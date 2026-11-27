# Think Health card scanner

Reads the words on a visiting-card photo and sends them back. Used by the Think Health Dashboard (External Leads →
Add a lead → Auto-Fill Via Picture). Nothing is stored.

- `POST /api/scan` with the photo as the body (`image/jpeg` or `image/png`, up to 8 MB) → `{ text, lines, confidence, turned, ms }`
- Only work.thinkhealth.in and the dashboard's own vercel.app address may call it from a browser.
- Reading: the photo is turned upright, sized, read plain and cleaned (Tesseract, standard English model in `lang/`);
  the way up that reads most is kept. The dashboard turns the words into the form's labels (`src/lib/cardScan.ts` there).
- Try a photo on this computer: `npm install`, then `node try.js <photo>`.
