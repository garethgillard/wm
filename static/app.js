(function () {
'use strict';

const HISTORY = 300;
// Keep these lists in step with EMOJI_COUNT / COLOR_COUNT in app/store.py.
const EMOJI = ["🦊","🐙","🦉","🐧","🦄","🐸","🐼","🦖","🐳","🦩","🐝","🦦","🐨","🐯","🦁","🐷","🐵","🦔","🐢","🦀","🍄","👽","🤖","🐟"];
const COLORS = ["#FFD6A5","#FDF1A0","#C6F3BA","#A6EEF5","#B4CCFF","#CDBFFF","#FFC9F2","#FFB3AE"];
const TITLES = ["Agent","Captain","Doctor","Professor","Baron","Admiral","Detective","Commander"];
const ADJ = ["Disco","Turbo","Velvet","Midnight","Cosmic","Sneaky","Polar","Neon","Crispy","Jazzy","Silent","Golden","Funky","Rogue","Fuzzy","Electric"];
const NOUN = ["Puffin","Moose","Herring","Lynx","Walrus","Troll","Otter","Narwhal","Lemming","Waffle","Reindeer","Salmon","Brunost","Viking","Pickle","Badger"];
const IDEAS = ["Bowling","Karaoke night","Pub quiz","Escape room","Taco Friday","Sauna and fjord dip","Board game night","Curling"];

const $ = id => document.getElementById(id);
const rand = n => Math.floor(Math.random() * n);
const pick = a => a[rand(a.length)];
const randomName = () => { const base = pick(ADJ) + " " + pick(NOUN); return Math.random() < .55 ? pick(TITLES) + " " + base : base; };
const str = (v, n) => typeof v === "string" ? v.slice(0, n) : "";
const idx = (v, max) => Number.isInteger(v) && v >= 0 && v < max ? v : 0;
const num = v => typeof v === "number" && isFinite(v) ? v : 0;
const wide = matchMedia("(min-width: 900px)");

/* ---------- local storage (per browser) ---------- */
function lsGet(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v){ try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
function newToken(){
  const b = new Uint8Array(24); crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
let TOKEN = lsGet("partyhq-token");
if (!TOKEN || !/^[A-Za-z0-9_-]{20,100}$/.test(TOKEN)){ TOKEN = newToken(); lsSet("partyhq-token", TOKEN); }

function h(tag, attrs, ...kids){
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)){
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of kids.flat()){
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const S = {
  ws:null, connected:false, ready:false, locked:false,
  me:null, isAdmin:false, hasAdmin:false,
  info:null, players:{}, messages:[], activities:[], votes:{}, myPicks:{},
  online:new Set(), typing:new Set(), presenceLive:false,
  tab:"chat", lastSeenTs:0, forceScroll:false, armed:null, draft:null, joinPrompted:false
};

/* ---------- helpers ---------- */
function nameOf(pid){ const p = S.players[pid]; return (p && p.codename) || "Mystery guest"; }
function av(pid, size){
  const p = S.players[pid];
  const el = h("span", {class:"av av-" + size, "aria-hidden":"true"}, p ? EMOJI[p.emoji] : "❔");
  if (p) el.style.setProperty("--av", COLORS[p.color]);
  return el;
}
function avRaw(emoji, color, size){
  const el = h("span", {class:"av av-" + size, "aria-hidden":"true"}, EMOJI[emoji]);
  el.style.setProperty("--av", COLORS[color]);
  return el;
}
let toastT = 0;
function toast(msg){ const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3400); }
function dayKey(ts){ return new Date(ts).toDateString(); }
function dayLabel(ts){
  const d = new Date(ts), now = new Date(), y = new Date(); y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {weekday:"short", day:"numeric", month:"short"});
}
function timeLabel(ts){ return new Date(ts).toLocaleTimeString(undefined, {hour:"2-digit", minute:"2-digit"}); }
function joined(){ return !!(S.me && S.players[S.me]); }
function canJoin(){ return S.ready && S.connected; }
function canAct(){
  if (!S.ready || !S.connected){ toast("You're offline. Reconnecting…"); return false; }
  if (!joined()){ openJoin(); return false; }
  return true;
}
function chatVisible(){ return wide.matches || S.tab === "chat"; }
function errText(e){
  switch (e && e.error){
    case "slow": return "Easy, agent. Wait a moment and try again.";
    case "offline": case "timeout": return "You're offline. Reconnecting…";
    case "forbidden": return "Only the organiser can do that.";
    case "not_joined": return "Pick a codename first.";
    case "full": return "The crew is full. Ask the organiser to raise the limit.";
    case "gone": return "That activity was already removed.";
    default: return "That didn't save. Try again.";
  }
}

/* ---------- connection ---------- */
let retry = 0, ridSeq = 0;
const pending = new Map();
function wsUrl(){ const u = new URL("ws", location.href); u.protocol = location.protocol === "https:" ? "wss:" : "ws:"; u.hash = ""; u.search = ""; return u.href; }
function sendRaw(obj){ if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(obj)); }
function hello(){
  sendRaw({type:"hello", token:TOKEN, passcode:lsGet("partyhq-pass") || undefined, admin:lsGet("partyhq-admin") || undefined});
}
function request(type, payload){
  return new Promise((resolve, reject) => {
    if (!S.ws || S.ws.readyState !== 1){ reject({error:"offline"}); return; }
    const rid = ++ridSeq;
    const t = setTimeout(() => { pending.delete(rid); reject({error:"timeout"}); }, 8000);
    pending.set(rid, {resolve:m => { clearTimeout(t); resolve(m); }, reject:m => { clearTimeout(t); reject(m); }});
    S.ws.send(JSON.stringify(Object.assign({type, rid}, payload || {})));
  });
}
function connect(){
  let ws;
  try { ws = new WebSocket(wsUrl()); } catch (e){ scheduleReconnect(); return; }
  S.ws = ws;
  ws.onopen = () => { retry = 0; S.connected = true; hello(); };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x){ return; } if (m && typeof m === "object") onServer(m); };
  ws.onclose = () => {
    if (S.ws !== ws) return;
    S.connected = false; S.presenceLive = false; S.online = new Set(); S.typing = new Set();
    for (const p of pending.values()) p.reject({error:"offline"});
    pending.clear();
    renderAll();
    scheduleReconnect();
  };
}
function scheduleReconnect(){ setTimeout(connect, Math.min(15000, 800 * Math.pow(2, retry++)) + rand(400)); }
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && S.ws && S.ws.readyState > 1){ retry = 0; connect(); }
});

