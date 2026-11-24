/* Privacy-safe Yandex.Metrika SPA tracker for "Язык музыки" (Counter 114644297, 0 PII). */
(function (root) {
  "use strict";

  const COUNTER_ID = 114644297;
  const host = typeof location !== "undefined" ? String(location.hostname || "") : "";
  const isLocal = host === "127.0.0.1" || host === "localhost" || host === "";
  let lastVirtualUrl = "";

  function initMetrika() {
    if (isLocal || typeof window === "undefined" || typeof document === "undefined") return;
    try {
      const w = window;
      w.ym =
        w.ym ||
        function () {
          (w.ym.a = w.ym.a || []).push(arguments);
        };
      w.ym.l = Date.now();

      const tagUrl = "https://mc.yandex.ru/metrika/tag.js?id=" + COUNTER_ID;
      let exists = false;
      for (let i = 0; i < document.scripts.length; i += 1) {
        if (document.scripts[i].src === tagUrl) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        const s = document.createElement("script");
        s.async = true;
        s.src = tagUrl;
        const first = document.getElementsByTagName("script")[0];
        if (first && first.parentNode) first.parentNode.insertBefore(s, first);
        else document.head.appendChild(s);
      }

      w.ym(COUNTER_ID, "init", {
        ssr: true,
        webvisor: true,
        clickmap: true,
        ecommerce: "dataLayer",
        referrer: document.referrer,
        url: location.href,
        accurateTrackBounce: true,
        trackLinks: true,
      });
    } catch (_) {}
  }

  function sanitizeParams(params) {
    if (!params || typeof params !== "object") return undefined;
    const out = {};
    const forbidden = /user|username|phone|email|token|initdata|chat_id/i;
    Object.keys(params).forEach((k) => {
      if (forbidden.test(k)) return;
      const v = params[k];
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        out[k] = v;
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        out[k] = sanitizeParams(v);
      }
    });
    return out;
  }

  function track(goalName, params) {
    if (isLocal || typeof window === "undefined" || typeof window.ym !== "function") return;
    try {
      const clean = sanitizeParams(params);
      if (clean && Object.keys(clean).length > 0) {
        window.ym(COUNTER_ID, "reachGoal", String(goalName), clean);
      } else {
        window.ym(COUNTER_ID, "reachGoal", String(goalName));
      }
    } catch (_) {}
  }

  function params(tree) {
    if (isLocal || typeof window === "undefined" || typeof window.ym !== "function") return;
    try {
      const clean = sanitizeParams(tree);
      if (clean && Object.keys(clean).length > 0) {
        window.ym(COUNTER_ID, "params", clean);
      }
    } catch (_) {}
  }

  function screen(virtualHash, title) {
    if (isLocal || typeof window === "undefined" || typeof window.ym !== "function") return;
    try {
      const base = location.origin + location.pathname;
      const cleanHash = String(virtualHash || "route").replace(/^#/, "");
      const url = base + "#" + cleanHash;
      if (url === lastVirtualUrl) return;
      const prev = lastVirtualUrl || document.referrer;
      lastVirtualUrl = url;
      window.ym(COUNTER_ID, "hit", url, {
        title: String(title || document.title || cleanHash),
        referer: prev,
      });
    } catch (_) {}
  }

  initMetrika();
  root.MusicAnalytics = { COUNTER_ID, track, params, screen };
})(typeof window !== "undefined" ? window : globalThis);
