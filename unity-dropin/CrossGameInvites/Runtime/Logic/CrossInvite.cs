using System;

namespace GrudgeMatch.CrossInvites
{
    // One row of public.gm_cross_invites as returned by rpc/gm_my_invites.
    // Field names match the JSON columns so JsonUtility can fill them.
    [Serializable]
    public class CrossInvite
    {
        public string id;
        public string app;
        public string app_name;
        public string game_ref;
        public string join_url;
        public string from_user;
        public string from_name;
        public string to_user;
        public string status;
        public string created_at;
        public string expires_at;
    }

    // JsonUtility cannot parse a top-level array; rows are wrapped as {"items": [...]}.
    [Serializable]
    public class CrossInviteList
    {
        public CrossInvite[] items;
    }
}