function cleanPlayer(x){
  const codename = str(x && x.codename, 28).trim();
  if (!x || !codename || typeof x.id !== "string") return null;
  return {id:x.id, codename, emoji:idx(x.emoji, EMOJI.length), color:idx(x.color, COLORS.length), joinedAt:num(x.joinedAt)};
}
function cleanMsg(x){
  if (!x || typeof x.pid !== "string") return null;
  const m = {id:String(x.id), pid:x.pid, kind:["msg","join","suggest"].includes(x.kind) ? x.kind : "msg", text:str(x.text, 500), aid:str(x.aid, 200), ts:num(x.ts)};
  return m.kind === "msg" && !m.text ? null : m;
}
function cleanAct(x){
  const title = str(x && x.title, 80).trim();
  return x && title && typeof x.id === "string" ? {id:x.id, title, pid:str(x.pid, 200), ts:num(x.ts)} : null;
}

function onServer(m){
  switch (m.type){
    case "ack": {
      const p = pending.get(m.rid);
      if (p){ pending.delete(m.rid); m.ok ? p.resolve(m) : p.reject(m); }
      return;
    }
    case "locked":
      S.locked = true; S.ready = false;
      if (m.wrong) lsSet("partyhq-pass", null);
      $("passErr").textContent = m.wrong ? "That passcode didn't work. Check it with the organiser." : "";
      $("passErr").hidden = !m.wrong;
      $("passLayer").hidden = false;
      renderAll();
      return;
    case "welcome": {
      const first = !S.ready && !S.messages.length;
      S.locked = false; $("passLayer").hidden = true;
      S.me = typeof m.you === "string" ? m.you : null;
      S.isAdmin = m.admin === true; S.hasAdmin = m.hasAdmin === true;
      if (!S.isAdmin) lsSet("partyhq-admin", null);
      const st = m.state || {};
      S.info = st.info || null;
      S.players = {};
      for (const x of st.players || []){ const p = cleanPlayer(x); if (p) S.players[p.id] = p; }
      S.messages = (st.messages || []).map(cleanMsg).filter(Boolean);
      S.activities = (st.activities || []).map(cleanAct).filter(Boolean);
      S.votes = {};
      for (const [pid, picks] of Object.entries(st.votes || {})){
        const c = {}; for (const [aid, v] of Object.entries(picks || {})) if (v === 1 || v === -1) c[aid] = v;
        S.votes[pid] = c;
      }
      S.myPicks = Object.assign({}, S.votes[S.me] || {});
      S.ready = true;
      if (first){ S.forceScroll = true; const last = S.messages[S.messages.length - 1]; S.lastSeenTs = last ? last.ts : 0; }
      renderAll();
      maybePromptJoin();
      return;
    }
    case "player": {
      const p = cleanPlayer(m.player); if (!p) return;
      S.players[p.id] = p; renderAll(); return;
    }
    case "message": {
      const msg = cleanMsg(m.message); if (!msg) return;
      if (S.messages.some(x => x.id === msg.id)) return;
      if (msg.pid === S.me) S.forceScroll = true;
      S.messages.push(msg);
      if (S.messages.length > HISTORY) S.messages.splice(0, S.messages.length - HISTORY);
      renderFeed(); return;
    }
    case "activity": {
      const a = cleanAct(m.activity); if (!a) return;
      if (!S.activities.some(x => x.id === a.id)) S.activities.push(a);
      renderVotes(); renderFeed(); renderCrew(); return;
    }
    case "activity_removed":
      S.activities = S.activities.filter(a => a.id !== m.id);
      renderVotes(); renderFeed(); renderCrew(); return;
    case "vote": {
      if (typeof m.pid !== "string" || typeof m.aid !== "string") return;
      const v = m.v === 1 || m.v === -1 ? m.v : 0;
      if (m.pid === S.me) S.myPicks = Object.assign({}, S.myPicks, {[m.aid]: v});
      else S.votes[m.pid] = Object.assign({}, S.votes[m.pid] || {}, {[m.aid]: v});
      renderVotes(); renderFeed(); renderCrew(); return;
    }
    case "info":
      S.info = m.info || null; renderHeader(); return;
    case "presence":
      S.online = new Set(Array.isArray(m.online) ? m.online : []);
      S.typing = new Set((Array.isArray(m.typing) ? m.typing : []).filter(p => p !== S.me));
      S.presenceLive = true;
      renderHeader(); renderCrew(); renderTyping(); return;
    case "error":
      if (m.error === "bad_token"){ TOKEN = newToken(); lsSet("partyhq-token", TOKEN); hello(); }
      return;
  }
}

