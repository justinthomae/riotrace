// Grudge Match admin: edits the Riot Race rows in the shared Supabase project (rr_content, rr_assets, rr_grants,
// rr_bans, rr_admin_log and the riotrace file bucket). Row-level security only lets admins write; this page is just
// a front end for those tables. The game picks changes up at its menus within about two minutes.
"use strict";

const SUPABASE_URL = "https://zhfkcjzajazsrpqeyaea.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZmtjanphamF6c3JwcWV5YWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjEyNzgsImV4cCI6MjA5NTM5NzI3OH0.hWqpo8HcGwaZGDa1tMvcpeShItQSDFYEl8cREfK_2EY";
const BUCKET = "riotrace";

const sb = supabase.createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const state = {
  user: null,
  manifest: null,      // builtin/manifest.json, written by Tools/publish_pages.py
  builtin: {},         // key -> parsed built-in document
  live: {},            // key -> rr_content row
  assets: {},          // key -> rr_assets row
  loaded: {},
};

// ------------------------------------------------------------------ helpers

function toast(text, bad) {
  const t = $("#toast");
  t.textContent = text;
  t.style.borderColor = bad ? "var(--bad)" : "var(--accent)";
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), bad ? 6000 : 2500);
}

function fail(error, what) {
  if (!error) return false;
  console.error(what, error);
  toast((what ? what + ": " : "") + (error.message || error), true);
  return true;
}

/** The game's content files are JSON with // and /* comments. */
function stripComments(text) {
  let out = "", i = 0, inString = false;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (inString) {
      out += c;
      if (c === "\\") { out += n ?? ""; i += 2; continue; }
      if (c === '"') inString = false;
      i++;
    } else if (c === '"') { inString = true; out += c; i++; }
    else if (c === "/" && n === "/") { while (i < text.length && text[i] !== "\n") i++; }
    else if (c === "/" && n === "*") { i += 2; while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++; i += 2; }
    else { out += c; i++; }
  }
  return out.replace(/,(\s*[\]}])/g, "$1");
}

