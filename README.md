# Affiliate Landing Page Analytics

Lightweight lead tracking for `index.html` and `thankyou.html` using a Cloudflare Worker plus D1. The page sends analytics with `navigator.sendBeacon()` so visits, clicks, and redirects do not block the visitor experience.

## What It Tracks

- Unique and returning visitors
- Page visits, button clicks, and thank-you redirects
- Device type, browser, OS, screen size, language, timezone, and referrer
- UTM source, medium, campaign, term, and content
- Country and city from Cloudflare request metadata
- Dashboard totals, conversion rate, recent events, CSV export, and daily stats

## Configure A Landing Page

Each tracked page has one reusable config block:

```html
<script>
  window.AFFILIATE_ANALYTICS = {
    siteId: "high-posting-jobs",
    endpoint: "/track"
  };
</script>
```

Use a different `siteId` for another landing page or campaign. Because this landing page is hosted on Render, the current pages send events directly to the deployed Worker endpoint:

```text
https://affiliate-analytics.leadspage.workers.dev/track
```

The old relative `/track` value only works if Cloudflare is proxying the same domain and routing `/track` to the Worker.

## Cloudflare Worker Setup

From the `worker/` folder:

```bash
npm install
npm run db:migrate
npm run deploy
```

If you already ran the first schema before these phase-two additions, run this once before deploying:

```bash
npm run db:upgrade:phase2
```

Important: these scripts use `--remote`, so they affect the Cloudflare-hosted D1 database. Without `--remote`, Wrangler only changes a local development database under `.wrangler/`.

After deployment, the Worker and D1 database run on Cloudflare. They do not depend on your local terminal staying open.

## GitHub Worker Deployment

Backend changes can deploy automatically from GitHub with `.github/workflows/cloudflare-worker.yml`. Add these repository secrets in GitHub:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

The token needs permission to deploy Workers and access D1 for this account. After those secrets exist, pushing changes under `worker/` triggers a Worker deployment.

The D1 binding is already configured in `worker/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "analytics"
database_id = "4c851261-5eec-4bb5-a278-ebdc406b8ef9"
```

If needed, the raw migration command is:

```bash
wrangler d1 execute analytics --file schema.sql
```

## Dashboard

Open `dashboard/view.html` and click `Refresh`. The deployed Worker URL is prefilled as `https://affiliate-analytics.leadspage.workers.dev`. The dashboard stores any URL override in your browser only and supports CSV export through `/export`.

For local viewing:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/dashboard/view.html
```

## Dashboard Protection

Set a Worker secret before deploying if you want the stats endpoints protected:

```bash
wrangler secret put DASHBOARD_TOKEN
```

When `DASHBOARD_TOKEN` is set, the dashboard must send the same value in the `Dashboard API key` field. This protects `/stats`, `/events`, `/live`, and `/export`. The public `/track` endpoint stays open so visitors can report events.

## Phase Two Additions

- Bot filtering for common crawlers and preview bots
- Funnel tracking for visit → click → WhatsApp redirect
- Session IDs, average session duration, and bounce rate
- Campaign comparison table
- Live visitor/event feed
- City-level location summary

## Social Redirect Links

`thankyou.html` uses `js/social-redirect.js` for app-first handoff. The current destination is WhatsApp:

```js
destinationUrl: "https://chat.whatsapp.com/L2P6K9nyhXLGyWptwYlTFb"
```

Supported app-first destinations:

- WhatsApp group invites: `https://chat.whatsapp.com/<invite-code>`
- WhatsApp direct links: `https://wa.me/<number>` or `https://api.whatsapp.com/...`
- Telegram links: `https://t.me/<username-or-group>`
- Any other URL falls back to normal browser redirect