/* ---------- votes ---------- */
function picksOf(pid){ return pid === S.me ? S.myPicks : (S.votes[pid] || {}); }
function tally(){
  const t = {};
  for (const a of S.activities) t[a.id] = {go:[], nogo:[]};
  const pids = new Set(Object.keys(S.votes)); if (S.me) pids.add(S.me);
  for (const pid of pids){
    for (const [aid, v] of Object.entries(picksOf(pid))){
      if (!t[aid]) continue;
      if (v === 1) t[aid].go.push(pid); else if (v === -1) t[aid].nogo.push(pid);
    }
  }
  return t;
}
function ranked(t){
  return [...S.activities].sort((a, b) => {
    const A = t[a.id], B = t[b.id];
    return (B.go.length - B.nogo.length) - (A.go.length - A.nogo.length) || B.go.length - A.go.length || a.ts - b.ts;
  });
}
function vote(aid, v){
  if (!canAct()) return;
  const cur = S.myPicks[aid] || 0;
  const next = cur === v ? 0 : v;
  S.myPicks = Object.assign({}, S.myPicks, {[aid]: next});
  renderVotes(); renderFeed(); renderCrew();
  request("vote", {aid, v:next}).catch(e => {
    if (S.myPicks[aid] === next){ S.myPicks = Object.assign({}, S.myPicks, {[aid]: cur}); renderVotes(); renderFeed(); renderCrew(); }
    toast(errText(e));
  });
}
function voteButtons(aid, t){
  const mine = S.myPicks[aid] || 0, dis = !S.connected || !S.ready;
  return [
    h("button", {type:"button", class:"vbtn go", "aria-pressed":String(mine === 1), disabled:dis, onclick:() => vote(aid, 1), "aria-label":"Go, " + t.go.length + " so far"},
      h("span", {text:"Go"}), h("span", {class:"n", text:String(t.go.length)})),
    h("button", {type:"button", class:"vbtn nogo", "aria-pressed":String(mine === -1), disabled:dis, onclick:() => vote(aid, -1), "aria-label":"No-go, " + t.nogo.length + " so far"},
      h("span", {text:"No-go"}), h("span", {class:"n", text:String(t.nogo.length)}))
  ];
}

