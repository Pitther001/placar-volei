import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// >>> COLE AQUI a configuração do seu projeto Firebase <<<
const firebaseConfig = {
  apiKey: "AIzaSyDqH_Lww5gAfNP9ewEUdvNy7t9nMTty99Y",
  authDomain: "placar-volei-f112b.firebaseapp.com",
  databaseURL: "https://placar-volei-f112b-default-rtdb.firebaseio.com",
  projectId: "placar-volei-f112b",
  appId: "1:319222241025:web:9ac4fbd3c5fbe17cb7ad00"
};

export const configured = !firebaseConfig.apiKey.startsWith("COLE");
export const room = (new URLSearchParams(location.search).get("sala") || "principal").replace(/[.#$\[\]\/]/g, "-");

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const roomRef = (p = "") => ref(db, `rooms/${room}${p ? "/" + p : ""}`);
export const connRef = ref(db, ".info/connected");
export { onValue, update };

// Valores padrão (usados pelo painel e pelo overlay)
export const DEFAULTS = {
  teams: {
    A: { name: "TIME A", logo: "", bg: "#1d4ed8", color: "#ffffff" },
    B: { name: "TIME B", logo: "", bg: "#dc2626", color: "#ffffff" }
  },
  game: { score: { A: 0, B: 0 }, sets: { A: 0, B: 0 }, setNumber: 1, serving: "A", finished: false, winner: "", history: [] },
  sponsorBar: { visible: true, size: 70, gap: 24 },
  sponsors: [],
  champ: { src: "", visible: true, size: 160 },
  style: { x: 40, y: 40, scale: 100, rowH: 64, logo: 48, nameSize: 30, numSize: 42, bgOpacity: 85,
           setsBg: "#0b1220", pointsBg: "#111111", showSetBadge: true }
};

export const toArr = v => !v ? [] : Array.isArray(v) ? v.filter(Boolean) : Object.values(v);

export function merge(base, over) {
  if (over === undefined || over === null) return base;
  if (typeof base !== "object" || base === null || Array.isArray(base)) return over;
  const r = { ...base };
  for (const k in over) r[k] = k in base ? merge(base[k], over[k]) : over[k];
  return r;
}