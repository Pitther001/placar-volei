import { room, roomRef, connRef, onValue, update, DEFAULTS, merge, toArr, configured } from "./firebase.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const AB = ["A", "B"], other = t => (t === "A" ? "B" : "A");
let S = merge(DEFAULTS, {}), lib = { teams: {}, sets: {} }, undo = [];
const pending = { A: null, B: null };

const patch = o => update(roomRef(), o);
const get = (p, o = S) => p.split("/").reduce((a, k) => a?.[k], o);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const slug = s => (s || "item").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
function toast(m) {
  const t = $("#toast"); t.textContent = m; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ---------- imagens: redimensiona e mantém transparência (PNG) ---------- */
function toDataURL(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL("image/png"));
    };
    img.onerror = rej; img.src = url;
  });
}

/* ---------- regras do vôlei ---------- */
const G = () => { const g = structuredClone(S.game); g.history = toArr(g.history); return g; };
const target = g => (g.setNumber >= 5 ? 15 : 25);
const won = (g, t) => g.score[t] >= target(g) && g.score[t] - g.score[other(t)] >= 2;
const matchOver = g => g.sets.A >= 3 || g.sets.B >= 3;

function saveGame(g) {
  undo.push(structuredClone(S.game));
  if (undo.length > 100) undo.shift();
  patch({ game: g });
}

function point(t, d) {
  const g = G();
  if (g.finished) {
    if (d > 0) return;                              // set encerrado: só aceita correção (−1)
    g.finished = false;
    if (g.winner) g.sets[g.winner] = Math.max(0, g.sets[g.winner] - 1);
    g.winner = "";
  }
  const n = g.score[t] + d;
  if (n < 0) return;
  g.score[t] = n;
  if (d > 0) g.serving = t;                         // quem pontua passa a sacar
  for (const x of AB) if (won(g, x)) { g.sets[x]++; g.finished = true; g.winner = x; break; }
  saveGame(g);
}

function adjSets(t, d) {
  const g = G(); g.sets[t] = Math.min(3, Math.max(0, g.sets[t] + d)); saveGame(g);
}
function setServe(t) { const g = G(); g.serving = t; saveGame(g); }

function nextSet() {
  const g = G();
  if (matchOver(g) || g.setNumber >= 5) return;
  if (!g.finished && (g.score.A || g.score.B) &&
      !confirm("O set atual ainda não foi concluído. Avançar sem contar o set?")) return;
  g.history.push({ A: g.score.A, B: g.score.B, winner: g.finished ? g.winner : "" });
  g.score = { A: 0, B: 0 }; g.setNumber++; g.finished = false; g.winner = "";
  saveGame(g);
}
function prevSet() {
  const g = G();
  if (!g.history.length) return;
  if ((g.score.A || g.score.B || g.finished) && !confirm("Voltar ao set anterior descarta o placar do set atual. Continuar?")) return;
  if (g.finished && g.winner) g.sets[g.winner] = Math.max(0, g.sets[g.winner] - 1);
  const h = g.history.pop();
  g.score = { A: h.A, B: h.B }; g.setNumber = Math.max(1, g.setNumber - 1);
  g.finished = !!h.winner; g.winner = h.winner || "";
  saveGame(g);
}
function resetSet() {
  const g = G();
  if ((g.score.A || g.score.B) && !confirm("Reiniciar o placar do set atual?")) return;
  if (g.finished && g.winner) g.sets[g.winner] = Math.max(0, g.sets[g.winner] - 1);
  g.score = { A: 0, B: 0 }; g.finished = false; g.winner = "";
  saveGame(g);
}
function resetMatch() {
  if (!confirm("Reiniciar TODA a partida (sets e pontos)?")) return;
  undo.push(structuredClone(S.game));
  patch({ game: structuredClone(DEFAULTS.game) });
}
function doUndo() { const g = undo.pop(); if (g) patch({ game: g }); }

/* ---------- configuração das equipes (gerada a partir do template) ---------- */
const tpl = $("#tplTeam").innerHTML;
$("#teamsCfg").innerHTML = AB.map(t => tpl.replaceAll("__T__", t)).join("");

