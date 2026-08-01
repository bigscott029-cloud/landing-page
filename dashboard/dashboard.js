(function () {
  "use strict";

  var siteId = "high-posting-jobs";
  var endpointInput = document.getElementById("endpoint");
  var rangeInput = document.getElementById("range");
  var exportLink = document.getElementById("export");

  endpointInput.value = localStorage.getItem("analytics_worker_url") || "";

  document.getElementById("refresh").addEventListener("click", load);
  endpointInput.addEventListener("change", function () {
    localStorage.setItem("analytics_worker_url", endpointInput.value.trim());
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

    if (!baseStats) {
      setEmpty("Enter your deployed Worker URL above.");
      return;
    }

    var statsUrl = baseStats + "?site_id=" + encodeURIComponent(siteId) + "&since=" + encodeURIComponent(sinceValue());
    var eventsUrl = baseEvents + "?site_id=" + encodeURIComponent(siteId) + "&limit=50";

    exportLink.href = workerUrl("/export") + "?site_id=" + encodeURIComponent(siteId);

    try {
      var responses = await Promise.all([
        fetch(statsUrl).then((response) => response.json()),
        fetch(eventsUrl).then((response) => response.json())
      ]);

      renderStats(responses[0]);
      renderEvents(responses[1].events || []);
    } catch (error) {
      setEmpty("Could not load analytics. Check the Worker URL and deployment.");
    }
  }

  function renderStats(data) {
    var totals = data.totals || {};

    text("visitors", totals.visitors || 0);
    text("visits", totals.visits || 0);
    text("clicks", totals.clicks || 0);
    text("conversion", (totals.conversion_rate || 0) + "%");
    text("returning", totals.returning_visits || 0);

    renderList("countries", data.topCountries || []);
    renderList("campaigns", data.topCampaigns || []);
    renderList("referrers", data.topReferrers || []);
    renderList("daily", data.daily || []);
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

  function setEmpty(message) {
    document.getElementById("events").innerHTML = '<tr><td colspan="6" class="muted">' + escapeHtml(message) + "</td></tr>";
  }

  function text(id, value) {
    document.getElementById(id).textContent = value;
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