function publicUrl(path, version) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(path)}?v=${version || 1}`;
}

async function log(action, detail) {
  await sb.from("rr_admin_log").insert({ action, detail: detail || {}, admin: state.user.id });
}

function current(key) {
  const row = state.live[key];
  return row ? row.value : state.builtin[key];
}

async function saveDoc(key, value, action) {
  const { error } = await sb.from("rr_content").upsert({ key, value, enabled: true, updated_at: new Date().toISOString(), updated_by: state.user.id });
  if (fail(error, "Save failed")) return false;
  await log(action || "content.save", { key });
  await loadLive();
  toast(`Saved ${key}. Players get it within two minutes.`);
  return true;
}

async function revertDoc(key) {
  if (!confirm(`Remove the live version of "${key}"? Players go back to the version built into the game.`)) return false;
  const { error } = await sb.from("rr_content").delete().eq("key", key);
  if (fail(error, "Revert failed")) return false;
  await log("content.revert", { key });
  await loadLive();
  toast(`${key} reverted to the built-in version.`);
  return true;
}

async function loadLive() {
  const { data, error } = await sb.from("rr_content").select("key,value,enabled,updated_at");
  if (fail(error, "Couldn't load content")) return;
  state.live = Object.fromEntries(data.map(r => [r.key, r]));
}

async function loadAssets() {
  const { data, error } = await sb.from("rr_assets").select("*");
  if (fail(error, "Couldn't load assets")) return;
  state.assets = Object.fromEntries(data.map(r => [r.key, r]));
}

function docTag(key) {
  const row = state.live[key];
  if (!row) return state.builtin[key] ? `<span class="tag">built-in</span>` : "";
  return row.enabled ? `<span class="tag live">live edit</span>` : `<span class="tag off">disabled</span>`;
}

// ------------------------------------------------------------------ sign-in

async function start() {
  $("#signin-form").addEventListener("submit", async e => {
    e.preventDefault();
    $("#signin-msg").textContent = "Signing in…";
    const { error } = await sb.auth.signInWithPassword({ email: $("#email").value.trim(), password: $("#password").value });
    $("#signin-msg").textContent = error ? error.message : "";
  });
  for (const p of ["google", "facebook"]) {
    $("#" + p).addEventListener("click", () => sb.auth.signInWithOAuth({ provider: p, options: { redirectTo: location.origin + location.pathname } }));
  }
  $("#signout2").addEventListener("click", () => sb.auth.signOut());
  document.querySelectorAll("#tabs button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
  sb.auth.onAuthStateChange((_event, session) => setTimeout(() => onSession(session), 0));
  const { data } = await sb.auth.getSession();
  onSession(data.session);
}

let sessionUser = undefined;
async function onSession(session) {
  const user = session ? session.user : null;
  if ((user && user.id) === (sessionUser && sessionUser.id)) return;
  sessionUser = user;
  state.user = user;
  for (const id of ["signin", "denied", "app", "tabs"]) $("#" + id).hidden = true;
  $("#who").innerHTML = "";
  if (!user) { $("#signin").hidden = false; return; }
  $("#who").innerHTML = `${esc(user.email)} <button id="signout">Sign out</button>`;
  $("#signout").addEventListener("click", () => sb.auth.signOut());
  const { data: isAdmin, error } = await sb.rpc("rr_is_admin");
  if (error || !isAdmin) { $("#denied").hidden = false; return; }
  $("#app").hidden = false;
  $("#tabs").hidden = false;
  await loadBuiltin();
  await Promise.all([loadLive(), loadAssets()]);
  showTab(localStorage.getItem("gm.admin.tab") || "content");
}

async function loadBuiltin() {
  if (state.manifest) return;
  const res = await fetch("builtin/manifest.json", { cache: "no-cache" });
  state.manifest = res.ok ? await res.json() : { content: [], images: [], sounds: [] };
  await Promise.all(state.manifest.content.map(async key => {
    try {
      const r = await fetch(`builtin/content/${key}.json`, { cache: "no-cache" });
      state.builtin[key] = JSON.parse(stripComments(await r.text()));
    } catch (e) { console.warn("built-in", key, e); }
  }));
}

function showTab(tab) {
  try { localStorage.setItem("gm.admin.tab", tab); } catch (e) { /* private mode */ }
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  document.querySelectorAll("[data-panel]").forEach(p => p.hidden = p.dataset.panel !== tab);
  const panel = $(`[data-panel="${tab}"]`);
  ({ content: renderContent, economy: renderEconomy, maps: renderMaps, characters: renderCharacters, assets: renderAssets, players: renderPlayers, log: renderLog })[tab](panel);
}

// ------------------------------------------------------------------ content (raw JSON documents)

let contentKey = null;
function renderContent(panel) {
  const keys = [...new Set([...Object.keys(state.builtin), ...Object.keys(state.live)])].sort();
  if (!contentKey || !keys.includes(contentKey)) contentKey = keys[0];
  panel.innerHTML = `
    <div class="card">
      <h2>Game content</h2>
      <p class="muted">Every game document: cars, weapons, cosmetics, cups, unlock prices, achievements, tracks. Saving makes a
        live version that replaces the built-in one for every player. The game checks it first: if it doesn't load, players keep the old version.</p>
      <div class="split">
        <div class="list">${keys.map(k => `<button data-key="${esc(k)}" class="${k === contentKey ? "on" : ""}">${esc(k)} ${docTag(k)}</button>`).join("")}</div>
        <div>
          <div class="row"><strong>${esc(contentKey)}</strong> ${docTag(contentKey)}</div>
          <textarea id="doc" spellcheck="false"></textarea>
          <div class="row">
            <button class="primary" id="doc-save">Save live</button>
            <button id="doc-format">Format</button>
            ${state.live[contentKey] ? `<button id="doc-toggle">${state.live[contentKey].enabled ? "Disable live version" : "Enable live version"}</button>
              <button class="danger" id="doc-revert">Revert to built-in</button>` : ""}
            <span class="msg" id="doc-msg"></span>
          </div>
        </div>
      </div>
    </div>`;
  panel.querySelectorAll(".list button").forEach(b => b.addEventListener("click", () => { contentKey = b.dataset.key; renderContent(panel); }));
  const area = $("#doc", panel);
  area.value = JSON.stringify(current(contentKey) ?? {}, null, 2);
  $("#doc-format", panel).addEventListener("click", () => {
    try { area.value = JSON.stringify(JSON.parse(area.value), null, 2); $("#doc-msg").textContent = ""; }
    catch (e) { $("#doc-msg").textContent = "Not valid JSON: " + e.message; }
  });
  $("#doc-save", panel).addEventListener("click", async () => {
    let value;
    try { value = JSON.parse(area.value); } catch (e) { $("#doc-msg").textContent = "Not valid JSON: " + e.message; return; }
    if (!value || typeof value !== "object" || Array.isArray(value)) { $("#doc-msg").textContent = "The document must be a JSON object."; return; }
    if (await saveDoc(contentKey, value)) renderContent(panel);
  });
  const toggle = $("#doc-toggle", panel);
  if (toggle) toggle.addEventListener("click", async () => {
    const enabled = !state.live[contentKey].enabled;
    const { error } = await sb.from("rr_content").update({ enabled }).eq("key", contentKey);
    if (fail(error)) return;
    await log(enabled ? "content.enable" : "content.disable", { key: contentKey });
    await loadLive();
    renderContent(panel);
  });
  const revert = $("#doc-revert", panel);
  if (revert) revert.addEventListener("click", async () => { if (await revertDoc(contentKey)) renderContent(panel); });
}

// ------------------------------------------------------------------ economy (form over the economy document)

const ECON_HELP = {
  startingCredits: "Credits a new player starts with", maxLevel: "Level cap",
  positionCredits: "Credits for 1st, 2nd, 3rd… (comma separated)", smallFieldScale: "Payout scale with few racers",
  finishCredits: "Credits for finishing", creditsPerKill: "Credits per wreck", creditsPerAssist: "Credits per assist",
  combatCreditsCap: "Most combat credits per race", xpBase: "XP for any race", xpPerPlaceAhead: "XP per racer beaten",
  xpFinishBonus: "XP for finishing", xpPerKill: "XP per wreck", xpKillCap: "Most wreck XP per race",
  timeTrialCredits: "Time trial credits", timeTrialXp: "Time trial XP", timeTrialXpUnfinished: "Time trial XP, unfinished",
  xpToNextBase: "XP to reach level 2", xpToNextPerLevel: "Extra XP needed per level",
};

function renderEconomy(panel) {
  const doc = current("economy") || { contentVersion: 1, economy: {} };
  const econ = doc.economy || {};
  const base = (state.builtin.economy || {}).economy || {};
  const fields = [...new Set([...Object.keys(base), ...Object.keys(econ)])];
  panel.innerHTML = `
    <div class="card">
      <h2>Economy</h2>
      <p class="muted">Race payouts, XP and levels. Prices of cars, tracks and parts are in the <em>unlocks</em> and
        <em>cosmetics</em> documents (Content tab). ${docTag("economy")}</p>
      <div class="econ">${fields.map(f => {
        const v = econ[f] ?? base[f];
        const val = Array.isArray(v) ? v.join(", ") : v;
        return `<label>${esc(ECON_HELP[f] || f)} <span class="muted">(${esc(f)}; built-in ${esc(Array.isArray(base[f]) ? base[f].join(", ") : base[f])})</span>
          <input data-f="${esc(f)}" data-array="${Array.isArray(v)}" value="${esc(val)}"></label>`;
      }).join("")}</div>
      <div class="row"><button class="primary" id="econ-save">Save live</button>
        ${state.live.economy ? `<button class="danger" id="econ-revert">Revert to built-in</button>` : ""}<span class="msg" id="econ-msg"></span></div>
    </div>
    <div class="card"><h3>Payout preview (8 racers, 2 wrecks, finished)</h3><div id="econ-preview" class="muted"></div></div>`;
  const read = () => {
    const out = {};
    for (const input of panel.querySelectorAll("[data-f]")) {
      const f = input.dataset.f;
      if (input.dataset.array === "true") out[f] = input.value.split(",").map(s => Number(s.trim())).filter(n => !isNaN(n));
      else out[f] = Number(input.value);
      if (!Array.isArray(out[f]) && isNaN(out[f])) throw new Error(`${f} must be a number`);
    }
    return out;
  };
  const preview = () => {
    try {
      const e = read();
      $("#econ-preview").innerHTML = (e.positionCredits || []).map((c, i) =>
        `${i + 1}${["st", "nd", "rd"][i] || "th"}: <strong>${(c + (e.finishCredits || 0) + Math.min(2 * (e.creditsPerKill || 0), e.combatCreditsCap || 0)).toLocaleString()} cr</strong>`).join(" · ");
    } catch (err) { $("#econ-preview").textContent = err.message; }
  };
  panel.querySelectorAll("[data-f]").forEach(i => i.addEventListener("input", preview));
  preview();
  $("#econ-save").addEventListener("click", async () => {
    let e;
    try { e = read(); } catch (err) { $("#econ-msg").textContent = err.message; return; }
    if (await saveDoc("economy", { contentVersion: doc.contentVersion || 1, economy: e }, "economy.save")) renderEconomy(panel);
  });
  const rv = $("#econ-revert");
  if (rv) rv.addEventListener("click", async () => { if (await revertDoc("economy")) renderEconomy(panel); });
}

// ------------------------------------------------------------------ maps

let mapKey = null;
function trackKeys() {
  return [...new Set([...Object.keys(state.builtin), ...Object.keys(state.live)])].filter(k => k.startsWith("track_")).sort();
}

function renderMaps(panel) {
  const keys = trackKeys();
  if (!mapKey || !keys.includes(mapKey)) mapKey = keys[0];
  const doc = current(mapKey) || { tracks: [] };
  const track = (doc.tracks || [])[0] || {};
  const art = imageFor(`Tracks/${track.id}`);
  panel.innerHTML = `
    <div class="card">
      <h2>Maps</h2>
      <p class="muted">Each track is one document. Points are <code>[x, y, halfWidth, runoff, height]</code> in metres;
        the plan is coloured by height (blue low, orange high). The track card picture shows on cup cards and Quick Race.</p>
      <div class="split">
        <div class="list">${keys.map(k => `<button data-key="${esc(k)}" class="${k === mapKey ? "on" : ""}">${esc(((current(k) || {}).tracks || [{}])[0].name || k)} ${docTag(k)}</button>`).join("")}
          <button id="map-new">+ New track (copy of this one)</button></div>
        <div>
          <div class="row"><strong>${esc(track.name)}</strong> <span class="muted">${esc(track.theme)} · ${esc(track.laps)} laps</span> ${docTag(mapKey)}</div>
          <div class="row" style="align-items:flex-start">
            <canvas class="plan" id="plan" width="900" height="900"></canvas>
            <div class="slot" style="width:240px">
              <div class="thumb" style="background-image:url('${esc(art.url)}')"></div>
              <div class="key">Tracks/${esc(track.id)} ${art.live ? '<span class="tag live">uploaded</span>' : ""}</div>
              <input type="file" accept="image/png,image/jpeg,image/webp" id="map-art">
              <span class="muted">1280×720 JPEG works best.</span>
            </div>
          </div>
          <textarea id="map-doc" spellcheck="false"></textarea>
          <div class="row"><button class="primary" id="map-save">Save live</button><button id="map-preview">Preview edits</button>
            ${state.live[mapKey] ? `<button class="danger" id="map-revert">Revert to built-in</button>` : ""}<span class="msg" id="map-msg"></span></div>
        </div>
      </div>
    </div>`;
  panel.querySelectorAll(".list button[data-key]").forEach(b => b.addEventListener("click", () => { mapKey = b.dataset.key; renderMaps(panel); }));
  const area = $("#map-doc", panel);
  area.value = JSON.stringify(doc, null, 2);
  drawPlan($("#plan", panel), track);
  const parse = () => {
    try {
      const v = JSON.parse(area.value);
      if (!v.tracks || !v.tracks[0] || !Array.isArray(v.tracks[0].points)) throw new Error('needs "tracks": [ { "points": [...] } ]');
      $("#map-msg").textContent = "";
      return v;
    } catch (e) { $("#map-msg").textContent = "Not valid: " + e.message; return null; }
  };
  $("#map-preview").addEventListener("click", () => { const v = parse(); if (v) drawPlan($("#plan", panel), v.tracks[0]); });
  $("#map-save").addEventListener("click", async () => { const v = parse(); if (v && await saveDoc(mapKey, v, "map.save")) renderMaps(panel); });
  const rv = $("#map-revert");
  if (rv) rv.addEventListener("click", async () => { if (await revertDoc(mapKey)) renderMaps(panel); });
  $("#map-art").addEventListener("change", async e => { if (await uploadAsset(`Tracks/${track.id}`, e.target.files[0], "image")) renderMaps(panel); });
  $("#map-new").addEventListener("click", async () => {
    const name = prompt("Name of the new track?");
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    if (!id || keys.includes("track_" + id)) { toast("That track already exists.", true); return; }
    const copy = JSON.parse(JSON.stringify(doc));
    Object.assign(copy.tracks[0], { id, name });
    if (await saveDoc("track_" + id, copy, "map.create")) { mapKey = "track_" + id; renderMaps(panel); }
  });
}

function drawPlan(canvas, track) {
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, canvas.width, canvas.height);
  const pts = track.points || [];
  if (pts.length < 2) return;
  const all = pts.concat(...(track.shortcuts || []).map(s => s.points || []));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minH = Infinity, maxH = -Infinity;
  for (const p of all) {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    minH = Math.min(minH, p[4] || 0); maxH = Math.max(maxH, p[4] || 0);
  }
  const pad = 50, scale = Math.min((canvas.width - 2 * pad) / (maxX - minX || 1), (canvas.height - 2 * pad) / (maxY - minY || 1));
  const X = p => pad + (p[0] - minX) * scale + ((canvas.width - 2 * pad) - (maxX - minX) * scale) / 2;
  const Y = p => canvas.height - pad - (p[1] - minY) * scale - ((canvas.height - 2 * pad) - (maxY - minY) * scale) / 2;
  const colour = h => {
    const t = maxH > minH ? (h - minH) / (maxH - minH) : 0;
    return `hsl(${210 - 180 * t}, 85%, ${50 + 8 * t}%)`;
  };
  const road = (points, closed, width) => {
    g.lineCap = "round";
    const n = closed ? points.length : points.length - 1;
    for (let i = 0; i < n; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      g.strokeStyle = "#000"; g.lineWidth = Math.max(4, 2 * (a[2] || width) * scale) + 4;
      g.beginPath(); g.moveTo(X(a), Y(a)); g.lineTo(X(b), Y(b)); g.stroke();
    }
    for (let i = 0; i < n; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      g.strokeStyle = colour(((a[4] || 0) + (b[4] || 0)) / 2); g.lineWidth = Math.max(3, 2 * (a[2] || width) * scale);
      g.beginPath(); g.moveTo(X(a), Y(a)); g.lineTo(X(b), Y(b)); g.stroke();
    }
  };
  for (const s of track.shortcuts || []) { g.globalAlpha = 0.75; road(s.points || [], false, s.halfWidth || 5); }
  g.globalAlpha = 1;
  road(pts, true, track.halfWidth || 9);
  g.fillStyle = "#fff"; g.strokeStyle = "#000"; g.lineWidth = 3;
  g.beginPath(); g.arc(X(pts[0]), Y(pts[0]), 10, 0, Math.PI * 2); g.fill(); g.stroke();
  g.font = "bold 26px system-ui"; g.fillStyle = "#fff";
  g.fillText(`START · height ${minH}–${maxH} m · ${pts.length} points`, 20, 34);
}

// ------------------------------------------------------------------ characters

function renderCharacters(panel) {
  const doc = JSON.parse(JSON.stringify(current("characters") || { contentVersion: 1, characters: [] }));
  const list = doc.characters || [];
  const fields = ["name", "animal", "color", "paint", "accent", "tagline"];
  panel.innerHTML = `
    <div class="card">
      <h2>Characters</h2>
      <p class="muted">The racers players pick. The full-body picture and face icon can be replaced here (PNG with transparency). ${docTag("characters")}</p>
      ${list.map((c, i) => {
        const body = imageFor(`Characters/${c.id}`), head = imageFor(`Characters/${c.id}_head`);
        return `<div class="charcard" data-i="${i}">
          <div><img src="${esc(body.url)}" alt=""><img src="${esc(head.url)}" alt="" style="width:44px;height:44px;margin-top:6px"></div>
          <div>
            <div class="row"><strong>${esc(c.id)}</strong></div>
            <div class="row">${fields.map(f => `<label>${f}<input data-f="${f}" value="${esc(c[f])}"></label>`).join("")}</div>
            <div class="row"><label>Body picture <input type="file" accept="image/png,image/webp" data-art="Characters/${esc(c.id)}"></label>
              <label>Face icon <input type="file" accept="image/png,image/webp" data-art="Characters/${esc(c.id)}_head"></label></div>
          </div></div>`;
      }).join("")}
      <div class="row"><button id="char-add">+ Add character</button><button class="primary" id="char-save">Save live</button>
        ${state.live.characters ? `<button class="danger" id="char-revert">Revert to built-in</button>` : ""}</div>
    </div>`;
  const collect = () => {
    panel.querySelectorAll(".charcard").forEach(card => {
      const c = list[+card.dataset.i];
      card.querySelectorAll("[data-f]").forEach(input => { c[input.dataset.f] = input.value; });
    });
  };
  panel.querySelectorAll("[data-art]").forEach(input => input.addEventListener("change", async e => {
    collect();
    if (await uploadAsset(input.dataset.art, e.target.files[0], "image")) renderCharacters(panel);
  }));
  $("#char-add").addEventListener("click", async () => {
    const name = prompt("Racer name?");
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!id || list.some(c => c.id === id)) { toast("That id is taken.", true); return; }
    collect();
    list.push(Object.assign({}, list[0] || {}, { id, name, tagline: "" }));
    if (await saveDoc("characters", doc, "character.create")) renderCharacters(panel);
  });
  $("#char-save").addEventListener("click", async () => { collect(); if (await saveDoc("characters", doc, "characters.save")) renderCharacters(panel); });
  const rv = $("#char-revert");
  if (rv) rv.addEventListener("click", async () => { if (await revertDoc("characters")) renderCharacters(panel); });
}

// ------------------------------------------------------------------ art & sound

function imageFor(key) {
  const row = state.assets[key];
  if (row) return { url: publicUrl(row.path, row.version), live: true };
  const built = (state.manifest.images || []).find(i => i.key === key);
  return { url: built ? `builtin/${built.file}` : "", live: false, size: built && built.size };
}

async function uploadAsset(key, file, kind) {
  if (!file) return false;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (kind === "image" && !["png", "jpg", "jpeg", "webp"].includes(ext)) { toast("Pictures must be PNG, JPEG or WebP.", true); return false; }
  if (kind === "audio" && !["mp3", "wav", "ogg"].includes(ext)) { toast("Sounds must be MP3, WAV or OGG.", true); return false; }
  toast(`Uploading ${file.name}…`);
  const path = `${key}-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false, cacheControl: "31536000" });
  if (fail(error, "Upload failed")) return false;
  const old = state.assets[key];
  const { error: rowError } = await sb.from("rr_assets").upsert({ key, path, kind, version: (old ? old.version : 0) + 1, updated_at: new Date().toISOString(), updated_by: state.user.id });
  if (fail(rowError, "Couldn't save")) return false;
  if (old && old.path !== path) await sb.storage.from(BUCKET).remove([old.path]);
  await log("asset.upload", { key, path });
  await loadAssets();
  toast(`${key} replaced. Players see it within two minutes.`);
  return true;
}

