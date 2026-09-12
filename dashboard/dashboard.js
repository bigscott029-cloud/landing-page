(function () {
  "use strict";

  var siteId = "high-posting-jobs";
  var endpointInput = document.getElementById("endpoint");
  var apiKeyInput = document.getElementById("api-key");
  var rangeInput = document.getElementById("range");
  var exportLink = document.getElementById("export");
  var statusElement = document.getElementById("dashboard-status");
  var defaultWorkerUrl = "https://affiliate-analytics.leadspage.workers.dev";

  endpointInput.value = initialWorkerUrl();
  apiKeyInput.value = sessionStorage.getItem("analytics_api_key") || "";

  document.getElementById("refresh").addEventListener("click", load);
  document.getElementById("reset-endpoint").addEventListener("click", function () {
    endpointInput.value = defaultWorkerUrl;
    localStorage.removeItem("analytics_worker_url");
    load();
  });
  document.getElementById("reset-view").addEventListener("click", function () {
    endpointInput.value = defaultWorkerUrl;
    rangeInput.value = "1970-01-01";
    localStorage.removeItem("analytics_worker_url");
    load();
  });
  document.getElementById("backup-reset").addEventListener("click", backupAndReset);
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

  function initialWorkerUrl() {
    var params = new URLSearchParams(window.location.search);
    var queryWorker = params.get("worker");

    if (queryWorker && /^https:\/\//i.test(queryWorker)) {
      localStorage.setItem("analytics_worker_url", queryWorker);
      return queryWorker;
    }

    return localStorage.getItem("analytics_worker_url") || defaultWorkerUrl;
  }

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
      setStatus("Enter your deployed Worker URL above.", "error");
      return;
    }

    var statsUrl = baseStats + "?site_id=" + encodeURIComponent(siteId) + "&since=" + encodeURIComponent(sinceValue());
    var eventsUrl = baseEvents + "?site_id=" + encodeURIComponent(siteId) + "&limit=50";
    var liveUrl = baseLive + "?site_id=" + encodeURIComponent(siteId);

    exportLink.href = workerUrl("/export") + "?site_id=" + encodeURIComponent(siteId);

    try {
      setStatus("Loading analytics from " + endpointInput.value.trim() + "…");
      var responses = await Promise.all([
        fetchJson(statsUrl),
        fetchJson(eventsUrl),
        fetchJson(liveUrl)
      ]);

      renderStats(responses[0]);
      renderEvents(responses[1].events || []);
      renderLive(responses[2].live || []);
      setStatus("Connected. Last updated " + new Date().toLocaleString() + ".", "success");
    } catch (error) {
      var message = error.message || "Could not load analytics. Check the Worker URL and deployment.";

      setEmpty(message);
      setStatus(message, "error");
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
      downloadBlob(blob, "analytics.csv");
    }).catch(function (error) {
      setEmpty(error.message);
    });
  }

  async function backupAndReset() {
    if (!window.confirm("This downloads a CSV backup, then permanently clears all data for this site. Continue?")) {
      return;
    }

    var endpoint = workerUrl("/export");
    var resetEndpoint = workerUrl("/reset") + "?site_id=" + encodeURIComponent(siteId);

    if (!endpoint) {
      setStatus("Enter your deployed Worker URL before clearing data.", "error");
      return;
    }

    var button = document.getElementById("backup-reset");
    button.disabled = true;
    setStatus("Creating CSV backup before clearing data…");

    try {
      var backupResponse = await fetch(endpoint + "?site_id=" + encodeURIComponent(siteId), { headers: authHeaders() });

      if (!backupResponse.ok) {
        throw new Error(backupResponse.status === 401 ? "Unauthorized. Enter the dashboard API key." : "Backup failed; no data was cleared.");
      }

      downloadBlob(await backupResponse.blob(), "analytics-backup-" + new Date().toISOString().slice(0, 10) + ".csv");
      setStatus("Backup downloaded. Clearing analytics data…");

      var resetResponse = await fetch(resetEndpoint, { method: "POST", headers: authHeaders() });
      var resetResult = await resetResponse.json();

      if (!resetResponse.ok || typeof resetResult.deleted !== "number") {
        throw new Error(resetResult.error || "Data reset failed after backup.");
      }

      await load();
      setStatus("Fresh monitoring started. Cleared " + (resetResult.deleted || 0) + " records.", "success");
    } catch (error) {
      setStatus(error.message || "Backup and reset failed.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function downloadBlob(blob, filename) {
    var downloadUrl = URL.createObjectURL(blob);
    var link = document.createElement("a");

    link.href = downloadUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(downloadUrl);
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
    text("handoffs", totals.handoffs || 0);
    text("conversion", (totals.conversion_rate || 0) + "%");
    text("bounce", (totals.bounce_rate || 0) + "%");

    renderList("funnel", data.funnel || []);
    renderList("social-breakdown", data.socialBreakdown || []);
    renderList("audience-quality", [
      { label: "Returning visits", total: totals.returning_visits || 0 },
      { label: "Average session", total: formatDuration(totals.avg_session_seconds || 0) }
    ]);
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
        "<td>" + Number(row.handoffs || 0) + "</td>" +
        "<td>" + Number(row.conversion_rate || 0) + "%</td>" +
      "</tr>";
    }).join("") : '<tr><td colspan="6" class="muted">No campaign data yet.</td></tr>';
  }

  function setEmpty(message) {
    document.getElementById("events").innerHTML = '<tr><td colspan="6" class="muted">' + escapeHtml(message) + "</td></tr>";
  }

  function setStatus(message, state) {
    statusElement.textContent = message;
    statusElement.className = "dashboard-status" + (state ? " " + state : "");
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
