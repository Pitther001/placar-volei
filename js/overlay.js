import { roomRef, onValue, DEFAULTS, merge, toArr } from "./firebase.js";

const $ = id => document.getElementById(id);
const stage = $("stage");
let first = true;

function fit() {
  stage.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`;
}
addEventListener("resize", fit); fit();

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
};
function setImg(img, src) {
  if (img.dataset.src !== src) { img.dataset.src = src; src ? img.src = src : img.removeAttribute("src"); }
  img.style.visibility = src ? "visible" : "hidden";
}
function setNum(el, v) {
  if (el.textContent !== String(v)) {
    el.textContent = v;
    if (!first) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  }
}

function render(s) {
  const st = s.style, g = s.game, op = st.bgOpacity / 100;
  const b = $("board");
  b.style.left = st.x + "px"; b.style.top = st.y + "px"; b.style.transform = `scale(${st.scale / 100})`;
  const v = stage.style;
  v.setProperty("--rowH", st.rowH + "px"); v.setProperty("--logo", st.logo + "px");
  v.setProperty("--nameSize", st.nameSize + "px"); v.setProperty("--numSize", st.numSize + "px");
  v.setProperty("--sp", s.sponsorBar.size + "px"); v.setProperty("--gap", s.sponsorBar.gap + "px");
  v.setProperty("--champ", s.champ.size + "px");

  ["A", "B"].forEach(t => {
    const row = $("row" + t), tm = s.teams[t], q = c => row.querySelector(c);
    q(".name span").textContent = tm.name;
    q(".name").style.background = rgba(tm.bg, op);
    q(".name").style.color = tm.color;
    q(".logo").style.background = rgba(st.setsBg, op);
    q(".sets").style.background = rgba(st.setsBg, op);
    q(".pts").style.background = rgba(st.pointsBg, op);
    setImg(q(".logo img"), tm.logo);
    q(".serve").classList.toggle("on", g.serving === t);
    setNum(q(".sets b"), g.sets[t]);
    setNum(q(".pts b"), g.score[t]);
  });

  const badge = $("setBadge"), over = g.sets.A >= 3 || g.sets.B >= 3;
  badge.textContent = over ? "Fim de jogo" : g.finished ? `Fim do ${g.setNumber}º set` : `${g.setNumber}º set`;
  badge.style.display = st.showSetBadge ? "inline-block" : "none";
  badge.style.background = rgba(st.setsBg, op);

  // iguala a largura dos dois nomes
  const names = [...document.querySelectorAll(".name")];
  names.forEach(n => n.style.minWidth = "340px");
  const w = Math.max(...names.map(n => n.scrollWidth));
  names.forEach(n => n.style.minWidth = w + "px");

  // patrocinadores
  const sp = toArr(s.sponsors), box = $("sponsors"), sig = sp.map(x => x.id).join();
  if (box.dataset.sig !== sig) {
    box.dataset.sig = sig; box.innerHTML = "";
    sp.forEach(x => { const i = new Image(); i.src = x.src; box.appendChild(i); });
  }
  box.style.display = s.sponsorBar.visible && sp.length ? "flex" : "none";

  // logo do campeonato
  setImg($("champ").querySelector("img"), s.champ.src);
  $("champ").style.display = s.champ.visible && s.champ.src ? "block" : "none";

  first = false;
}

onValue(roomRef(), snap => render(merge(DEFAULTS, snap.val() || {})));