/* ---------- actions ---------- */
async function send(raw){
  const text = raw.trim();
  if (!text || !canAct()) return;
  const idea = text.match(/^\/idea\s+(.+)/i);
  $("msgInput").value = ""; setTyping(false); S.forceScroll = true;
  if (idea){ if (!(await addActivity(idea[1])) && !$("msgInput").value) $("msgInput").value = raw; return; }
  try { await request("msg", {text:text.slice(0, 500)}); }
  catch (e){ if (!$("msgInput").value) $("msgInput").value = raw; toast(errText(e)); }
}
async function addActivity(raw){
  const title = String(raw).trim().replace(/\s+/g, " ").slice(0, 80);
  if (!title || !canAct()) return false;
  const dup = S.activities.find(a => a.title.toLowerCase() === title.toLowerCase());
  if (dup){ toast(dup.title + " is already on the list."); return false; }
  try { await request("idea", {title}); return true; }
  catch (e){ toast(e && e.error === "duplicate" ? (e.title || title) + " is already on the list." : errText(e)); return false; }
}
function removeActivity(a){
  if (S.armed && S.armed.id === a.id && Date.now() < S.armed.until){
    S.armed = null;
    request("remove_idea", {id:a.id}).catch(e => toast(errText(e)));
    return;
  }
  S.armed = {id:a.id, until:Date.now() + 3000};
  renderVotes();
  setTimeout(renderVotes, 3100);
}

/* ---------- typing indicator ---------- */
let typingOn = false, typingT = 0;
function setTyping(on){
  if (!joined()) return;
  clearTimeout(typingT);
  if (on){ typingT = setTimeout(() => setTyping(false), 3000); if (typingOn) return; }
  else if (!typingOn) return;
  typingOn = on;
  sendRaw({type:"typing", on});
}

/* ---------- rendering ---------- */
function renderHeader(){
  const i = S.info || {};
  $("partyName").textContent = str(i.name, 40) || "Work party";
  const meta = [str(i.when, 60), str(i.where, 60)].filter(Boolean).join(" · ");
  $("partyMeta").textContent = meta || "Date and place to be decided";
  $("editInfo").hidden = !(S.isAdmin && S.ready);
  document.title = (str(i.name, 40) || "Work party") + " · Party HQ";

  const me = $("meBtn"); me.replaceChildren(); me.classList.remove("solo");
  if (joined()){
    me.append(av(S.me, "sm"), h("span", {class:"me-name", text:nameOf(S.me)}));
    me.setAttribute("aria-label", "You are " + nameOf(S.me) + ". Change codename or avatar");
    me.hidden = false;
  } else if (canJoin()){
    me.classList.add("solo"); me.append("Join"); me.setAttribute("aria-label", "Pick a codename and join"); me.hidden = false;
  } else me.hidden = true;

  const on = $("online"); on.replaceChildren();
  const crew = Object.keys(S.players);
  if (S.locked){ on.append(h("span", {text:"Invite only"})); return; }
  if (!S.ready){ on.append(h("span", {text:"Connecting…"})); return; }
  if (!S.connected){ on.append(h("span", {class:"status-dot"}), h("span", {text:"Reconnecting…"})); return; }
  if (!crew.length){ on.append(h("span", {text:"No one has joined yet"})); return; }
  const here = S.presenceLive ? crew.filter(p => S.online.has(p)) : [];
  if (here.length) on.append(h("span", {class:"stack"}, here.slice(0, 6).map(p => av(p, "xs"))));
  on.append(h("span", {text: S.presenceLive ? here.length + " here now · " + crew.length + " in the crew" : crew.length + " in the crew"}));
}

