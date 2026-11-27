// POST /api/scan with the photo as the body (image/jpeg, image/png, image/webp, up to 8 MB) → { text, confidence, turned, ms }.
// Only the dashboard's own sites may call it from a browser. Nothing is stored: the photo is read and forgotten.
import { readCard } from "../read.js";

const ALLOWED = [/^https:\/\/work\.thinkhealth\.in$/, /^https:\/\/training-dashboard-[a-z0-9-]+\.vercel\.app$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/];
const MAX = 8 * 1024 * 1024;

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const origin = req.headers.origin ?? "";
  const ok = ALLOWED.some((r) => r.test(origin));
  if (ok) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
  }
  if (req.method === "OPTIONS") return res.status(ok ? 204 : 403).end();
  if (req.method === "GET") {
    // GET ?check=1: reads a small made-up picture and says how long each step took (to see where time goes on Vercel).
    if (/[?&]check=1/.test(req.url ?? "")) {
      const steps = [];
      try {
        const sharp = (await import("sharp")).default;
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="200"><rect width="100%" height="100%" fill="white"/><text x="30" y="120" font-size="64" font-family="Arial">TEST CARD 12345</text></svg>';
        const out = await readCard(await sharp(Buffer.from(svg)).png().toBuffer(), steps);
        return res.status(200).json({ ok: true, text: out.text, steps });
      } catch (e) { return res.status(500).json({ ok: false, error: String(e?.message ?? e), steps }); }
    }
    return res.status(200).json({ ok: true, what: "Think Health card scanner: POST a card photo to /api/scan" });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST a photo" });
  if (origin && !ok) return res.status(403).json({ error: "Not allowed from this site" });
  if (!/^image\//.test(req.headers["content-type"] ?? "")) return res.status(415).json({ error: "Send the photo itself (image/jpeg or image/png)" });

  const parts = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX) return res.status(413).json({ error: "The photo is over 8 MB" });
      parts.push(chunk);
    }
    const out = await readCard(Buffer.concat(parts));
    return res.status(200).json(out);
  } catch (e) {
    console.error("[scan]", e);
    return res.status(500).json({ error: "Couldn't read that photo" });
  }
}
