const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      if (url.pathname === "/track" && request.method === "POST") {
        return track(request, env);
      }

      if (url.pathname === "/stats" && request.method === "GET") {
        return stats(url, env);
      }

      if (url.pathname === "/events" && request.method === "GET") {
        return events(url, env);
      }

      if (url.pathname === "/export" && request.method === "GET") {
        return exportCsv(url, env);
      }

      return json({ ok: true, service: "affiliate-analytics" });
    } catch (error) {
      return json({ error: error.message }, 500);
    }
  }
};

async function track(request, env) {
  const body = await request.json();
  const cf = request.cf || {};

  await env.DB.prepare(
    `INSERT INTO visits (
      site_id, visitor_id, returning, event, page, page_url, label, destination,
      country, city, device, browser, os, language, timezone, screen, referrer,
      user_agent, utm_source, utm_medium, utm_campaign, utm_term, utm_content
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.site_id || "default",
    body.visitor_id || "",
    body.returning ? 1 : 0,
    body.event || "visit",
    body.page || "",
    body.page_url || "",
    body.label || "",
    body.destination || "",
    cf.country || "",
    cf.city || "",
    body.device || "",
    body.browser || "",
    body.os || "",
    body.language || "",
    body.timezone || "",
    body.screen || "",
    body.referrer || "",
    body.user_agent || "",
    body.utm_source || "",
    body.utm_medium || "",
    body.utm_campaign || "",
    body.utm_term || "",
    body.utm_content || ""
  ).run();

  return json({ ok: true });
}

async function stats(url, env) {
  const siteId = url.searchParams.get("site_id") || "default";
  const since = url.searchParams.get("since") || "1970-01-01";

  const totals = await env.DB.prepare(
    `SELECT
      COUNT(*) AS events,
      COUNT(DISTINCT visitor_id) AS visitors,
      SUM(CASE WHEN event = 'visit' THEN 1 ELSE 0 END) AS visits,
      SUM(CASE WHEN event = 'click' THEN 1 ELSE 0 END) AS clicks,
      SUM(CASE WHEN returning = 1 AND event = 'visit' THEN 1 ELSE 0 END) AS returning_visits
    FROM visits
    WHERE site_id = ? AND created_at >= ?`
  ).bind(siteId, since).first();

  const topReferrers = await grouped(env, siteId, since, "referrer");
  const topCampaigns = await grouped(env, siteId, since, "utm_campaign");
  const topCountries = await grouped(env, siteId, since, "country");
  const daily = await env.DB.prepare(
    `SELECT DATE(created_at) AS label, COUNT(*) AS total
     FROM visits
     WHERE site_id = ? AND event = 'visit' AND created_at >= ?
     GROUP BY DATE(created_at)
     ORDER BY label DESC
     LIMIT 30`
  ).bind(siteId, since).all();

  const visitors = totals.visitors || 0;
  const clicks = totals.clicks || 0;

  return json({
    totals: {
      events: totals.events || 0,
      visitors: visitors,
      visits: totals.visits || 0,
      clicks: clicks,
      returning_visits: totals.returning_visits || 0,
      conversion_rate: visitors ? Number(((clicks / visitors) * 100).toFixed(2)) : 0
    },
    topReferrers: topReferrers.results,
    topCampaigns: topCampaigns.results,
    topCountries: topCountries.results,
    daily: daily.results
  });
}

async function events(url, env) {
  const siteId = url.searchParams.get("site_id") || "default";
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

  const rows = await env.DB.prepare(
    `SELECT id, event, page, label, destination, country, city, device, browser, os,
      referrer, utm_source, utm_campaign, created_at
     FROM visits
     WHERE site_id = ?
     ORDER BY created_at DESC
     LIMIT ?`
  ).bind(siteId, limit).all();

  return json({ events: rows.results });
}

async function exportCsv(url, env) {
  const siteId = url.searchParams.get("site_id") || "default";
  const rows = await env.DB.prepare(
    `SELECT * FROM visits WHERE site_id = ? ORDER BY created_at DESC LIMIT 5000`
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

async function grouped(env, siteId, since, field) {
  return env.DB.prepare(
    `SELECT COALESCE(NULLIF(${field}, ''), 'Direct / Unknown') AS label, COUNT(*) AS total
     FROM visits
     WHERE site_id = ? AND created_at >= ?
     GROUP BY label
     ORDER BY total DESC
     LIMIT 10`
  ).bind(siteId, since).all();
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
