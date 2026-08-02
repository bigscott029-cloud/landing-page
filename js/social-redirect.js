(function (window, document) {
  "use strict";

  function getDevice() {
    var userAgent = navigator.userAgent || "";

    if (/Android/i.test(userAgent)) return "android";
    if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";

    return "desktop";
  }

  function buildLinks(destinationUrl) {
    var url = new URL(destinationUrl);
    var host = url.hostname.replace(/^www\./, "");
    var path = url.pathname.replace(/^\/+/, "");

    if (host === "chat.whatsapp.com") {
      return buildWhatsAppGroupLinks(path, destinationUrl);
    }

    if (host === "t.me" || host === "telegram.me") {
      return buildTelegramLinks(path, destinationUrl);
    }

    if (host === "wa.me" || host === "api.whatsapp.com") {
      return {
        android: "intent://" + host + url.pathname + url.search + "#Intent;scheme=https;package=com.whatsapp;S.browser_fallback_url=" + encodeURIComponent(destinationUrl) + ";end",
        ios: destinationUrl.replace(/^https?:\/\//, "whatsapp://"),
        web: destinationUrl,
        label: "WhatsApp"
      };
    }

    return {
      android: destinationUrl,
      ios: destinationUrl,
      web: destinationUrl,
      label: host
    };
  }

  function buildWhatsAppGroupLinks(inviteCode, destinationUrl) {
    return {
      android: "intent://chat.whatsapp.com/" + inviteCode + "#Intent;scheme=https;package=com.whatsapp;S.browser_fallback_url=" + encodeURIComponent(destinationUrl) + ";end",
      ios: "whatsapp://chat?code=" + inviteCode,
      web: destinationUrl,
      label: "WhatsApp"
    };
  }

  function buildTelegramLinks(path, destinationUrl) {
    var cleanPath = path.replace(/^s\//, "");

    return {
      android: "intent://resolve?domain=" + cleanPath + "#Intent;scheme=tg;package=org.telegram.messenger;S.browser_fallback_url=" + encodeURIComponent(destinationUrl) + ";end",
      ios: "tg://resolve?domain=" + cleanPath,
      web: destinationUrl,
      label: "Telegram"
    };
  }

  function init(config) {
    var destinationUrl = config.destinationUrl;
    var openButton = document.getElementById(config.buttonId || "open-social");
    var countdown = document.getElementById(config.countdownId || "countdown");
    var links = buildLinks(destinationUrl);
    var redirected = false;
    var seconds = config.delaySeconds || 2;

    function currentLink() {
      var device = getDevice();

      if (device === "android") return links.android;
      if (device === "ios") return links.ios;

      return links.web;
    }

    function trackRedirect(method) {
      if (window.AffiliateTracker) {
        window.AffiliateTracker.send("redirect", {
          label: links.label + " Redirect - " + method,
          destination: destinationUrl
        });
      }
    }

    function open(method) {
      if (redirected) return;

      redirected = true;
      trackRedirect(method);
      window.location.href = currentLink();

      if (getDevice() === "ios" && currentLink() !== links.web) {
        setTimeout(function () {
          window.location.href = links.web;
        }, 1200);
      }
    }

    if (openButton) {
      openButton.href = currentLink();
      openButton.textContent = config.buttonText || ("Open " + links.label);
      openButton.addEventListener("click", function (event) {
        event.preventDefault();
        redirected = false;
        open("manual");
      });
    }

    if (countdown) {
      setTimeout(function () {
        countdown.textContent = String(Math.max(seconds - 1, 1));
      }, 1000);
    }

    setTimeout(function () {
      open("auto");
    }, seconds * 1000);
  }

  window.SocialRedirect = {
    init: init
  };
})(window, document);
