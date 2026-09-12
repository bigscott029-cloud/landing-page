const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Analytics-Key"
};

const BOT_PATTERN = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegrambot|slackbot|discordbot|linkedinbot|twitterbot|pinterest|semrush|ahrefs|curl|wget|python-requests/i;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      if (url.pathname === "/track" && request.method === "POST") {
        return track(request, env, ctx);
      }

      if (url.pathname === "/stats" && request.method === "GET") {
        const denied = authorize(request, env);
        return denied || stats(url, env);
      }

      if (url.pathname === "/events" && request.method === "GET") {
        const denied = authorize(request, env);
        return denied || events(url, env);
      }

      if (url.pathname === "/live" && request.method === "GET") {
        const denied = authorize(request, env);
        return denied || live(url, env);
      }

      if (url.pathname === "/export" && request.method === "GET") {
        const denied = authorize(request, env);
        return denied || exportCsv(url, env);
      }

      if (url.pathname === "/reset" && request.method === "POST") {
        if (!env.DASHBOARD_TOKEN) {
          return json({ error: "Reset is disabled until DASHBOARD_TOKEN is configured." }, 503);
        }

        const denied = authorize(request, env);
        return denied || resetData(url, env);
      }

      return json({ ok: true, service: "affiliate-analytics" });
    } catch (error) {
      return json({ error: error.message }, 500);
    }
  }
};

