/* Tattoo AR — capa de autenticación (Supabase) */
(function () {
  "use strict";
  var client = null;
  function sb() {
    if (!client && window.supabase && window.SUPABASE_URL) {
      client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    }
    return client;
  }
  var api = {
    client: sb,
    async session() { var c = sb(); if (!c) return null; var r = await c.auth.getSession(); return r.data ? r.data.session : null; },
    async profile() {
      var c = sb(); var s = await this.session(); if (!s) return null;
      var r = await c.from("profiles").select("*").eq("id", s.user.id).single();
      return r.data || { id: s.user.id, full_name: (s.user.user_metadata && s.user.user_metadata.full_name) || "", role: "artist", status: "pending", plan: "free" };
    },
    async signIn(email, password) { return sb().auth.signInWithPassword({ email: email, password: password }); },
    async signUp(email, password, meta) {
      meta = meta || {};
      var full = (meta.full_name || ((meta.first_name || "") + " " + (meta.last_name || ""))).trim();
      return sb().auth.signUp({ email: email, password: password, options: { data: {
        full_name: full, first_name: meta.first_name || "", last_name: meta.last_name || "",
        phone: meta.phone || "", phone_country: meta.phone_country || "", location: meta.location || "",
        studio_name: meta.studio_name || "", avatar_url: meta.avatar_url || ""
      } } });
    },
    async updateMyProfile(meta) {
      meta = meta || {};
      return sb().rpc("update_my_profile", {
        p_first: meta.first_name || "", p_last: meta.last_name || "",
        p_phone: meta.phone || "", p_phone_country: meta.phone_country || "",
        p_location: meta.location || "", p_studio: meta.studio_name || "", p_avatar: meta.avatar_url || ""
      });
    },
    async signOut() { try { await sb().auth.signOut(); } catch (e) {} },
    async requireAuth(redirect) {
      var s = await this.session();
      if (!s) { location.replace(redirect || "login.html"); return false; }
      return true;
    },
    async requireAdmin(redirect) {
      var p = await this.profile();
      if (!p || p.role !== "admin") { location.replace(redirect || "studio.html"); return false; }
      return true;
    },
    firstName(name) { return (name || "").trim().split(/\s+/)[0] || ""; }
  };
  window.taAuth = api;
})();
