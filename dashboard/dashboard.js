(function () {
  "use strict";

  var siteId = "high-posting-jobs";
  var endpointInput = document.getElementById("endpoint");
  var apiKeyInput = document.getElementById("api-key");
  var rangeInput = document.getElementById("range");
  var exportLink = document.getElementById("export");

  endpointInput.value = localStorage.getItem("analytics_worker_url") || "";
  apiKeyInput.value = sessionStorage.getItem("analytics_api_key") || "";

  document.getElementById("refresh").addEventListener("click", load);
  exportLink.addEventListener("click", exportCsv);
  endpointInput.addEventListener("change", function () {
    localStorage.setItem("analytics_worker_url", endpointInput.value.trim());
    load();
  });
  apiKeyInput.addEventListener("change", function () {
    sessionStorage.setItem("analytics_api_key", apiKeyInput.value.trim());
    load();
  });
  rangeInput.addEventListener("change", load);

  function workerUrl(path) {
    var base = endpointInput.value.trim().replace(/\/$/, "");

    if (!base) {
      return "";
    }

    return base + path;
  }

  function sinceValue() {
    var value = rangeInput.value;
    var date = new Date();

    if (value === "day") date.setDate(date.getDate() - 1);
    if (value === "week") date.setDate(date.getDate() - 7);
    if (value === "month") date.setDate(date.getDate() - 30);
    if (value === "1970-01-01") return value;

    return date.toISOString();
  }

  async function load() {
    var baseStats = workerUrl("/stats");
    var baseEvents = workerUrl("/events");
    var baseLive = workerUrl("/live");

    if (!baseStats) {
      setEmpty("Enter your deployed Worker URL above.");
      return;
    }

    var statsUrl = baseStats + "?site_id=" + encodeURIComponent(siteId) + "&since=" + encodeURIComponent(sinceValue());
    var eventsUrl = baseEvents + "?site_id=" + encodeURIComponent(siteId) + "&limit=50";
    var liveUrl = baseLive + "?site_id=" + encodeURIComponent(siteId);

    exportLink.href = workerUrl("/export") + "?site_id=" + encodeURIComponent(siteId);

    try {
      var responses = await Promise.all([
        fetchJson(statsUrl),
        fetchJson(eventsUrl),
        fetchJson(liveUrl)
      ]);

      renderStats(responses[0]);
      renderEvents(responses[1].events || []);
      renderLive(responses[2].live || []);
    } catch (error) {
      setEmpty(error.message || "Could not load analytics. Check the Worker URL and deployment.");
    }
  }

  function exportCsv(event) {
    event.preventDefault();

    var url = workerUrl("/export") + "?site_id=" + encodeURIComponent(siteId);

    if (!workerUrl("/export")) {
      setEmpty("Enter your deployed Worker URL before exporting.");
      return;
    }

    fetch(url, {
      headers: authHeaders()
    }).then(function (response) {
      if (!response.ok) {
        throw new Error(response.status === 401 ? "Unauthorized. Enter the dashboard API key." : "CSV export failed.");
      }

      return response.blob();
    }).then(function (blob) {
      var downloadUrl = URL.createObjectURL(blob);
      var link = document.createElement("a");

      link.href = downloadUrl;
      link.download = "analytics.csv";
      link.click();
      URL.revokeObjectURL(downloadUrl);
    }).catch(function (error) {
      setEmpty(error.message);
    });
  }

  function fetchJson(url) {
    return fetch(url, {
      headers: authHeaders()
    }).then(function (response) {
      if (!response.ok) {
        throw new Error(response.status === 401 ? "Unauthorized. Enter the dashboard API key." : "Analytics request failed.");
      }

      return response.json();
    });
  }

  function authHeaders() {
    var apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      return {};
    }

    return {
      "X-Analytics-Key": apiKey
    };
  }

  function renderStats(data) {
    var totals = data.totals || {};

    text("visitors", totals.visitors || 0);
    text("visits", totals.visits || 0);
    text("clicks", totals.clicks || 0);
    text("redirects", totals.redirects || 0);
    text("conversion", (totals.conversion_rate || 0) + "%");
    text("bounce", (totals.bounce_rate || 0) + "%");
    text("session", formatDuration(totals.avg_session_seconds || 0));
    text("returning", totals.returning_visits || 0);

    renderList("funnel", data.funnel || []);
    renderList("countries", data.topCountries || []);
    renderList("cities", data.topCities || []);
    renderList("campaigns", data.topCampaigns || []);
    renderList("referrers", data.topReferrers || []);
    renderList("daily", data.daily || []);
    renderCampaignComparison(data.campaignComparison || []);
  }

  function renderList(id, rows) {
    var element = document.getElementById(id);

    element.innerHTML = rows.length ? rows.map(function (row) {
      return '<div class="row"><span>' + escapeHtml(row.label || "Unknown") + '</span><strong>' + row.total + "</strong></div>";
    }).join("") : '<p class="muted">No data yet.</p>';
  }

  function renderEvents(rows) {
    var element = document.getElementById("events");

    element.innerHTML = rows.length ? rows.map(function (row) {
      var location = [row.city, row.country].filter(Boolean).join(", ") || "Unknown";
      var device = [row.device, row.browser, row.os].filter(Boolean).join(" / ") || "Unknown";
      var campaign = row.utm_campaign || row.utm_source || "Direct";
      var label = row.label || row.page || "";

      return "<tr>" +
        "<td>" + escapeHtml(new Date(row.created_at).toLocaleString()) + "</td>" +
        "<td>" + escapeHtml(row.event) + "</td>" +
        "<td>" + escapeHtml(location) + "</td>" +
        "<td>" + escapeHtml(device) + "</td>" +
        "<td>" + escapeHtml(campaign) + "</td>" +
        "<td>" + escapeHtml(label) + "</td>" +
      "</tr>";
    }).join("") : '<tr><td colspan="6" class="muted">No events yet.</td></tr>';
  }

  function renderLive(rows) {
    var element = document.getElementById("live");

    element.innerHTML = rows.length ? rows.map(function (row) {
      var location = [row.city, row.country].filter(Boolean).join(", ") || "Unknown";
      var campaign = row.utm_campaign || row.utm_source || "Direct";
      var when = new Date(row.created_at).toLocaleTimeString();

      return '<div class="row"><span>' + escapeHtml(row.event + " from " + location) +
        '<br><small class="muted">' + escapeHtml(campaign + " · " + when) +
        '</small></span><strong>' + escapeHtml(row.device || "") + "</strong></div>";
    }).join("") : '<p class="muted">No live events yet.</p>';
  }

  function renderCampaignComparison(rows) {
    var element = document.getElementById("campaign-comparison");

    element.innerHTML = rows.length ? rows.map(function (row) {
      return "<tr>" +
        "<td>" + escapeHtml(row.label) + "</td>" +
        "<td>" + Number(row.visitors || 0) + "</td>" +
        "<td>" + Number(row.visits || 0) + "</td>" +
        "<td>" + Number(row.clicks || 0) + "</td>" +
        "<td>" + Number(row.redirects || 0) + "</td>" +
        "<td>" + Number(row.conversion_rate || 0) + "%</td>" +
      "</tr>";
    }).join("") : '<tr><td colspan="6" class="muted">No campaign data yet.</td></tr>';
  }

  function setEmpty(message) {
    document.getElementById("events").innerHTML = '<tr><td colspan="6" class="muted">' + escapeHtml(message) + "</td></tr>";
  }

  function text(id, value) {
    document.getElementById(id).textContent = value;
  }

  function formatDuration(seconds) {
    if (seconds < 60) {
      return seconds + "s";
    }

    return Math.floor(seconds / 60) + "m " + (seconds % 60) + "s";
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char];
    });
  }

  load();
})();
