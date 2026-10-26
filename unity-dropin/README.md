# Cross-game invites (drop-in for the Riot Race Unity project)

This folder is **not** part of the published web build. The Riot Race Unity
source isn't in this repository, so the feature is delivered as a self-contained
module to copy into the Unity project.

When a friend invites the player to another Grudge Match game (Lost Empires,
Silent Depths, ...), a small notice appears:

| State | Message | Buttons |
|---|---|---|
| `pending`, mid-race | "{from_name} invites you to {app_name}" (small top-right card) | Join now · After this game · No thanks |
| `pending`, menus | "{from_name} invites you to {app_name}" | Join · No thanks |
| `later`, mid-race | hidden | — |
| `later`, menus / race over | "{from_name} is waiting for you in {app_name}" | Join · No thanks |

Join → `gm_respond_invite(now)` then `Application.OpenURL(join_url)` (https only).
After this game → `later`. No thanks → `decline`. Invites whose `app` is
`riotrace` are ignored.

## Install

1. Copy `CrossGameInvites/` into the Unity project's `Assets/` (for example `Assets/GrudgeMatch/CrossGameInvites/`).
2. Implement `ICrossInviteHost` on the existing Supabase/auth code, handing over
   the project URL, anon key and **current** session access token (the same one
   used for `public.friends`), plus whether a race is in progress:

   ```csharp
   using GrudgeMatch.CrossInvites;

   class RiotRaceInviteHost : ICrossInviteHost
   {
       public string SupabaseUrl => GrudgeMatchAuth.SupabaseUrl;        // existing config
       public string AnonKey => GrudgeMatchAuth.AnonKey;
       public string AccessToken => GrudgeMatchAuth.Session?.AccessToken; // null when signed out
       public bool IsRacing => RaceManager.Instance != null && RaceManager.Instance.IsRaceRunning;
   }
   ```

3. After boot (once): `CrossInviteNotifier.Install(new RiotRaceInviteHost());`

The notifier polls `rpc/gm_my_invites` every 10 s only while signed in and the
app has focus (`OnApplicationPause`/`OnApplicationFocus`), polls right away when
a race ends, and never polls when signed out. No tables or functions are created.

## Layout

- `Runtime/Logic/` — `GrudgeMatch.CrossInvites.Logic` (no UnityEngine): row model and the pure decision logic.
- `Runtime/` — `GrudgeMatch.CrossInvites`: `ICrossInviteHost`, `CrossInviteNotifier` (poll + REST + IMGUI notice).
- `Tests/Editor/` — NUnit edit-mode tests for the decision logic (Unity Test Framework).
- `verify/check.sh` — compiles everything outside Unity with mono `mcs` (Unity APIs stubbed) and runs the tests.

## Still to test in the editor / on device

- Wiring `ICrossInviteHost` to the real auth session and race state (names above are placeholders).
- The IMGUI card's look, size and placement on phone, tablet and desktop. During a race it sits top-right; make sure it doesn't overlap touch controls or the HUD, or swap it for a uGUI prefab.
- `JsonUtility` parsing of real `gm_my_invites` rows (nullable columns).
- **WebGL:** `Application.OpenURL` runs after the RPC returns, outside the click event, so browsers may block the new tab. If they do, open the link from a `.jslib` on pointer-up, or open `invite.join_url` right when Join is pressed.
- Focus/pause behaviour on WebGL, iOS and Android.
- End to end: open https://lost-empires.onrender.com, sign in with a second Grudge Match account that is friends with the Riot Race account, create an online room and press **Invite friends**. Within about 10 s Riot Race should show the notice in the menu. Try Join, No thanks, and (mid-race) After this game, which should show again when the race ends.
