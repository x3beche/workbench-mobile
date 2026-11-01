/**
 * The made-up server's Office (backend/office.py, backend/office_embed.py).
 *
 * The phone no longer draws the office: it hosts the web's own `/office/embed` in a WebView and opens it with a
 * one-off ticket (`POST /api/office/embed-token`). This mock answers that with `ready: false` - the page is
 * another task's (#a02107), and until it lands the app draws its stand-in, which is what a screenshot of the screen
 * shows. Set `MOCK_OFFICE_EMBED=/office/embed` (a page the mock serves, or any address) to see the "real page"
 * branch instead: the app then loads that address with the ticket in a header.
 */
const EMBED = process.env.MOCK_OFFICE_EMBED || '';

const TICKET = () => `mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export function officeEmbedToken() {
  if (!EMBED) return { ready: false, url: null, token: null, expires_in: 0 };
  return { ready: true, url: EMBED, token: TICKET(), expires_in: 60 };
}

/** GET /api/office/embed-token (the app asks with POST; this mock takes either). */
export function handleOffice(req, res, p) {
  if (p !== '/api/office/embed-token') return false;
  if (req.method !== 'GET' && req.method !== 'POST') return false;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(officeEmbedToken()));
  return true;
}