async function resetAsset(key) {
  const old = state.assets[key];
  if (!old || !confirm(`Go back to the built-in ${key}?`)) return false;
  const { error } = await sb.from("rr_assets").delete().eq("key", key);
  if (fail(error)) return false;
  await sb.storage.from(BUCKET).remove([old.path]);
  await log("asset.reset", { key });
  await loadAssets();
  return true;
}

let assetFilter = "Branding";
function renderAssets(panel) {
  const m = state.manifest;
  const groups = [...new Set(m.images.map(i => i.key.split("/")[0])), "Audio/Sfx", "Audio/Ui", "Audio/Music"];
  const slots = assetFilter.startsWith("Audio")
    ? m.sounds.filter(k => k.startsWith(assetFilter + "/")).map(k => ({ key: k, kind: "audio" }))
    : m.images.filter(i => i.key.split("/")[0] === assetFilter).map(i => ({ key: i.key, kind: "image", size: i.size }));
  panel.innerHTML = `
    <div class="card">
      <h2>Art &amp; sound</h2>
      <p class="muted">Replace any picture or sound in the game. Logo and key art are in Branding; button, pad and icon art in UI.
        Keep pictures the same shape as the built-in ones (size shown). Sounds with no built-in file (music) just start playing.</p>
      <div class="row">${groups.map(gr => `<button data-g="${gr}" class="${gr === assetFilter ? "primary" : ""}">${gr.replace("Audio/", "Sound: ")}</button>`).join("")}</div>
      <div class="grid">${slots.map(s => {
        const row = state.assets[s.key];
        if (s.kind === "image") {
          const img = imageFor(s.key);
          return `<div class="slot"><div class="thumb" style="background-image:url('${esc(img.url)}')"></div>
            <div class="key">${esc(s.key)} ${row ? '<span class="tag live">uploaded</span>' : ""}</div>
            <span class="muted">${s.size ? esc(s.size) + " px" : ""}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" data-up="${esc(s.key)}" data-kind="image">
            ${row ? `<button class="danger" data-reset="${esc(s.key)}">Use built-in</button>` : ""}</div>`;
        }
        return `<div class="slot"><div class="key">${esc(s.key)} ${row ? '<span class="tag live">uploaded</span>' : '<span class="tag">built-in</span>'}</div>
          ${row ? `<audio controls preload="none" src="${esc(publicUrl(row.path, row.version))}"></audio>` : ""}
          <input type="file" accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg" data-up="${esc(s.key)}" data-kind="audio">
          ${row ? `<button class="danger" data-reset="${esc(s.key)}">Use built-in</button>` : ""}</div>`;
      }).join("")}</div>
    </div>`;
  panel.querySelectorAll("[data-g]").forEach(b => b.addEventListener("click", () => { assetFilter = b.dataset.g; renderAssets(panel); }));
  panel.querySelectorAll("[data-up]").forEach(i => i.addEventListener("change", async e => {
    if (await uploadAsset(i.dataset.up, e.target.files[0], i.dataset.kind)) renderAssets(panel);
  }));
  panel.querySelectorAll("[data-reset]").forEach(b => b.addEventListener("click", async () => { if (await resetAsset(b.dataset.reset)) renderAssets(panel); }));
}

