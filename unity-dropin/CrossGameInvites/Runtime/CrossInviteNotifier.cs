using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace GrudgeMatch.CrossInvites
{
    // Polls rpc/gm_my_invites while signed in and in the foreground, and shows a
    // small notice for invites to other Grudge Match games.
    // Start it once after boot: CrossInviteNotifier.Install(myHost);
    public class CrossInviteNotifier : MonoBehaviour
    {
        static CrossInviteNotifier instance;

        ICrossInviteHost host;
        readonly List<CrossInvite> invites = new List<CrossInvite>();
        // Answered Now/Decline this session; hidden even if a poll still returns them.
        readonly HashSet<string> handled = new HashSet<string>();
        // Answered "After this game" locally; treated as 'later' until the server agrees.
        readonly HashSet<string> deferred = new HashSet<string>();
        float nextPollAt;
        bool pollInFlight;
        bool paused;
        bool wasRacing;
        bool signedIn;

        public static CrossInviteNotifier Install(ICrossInviteHost host)
        {
            if (instance == null)
            {
                var go = new GameObject("CrossInviteNotifier");
                DontDestroyOnLoad(go);
                instance = go.AddComponent<CrossInviteNotifier>();
            }
            instance.host = host;
            return instance;
        }

        void Update()
        {
            string token = host != null ? host.AccessToken : null;
            if (string.IsNullOrEmpty(token))
            {
                // Signed out: forget this user's invites (no polling until signed in again).
                if (signedIn)
                {
                    invites.Clear();
                    handled.Clear();
                    deferred.Clear();
                    signedIn = false;
                }
                return;
            }
            if (!signedIn)
            {
                signedIn = true;
                nextPollAt = 0f;
            }

            bool racing = host.IsRacing;
            if (wasRacing && !racing) nextPollAt = 0f; // refresh as the race ends
            wasRacing = racing;

            if (paused || pollInFlight || Time.unscaledTime < nextPollAt) return;
            nextPollAt = Time.unscaledTime + CrossInviteLogic.PollSeconds;
            StartCoroutine(Poll());
        }

        void OnApplicationPause(bool isPaused)
        {
            paused = isPaused;
            if (!isPaused) nextPollAt = 0f;
        }

        void OnApplicationFocus(bool hasFocus)
        {
            paused = !hasFocus;
            if (hasFocus) nextPollAt = 0f;
        }

        IEnumerator Poll()
        {
            pollInFlight = true;
            yield return Rpc("gm_my_invites", "{}", (ok, text) =>
            {
                if (!ok || !signedIn) return;
                CrossInviteList list;
                try { list = JsonUtility.FromJson<CrossInviteList>(CrossInviteLogic.WrapRows(text)); }
                catch (Exception e) { Debug.LogWarning("CrossInvites: bad invite list: " + e.Message); return; }

                invites.Clear();
                if (list != null && list.items != null)
                {
                    foreach (var invite in list.items)
                    {
                        if (invite == null) continue;
                        if (deferred.Contains(invite.id)) invite.status = CrossInviteLogic.StatusLater;
                        if (CrossInviteLogic.IsRelevant(invite)) invites.Add(invite);
                    }
                }
            });
            pollInFlight = false;
        }

        void Answer(CrossInvite invite, InviteButton button)
        {
            var choice = CrossInviteLogic.ChoiceFor(button);
            if (choice == InviteChoice.Later)
            {
                deferred.Add(invite.id);
                invite.status = CrossInviteLogic.StatusLater;
            }
            else
            {
                handled.Add(invite.id);
                invites.Remove(invite);
            }

            string fallbackUrl = invite.join_url;
            StartCoroutine(Rpc("gm_respond_invite", CrossInviteLogic.RespondBody(invite.id, choice), (ok, text) =>
            {
                if (!ok)
                {
                    Debug.LogWarning("CrossInvites: could not answer invite " + invite.id);
                    return;
                }
                if (choice != InviteChoice.Now) return;
                string url = CrossInviteLogic.ParseRpcText(text);
                if (!CrossInviteLogic.IsSafeJoinUrl(url)) url = fallbackUrl;
                if (CrossInviteLogic.IsSafeJoinUrl(url)) Application.OpenURL(url.Trim());
                else Debug.LogWarning("CrossInvites: refusing to open non-https join link");
            }));
        }

        IEnumerator Rpc(string function, string body, Action<bool, string> done)
        {
            string token = host != null ? host.AccessToken : null;
            if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(host.SupabaseUrl))
            {
                done(false, null);
                yield break;
            }

            string url = host.SupabaseUrl.TrimEnd('/') + "/rest/v1/rpc/" + function;
            using (var req = new UnityWebRequest(url, "POST"))
            {
                req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body));
                req.downloadHandler = new DownloadHandlerBuffer();
                req.SetRequestHeader("Content-Type", "application/json");
                req.SetRequestHeader("apikey", host.AnonKey);
                req.SetRequestHeader("Authorization", "Bearer " + token);
                req.timeout = 15;
                yield return req.SendWebRequest();

                bool ok = req.result == UnityWebRequest.Result.Success;
                if (!ok) Debug.LogWarning("CrossInvites: " + function + " failed (" + req.responseCode + "): " + req.error);
                done(ok, ok ? req.downloadHandler.text : null);
            }
        }

        // IMGUI keeps this free of prefabs/scene setup. During a race it is a
        // small top-right card; in menus a slightly larger card at the bottom.
        void OnGUI()
        {
            if (host == null || string.IsNullOrEmpty(host.AccessToken)) return;
            bool racing = host.IsRacing;
            var invite = CrossInviteLogic.PickNext(invites, racing, handled);
            var notice = CrossInviteLogic.Describe(invite, racing);
            if (notice == null) return;

            float scale = Mathf.Clamp(Mathf.Min(Screen.width, Screen.height) / 720f, 0.75f, 3f);
            float pad = 10f * scale;
            float width = (notice.Compact ? 300f : 420f) * scale;
            width = Mathf.Min(width, Screen.width - 2f * pad);
            float buttonH = (notice.Compact ? 30f : 40f) * scale;
            float textH = (notice.Compact ? 40f : 52f) * scale;
            float height = pad * 3f + textH + buttonH;
            float x = notice.Compact ? Screen.width - width - pad : (Screen.width - width) * 0.5f;
            float y = notice.Compact ? pad : Screen.height - height - pad * 2f;

            GUI.depth = -1000;
            var box = new Rect(x, y, width, height);
            GUI.Box(box, GUIContent.none);

            var textStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = Mathf.RoundToInt((notice.Compact ? 14f : 18f) * scale),
                wordWrap = true,
                alignment = TextAnchor.MiddleCenter,
            };
            GUI.Label(new Rect(x + pad, y + pad, width - 2f * pad, textH), notice.Message, textStyle);

            var buttonStyle = new GUIStyle(GUI.skin.button)
            {
                fontSize = Mathf.RoundToInt((notice.Compact ? 12f : 16f) * scale),
            };
            int count = notice.Buttons.Length;
            float gap = pad * 0.5f;
            float bw = (width - 2f * pad - gap * (count - 1)) / count;
            float by = y + pad * 2f + textH;
            for (int i = 0; i < count; i++)
            {
                var r = new Rect(x + pad + i * (bw + gap), by, bw, buttonH);
                if (GUI.Button(r, CrossInviteLogic.Label(notice.Buttons[i]), buttonStyle))
                {
                    Answer(invite, notice.Buttons[i]);
                    break;
                }
            }
        }
    }
}