AB.forEach(t => {
  const box = $(`.team-cfg[data-team="${t}"]`), q = s => $(s, box);
  q(".f-file").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    pending[t] = await toDataURL(f, 256);
    q(".f-apply").disabled = false; render();
  };
  q(".f-apply").onclick = () => {
    if (!pending[t]) return;
    patch({ [`teams/${t}/logo`]: pending[t] });
    pending[t] = null; q(".f-file").value = ""; q(".f-apply").disabled = true;
  };
  q(".f-clear").onclick = () => {
    pending[t] = null; q(".f-file").value = ""; q(".f-apply").disabled = true;
    patch({ [`teams/${t}/logo`]: "" });
  };
  q(".f-save").onclick = () => {
    const tm = S.teams[t];
    patch({ [`library/teams/${slug(tm.name)}`]: tm }); toast("Equipe salva!");
  };
  q(".f-load").onclick = () => {
    const k = q(".f-lib").value;
    if (lib.teams[k]) patch({ [`teams/${t}`]: lib.teams[k] });
  };
  q(".f-del").onclick = () => {
    const k = q(".f-lib").value;
    if (k && confirm("Excluir esta equipe salva?")) patch({ [`library/teams/${k}`]: null });
  };
});

/* ---------- patrocinadores ---------- */
$("#spFile").onchange = async e => {
  const items = [];
  for (const f of e.target.files)
    items.push({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), src: await toDataURL(f, 400) });
  e.target.value = "";
  patch({ sponsors: [...toArr(S.sponsors), ...items] });
};
$("#spList").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  const i = +b.dataset.i, act = b.dataset.act, a = toArr(S.sponsors).slice();
  if (act === "del") a.splice(i, 1);
  else {
    const j = act === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
  }
  patch({ sponsors: a });
};
$("#setSave").onclick = () => {
  const name = $("#setName").value.trim();
  if (!name) return alert("Dê um nome ao conjunto.");
  patch({ [`library/sponsorSets/${slug(name)}`]: { name, items: toArr(S.sponsors) } });
  toast("Conjunto salvo!");
};
$("#setLoad").onclick = () => {
  const s = lib.sets[$("#setSel").value];
  if (s) patch({ sponsors: toArr(s.items) });
};
$("#setDel").onclick = () => {
  const k = $("#setSel").value;
  if (k && confirm("Excluir este conjunto?")) patch({ [`library/sponsorSets/${k}`]: null });
};

/* ---------- logo do campeonato ---------- */
$("#champFile").onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  patch({ "champ/src": await toDataURL(f, 600) }); e.target.value = "";
};
$("#champClear").onclick = () => patch({ "champ/src": "" });
$("#btnStyleReset").onclick = () => { if (confirm("Restaurar o visual padrão?")) patch({ style: DEFAULTS.style }); };

/* ---------- campos genéricos (data-path) ---------- */
document.addEventListener("input", e => {
  const el = e.target, p = el.dataset?.path; if (!p) return;
  patch({ [p]: el.type === "checkbox" ? el.checked : el.type === "range" ? +el.value : el.value });
});

/* ---------- botões do placar ---------- */
$$("[data-d]").forEach(b => b.onclick = () => { const [t, d] = b.dataset.d.split(","); point(t, +d); });
$$("[data-s]").forEach(b => b.onclick = () => { const [t, d] = b.dataset.s.split(","); adjSets(t, +d); });
$$("[data-serve]").forEach(b => b.onclick = () => setServe(b.dataset.serve));
$("#btnSwap").onclick = () => setServe(other(S.game.serving));
$("#btnNext").onclick = nextSet;
$("#btnPrev").onclick = prevSet;
$("#btnResetSet").onclick = resetSet;
$("#btnResetMatch").onclick = resetMatch;
$("#btnUndo").onclick = doUndo;

addEventListener("keydown", e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); return doUndo(); }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  ({ q: () => point("A", 1), a: () => point("A", -1), p: () => point("B", 1), l: () => point("B", -1) })[k]?.();
});

