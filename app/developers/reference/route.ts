/**
 * Browsable rendering of the OpenAPI contract.
 *
 * The /developers page is the hand-written quick reference; this route renders
 * the *same* spec (served at /api/v1/openapi.json) as a full, three-panel API
 * reference so integrators get a real docs experience instead of a wall of raw
 * JSON. Redoc is loaded from a CDN and pinned to its v2 major — this page is
 * developer-facing, so a CDN dependency is acceptable here where it would not
 * be in the farmer-facing app. The raw JSON stays the reliable machine path.
 */

export function GET() {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>API reference — Seasonwise</title>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
  .topbar {
    display: flex; flex-wrap: wrap; gap: 1.25rem; align-items: center;
    padding: 0.75rem 1.25rem; border-bottom: 1px solid #e7e2d6;
    background: #faf7f0; font: 600 14px/1 system-ui, sans-serif;
  }
  .topbar a { color: #1f5130; text-decoration: none; }
  .topbar a:hover { text-decoration: underline; }
  .topbar .sep { flex: 1; }
  noscript { display: block; padding: 1.25rem; color: #444; }
</style>
</head>
<body>
<div class="topbar">
  <a href="/developers">&larr; Developer docs</a>
  <span class="sep"></span>
  <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer">Raw openapi.json &#8599;</a>
</div>
<noscript>
  This interactive reference needs JavaScript. The raw specification is
  available at <a href="/api/v1/openapi.json">/api/v1/openapi.json</a>.
</noscript>
<redoc spec-url="/api/v1/openapi.json" hide-download-button></redoc>
<script src="https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js"></script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, s-maxage=3600",
    },
  });
}
