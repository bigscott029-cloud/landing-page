(function () {
  "use strict";

  var password = window.DASHBOARD_PASSWORD || "";

  if (!password) {
    return;
  }

  if (sessionStorage.getItem("dashboard_unlocked") === "true") {
    return;
  }

  var entered = window.prompt("Dashboard password");

  if (entered === password) {
    sessionStorage.setItem("dashboard_unlocked", "true");
    return;
  }

  document.documentElement.innerHTML = "<body><p>Dashboard locked.</p></body>";
})();