/* ---------- sala, URL do overlay, prévia ---------- */
const overlayUrl = new URL("overlay.html?sala=" + encodeURIComponent(room), location.href).href;
$("#roomInput").value = room;
$("#urlBox").value = overlayUrl;
$("#preview").src = overlayUrl;
$("#btnRoom").onclick = () => {
  const v = $("#roomInput").value.trim();
  if (v) location.search = "?sala=" + encodeURIComponent(v);
};
$("#btnCopy").onclick = async () => {
  try { await navigator.clipboard.writeText(overlayUrl); toast("URL do overlay copiada!"); }
  catch { prompt("Copie a URL:", overlayUrl); }
};
$("#cfgWarn").hidden = configured;
onValue(connRef, s => {
  const ok = s.val() === true, p = $("#status");
  p.textContent = ok ? "● conectado" : "● desconectado";
  p.className = "pill " + (ok ? "ok" : "bad");
});

/* ---------- renderização ---------- */
function fillSelect(sel, entries, label) {
  const sig = JSON.stringify(entries);
  if (sel.dataset.sig === sig) return;
  const cur = sel.value; sel.dataset.sig = sig;
  sel.innerHTML = `<option value="">— ${label} —</option>` +
    entries.map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`).join("");
  sel.value = cur;
}

function render() {
  const g = G(), T = S.teams, over = matchOver(g);
  $("#setInfo").textContent = `· ${g.setNumber}º set · até ${target(g)} pontos (diferença mín. 2)`;

  AB.forEach(t => {
    $("#name" + t).textContent = T[t].name;
    $("#pts" + t).textContent = g.score[t];
    $("#sets" + t).textContent = g.sets[t];
    $("#ctl" + t).style.borderColor = T[t].bg;
    $("#ctl" + t).classList.toggle("serving", g.serving === t);
    $("#srv" + t).textContent = g.serving === t ? "🏐 SACANDO" : "Dar saque";

    const box = $(`.team-cfg[data-team="${t}"]`), pv = $(".f-prev", box);
    const src = pending[t] || T[t].logo;
    if (pv.dataset.s !== src) { pv.dataset.s = src; src ? pv.src = src : pv.removeAttribute("src"); }
    pv.style.visibility = src ? "visible" : "hidden";
    fillSelect($(".f-lib", box), Object.entries(lib.teams).map(([k, v]) => [k, v.name]), "equipes salvas");
  });

  const al = $("#alert");
  if (over) {
    const w = g.sets.A > g.sets.B ? "A" : "B";
    al.textContent = `🏆 Partida encerrada: ${T[w].name} venceu por ${g.sets[w]} a ${g.sets[other(w)]}.`; al.hidden = false;
  } else if (g.finished) {
    al.textContent = `✅ ${T[g.winner].name} venceu o ${g.setNumber}º set (${g.score.A} x ${g.score.B}). Clique em "Próximo set".`; al.hidden = false;
  } else al.hidden = true;

  $("#btnNext").disabled = over || g.setNumber >= 5;
  $("#btnPrev").disabled = !g.history.length;
  $("#btnUndo").disabled = !undo.length;

  $$("[data-path]").forEach(el => {
    const v = get(el.dataset.path);
    if (el.type === "checkbox") el.checked = !!v;
    else if (el !== document.activeElement && v !== undefined) el.value = v;
    if (el.nextElementSibling?.tagName === "OUTPUT") el.nextElementSibling.textContent = v;
  });

  const cp = $("#champPrev"), cs = S.champ.src;
  if (cp.dataset.s !== cs) { cp.dataset.s = cs; cs ? cp.src = cs : cp.removeAttribute("src"); }
  cp.style.visibility = cs ? "visible" : "hidden";

  const sp = toArr(S.sponsors), list = $("#spList"), sig = sp.map(x => x.id).join();
  if (list.dataset.sig !== sig) {
    list.dataset.sig = sig;
    list.innerHTML = sp.map((x, i) => `<div class="sp-item"><img src="${x.src}" alt=""><span>Logo ${i + 1}</span>
      <button data-act="up" data-i="${i}">↑</button><button data-act="down" data-i="${i}">↓</button>
      <button data-act="del" data-i="${i}" class="danger">✕</button></div>`).join("");
  }
  fillSelect($("#setSel"), Object.entries(lib.sets).map(([k, v]) => [k, v.name]), "conjuntos salvos");
}

onValue(roomRef(), snap => {
  const v = snap.val() || {};
  S = merge(DEFAULTS, v);
  lib = { teams: v.library?.teams || {}, sets: v.library?.sponsorSets || {} };
  render();
});