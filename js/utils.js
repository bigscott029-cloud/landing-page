(function (window) {
  "use strict";

  function getQueryParams() {
    var params = new URLSearchParams(window.location.search);

    return {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_term: params.get("utm_term") || "",
      utm_content: params.get("utm_content") || ""
    };
  }

  function getDeviceType() {
    var width = window.innerWidth || screen.width;
    var userAgent = navigator.userAgent || "";

    if (/Mobi|Android|iPhone|iPod/i.test(userAgent) || width < 768) {
      return "mobile";
    }

    if (/iPad|Tablet/i.test(userAgent) || width < 1024) {
      return "tablet";
    }

    return "desktop";
  }

  function getBrowser() {
    var userAgent = navigator.userAgent || "";

    if (/Edg/i.test(userAgent)) return "Edge";
    if (/OPR|Opera/i.test(userAgent)) return "Opera";
    if (/Chrome|CriOS/i.test(userAgent)) return "Chrome";
    if (/Firefox|FxiOS/i.test(userAgent)) return "Firefox";
    if (/Safari/i.test(userAgent)) return "Safari";

    return "Unknown";
  }

  function getOS() {
    var userAgent = navigator.userAgent || "";

    if (/Windows/i.test(userAgent)) return "Windows";
    if (/Android/i.test(userAgent)) return "Android";
    if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
    if (/Mac OS X/i.test(userAgent)) return "macOS";
    if (/Linux/i.test(userAgent)) return "Linux";

    return "Unknown";
  }

  window.AnalyticsUtils = {
    getBrowser: getBrowser,
    getDeviceType: getDeviceType,
    getOS: getOS,
    getQueryParams: getQueryParams
  };
})(window);
