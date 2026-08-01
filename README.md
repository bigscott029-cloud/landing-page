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

Use a different `siteId` for another landing page or campaign. If the Worker is not routed on the same domain as the page, change `endpoint` to the deployed Worker URL plus `/track`. Because this landing page is hosted on Render, `/track` only works after you either add a Cloudflare route/proxy in front of the same domain or replace it with the full Worker URL.

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

Open `dashboard/view.html`, enter the deployed Worker URL, and click `Refresh`. The dashboard stores that URL in your browser only and supports CSV export through `/export`.

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
