# Affiliate Landing Page Analytics

Lightweight lead tracking for the single-page `index.html` landing page using a Cloudflare Worker plus D1. The page sends analytics with `navigator.sendBeacon()` so visits and CTA handoffs do not block the visitor experience.

## What It Tracks

- Unique and returning visitors
- Page visits, CTA selections, and visitor-initiated WhatsApp/Telegram handoffs
- Device type, browser, OS, screen size, language, timezone, and referrer
- UTM source, medium, campaign, term, and content
- Country and city from Cloudflare request metadata
- Dashboard totals, CTA session rate, recent events, CSV export, and daily stats

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

### TikTok Events API

The Worker can forward a visitor-initiated social handoff to TikTok without exposing the access token in the website code. Store the token as a Worker secret, set the Pixel ID to the same Pixel ID used in `index.html`, and deploy:

```bash
cd worker
npx wrangler secret put TIKTOK_ACCESS_TOKEN
npx wrangler secret put TIKTOK_PIXEL_ID
npm run deploy
```

For Events Manager testing, also set `TIKTOK_TEST_EVENT_CODE` as a Worker secret. Remove it after verification so production events are not marked as test events. Rotate any token that has been pasted into chat, source files, or logs.

## Phase Two Additions

- Bot filtering for common crawlers and preview bots
- Funnel tracking for visit → CTA selection → outbound handoff
- Session IDs, average session duration, and bounce rate
- Campaign comparison table
- Live visitor/event feed
- City-level location summary

## Social links and lead reporting

The two destination links are set directly in `index.html`. A tap is an **outbound handoff**, not a completed lead: neither WhatsApp nor Telegram tells this website whether a visitor joined a group or sent a message. Use the group member list, message replies, or a dedicated join form to measure completed leads.

For reliable TikTok campaign attribution, set the ad's destination URL with UTMs, for example:

```text
https://your-domain.example/?utm_source=tiktok&utm_medium=paid_social&utm_campaign=september_whatsapp
```
