/* ──────────────────────────────────────────────────────────────────────────────
 *  app.js — Formação MySQL Profissional (mysql.technowhub.ai)
 *  ─────────────────────────────────────────────────────────────────────────────
 *  Página de VENDAS (checkout Engaged + WhatsApp; sem formulário de lead).
 *  O que faz:
 *   1. Captura utm_* (+ gclid/fbclid/...) da URL e persiste por sessão.
 *   2. Repassa os params aos links de saída absolutos (WhatsApp) — a preservação
 *      de UTM para o checkout já é feita pelo script inline do index.html.
 *   3. Empurra eventos pra IRIS (cockpit em tempo real): lp_view, click_compra,
 *      click_whats — POST /api/events (mesma convenção das LPs irmãs).
 *   4. Pixel Meta / Google Ads — no-op até preencher os IDs.
 *  ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var CFG = {
    PRODUCT_SLUG:    'mysql',
    CAMPAIGN_SLUG:   'mysql-lancamento', // padrão; campanhas reais chegam via utm_campaign
    IRIS_EVENTS_URL: 'https://iris.technowhub.ai/api/events',
    CURRENCY:        'BRL',
    META_PIXEL_ID:   '',   // preencher quando o Pixel entrar (vazio = no-op)
    GADS_ID:               '', // AW-XXXXXXXXXX (vazio = no-op)
    GADS_CONVERSION_LABEL: ''
  };

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var PASSTHROUGH_KEYS = ['gclid', 'fbclid', 'gad_source', 'gbraid', 'wbraid', 'msclkid', 'ttclid'];
  var ALL_KEYS = UTM_KEYS.concat(PASSTHROUGH_KEYS);

  function getTrackingParams() {
    var qs = new URLSearchParams(window.location.search);
    var saved = {};
    try { saved = JSON.parse(sessionStorage.getItem('cp_tracking') || '{}'); } catch (e) {}
    ALL_KEYS.forEach(function (k) {
      var v = qs.get(k);
      if (v) saved[k] = v;
    });
    try { sessionStorage.setItem('cp_tracking', JSON.stringify(saved)); } catch (e) {}
    return saved;
  }

  function withTracking(rawHref, params) {
    if (!rawHref) return rawHref;
    var url;
    try { url = new URL(rawHref, window.location.href); } catch (e) { return rawHref; }
    Object.keys(params).forEach(function (k) {
      if (!url.searchParams.has(k)) url.searchParams.set(k, params[k]);
    });
    return url.toString();
  }

  function sendIrisEvent(eventName, extra) {
    try {
      var p = getTrackingParams();
      var body = {
        product_slug:  CFG.PRODUCT_SLUG,
        event_name:    eventName,
        campaign_slug: p.utm_campaign || CFG.CAMPAIGN_SLUG,
        page_url:      location.href,
        utm_source:    p.utm_source   || null,
        utm_medium:    p.utm_medium   || null,
        utm_campaign:  p.utm_campaign || null,
        utm_content:   p.utm_content  || null,
        utm_term:      p.utm_term     || null,
        referrer:      document.referrer || null
      };
      if (extra) body.meta = extra;
      fetch(CFG.IRIS_EVENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        mode: 'cors'
      }).catch(function () {});
    } catch (e) {}
  }

  // WhatsApp: passthrough de UTM + evento click_whats
  function decorateWhatsApp(params) {
    document.querySelectorAll('a[href*="api.whatsapp.com"]').forEach(function (el) {
      if (el.dataset.waBound) return;
      el.dataset.waBound = '1';
      el.setAttribute('href', withTracking(el.getAttribute('href') || '', params));
      el.addEventListener('click', function () {
        sendIrisEvent('click_whats', { channel: 'whatsapp' });
        track('Contact', { placement: 'whatsapp' });
      });
    });
  }

  // Botões de checkout (matrícula): evento click_compra
  function decorateCheckout() {
    document.querySelectorAll('.btn-neon, .pill--primary').forEach(function (el) {
      if (el.dataset.buyBound) return;
      el.dataset.buyBound = '1';
      el.addEventListener('click', function () {
        sendIrisEvent('click_compra', { placement: 'checkout' });
        track('InitiateCheckout', { content_name: 'Formacao MySQL Profissional' });
      });
    });
  }

  function initPixel() {
    if (!CFG.META_PIXEL_ID || window.fbq) return;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', CFG.META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  function initGads() {
    if (!CFG.GADS_ID || window.gtag) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + CFG.GADS_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', CFG.GADS_ID);
  }

  function track(eventName, params) {
    params = params || {};
    if (window.fbq) { try { window.fbq('track', eventName, params); } catch (e) {} }
    if (window.dataLayer) { window.dataLayer.push(Object.assign({ event: eventName }, params)); }
  }

  function apply() {
    var params = getTrackingParams();
    decorateWhatsApp(params);
    decorateCheckout();
  }

  initPixel();
  initGads();
  apply();
  new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });

  sendIrisEvent('lp_view');
})();
