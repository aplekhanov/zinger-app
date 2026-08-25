(function () {
	"use strict";

	var CONFIG = {
		measurementId: "G-94GWNXKDMR",
		bridge: true,
		debug: false,
		campaignId: "unknown"
	};

	var overrides = window.ZINGER_PROMO_CONFIG || {};
	for (var key in overrides) {
		if (Object.prototype.hasOwnProperty.call(overrides, key)) {
			CONFIG[key] = overrides[key];
		}
	}

	var params = new URLSearchParams(window.location.search);
	if (params.get("debug") === "1") { CONFIG.debug = true; }

	function messageHandler() {
		return window.webkit
			&& window.webkit.messageHandlers
			&& window.webkit.messageHandlers.iconMaker;
	}

	function deviceContext() {
		var ua = navigator.userAgent || "";

		var isIpadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
		var isIOS = /iPad|iPhone|iPod/.test(ua) || isIpadOS;

		var deviceType = "desktop";
		if (/iPad/.test(ua) || isIpadOS) { deviceType = "tablet"; }
		else if (isIOS) { deviceType = "mobile"; }

		var surface = "browser";
		if (messageHandler()) { surface = "in_app_webview"; }
		else if (window.navigator.standalone === true) { surface = "home_screen"; }
		else if (isIOS && !/Safari/.test(ua)) { surface = "ios_webview"; }

		return {
			device_type: deviceType,
			surface: surface
		};
	}

	function campaignContext() {
		// Not campaign_id: gtag reserves campaign_* for traffic attribution.
		var out = { promo_campaign: CONFIG.campaignId };
		["placement", "src", "app_version"].forEach(function (name) {
			var value = params.get(name);
			if (value) { out[name] = value; }
		});
		return out;
	}

	var context = deviceContext();
	var campaign = campaignContext();
	var loadedAt = Date.now();

	function loadGa4() {
		if (!CONFIG.measurementId) { return; }

		window.dataLayer = window.dataLayer || [];
		window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
		window.gtag("js", new Date());

		var config = { surface: context.surface };
		if (CONFIG.debug) { config.debug_mode = true; }
		for (var k in campaign) {
			if (Object.prototype.hasOwnProperty.call(campaign, k)) { config[k] = campaign[k]; }
		}
		window.gtag("config", CONFIG.measurementId, config);

		var script = document.createElement("script");
		script.async = true;
		script.src = "https://www.googletagmanager.com/gtag/js?id="
			+ encodeURIComponent(CONFIG.measurementId);
		document.head.appendChild(script);
	}

	function track(event, extra) {
		var payload = {};
		[context, campaign, extra || {}].forEach(function (bag) {
			for (var k in bag) {
				if (Object.prototype.hasOwnProperty.call(bag, k)) { payload[k] = bag[k]; }
			}
		});
		payload.seconds_on_page = Math.round((Date.now() - loadedAt) / 1000);

		if (CONFIG.debug) { console.log("[promo]", event, payload); }

		try {
			if (CONFIG.measurementId && window.gtag) { window.gtag("event", event, payload); }
		} catch (e) { /* never break the page */ }

		try {
			var handler = CONFIG.bridge && messageHandler();
			if (handler) { handler.postMessage({ type: "promoEvent", event: event, params: payload }); }
		} catch (e) { /* as above */ }
	}

	var outcome = "none";
	function setOutcome(value) { outcome = value; }

	var engagementSent = false;
	function sendEngagement() {
		if (engagementSent) { return; }
		engagementSent = true;
		track("promo_engagement", { outcome: outcome });
	}

	// visibilitychange is the one iOS delivers when a WebView tab closes.
	document.addEventListener("visibilitychange", function () {
		if (document.visibilityState === "hidden") { sendEngagement(); }
	});
	window.addEventListener("pagehide", sendEngagement);

	loadGa4();

	window.ZingerPromo = {
		track: track,
		setOutcome: setOutcome,
		context: function () {
			var snapshot = {};
			[context, campaign].forEach(function (bag) {
				for (var k in bag) {
					if (Object.prototype.hasOwnProperty.call(bag, k)) { snapshot[k] = bag[k]; }
				}
			});
			return snapshot;
		}
	};

	// GA4 gets its own page_view from the config call; sending one here would
	// double-count, so promo_view is for the bridge and the debug console only.
	if (CONFIG.debug || messageHandler()) { track("promo_view"); }
})();
