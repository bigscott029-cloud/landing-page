(function (window, document) {
  "use strict";

  var config = window.AFFILIATE_ANALYTICS || {};
  var endpoint = config.endpoint || "/track";
  var siteId = config.siteId || "default";

  function buildPayload(event, extra) {
    var visitor = window.AnalyticsFingerprint.getVisitor();
    var utils = window.AnalyticsUtils;
    var query = utils.getQueryParams();

    return Object.assign({
      site_id: siteId,
      visitor_id: visitor.id,
      returning: visitor.returning,
      event: event,
      page: window.location.pathname || "/",
      page_url: window.location.href,
      device: utils.getDeviceType(),
      browser: utils.getBrowser(),
      os: utils.getOS(),
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      screen: [screen.width, screen.height].join("x"),
      referrer: document.referrer || "",
      user_agent: navigator.userAgent || "",
      utm_source: query.utm_source,
      utm_medium: query.utm_medium,
      utm_campaign: query.utm_campaign,
      utm_term: query.utm_term,
      utm_content: query.utm_content
    }, extra || {});
  }

  function send(event, extra) {
    var payload = JSON.stringify(buildPayload(event, extra));

    if (navigator.sendBeacon) {
      var blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(endpoint, blob);
      return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(function () {});
  }

  function bindClicks() {
    document.addEventListener("click", function (event) {
      var target = event.target.closest("[data-track-click], a, button");

      if (!target) return;

      send("click", {
        label: target.getAttribute("data-track-label") || target.textContent.trim().slice(0, 80),
        destination: target.href || target.getAttribute("data-destination") || ""
      });
    });
  }

  window.AffiliateTracker = {
    send: send
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      send("visit");
      bindClicks();
    });
  } else {
    send("visit");
    bindClicks();
  }
})(window, document);