function renderTabs(){
  $("app").dataset.tab = S.tab;
  for (const b of document.querySelectorAll(".tab")) b.setAttribute("aria-selected", String(b.dataset.tab === S.tab));
  const unread = chatVisible() ? 0 : S.messages.filter(m => m.ts > S.lastSeenTs && m.pid !== S.me && m.kind !== "join").length;
  $("chatBadge").textContent = unread > 99 ? "99+" : String(unread);
  $("chatBadge").hidden = !unread;
  $("voteCount").textContent = String(S.activities.length);
  $("crewCountTab").textContent = String(Object.keys(S.players).length);
}

function renderFeed(){
  const feed = $("feed");
  const near = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 90;
  feed.replaceChildren();
  if (!S.ready){
    feed.append(h("div", {class:"empty-chat"}, h("p", {class:"big", text: S.locked ? "Invite only" : "Connecting…"}), h("p", {text: S.locked ? "Enter the passcode from the organiser." : "Opening the secret channel."})));
    renderTabs(); return;
  }
  if (!S.messages.length){
    feed.append(h("div", {class:"empty-chat"},
      h("p", {class:"big", text:"Comms are quiet"}),
      h("p", null, "Say hello, or type ", h("code", {text:"/idea"}), " and an activity to put it to a vote.")));
    renderTabs(); return;
  }
  const t = tally(), acts = new Map(S.activities.map(a => [a.id, a]));
  let prev = null, lastDay = null;
  for (const m of S.messages){
    const dk = dayKey(m.ts);
    if (dk !== lastDay){ feed.append(h("div", {class:"day", text:dayLabel(m.ts)})); lastDay = dk; prev = null; }
    if (m.kind === "join"){
      feed.append(h("div", {class:"event"}, av(m.pid, "xs"), h("span", {text: nameOf(m.pid) + " joined the crew"})));
      prev = null; continue;
    }
    if (m.kind === "suggest"){
      const a = acts.get(m.aid);
      feed.append(h("div", {class:"suggest"},
        h("div", {class:"suggest-head"}, av(m.pid, "xs"), h("span", {text: nameOf(m.pid) + " proposed an activity · " + timeLabel(m.ts)})),
        h("div", {class:"suggest-title", text: a ? a.title : m.text}),
        a ? h("div", {class:"act-votes"}, voteButtons(a.id, t[a.id])) : h("div", {class:"suggest-gone", text:"Taken off the list"})));
      prev = null; continue;
    }
    const mine = m.pid === S.me;
    const cont = !!(prev && prev.pid === m.pid && m.ts - prev.ts < 5 * 60 * 1000);
    feed.append(h("div", {class:"msg" + (mine ? " mine" : "") + (cont ? " cont" : "")},
      h("div", {class:"gutter"}, cont ? null : av(m.pid, "sm")),
      h("div", {class:"body"},
        cont ? null : h("div", {class:"head"}, mine ? null : h("span", {class:"who", text:nameOf(m.pid)}), h("span", {class:"time", text:timeLabel(m.ts)})),
        h("div", {class:"bubble", text:m.text}))));
    prev = m;
  }
  if (near || S.forceScroll) feed.scrollTop = feed.scrollHeight;
  S.forceScroll = false;
  if (chatVisible() && S.messages.length) S.lastSeenTs = Math.max(S.lastSeenTs, S.messages[S.messages.length - 1].ts);
  renderTabs();
}

