namespace GrudgeMatch.CrossInvites
{
    // Implemented by the game's existing Supabase/auth code so the notifier
    // reuses the current Grudge Match login instead of signing in itself.
    public interface ICrossInviteHost
    {
        // e.g. https://zhfkcjzajazsrpqeyaea.supabase.co
        string SupabaseUrl { get; }
        // The project's public anon key (already used for public.friends).
        string AnonKey { get; }
        // The signed-in user's current access token; null or empty when signed out.
        string AccessToken { get; }
        // True while the player is mid-race (driving), false in menus/results.
        bool IsRacing { get; }
    }
}
