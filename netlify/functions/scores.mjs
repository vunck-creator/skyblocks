// SKY BLOCKS 1990 全网排行榜：每个模式存一份 Top 50（Netlify Blobs，免费，不用另外开账号）
// GET  /api/scores            → {noob:[…],easy:[…],normal:[…],classic:[…]}
// POST /api/scores {mode,n,s,ln,lv} → {mode,rank,list}   rank = 0 表示没挤进榜
import { getStore } from "@netlify/blobs";

const MODES = ["noob", "easy", "normal", "classic"];
const MAX = 50;
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*", // 离线 HTML / Claude 网页版也能来查
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: HEADERS });
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

export function cleanName(n) {
  return String(n ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 10) || "???";
}
// 防一下太离谱的假分数：每消一行最多大约 5 万分
export function checkEntry(b) {
  if (!b || !MODES.includes(b.mode)) return "mode";
  if (!int(b.s, 1, 99999999) || !int(b.ln, 1, 99999) || !int(b.lv, 0, 99)) return "number";
  if (b.s > b.ln * 50000) return "score";
  return "";
}
export function insert(list, e) {
  list = Array.isArray(list) ? list.slice() : [];
  list.push(e);
  list.sort((a, b) => b.s - a.s || (a.t || 0) - (b.t || 0)); // 同分先到先得
  const top = list.slice(0, MAX);
  return { top, rank: top.indexOf(e) + 1 };
}

export default async (req, context) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  const store = getStore({ name: "skyblocks-ranks", consistency: "strong" });
  const load = async (m) => (await store.get(m, { type: "json" })) || [];
  if (req.method === "GET") {
    const all = {};
    for (const m of MODES) all[m] = await load(m);
    return json(all);
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b;
  try { b = await req.json(); } catch { return json({ error: "json" }, 400); }
  const bad = checkEntry(b);
  if (bad) return json({ error: bad }, 400);
  const now = Date.now();
  const e = { n: cleanName(b.n), s: b.s, ln: b.ln, lv: b.lv, d: new Date(now).toISOString().slice(0, 10), t: now };
  const { top, rank } = insert(await load(b.mode), e);
  if (rank) await store.setJSON(b.mode, top);
  return json({ mode: b.mode, rank, list: top });
};

export const config = { path: "/api/scores" };
