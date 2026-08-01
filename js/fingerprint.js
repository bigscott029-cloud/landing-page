(function (window) {
  "use strict";

  var STORAGE_KEY = "affiliate_visitor_id";

  function createId() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return "v_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12);
  }

  function getVisitor() {
    var visitorId = localStorage.getItem(STORAGE_KEY);
    var returning = Boolean(visitorId);

    if (!visitorId) {
      visitorId = createId();
      localStorage.setItem(STORAGE_KEY, visitorId);
    }

    return {
      id: visitorId,
      returning: returning
    };
  }

  window.AnalyticsFingerprint = {
    getVisitor: getVisitor
  };
})(window);