function renderTyping(){
  const names = [...S.typing].filter(p => S.players[p]).map(nameOf);
  $("typing").textContent = !names.length ? "" : names.length === 1 ? names[0] + " is typing…" : names.length === 2 ? names[0] + " and " + names[1] + " are typing…" : "Several agents are typing…";
}

function renderComposer(){
  const form = $("composer"), note = $("composerNote"), add = $("addForm");
  note.replaceChildren();
  let msg = null;
  if (S.locked) msg = h("button", {type:"button", class:"btn primary", onclick:() => { $("passLayer").hidden = false; }}, "Enter the passcode");
  else if (!S.ready) msg = "Connecting to Party HQ…";
  else if (!S.connected) msg = "Reconnecting… your messages will send once you're back online.";
  else if (!joined()) msg = h("button", {type:"button", class:"btn primary", onclick:openJoin}, "Pick a codename to join");
  form.hidden = !!msg; note.hidden = !msg; if (msg) note.append(msg);
  add.hidden = !!msg;
}

function renderVotes(){
  const list = $("acts"); list.replaceChildren();
  const t = tally();
  const ideas = $("ideas"); ideas.replaceChildren();
  const listed = new Set(S.activities.map(a => a.title.toLowerCase()));
  const spare = IDEAS.filter(i => !listed.has(i.toLowerCase()));
  const showIdeas = S.ready && S.connected && S.activities.length < 4 && spare.length > 0;
  ideas.hidden = !showIdeas;
  if (showIdeas){
    ideas.append(h("span", {class:"ideas-label", text:"Quick ideas, tap to propose:"}));
    for (const i of spare.slice(0, 6)) ideas.append(h("button", {type:"button", class:"chip", onclick:() => addActivity(i)}, i));
  }
  if (!S.ready){ list.append(h("li", {class:"empty", text: S.locked ? "Enter the passcode to see the activities." : "Loading activities…"})); renderTabs(); return; }
  if (!S.activities.length){ list.append(h("li", {class:"empty", text:"Nothing proposed yet. Add the first idea above, or use /idea in the chat."})); renderTabs(); return; }
  ranked(t).forEach((a, i) => {
    const r = t[a.id], total = r.go.length + r.nogo.length;
    const leading = i === 0 && r.go.length > r.nogo.length;
    const canDel = S.connected && (a.pid === S.me || S.isAdmin);
    const armed = S.armed && S.armed.id === a.id && Date.now() < S.armed.until;
    const goers = r.go.filter(p => S.players[p]);
    let bar = null;
    if (total){
      const g = h("span", {class:"g"}), n = h("span", {class:"n"});
      g.style.width = (100 * r.go.length / total) + "%";
      n.style.width = (100 * r.nogo.length / total) + "%";
      bar = h("div", {class:"bar", "aria-hidden":"true"}, g, n);
    }
    list.append(h("li", {class:"act" + (leading ? " leading" : "")},
      h("span", {class:"rank", text:"#" + (i + 1)}),
      h("div", {class:"act-main"},
        h("div", {class:"act-title"}, h("span", {text:a.title}), leading ? h("span", {class:"lead-chip", text:"Leading"}) : null),
        h("div", {class:"act-by"}, av(a.pid, "xs"), h("span", {text:"proposed by " + nameOf(a.pid)})),
        bar),
      canDel ? h("button", {type:"button", class:"del" + (armed ? " armed" : ""), onclick:() => removeActivity(a), "aria-label":"Remove " + a.title}, armed ? "Tap again" : "Remove") : null,
      h("div", {class:"act-votes"}, voteButtons(a.id, r), goers.length ? h("span", {class:"stack", title:goers.map(nameOf).join(", ")}, goers.slice(0, 6).map(p => av(p, "xs"))) : null)));
  });
  renderTabs();
}

