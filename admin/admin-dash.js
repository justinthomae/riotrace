// Grudge Match admin: Dashboard (usage numbers from rr_sessions / rr_events via rr_admin_dashboard), Users
// (rr_admin_users + rr_admin_user_activity, gifts and bans), Theme (the game's colours and fonts, live document
// "ui_theme") and the picture fitter used when replacing art. Loaded after admin.js and uses its helpers.
"use strict";

// ------------------------------------------------------------------ chart helpers

// Dark-surface steps of the reference data-viz palette (validated for the dark surface); slot 1 for single series.
const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const charts = [];

function chartDefaults() {
  if (!window.Chart || chartDefaults.done) return;
  chartDefaults.done = true;
  Chart.defaults.color = "#a59fbb";
  Chart.defaults.borderColor = "rgba(165,159,187,.14)";
  Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = "#262236";
  Chart.defaults.plugins.tooltip.borderColor = "#3a3450";
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.titleColor = "#f2eefa";
  Chart.defaults.plugins.tooltip.bodyColor = "#f2eefa";
  Chart.defaults.maintainAspectRatio = false;
}

function clearCharts() { while (charts.length) charts.pop().destroy(); }

function niceName(id) {
  return String(id ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/** A single-series chart: "line" over days, "bar" columns, or "hbar" ranked rows. */
function drawChart(canvas, kind, labels, values, label, color = SERIES[0]) {
  if (!window.Chart) { canvas.replaceWith(Object.assign(document.createElement("p"), { className: "muted", textContent: "Charts couldn't load." })); return; }
  chartDefaults();
  const horizontal = kind === "hbar";
  const line = kind === "line";
  const chart = new Chart(canvas, {
    type: line ? "line" : "bar",
    data: {
      labels, datasets: [{
        label, data: values,
        borderColor: color, backgroundColor: line ? color + "33" : color,
        borderWidth: line ? 2 : 0, fill: line, tension: 0.3,
        pointRadius: line ? (values.length > 40 ? 0 : 3) : 0, pointHoverRadius: 5, pointBackgroundColor: color,
        borderRadius: line ? 0 : 4, borderSkipped: "start", maxBarThickness: 28, categoryPercentage: 0.8, barPercentage: 0.9,
      }],
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { grid: { display: horizontal }, beginAtZero: true, ticks: { maxRotation: 0, autoSkip: true, precision: 0 } },
        y: { grid: { display: !horizontal }, beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
  charts.push(chart);
}

function kpi(label, value, note) {
  return `<div class="kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div>${note ? `<div class="kpi-note">${esc(note)}</div>` : ""}</div>`;
}

function minutesText(m) {
  m = Number(m) || 0;
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${Math.round(m - h * 60)} min`;
}

function ago(when) {
  if (!when) return "never";
  const s = (Date.now() - new Date(when).getTime()) / 1000;
  if (s < 120) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

function trackName(id) {
  const doc = current("track_" + id);
  const t = doc && Array.isArray(doc.tracks) ? doc.tracks.find(x => x.id === id) : null;
  return (t && t.name) || niceName(id);
}

// ------------------------------------------------------------------ dashboard

let dashDays = 30, dashTimer = null;
async function renderDashboard(panel) {
  clearInterval(dashTimer);
  if (!panel.querySelector(".kpis")) panel.innerHTML = `<div class="card"><h2>Dashboard</h2><p class="muted">Loading…</p></div>`;
  const { data: d, error } = await sb.rpc("rr_admin_dashboard", { p_days: dashDays });
  if (fail(error, "Couldn't load the dashboard")) return;
  clearCharts();
  const ranges = [[1, "Today"], [7, "7 days"], [30, "30 days"], [90, "90 days"]];
  const finished = (d.online_vs_offline || []).reduce((a, x) => a + x.races, 0);
  const online = (d.online_vs_offline || []).find(x => x.kind === "online");
  const onlineShare = finished ? Math.round(100 * (online ? online.races : 0) / finished) + "%" : "–";
  const quitRate = d.races_period + d.quits ? Math.round(100 * d.quits / (d.races_period + d.quits)) + "%" : "–";
  const box = (id, title, note, tall) => `<div class="card chart-card"><h3>${esc(title)}</h3>${note ? `<p class="muted small">${esc(note)}</p>` : ""}<div class="chart${tall ? " tall" : ""}"><canvas id="${id}"></canvas></div></div>`;
  panel.innerHTML = `
    <div class="card">
      <div class="row spread"><h2>Dashboard</h2>
        <div class="row">${ranges.map(([n, l]) => `<button data-days="${n}" class="${n === dashDays ? "primary" : ""}">${l}</button>`).join("")}
          <button id="dash-refresh" title="Refresh">↻</button></div></div>
      <div class="kpis">
        ${kpi("Playing now", d.online_now, "in the last 2 minutes")}
        ${kpi("Players today", d.players_today)}
        ${kpi("Players, 7 days", d.players_7d)}
        ${kpi("Accounts", d.accounts_total)}
        ${kpi("Hours played", d.hours_period, `${d.sessions_period} sessions`)}
        ${kpi("Average session", minutesText(d.avg_session_minutes))}
        ${kpi("Races finished", d.races_period, `${onlineShare} online`)}
        ${kpi("Races quit", d.quits, `${quitRate} of races started`)}
      </div>
      <p class="muted small">Guests count by device. Numbers start from this version of the game; older builds don't report.</p>
    </div>
    <div class="card"><h3>Playing right now (${d.online_now})</h3>
      ${d.online.length ? `<table><thead><tr><th>Racer</th><th>Doing</th><th>On</th><th>This session</th></tr></thead><tbody>
        ${d.online.map(o => `<tr><td>${o.user_id ? `<a href="#" data-user="${esc(o.user_id)}">${esc(o.name)}</a>` : esc(o.name)}</td><td>${esc(o.screen)}</td><td>${esc(o.platform)}</td><td>${minutesText(o.minutes)}</td></tr>`).join("")}
      </tbody></table>` : `<p class="muted">Nobody is playing at the moment.</p>`}
    </div>
    <div class="dash-grid">
      ${box("c-players", "Players per day")}
      ${box("c-minutes", "Hours played per day")}
      ${box("c-races", "Races finished per day")}
      ${box("c-signups", "New accounts per day")}
      ${box("c-modes", "Most played modes", "Finished races and battles")}
      ${box("c-tracks", "Most played tracks", "Top 20", true)}
      ${box("c-vehicles", "Most driven karts")}
      ${box("c-hours", "When people play", "Sessions started by hour (your time)")}
      ${box("c-platforms", "Platforms", "Sessions")}
    </div>
    <div class="card"><h3>Most time in the game</h3>
      <table><thead><tr><th>Racer</th><th>Time played</th><th>Sessions</th><th>Last seen</th></tr></thead><tbody>
      ${(d.top_players || []).map(p => `<tr><td><a href="#" data-user="${esc(p.user_id)}">${esc(p.name)}</a></td><td>${minutesText(p.minutes)}</td><td>${p.sessions}</td><td>${ago(p.last_seen)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">No signed-in play yet.</td></tr>`}
      </tbody></table></div>`;

  const days = d.daily || [];
  const dayLabels = days.map(x => new Date(x.day + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }));
  drawChart($("#c-players"), "line", dayLabels, days.map(x => x.players), "Players");
  drawChart($("#c-minutes"), "bar", dayLabels, days.map(x => Math.round(x.minutes / 6) / 10), "Hours");
  drawChart($("#c-races"), "bar", dayLabels, days.map(x => x.races), "Races");
  drawChart($("#c-signups"), "bar", dayLabels, days.map(x => x.signups), "New accounts");
  drawChart($("#c-modes"), "hbar", d.modes.map(m => niceName(m.mode)), d.modes.map(m => m.races), "Races");
  drawChart($("#c-tracks"), "hbar", d.tracks.map(t => trackName(t.track)), d.tracks.map(t => t.races), "Races");
  drawChart($("#c-vehicles"), "hbar", d.vehicles.map(v => niceName(v.vehicle)), d.vehicles.map(v => v.races), "Races");
  // Hours arrive in UTC; shift them to the admin's own clock.
  const offset = -new Date().getTimezoneOffset() / 60;
  const local = new Array(24).fill(0);
  for (const h of d.hours_of_day || []) local[((h.hour + offset) % 24 + 24) % 24 | 0] += h.sessions;
  drawChart($("#c-hours"), "bar", local.map((_, i) => `${(i % 12) || 12}${i < 12 ? "a" : "p"}`), local, "Sessions");
  drawChart($("#c-platforms"), "hbar", d.platforms.map(p => niceName(p.platform)), d.platforms.map(p => p.sessions), "Sessions");

  panel.querySelectorAll("[data-days]").forEach(b => b.addEventListener("click", () => { dashDays = +b.dataset.days; renderDashboard(panel); }));
  $("#dash-refresh", panel).addEventListener("click", () => renderDashboard(panel));
  panel.querySelectorAll("[data-user]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); openUser(a.dataset.user); }));
  // Keep "playing now" fresh while the dashboard is open.
  dashTimer = setInterval(() => { if (!panel.hidden && !document.hidden) renderDashboard(panel); }, 60000);
}

// ------------------------------------------------------------------ users

/** Player pictures only from our own storage: any other address would tell its owner when an admin looked. */
function safeAvatar(url) {
  return typeof url === "string" && url.startsWith(SUPABASE_URL + "/storage/v1/object/public/");
}

const users = { search: "", sort: "last_seen", page: 0, size: 50 };
const banned = b => b.banned;

async function renderUsers(panel) {
  if (!panel.querySelector("#u-table")) panel.innerHTML = `<div class="card"><h2>Users</h2><p class="muted">Loading…</p></div>`;
  const [res, grants] = await Promise.all([
    sb.rpc("rr_admin_users", { p_search: users.search, p_limit: users.size, p_offset: users.page * users.size, p_sort: users.sort }),
    sb.from("rr_grants").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  if (fail(res.error, "Couldn't load users") || fail(grants.error, "Couldn't load gifts")) return;
  const { total, rows } = res.data;
  const ids = rows.map(r => r.user_id);
  const saves = ids.length ? await sb.from("rr_saves").select("user_id,profile").in("user_id", ids) : { data: [] };
  const save = Object.fromEntries((saves.data || []).map(s => [s.user_id, parseSave(s.profile)]));
  const nameOf = Object.fromEntries(rows.map(r => [r.user_id, r.name || r.email]));
  const pages = Math.max(1, Math.ceil(total / users.size));
  const sorts = [["last_seen", "Last seen"], ["minutes", "Time played"], ["races", "Races"], ["created", "Newest"]];
  panel.innerHTML = `
    <div class="card">
      <h2>Users <span class="muted">(${total})</span></h2>
      <div class="row">
        <label>Search <input id="u-search" placeholder="Racer name or e-mail" value="${esc(users.search)}"></label>
        <label style="flex:0 0 180px">Sort by <select id="u-sort">${sorts.map(([k, l]) => `<option value="${k}" ${k === users.sort ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      </div>
      <table id="u-table"><thead><tr><th></th><th>Racer</th><th>Level</th><th>Credits</th><th>Time played</th><th>Races</th><th>Last seen</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows.map(u => {
        const s = save[u.user_id] || {};
        return `<tr data-id="${esc(u.user_id)}">
          <td>${safeAvatar(u.avatar) ? `<img class="av" src="${esc(u.avatar)}" alt="">` : `<span class="av blank"></span>`}</td>
          <td><a href="#" data-open><strong>${esc(u.name || "(no racer card)")}</strong></a><br><span class="muted small">${esc(u.email || "")}</span></td>
          <td>${esc(s.level ?? "")}</td><td>${s.credits != null ? Number(s.credits).toLocaleString() : ""}</td>
          <td>${minutesText(u.minutes)}</td><td>${u.races}${u.wins ? ` <span class="muted small">(${u.wins} wins)</span>` : ""}</td>
          <td>${ago(u.last_seen)}</td>
          <td>${banned(u) ? `<span class="tag off">banned${u.ban_until ? " until " + new Date(u.ban_until).toLocaleDateString() : ""}</span>` : esc(u.status || "")}</td>
          <td class="row nowrap"><button data-gift>Gift</button>${banned(u) ? `<button data-unban>Unban</button>` : `<button class="danger" data-ban>Ban</button>`}</td></tr>`;
      }).join("") || `<tr><td colspan="9" class="muted">No users match.</td></tr>`}</tbody></table>
      <div class="row"><button id="u-prev" ${users.page ? "" : "disabled"}>‹ Previous</button>
        <span class="muted">Page ${users.page + 1} of ${pages}</span>
        <button id="u-next" ${users.page + 1 < pages ? "" : "disabled"}>Next ›</button></div>
    </div>
    <div class="card"><h3>Recent gifts</h3>
      <table><thead><tr><th>Player</th><th>Credits</th><th>XP</th><th>Note</th><th>Sent</th><th>Collected</th><th></th></tr></thead><tbody>
      ${grants.data.map(g => `<tr><td><a href="#" data-user="${esc(g.user_id)}">${esc(nameOf[g.user_id] || g.user_id.slice(0, 8))}</a></td><td>${g.credits}</td><td>${g.xp}</td><td>${esc(g.note)}</td>
        <td>${new Date(g.created_at).toLocaleString()}</td><td>${g.claimed_at ? new Date(g.claimed_at).toLocaleString() : "waiting"}</td>
        <td>${g.claimed_at ? "" : `<button class="danger" data-cancel="${esc(g.id)}">Cancel</button>`}</td></tr>`).join("")}
      </tbody></table></div>`;

  let typing;
  $("#u-search", panel).addEventListener("input", e => {
    clearTimeout(typing);
    typing = setTimeout(() => { users.search = e.target.value.trim(); users.page = 0; renderUsers(panel).then(() => { const i = $("#u-search", panel); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 350);
  });
  $("#u-sort", panel).addEventListener("change", e => { users.sort = e.target.value; users.page = 0; renderUsers(panel); });
  $("#u-prev", panel).addEventListener("click", () => { users.page--; renderUsers(panel); });
  $("#u-next", panel).addEventListener("click", () => { users.page++; renderUsers(panel); });
  panel.querySelectorAll("[data-user]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); openUser(a.dataset.user); }));
  panel.querySelectorAll("tr[data-id]").forEach(tr => {
    const id = tr.dataset.id, who = nameOf[id] || id;
    $("[data-open]", tr).addEventListener("click", e => { e.preventDefault(); openUser(id, rows.find(r => r.user_id === id), save[id]); });
    $("[data-gift]", tr).addEventListener("click", async () => { if (await giftUser(id, who)) renderUsers(panel); });
    const ban = $("[data-ban]", tr), unban = $("[data-unban]", tr);
    if (ban) ban.addEventListener("click", async () => { if (await banUser(id, who)) renderUsers(panel); });
    if (unban) unban.addEventListener("click", async () => { if (await unbanUser(id)) renderUsers(panel); });
  });
  panel.querySelectorAll("[data-cancel]").forEach(b => b.addEventListener("click", async () => {
    const { error } = await sb.from("rr_grants").delete().eq("id", b.dataset.cancel).is("claimed_at", null);
    if (fail(error)) return;
    await log("player.gift_cancel", { id: b.dataset.cancel });
    renderUsers(panel);
  }));
}

async function giftUser(id, who) {
  const credits = parseInt(prompt(`Credits to give ${who}? (negative takes credits away)`, "1000") || "0", 10) || 0;
  const xp = Math.max(0, parseInt(prompt("XP to give?", "0") || "0", 10) || 0);
  if (!credits && !xp) return false;
  const note = (prompt("Message shown to the player (optional)", "Thanks for racing!") || "").slice(0, 200);
  const { error } = await sb.from("rr_grants").insert({ user_id: id, credits, xp, note, created_by: state.user.id });
  if (fail(error, "Gift failed")) return false;
  await log("player.gift", { user_id: id, credits, xp });
  toast(`Gift sent. ${who} collects it next time they're at the main menu.`);
  return true;
}

async function banUser(id, who) {
  const reason = prompt(`Ban ${who} from online play and leaderboards. Reason?`);
  if (reason === null) return false;
  const days = prompt("For how many days? (leave empty for no end date)", "7");
  if (days === null) return false;
  const until = days.trim() ? new Date(Date.now() + parseFloat(days) * 86400000).toISOString() : null;
  const { error } = await sb.from("rr_bans").upsert({ user_id: id, reason: reason.slice(0, 300), until, created_by: state.user.id });
  if (fail(error, "Ban failed")) return false;
  await log("player.ban", { user_id: id, until, reason });
  return true;
}

async function unbanUser(id) {
  const { error } = await sb.from("rr_bans").delete().eq("user_id", id);
  if (fail(error)) return false;
  await log("player.unban", { user_id: id });
  return true;
}

/** A side sheet with one account's details, play time and recent races. */
async function openUser(id, row, profile) {
  let sheet = $("#sheet");
  if (!sheet) {
    sheet = Object.assign(document.createElement("aside"), { id: "sheet" });
    document.body.appendChild(sheet);
  }
  sheet.innerHTML = `<div class="sheet-body"><button class="close" data-close>✕</button><p class="muted">Loading…</p></div>`;
  sheet.classList.add("open");
  const close = () => sheet.classList.remove("open");
  sheet.onclick = e => { if (e.target === sheet || e.target.closest("[data-close]")) close(); };
  if (!row) {
    const r = await sb.rpc("rr_admin_users", { p_search: "", p_limit: 200, p_offset: 0, p_sort: "last_seen" });
    row = r.data && r.data.rows.find(x => x.user_id === id);
  }
  if (!profile) {
    const s = await sb.from("rr_saves").select("profile").eq("user_id", id).maybeSingle();
    profile = s.data ? parseSave(s.data.profile) : {};
  }
  const { data: act, error } = await sb.rpc("rr_admin_user_activity", { p_user: id });
  if (fail(error, "Couldn't load activity")) return;
  row = row || { user_id: id, name: "", email: "", minutes: 0, sessions: 0, races: 0 };
  const sessions = act.sessions || [], events = act.events || [];
  // Minutes per day over the last 14 days, from this account's sessions.
  const perDay = new Map();
  for (let i = 13; i >= 0; i--) perDay.set(new Date(Date.now() - i * 86400000).toDateString(), 0);
  for (const s of sessions) { const k = new Date(s.started_at).toDateString(); if (perDay.has(k)) perDay.set(k, perDay.get(k) + Number(s.minutes)); }
  sheet.innerHTML = `<div class="sheet-body">
    <button class="close" data-close>✕</button>
    <div class="row">${safeAvatar(row.avatar) ? `<img class="av big" src="${esc(row.avatar)}" alt="">` : ""}
      <div><h2>${esc(row.name || "(no racer card)")}</h2><div class="muted small">${esc(row.email || "")}<br>${esc(id)}</div></div></div>
    <div class="kpis small">
      ${kpi("Time played", minutesText(row.minutes))}
      ${kpi("Sessions", row.sessions)}
      ${kpi("Races", row.races, row.wins ? `${row.wins} wins` : "")}
      ${kpi("Level", profile.level ?? "–", profile.credits != null ? `${Number(profile.credits).toLocaleString()} credits` : "")}
    </div>
    <p class="muted small">Joined ${row.created_at ? new Date(row.created_at).toLocaleDateString() : "?"} · last signed in ${ago(row.last_sign_in_at)} · last played ${ago(row.last_seen)}</p>
    ${row.banned ? `<p class="tag off">Banned${row.ban_until ? " until " + new Date(row.ban_until).toLocaleDateString() : ""}: ${esc(row.ban_reason || "")}</p>` : ""}
    <div class="row"><button data-act="gift">Gift credits</button>${row.banned ? `<button data-act="unban">Unban</button>` : `<button class="danger" data-act="ban">Ban</button>`}</div>
    <h3>Minutes played, last 14 days</h3><div class="chart short"><canvas id="u-chart"></canvas></div>
    <h3>Recent races</h3>
    <table><thead><tr><th>When</th><th>Mode</th><th>Track</th><th>Kart</th><th>Place</th><th>Time</th></tr></thead><tbody>
    ${events.filter(e => !e.kind.endsWith("_started")).map(e => `<tr><td>${new Date(e.at).toLocaleString()}</td><td>${esc(niceName(e.mode))}${e.online ? ' <span class="tag">online</span>' : ""}</td>
      <td>${esc(trackName(e.track))}</td><td>${esc(niceName(e.vehicle))}</td>
      <td>${e.kind === "race_quit" ? '<span class="tag off">quit</span>' : e.place ? `${e.place} / ${e.racers}` : ""}</td><td>${e.seconds ? minutesText(e.seconds / 60) : ""}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">No races recorded.</td></tr>`}
    </tbody></table>
    <h3>Sessions</h3>
    <table><thead><tr><th>Started</th><th>Length</th><th>On</th><th>Version</th></tr></thead><tbody>
    ${sessions.map(s => `<tr><td>${new Date(s.started_at).toLocaleString()}</td><td>${minutesText(s.minutes)}</td><td>${esc(s.platform)}</td><td>${esc(s.version)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">No sessions recorded.</td></tr>`}
    </tbody></table></div>`;
  const keys = [...perDay.keys()];
  drawChart($("#u-chart", sheet), "bar", keys.map(k => new Date(k).toLocaleDateString(undefined, { month: "short", day: "numeric" })), keys.map(k => Math.round(perDay.get(k))), "Minutes");
  const who = row.name || row.email || id;
  const after = ok => { if (ok) { openUser(id); const p = $('[data-panel="players"]'); if (!p.hidden) renderUsers(p); } };
  sheet.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", async () => {
    const a = b.dataset.act;
    after(a === "gift" ? await giftUser(id, who) : a === "ban" ? await banUser(id, who) : await unbanUser(id));
  }));
}

// ------------------------------------------------------------------ theme

const THEME_KEY = "ui_theme";
const THEME_COLORS = [
  ["Accent", "#FF6B1A", "Main buttons, highlights, selected items"],
  ["AccentDark", "#B2260F", "Pressed buttons, accent shadows"],
  ["Gold", "#FFC21A", "Titles, coins, rewards"],
  ["Ember", "#E3241C", "Logo red, warnings in menus"],
  ["Turbo", "#40BFFF", "Boost and turbo"],
  ["Good", "#4CD973", "Success, ready, owned"],
  ["Danger", "#FF3B2E", "Errors, damage, delete"],
  ["TextColor", "#F4F1EE", "Main text"],
  ["Muted", "#A89E99", "Secondary text"],
  ["Background", "#0B090B", "Screen backdrop"],
  ["PanelColor", "#1A1416", "Panels and cards"],
  ["PanelLight", "#2B2124", "Raised panels, list rows"],
  ["PanelText", "#291A14", "Text on painted art panels"],
  ["ControlTint", "#0F0D0F", "Touch pad glass"],
];
const DISPLAY_FONTS = [["", "Lilita One (standard)", "RiotRace-Display"], ["Bangers", "Bangers", "RiotRace-Display-Bangers"], ["Luckiest", "Luckiest Guy", "RiotRace-Display-Luckiest"]];
const BODY_FONTS = [["", "Nunito (standard)", "RiotRace-Body"], ["Fredoka", "Fredoka", "RiotRace-Body-Fredoka"], ["Quicksand", "Quicksand", "RiotRace-Body-Quicksand"]];
const PRESETS = {
  "Riot (standard)": {},
  "Neon night": { Accent: "#FF2E9A", AccentDark: "#9C1263", Gold: "#FFE45C", Turbo: "#3CF2FF", Background: "#07061A", PanelColor: "#141032", PanelLight: "#241C4D" },
  "Ocean": { Accent: "#1FB5FF", AccentDark: "#0C5E9C", Gold: "#FFD45C", Ember: "#FF5A4E", Background: "#06111A", PanelColor: "#0E1E2B", PanelLight: "#183247" },
  "Jungle": { Accent: "#7BD93A", AccentDark: "#3A7A12", Gold: "#FFC93C", Background: "#08100A", PanelColor: "#132016", PanelLight: "#203323" },
};

let fontsLoaded = false;
function loadThemeFonts() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  const css = [...DISPLAY_FONTS, ...BODY_FONTS].map(([, , file]) => `@font-face{font-family:"${file}";src:url("builtin/fonts/${file}.ttf") format("truetype");font-display:swap}`).join("");
  document.head.appendChild(Object.assign(document.createElement("style"), { textContent: css }));
}

function renderTheme(panel) {
  loadThemeFonts();
  const saved = state.live[THEME_KEY];
  const theme = JSON.parse(JSON.stringify((saved && saved.value) || {}));
  theme.colors = theme.colors || {};
  const fontFile = (list, name) => (list.find(f => f[0] === (name || "")) || list[0])[2];
  const colorOf = name => (theme.colors[name] || THEME_COLORS.find(c => c[0] === name)[1]).slice(0, 7);
  panel.innerHTML = `
    <div class="card">
      <div class="row spread"><h2>Theme</h2>${saved ? `<span class="tag live">live${saved.updated_at ? " since " + new Date(saved.updated_at).toLocaleDateString() : ""}</span>` : `<span class="tag">standard look</span>`}</div>
      <p class="muted">The game's menu and HUD colours and fonts. Saving changes the look for every player at their next menu
        (within two minutes); it never changes gameplay or online matching. Pictures and logos are on the Art &amp; sound tab.</p>
      <div class="theme-split">
        <div>
          <h3>Starting points</h3>
          <div class="row">${Object.keys(PRESETS).map(p => `<button data-preset="${esc(p)}">${esc(p)}</button>`).join("")}</div>
          <h3>Fonts</h3>
          <div class="row">
            <label>Headings &amp; buttons <select id="t-display">${DISPLAY_FONTS.map(([k, l]) => `<option value="${k}" ${k === (theme.display || "") ? "selected" : ""}>${l}</option>`).join("")}</select></label>
            <label>Body text <select id="t-body">${BODY_FONTS.map(([k, l]) => `<option value="${k}" ${k === (theme.body || "") ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          </div>
          <h3>Colours</h3>
          <div class="swatches">${THEME_COLORS.map(([name, def, what]) => `
            <label class="swatch"><input type="color" data-color="${name}" value="${colorOf(name)}">
              <span><strong>${esc(niceName(name).replace("Text Color", "Text"))}</strong><br><span class="muted small">${esc(what)}</span></span>
              <button type="button" class="mini" data-reset-color="${name}" title="Standard colour" ${theme.colors[name] ? "" : "hidden"}>↺</button></label>`).join("")}
          </div>
        </div>
        <div>
          <h3>Preview</h3>
          <div id="t-preview" class="preview"></div>
        </div>
      </div>
      <div class="row">
        <button class="primary" id="t-save">Save live</button>
        ${saved ? `<button class="danger" id="t-revert">Back to the standard look</button>` : ""}
        <span class="msg" id="t-msg"></span>
      </div>
    </div>`;

  const preview = () => {
    const c = name => colorOf(name);
    const disp = fontFile(DISPLAY_FONTS, theme.display), body = fontFile(BODY_FONTS, theme.body);
    $("#t-preview", panel).innerHTML = `
      <div class="pv" style="background:${c("Background")};color:${c("TextColor")};font-family:'${body}'">
        <div class="pv-title" style="font-family:'${disp}';color:${c("Gold")}">RIOT RACE</div>
        <div class="pv-panel" style="background:${c("PanelColor")}">
          <div style="font-family:'${disp}';font-size:20px">QUICK RACE</div>
          <div style="color:${c("Muted")}">Sunloop Bay · 3 laps · 8 racers</div>
          <div class="pv-row" style="background:${c("PanelLight")}"><span>Credits</span><span style="color:${c("Gold")}">● 12,450</span></div>
          <div class="pv-row" style="background:${c("PanelLight")}"><span>Boost</span><span style="color:${c("Turbo")}">▶▶ Ready</span></div>
          <div class="pv-row" style="background:${c("PanelLight")}"><span>Shield</span><span style="color:${c("Good")}">✔ Equipped</span><span style="color:${c("Danger")}">✖ −40</span></div>
          <div class="pv-buttons">
            <span class="pv-btn" style="font-family:'${disp}';background:linear-gradient(${c("Accent")},${c("AccentDark")});color:#170a05">RACE!</span>
            <span class="pv-btn" style="font-family:'${disp}';background:${c("PanelLight")};color:${c("TextColor")}">GARAGE</span>
          </div>
        </div>
        <div class="pv-art" style="color:${c("PanelText")}">Painted panel text</div>
        <div class="pv-pads"><span style="background:${c("ControlTint")}cc">A</span><span style="background:${c("ControlTint")}cc">B</span><span style="background:${c("Ember")}">●</span></div>
      </div>`;
  };
  preview();

  panel.querySelectorAll("[data-color]").forEach(input => input.addEventListener("input", () => {
    const name = input.dataset.color;
    const def = THEME_COLORS.find(x => x[0] === name)[1];
    if (input.value.toUpperCase() === def) delete theme.colors[name]; else theme.colors[name] = input.value.toUpperCase();
    $(`[data-reset-color="${name}"]`, panel).hidden = !theme.colors[name];
    preview();
  }));
  panel.querySelectorAll("[data-reset-color]").forEach(b => b.addEventListener("click", e => {
    e.preventDefault();
    const name = b.dataset.resetColor;
    delete theme.colors[name];
    $(`[data-color="${name}"]`, panel).value = colorOf(name);
    b.hidden = true;
    preview();
  }));
  panel.querySelectorAll("[data-preset]").forEach(b => b.addEventListener("click", () => {
    theme.colors = { ...PRESETS[b.dataset.preset] };
    panel.querySelectorAll("[data-color]").forEach(i => { i.value = colorOf(i.dataset.color); $(`[data-reset-color="${i.dataset.color}"]`, panel).hidden = !theme.colors[i.dataset.color]; });
    preview();
  }));
  $("#t-display", panel).addEventListener("change", e => { theme.display = e.target.value; preview(); });
  $("#t-body", panel).addEventListener("change", e => { theme.body = e.target.value; preview(); });
  $("#t-save", panel).addEventListener("click", async () => {
    const value = { colors: theme.colors, display: theme.display || "", body: theme.body || "" };
    if (await saveDoc(THEME_KEY, value, "theme.save")) renderTheme(panel);
  });
  const revert = $("#t-revert", panel);
  if (revert) revert.addEventListener("click", async () => { if (await revertDoc(THEME_KEY)) renderTheme(panel); });
}

// ------------------------------------------------------------------ picture fitter

/**
 * Lets the admin frame a new picture to the built-in one's size before uploading it: drag to move, slider to zoom,
 * "Fit" shows all of it (with a backdrop colour), "Fill" crops to cover. Resolves to a File, or null if cancelled.
 */
function fitImage(file, size) {
  const m = /^(\d+)x(\d+)$/.exec(size || "");
  if (!m) return Promise.resolve(file);
  const W = +m[1], H = +m[2];
  return new Promise(resolve => {
    const img = new Image();
    img.onerror = () => resolve(file);
    img.onload = () => {
      if (img.naturalWidth === W && img.naturalHeight === H) { resolve(file); return; }
      const keepAlpha = /png|webp/.test(file.type);
      const dlg = document.createElement("div");
      dlg.id = "fitter";
      dlg.innerHTML = `<div class="card fit-card">
        <h2>Frame the picture</h2>
        <p class="muted">The game uses this picture at ${W} × ${H}. Yours is ${img.naturalWidth} × ${img.naturalHeight}. Drag to move it; zoom to crop.</p>
        <canvas class="fit-canvas"></canvas>
        <div class="row"><label>Zoom <input type="range" min="0.2" max="4" step="0.01" id="fit-zoom"></label>
          <button id="fit-fit">Fit</button><button id="fit-fill">Fill</button>
          <label style="flex:0 0 auto" ${keepAlpha ? "hidden" : ""}>Backdrop <input type="color" id="fit-bg" value="#000000"></label></div>
        <div class="row"><button class="primary" id="fit-ok">Use this</button><button id="fit-orig">Upload as is</button><button id="fit-cancel">Cancel</button></div>
      </div>`;
      document.body.appendChild(dlg);
      const canvas = $(".fit-canvas", dlg);
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      const fit = Math.min(W / img.naturalWidth, H / img.naturalHeight), fill = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      let scale = fill, x = 0, y = 0;
      const zoom = $("#fit-zoom", dlg);
      zoom.min = (fit * 0.5).toFixed(3); zoom.max = (fill * 4).toFixed(3); zoom.step = (fill / 200).toFixed(4);
      const draw = () => {
        ctx.clearRect(0, 0, W, H);
        if (!keepAlpha) { ctx.fillStyle = $("#fit-bg", dlg).value; ctx.fillRect(0, 0, W, H); }
        const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, (W - w) / 2 + x, (H - h) / 2 + y, w, h);
        zoom.value = scale;
      };
      draw();
      zoom.addEventListener("input", () => { scale = +zoom.value; draw(); });
      $("#fit-fit", dlg).addEventListener("click", () => { scale = fit; x = y = 0; draw(); });
      $("#fit-fill", dlg).addEventListener("click", () => { scale = fill; x = y = 0; draw(); });
      $("#fit-bg", dlg).addEventListener("input", draw);
      let drag = null;
      canvas.addEventListener("pointerdown", e => { drag = { sx: e.clientX, sy: e.clientY, x, y }; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener("pointermove", e => {
        if (!drag) return;
        const k = W / canvas.getBoundingClientRect().width;
        x = drag.x + (e.clientX - drag.sx) * k; y = drag.y + (e.clientY - drag.sy) * k; draw();
      });
      canvas.addEventListener("pointerup", () => { drag = null; });
      const done = value => { dlg.remove(); URL.revokeObjectURL(img.src); resolve(value); };
      $("#fit-cancel", dlg).addEventListener("click", () => done(null));
      $("#fit-orig", dlg).addEventListener("click", () => done(file));
      $("#fit-ok", dlg).addEventListener("click", () => {
        const type = keepAlpha ? "image/png" : "image/jpeg";
        canvas.toBlob(blob => done(blob ? new File([blob], file.name.replace(/\.\w+$/, keepAlpha ? ".png" : ".jpg"), { type }) : file), type, 0.92);
      });
    };
    img.src = URL.createObjectURL(file);
  });
}