async function track(request, env, ctx) {
  const body = await readJson(request);
  const cf = request.cf || {};
  const userAgent = body.user_agent || request.headers.get("User-Agent") || "";
  const isBot = BOT_PATTERN.test(userAgent);

  if (isBot && env.STORE_BOT_EVENTS !== "true") {
    return json({ ok: true, ignored: "bot" });
  }

  await env.DB.prepare(
    `INSERT INTO visits (
      site_id, visitor_id, session_id, returning_visitor, event, engagement_ms, is_bot,
      page, page_url, label, destination, country, city, device, browser, os,
      language, timezone, screen, referrer, user_agent, utm_source, utm_medium,
      utm_campaign, utm_term, utm_content
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    clean(body.site_id, "default"),
    clean(body.visitor_id),
    clean(body.session_id),
    body.returning ? 1 : 0,
    clean(body.event, "visit"),
    Number(body.engagement_ms || 0),
    isBot ? 1 : 0,
    clean(body.page),
    clean(body.page_url),
    clean(body.label),
    clean(body.destination),
    clean(cf.country),
    clean(cf.city),
    clean(body.device),
    clean(body.browser),
    clean(body.os),
    clean(body.language),
    clean(body.timezone),
    clean(body.screen),
    clean(body.referrer),
    clean(userAgent),
    clean(body.utm_source),
    clean(body.utm_medium),
    clean(body.utm_campaign),
    clean(body.utm_term),
    clean(body.utm_content)
  ).run();

  // Only send a TikTok conversion signal after a real, visitor-initiated
  // outbound handoff. Timer redirects are not evidence of a lead.
  if (env.TIKTOK_ACCESS_TOKEN && env.TIKTOK_PIXEL_ID && body.event === "handoff") {
    ctx.waitUntil(sendTikTokEvent(request, env, body, cf));
  }

  return json({ ok: true });
}

async function sendTikTokEvent(request, env, body, cf) {
  const event = "ClickButton";
  const user = {
    ip: request.headers.get("CF-Connecting-IP") || "",
    user_agent: body.user_agent || request.headers.get("User-Agent") || ""
  };

  if (body.ttclid) user.ttclid = clean(body.ttclid);
  if (body.ttp) user.ttp = clean(body.ttp);

  const payload = {
    event_source: "web",
    event_source_id: env.TIKTOK_PIXEL_ID,
    data: [{
      event,
      event_time: Math.floor(Date.now() / 1000),
      event_id: clean(body.event_id, crypto.randomUUID()),
      user,
      page: {
        url: clean(body.page_url),
        referrer: clean(body.referrer)
      },
      properties: {
        channel: clean(body.label),
        country: clean(cf.country),
        city: clean(cf.city)
      }
    }]
  };

  if (env.TIKTOK_TEST_EVENT_CODE) {
    payload.test_event_code = env.TIKTOK_TEST_EVENT_CODE;
  }

  await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
    method: "POST",
    headers: {
      "Access-Token": env.TIKTOK_ACCESS_TOKEN,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

async function readJson(request) {
  const text = await request.text();

  if (!text) {
    return {};
  }

  return JSON.parse(text);
}

async function stats(url, env) {
  const siteId = url.searchParams.get("site_id") || "default";
  const since = url.searchParams.get("since") || "1970-01-01";
  const where = "site_id = ? AND created_at >= ? AND COALESCE(is_bot, 0) = 0";

  const totals = await env.DB.prepare(
    `SELECT
      COUNT(*) AS events,
      COUNT(DISTINCT visitor_id) AS visitors,
      COUNT(DISTINCT session_id) AS sessions,
      SUM(CASE WHEN event = 'visit' THEN 1 ELSE 0 END) AS visits,
      SUM(CASE WHEN event = 'click' THEN 1 ELSE 0 END) AS clicks,
      SUM(CASE WHEN event = 'handoff' THEN 1 ELSE 0 END) AS handoffs,
      COUNT(DISTINCT CASE WHEN event = 'click' AND session_id != '' THEN session_id END) AS click_sessions,
      SUM(CASE WHEN returning_visitor = 1 AND event = 'visit' THEN 1 ELSE 0 END) AS returning_visits
    FROM visits
    WHERE ${where}`
  ).bind(siteId, since).first();

  const sessionSummary = await env.DB.prepare(
    `WITH sessions AS (
      SELECT
        session_id,
        MAX(engagement_ms) AS engagement_ms,
        SUM(CASE WHEN event = 'visit' THEN 1 ELSE 0 END) AS visits,
        SUM(CASE WHEN event IN ('click', 'handoff') THEN 1 ELSE 0 END) AS conversions
      FROM visits
      WHERE ${where} AND session_id != ''
      GROUP BY session_id
    )
    SELECT
      AVG(engagement_ms) AS avg_engagement_ms,
      SUM(CASE WHEN visits > 0 AND conversions = 0 THEN 1 ELSE 0 END) AS bounced_sessions
    FROM sessions`
  ).bind(siteId, since).first();

  const funnel = await env.DB.prepare(
    `SELECT event AS label, COUNT(*) AS total
     FROM visits
     WHERE ${where} AND event IN ('visit', 'click', 'handoff')
     GROUP BY event`
  ).bind(siteId, since).all();

  const campaigns = await campaignComparison(env, siteId, since);
  const socialBreakdown = await env.DB.prepare(
    `SELECT
      CASE
        WHEN lower(COALESCE(label, '')) LIKE '%telegram%' THEN 'Telegram'
        WHEN lower(COALESCE(label, '')) LIKE '%whatsapp%' THEN 'WhatsApp'
        ELSE 'Other'
      END AS label,
      COUNT(*) AS total
     FROM visits
     WHERE ${where} AND event = 'handoff'
     GROUP BY label
     ORDER BY total DESC`
  ).bind(siteId, since).all();
  const topReferrers = await grouped(env, siteId, since, "referrer");
  const topCampaigns = await grouped(env, siteId, since, "utm_campaign");
  const topCountries = await grouped(env, siteId, since, "country");
  const topCities = await env.DB.prepare(
    `SELECT
      CASE
        WHEN city != '' AND country != '' THEN city || ', ' || country
        WHEN city != '' THEN city
        WHEN country != '' THEN country
        ELSE 'Unknown'
      END AS label,
      COUNT(*) AS total
     FROM visits
     WHERE ${where} AND event = 'visit'
     GROUP BY label
     ORDER BY total DESC
     LIMIT 10`
  ).bind(siteId, since).all();
  const daily = await env.DB.prepare(
    `SELECT DATE(created_at) AS label, COUNT(*) AS total
     FROM visits
     WHERE ${where} AND event = 'visit'
     GROUP BY DATE(created_at)
     ORDER BY label DESC
     LIMIT 30`
  ).bind(siteId, since).all();

  const visitors = totals.visitors || 0;
  const sessions = totals.sessions || 0;
  const bouncedSessions = sessionSummary.bounced_sessions || 0;

  return json({
    totals: {
      events: totals.events || 0,
      visitors,
      sessions,
      visits: totals.visits || 0,
      clicks: totals.clicks || 0,
      handoffs: totals.handoffs || 0,
      returning_visits: totals.returning_visits || 0,
      conversion_rate: sessions ? percent(totals.click_sessions || 0, sessions) : 0,
      bounce_rate: sessions ? percent(bouncedSessions, sessions) : 0,
      avg_session_seconds: Math.round((sessionSummary.avg_engagement_ms || 0) / 1000)
    },
    funnel: normalizeFunnel(funnel.results),
    socialBreakdown: socialBreakdown.results,
    campaignComparison: campaigns.results.map(addCampaignRates),
    topReferrers: topReferrers.results,
    topCampaigns: topCampaigns.results,
    topCountries: topCountries.results,
    topCities: topCities.results,
    daily: daily.results
  });
}

async function events(url, env) {
  const siteId = url.searchParams.get("site_id") || "default";
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

  const rows = await env.DB.prepare(
    `SELECT id, event, page, label, destination, country, city, device, browser, os,
      referrer, utm_source, utm_campaign, engagement_ms, created_at
     FROM visits
     WHERE site_id = ? AND COALESCE(is_bot, 0) = 0
     ORDER BY created_at DESC
     LIMIT ?`
  ).bind(siteId, limit).all();

  return json({ events: rows.results });
}

async function live(url, env) {
  const siteId = url.searchParams.get("site_id") || "default";
  const rows = await env.DB.prepare(
    `SELECT event, country, city, device, browser, utm_source, utm_campaign, created_at
     FROM visits
     WHERE site_id = ? AND COALESCE(is_bot, 0) = 0 AND event IN ('visit', 'click', 'handoff')
     ORDER BY created_at DESC
     LIMIT 20`
  ).bind(siteId).all();

  return json({ live: rows.results });
}

async function exportCsv(url, env) {
  const siteId = url.searchParams.get("site_id") || "default";
  const rows = await env.DB.prepare(
    `SELECT * FROM visits
     WHERE site_id = ? AND COALESCE(is_bot, 0) = 0
     ORDER BY created_at DESC
     LIMIT 5000`
  ).bind(siteId).all();

  const headers = Object.keys(rows.results[0] || { id: "", event: "", created_at: "" });
  const csv = [
    headers.join(","),
    ...rows.results.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n");

  return new Response(csv, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=analytics.csv"
    }
  });
}

async function resetData(url, env) {
  const siteId = url.searchParams.get("site_id") || "default";
  const result = await env.DB.prepare("DELETE FROM visits WHERE site_id = ?").bind(siteId).run();

  return json({ ok: true, site_id: siteId, deleted: result.meta.changes || 0 });
}

async function grouped(env, siteId, since, field) {
  return env.DB.prepare(
    `SELECT COALESCE(NULLIF(${field}, ''), 'Direct / Unknown') AS label, COUNT(*) AS total
     FROM visits
     WHERE site_id = ? AND created_at >= ? AND COALESCE(is_bot, 0) = 0 AND event = 'visit'
     GROUP BY label
     ORDER BY total DESC
     LIMIT 10`
  ).bind(siteId, since).all();
}

async function campaignComparison(env, siteId, since) {
  return env.DB.prepare(
    `SELECT
      COALESCE(NULLIF(utm_campaign, ''), NULLIF(utm_source, ''), 'Direct / Unknown') AS label,
      COUNT(DISTINCT visitor_id) AS visitors,
      COUNT(DISTINCT CASE WHEN event = 'click' AND visitor_id != '' THEN visitor_id END) AS click_visitors,
      SUM(CASE WHEN event = 'visit' THEN 1 ELSE 0 END) AS visits,
      SUM(CASE WHEN event = 'click' THEN 1 ELSE 0 END) AS clicks,
      SUM(CASE WHEN event = 'handoff' THEN 1 ELSE 0 END) AS handoffs
     FROM visits
     WHERE site_id = ? AND created_at >= ? AND COALESCE(is_bot, 0) = 0
     GROUP BY label
     ORDER BY visitors DESC
     LIMIT 12`
  ).bind(siteId, since).all();
}

function authorize(request, env) {
  if (!env.DASHBOARD_TOKEN) {
    return null;
  }

  const headerToken = request.headers.get("X-Analytics-Key") || "";
  const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const token = headerToken || bearer;

  if (token === env.DASHBOARD_TOKEN) {
    return null;
  }

  return json({ error: "Unauthorized" }, 401);
}

function normalizeFunnel(rows) {
  const totals = { visit: 0, click: 0, handoff: 0 };

  rows.forEach((row) => {
    totals[row.label] = row.total;
  });

  return [
    { label: "Visits", total: totals.visit },
    { label: "CTA Clicks", total: totals.click },
    { label: "Outbound Handoffs", total: totals.handoff }
  ];
}

function addCampaignRates(row) {
  return {
    ...row,
    conversion_rate: row.visitors ? percent(row.click_visitors || 0, row.visitors) : 0
  };
}

function percent(value, total) {
  return Number(((value / total) * 100).toFixed(2));
}

function clean(value, fallback = "") {
  return String(value ?? fallback).slice(0, 500);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json"
    }
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}