function renderCrew(){
  const list = $("crewList"); list.replaceChildren();
  const pids = Object.keys(S.players).sort((a, b) => (S.online.has(b) - S.online.has(a)) || nameOf(a).localeCompare(nameOf(b)));
  $("crewCount").textContent = String(pids.length);
  $("crewSub").textContent = S.presenceLive ? [...S.online].filter(p => S.players[p]).length + " here now" : "";
  if (!pids.length){
    list.append(h("li", {class:"empty", text: S.ready ? "No one has joined yet. Pick your codename and send the link around." : "Loading the crew…"}));
  } else {
    const t = tally();
    for (const pid of pids){
      let go = 0, nogo = 0;
      for (const [aid, v] of Object.entries(picksOf(pid))){ if (!t[aid]) continue; if (v === 1) go++; else if (v === -1) nogo++; }
      list.append(h("li", {class:"crew-row"},
        h("span", {class:"av-wrap"}, av(pid, "md"), S.presenceLive && S.online.has(pid) ? h("span", {class:"dot", title:"Here now"}) : null),
        h("span", {class:"crew-main"},
          h("span", {class:"crew-name"}, h("span", {class:"nm", text:nameOf(pid)}), pid === S.me ? h("span", {class:"you", text:"You"}) : null),
          h("span", {class:"crew-sub", text: go + " go · " + nogo + " no-go"}))));
    }
  }
  const org = $("organiser"); org.replaceChildren();
  org.hidden = !(S.ready && S.hasAdmin);
  if (!org.hidden){
    if (S.isAdmin){
      org.append(h("span", null, h("strong", {text:"Organiser mode is on."}), " You can edit details and remove any activity."),
        h("button", {type:"button", class:"linkbtn", onclick:leaveAdmin}, "Turn off"));
    } else {
      org.append(h("span", {text:"Organising this party?"}), h("button", {type:"button", class:"linkbtn", onclick:openAdmin}, "Enter organiser code"));
    }
  }
  renderTabs();
}

function renderAll(){ renderHeader(); renderComposer(); renderFeed(); renderVotes(); renderCrew(); renderTyping(); renderTabs(); }

/* ---------- identity sheet ---------- */
function renderJoin(){
  const d = S.draft;
  $("joinPreviewAv").replaceChildren(avRaw(d.emoji, d.color, "lg"));
  $("joinPreviewName").textContent = $("codename").value.trim() || "Codename";
  const grid = $("emojiGrid"); grid.replaceChildren();
  EMOJI.forEach((e, i) => grid.append(h("button", {type:"button", "aria-pressed":String(i === d.emoji), "aria-label":"Avatar " + e, onclick:() => { d.emoji = i; renderJoin(); }}, e)));
  const sw = $("swatches"); sw.replaceChildren();
  COLORS.forEach((c, i) => { const b = h("button", {type:"button", "aria-pressed":String(i === d.color), "aria-label":"Colour " + (i + 1), onclick:() => { d.color = i; renderJoin(); }}); b.style.setProperty("--av", c); sw.append(b); });
}
function openJoin(){
  if (!canJoin()) return;
  const p = S.players[S.me];
  S.draft = p ? {emoji:p.emoji, color:p.color} : {emoji:rand(EMOJI.length), color:rand(COLORS.length)};
  $("codename").value = p ? p.codename : randomName();
  $("joinTitle").textContent = p ? "Change your identity" : "Choose your secret identity";
  $("joinLede").hidden = !!p;
  $("joinSubmit").textContent = p ? "Save" : "Join the party";
  $("joinClose").textContent = p ? "Cancel" : "Not now";
  $("joinErr").hidden = true;
  renderJoin();
  $("joinLayer").hidden = false;
}
async function submitJoin(e){
  e.preventDefault();
  const err = $("joinErr"), btn = $("joinSubmit");
  const codename = $("codename").value.trim().replace(/\s+/g, " ").slice(0, 28);
  if (codename.length < 2){ err.textContent = "Pick a codename with at least 2 characters."; err.hidden = false; return; }
  const taken = Object.values(S.players).some(p => p.id !== S.me && p.codename.toLowerCase() === codename.toLowerCase());
  if (taken){ err.textContent = "Another agent already has that codename. Roll the dice for a new one."; err.hidden = false; return; }
  btn.disabled = true;
  try {
    const res = await request("join", {codename, emoji:S.draft.emoji, color:S.draft.color});
    if (typeof res.you === "string") S.me = res.you;
    S.forceScroll = true;
    $("joinLayer").hidden = true;
    renderAll();
  } catch (ex){
    err.textContent = ex && ex.error === "taken" ? "Another agent just took that codename. Roll the dice for a new one." : errText(ex);
    err.hidden = false;
  } finally { btn.disabled = false; }
}
function maybePromptJoin(){
  if (S.joinPrompted || !canJoin() || joined()) return;
  S.joinPrompted = true; openJoin();
}

