using System;
using System.Collections.Generic;
using System.Text;

namespace GrudgeMatch.CrossInvites
{
    public enum InviteChoice { Now, Later, Decline }

    public enum InviteButton { JoinNow, AfterThisGame, Join, NoThanks }

    // What the notice should show for one invite in the current game state.
    public sealed class InviteNotice
    {
        public string InviteId;
        public string Message;
        public InviteButton[] Buttons;
        // True during a race: small corner notice that never blocks driving.
        public bool Compact;
    }

    // Pure decision logic (no UnityEngine) so it can be unit-tested anywhere.
    public static class CrossInviteLogic
    {
        public const string OwnApp = "riotrace";
        public const float PollSeconds = 10f;
        public const string StatusPending = "pending";
        public const string StatusLater = "later";

        public static bool IsRelevant(CrossInvite invite)
        {
            if (invite == null || string.IsNullOrEmpty(invite.id)) return false;
            if (string.Equals((invite.app ?? "").Trim(), OwnApp, StringComparison.OrdinalIgnoreCase)) return false;
            return invite.status == StatusPending || invite.status == StatusLater;
        }

        // Returns null when nothing should be shown right now.
        // "later" invites wait until the race is over.
        public static InviteNotice Describe(CrossInvite invite, bool racing)
        {
            if (!IsRelevant(invite)) return null;
            string from = string.IsNullOrEmpty(invite.from_name) ? "A friend" : invite.from_name;
            string appName = string.IsNullOrEmpty(invite.app_name) ? invite.app : invite.app_name;

            if (invite.status == StatusLater)
            {
                if (racing) return null;
                return new InviteNotice
                {
                    InviteId = invite.id,
                    Message = from + " is waiting for you in " + appName,
                    Buttons = new[] { InviteButton.Join, InviteButton.NoThanks },
                    Compact = false,
                };
            }

            return new InviteNotice
            {
                InviteId = invite.id,
                Message = from + " invites you to " + appName,
                Buttons = racing
                    ? new[] { InviteButton.JoinNow, InviteButton.AfterThisGame, InviteButton.NoThanks }
                    : new[] { InviteButton.Join, InviteButton.NoThanks },
                Compact = racing,
            };
        }

        // First invite that has something to show, skipping ones answered this session.
        public static CrossInvite PickNext(IList<CrossInvite> invites, bool racing, ICollection<string> handled)
        {
            if (invites == null) return null;
            foreach (var invite in invites)
            {
                if (invite == null || (handled != null && handled.Contains(invite.id))) continue;
                if (Describe(invite, racing) != null) return invite;
            }
            return null;
        }

        public static InviteChoice ChoiceFor(InviteButton button)
        {
            switch (button)
            {
                case InviteButton.AfterThisGame: return InviteChoice.Later;
                case InviteButton.NoThanks: return InviteChoice.Decline;
                default: return InviteChoice.Now;
            }
        }

        public static string ToWire(InviteChoice choice)
        {
            switch (choice)
            {
                case InviteChoice.Later: return "later";
                case InviteChoice.Decline: return "decline";
                default: return "now";
            }
        }

        public static string Label(InviteButton button)
        {
            switch (button)
            {
                case InviteButton.JoinNow: return "Join now";
                case InviteButton.AfterThisGame: return "After this game";
                case InviteButton.Join: return "Join";
                default: return "No thanks";
            }
        }

        // Only absolute https links are ever opened.
        public static bool IsSafeJoinUrl(string url)
        {
            if (string.IsNullOrEmpty(url)) return false;
            Uri uri;
            return Uri.TryCreate(url.Trim(), UriKind.Absolute, out uri)
                && uri.Scheme == Uri.UriSchemeHttps
                && !string.IsNullOrEmpty(uri.Host);
        }

        public static string RespondBody(string inviteId, InviteChoice choice)
        {
            return "{\"p_invite\":\"" + Escape(inviteId) + "\",\"p_choice\":\"" + ToWire(choice)
                + "\",\"p_from_app\":\"" + OwnApp + "\"}";
        }

        public static string WrapRows(string jsonArray)
        {
            string body = string.IsNullOrEmpty(jsonArray) ? "" : jsonArray.Trim();
            if (body.Length == 0 || body[0] != '[') body = "[]";
            return "{\"items\":" + body + "}";
        }

        // An RPC returning text comes back as a JSON string ("\"https://...\"") or null.
        public static string ParseRpcText(string body)
        {
            if (body == null) return null;
            string s = body.Trim();
            if (s.Length == 0 || s == "null") return null;
            if (s.Length < 2 || s[0] != '"' || s[s.Length - 1] != '"') return s;

            var sb = new StringBuilder(s.Length);
            for (int i = 1; i < s.Length - 1; i++)
            {
                char c = s[i];
                if (c != '\\' || i + 1 >= s.Length - 1) { sb.Append(c); continue; }
                char n = s[++i];
                switch (n)
                {
                    case 'n': sb.Append('\n'); break;
                    case 't': sb.Append('\t'); break;
                    case 'r': sb.Append('\r'); break;
                    case 'u':
                        if (i + 4 < s.Length - 1)
                        {
                            sb.Append((char)Convert.ToInt32(s.Substring(i + 1, 4), 16));
                            i += 4;
                        }
                        break;
                    default: sb.Append(n); break; // \" \\ \/
                }
            }
            return sb.ToString();
        }

        static string Escape(string s)
        {
            return (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"");
        }
    }
}