// ------------------------------------------------------------------ players

function parseSave(text) {
  try {
    const env = JSON.parse(text);
    return JSON.parse(env.data || "{}");
  } catch (e) { return {}; }
}

async function renderPlayers(panel) {
  panel.innerHTML = `<div class="card"><h2>Players</h2><p class="muted">Loading…</p></div>`;
  const [players, saves, bans, grants] = await Promise.all([
    sb.from("rr_players").select("user_id,name,avatar,status,updated_at").order("updated_at", { ascending: false }).limit(500),
    sb.from("rr_saves").select("user_id,profile,saved_at").limit(1000),
    sb.from("rr_bans").select("*"),
    sb.from("rr_grants").select("*").order("created_at", { ascending: false }).limit(200),
  ]);
  for (const r of [players, saves, bans, grants]) if (fail(r.error, "Couldn't load players")) return;
  const save = Object.fromEntries(saves.data.map(s => [s.user_id, parseSave(s.profile)]));
  const ban = Object.fromEntries(bans.data.map(b => [b.user_id, b]));
  const names = Object.fromEntries(players.data.map(p => [p.user_id, p.name]));
  const rows = players.data.slice();
  for (const id of Object.keys(save)) if (!names[id]) rows.push({ user_id: id, name: save[id].name || "(no profile)", status: "" });
  const banned = b => b && (!b.until || new Date(b.until) > new Date());
  panel.innerHTML = `
    <div class="card">
      <h2>Players</h2>
      <div class="row"><label>Search <input id="p-search" placeholder="Name or id"></label></div>
      <table><thead><tr><th></th><th>Racer</th><th>Level</th><th>Credits</th><th>Last seen</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows.map(p => {
        const s = save[p.user_id] || {}, b = ban[p.user_id];
        return `<tr data-id="${esc(p.user_id)}" data-search="${esc((p.name + " " + p.user_id).toLowerCase())}">
          <td>${p.avatar && /^https?:/.test(p.avatar) ? `<img class="av" src="${esc(p.avatar)}" alt="">` : ""}</td>
          <td><strong>${esc(p.name)}</strong><br><span class="muted key">${esc(p.user_id)}</span></td>
          <td>${esc(s.level ?? "")}</td><td>${s.credits != null ? Number(s.credits).toLocaleString() : ""}</td>
          <td>${p.updated_at ? new Date(p.updated_at).toLocaleString() : ""}</td>
          <td>${banned(b) ? `<span class="tag off">banned${b.until ? " until " + new Date(b.until).toLocaleDateString() : ""}</span>` : esc(p.status || "")}</td>
          <td class="row"><button data-gift>Gift</button>${banned(b) ? `<button data-unban>Unban</button>` : `<button class="danger" data-ban>Ban</button>`}</td></tr>`;
      }).join("")}</tbody></table>
    </div>
    <div class="card"><h3>Recent gifts</h3>
      <table><thead><tr><th>Player</th><th>Credits</th><th>XP</th><th>Note</th><th>Sent</th><th>Collected</th><th></th></tr></thead><tbody>
      ${grants.data.map(g => `<tr><td>${esc(names[g.user_id] || g.user_id)}</td><td>${g.credits}</td><td>${g.xp}</td><td>${esc(g.note)}</td>
        <td>${new Date(g.created_at).toLocaleString()}</td><td>${g.claimed_at ? new Date(g.claimed_at).toLocaleString() : "waiting"}</td>
        <td>${g.claimed_at ? "" : `<button class="danger" data-cancel="${esc(g.id)}">Cancel</button>`}</td></tr>`).join("")}
      </tbody></table></div>`;
  $("#p-search").addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    panel.querySelectorAll("tbody tr[data-search]").forEach(tr => tr.hidden = q && !tr.dataset.search.includes(q));
  });
  panel.querySelectorAll("tr[data-id]").forEach(tr => {
    const id = tr.dataset.id, who = names[id] || id;
    const gift = $("[data-gift]", tr), banBtn = $("[data-ban]", tr), unban = $("[data-unban]", tr);
    gift.addEventListener("click", async () => {
      const credits = parseInt(prompt(`Credits to give ${who}? (negative takes credits away)`, "1000") || "0", 10) || 0;
      const xp = Math.max(0, parseInt(prompt("XP to give?", "0") || "0", 10) || 0);
      if (!credits && !xp) return;
      const note = (prompt("Message shown to the player (optional)", "Thanks for racing!") || "").slice(0, 200);
      const { error } = await sb.from("rr_grants").insert({ user_id: id, credits, xp, note, created_by: state.user.id });
      if (fail(error, "Gift failed")) return;
      await log("player.gift", { user_id: id, credits, xp });
      toast(`Gift sent. ${who} collects it next time they're at the main menu.`);
      renderPlayers(panel);
    });
    if (banBtn) banBtn.addEventListener("click", async () => {
      const reason = prompt(`Ban ${who} from online play and leaderboards. Reason?`);
      if (reason === null) return;
      const days = prompt("For how many days? (leave empty for no end date)", "7");
      if (days === null) return;
      const until = days.trim() ? new Date(Date.now() + parseFloat(days) * 86400000).toISOString() : null;
      const { error } = await sb.from("rr_bans").upsert({ user_id: id, reason: reason.slice(0, 300), until, created_by: state.user.id });
      if (fail(error, "Ban failed")) return;
      await log("player.ban", { user_id: id, until, reason });
      renderPlayers(panel);
    });
    if (unban) unban.addEventListener("click", async () => {
      const { error } = await sb.from("rr_bans").delete().eq("user_id", id);
      if (fail(error)) return;
      await log("player.unban", { user_id: id });
      renderPlayers(panel);
    });
  });
  panel.querySelectorAll("[data-cancel]").forEach(b => b.addEventListener("click", async () => {
    const { error } = await sb.from("rr_grants").delete().eq("id", b.dataset.cancel).is("claimed_at", null);
    if (fail(error)) return;
    await log("player.gift_cancel", { id: b.dataset.cancel });
    renderPlayers(panel);
  }));
}

// ------------------------------------------------------------------ log

async function renderLog(panel) {
  const { data, error } = await sb.from("rr_admin_log").select("*").order("at", { ascending: false }).limit(200);
  if (fail(error)) return;
  panel.innerHTML = `<div class="card"><h2>Admin log</h2><table><thead><tr><th>When</th><th>Action</th><th>Detail</th></tr></thead><tbody>
    ${data.map(r => `<tr><td>${new Date(r.at).toLocaleString()}</td><td>${esc(r.action)}</td><td class="key">${esc(JSON.stringify(r.detail))}</td></tr>`).join("")}
  </tbody></table></div>`;
}

start();