/* ---------- party details + organiser ---------- */
function openInfo(){
  const i = S.info || {};
  $("infoName").value = str(i.name, 40) || "Work party";
  $("infoWhen").value = str(i.when, 60);
  $("infoWhere").value = str(i.where, 60);
  $("infoErr").hidden = true;
  $("infoLayer").hidden = false;
}
async function submitInfo(e){
  e.preventDefault();
  const btn = $("infoSubmit"); btn.disabled = true;
  try {
    await request("info", {name:$("infoName").value, when:$("infoWhen").value, where:$("infoWhere").value});
    $("infoLayer").hidden = true; toast("Party details saved");
  } catch (ex){ $("infoErr").textContent = errText(ex); $("infoErr").hidden = false; }
  finally { btn.disabled = false; }
}
function openAdmin(){ $("adminInput").value = ""; $("adminErr").hidden = true; $("adminLayer").hidden = false; }
async function submitAdmin(e){
  e.preventDefault();
  const code = $("adminInput").value.trim();
  if (!code) return;
  try {
    await request("admin", {code});
    lsSet("partyhq-admin", code); S.isAdmin = true;
    $("adminLayer").hidden = true; renderAll(); toast("Organiser mode is on");
  } catch (ex){ $("adminErr").textContent = ex && ex.error === "forbidden" ? "That code didn't work." : errText(ex); $("adminErr").hidden = false; }
}
function leaveAdmin(){
  lsSet("partyhq-admin", null); S.isAdmin = false;
  request("admin", {code:""}).catch(() => {});
  renderAll();
}

/* ---------- wiring ---------- */
for (const b of document.querySelectorAll(".tab")) b.addEventListener("click", () => {
  S.tab = b.dataset.tab; S.forceScroll = S.tab === "chat"; renderTabs(); if (S.tab === "chat") renderFeed();
});
wide.addEventListener("change", () => renderAll());
$("composer").addEventListener("submit", e => { e.preventDefault(); send($("msgInput").value); });
$("msgInput").addEventListener("input", e => setTyping(!!e.target.value.trim()));
$("addForm").addEventListener("submit", async e => {
  e.preventDefault(); const inp = $("actInput"); const v = inp.value; inp.value = "";
  if (!(await addActivity(v)) && !inp.value) inp.value = v;
});
$("meBtn").addEventListener("click", openJoin);
$("editInfo").addEventListener("click", openInfo);
$("joinForm").addEventListener("submit", submitJoin);
$("joinClose").addEventListener("click", () => { $("joinLayer").hidden = true; });
$("dice").addEventListener("click", () => { $("codename").value = randomName(); renderJoin(); });
$("codename").addEventListener("input", () => { $("joinPreviewName").textContent = $("codename").value.trim() || "Codename"; });
$("infoForm").addEventListener("submit", submitInfo);
$("infoClose").addEventListener("click", () => { $("infoLayer").hidden = true; });
$("adminForm").addEventListener("submit", submitAdmin);
$("adminClose").addEventListener("click", () => { $("adminLayer").hidden = true; });
$("passForm").addEventListener("submit", e => {
  e.preventDefault();
  const v = $("passInput").value.trim(); if (!v) return;
  lsSet("partyhq-pass", v); $("passErr").hidden = true; hello();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape"){ $("joinLayer").hidden = true; $("infoLayer").hidden = true; $("adminLayer").hidden = true; }
});

renderAll();
connect();
})();
