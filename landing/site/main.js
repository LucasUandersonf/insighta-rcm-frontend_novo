// Insighta landing v4 — interações. A página funciona sem JS (conteúdo todo no HTML).
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Entrada ao rolar + contadores
  function countUp(el) {
    var target = Number(el.getAttribute("data-count"));
    if (reduce || !target) return;
    var t0 = null;
    (function step(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / 1300, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("pt-BR");
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      if (e.target.hasAttribute("data-count")) countUp(e.target);
      e.target.querySelectorAll("[data-count]").forEach(countUp);
      io.unobserve(e.target);
    });
  }, { threshold: 0.18 }) : null;
  document.querySelectorAll(".reveal, .fact b[data-count]").forEach(function (el) { io ? io.observe(el) : el.classList.add("is-in"); });

  // Palco do hero: 4 etapas que se revezam (pausa ao passar o mouse)
  var stage = document.querySelector("[data-stage]");
  if (stage) {
    var cards = stage.querySelectorAll(".st");
    var dots = document.querySelectorAll(".stage__dots button");
    var cur = 0, paused = false;
    function show(i) {
      cur = i;
      stage.setAttribute("data-active", String(i));
      cards.forEach(function (c, k) { c.classList.toggle("is-active", k === i); });
      dots.forEach(function (d, k) { d.classList.toggle("is-on", k === i); });
    }
    cards.forEach(function (c, k) { c.addEventListener("click", function () { show(k); }); });
    dots.forEach(function (d, k) { d.addEventListener("click", function () { show(k); }); });
    stage.addEventListener("mouseenter", function () { paused = true; });
    stage.addEventListener("mouseleave", function () { paused = false; });
    show(0);
    if (!reduce) setInterval(function () { if (!paused) show((cur + 1) % cards.length); }, 3600);
  }

  // Pergunte: digitação da pergunta e aparição da resposta
  var q = document.querySelector("[data-type]");
  if (q) {
    var text = q.getAttribute("data-type");
    var ans = q.parentElement.querySelector(".chat__a");
    function finish() { q.textContent = text; q.classList.add("is-done"); ans.classList.add("is-in"); }
    if (reduce || !io) finish();
    else {
      var started = false;
      new IntersectionObserver(function (es, obs) {
        if (!es[0].isIntersecting || started) return;
        started = true; obs.disconnect();
        var n = 0;
        var t = setInterval(function () { q.textContent = text.slice(0, ++n); if (n >= text.length) { clearInterval(t); setTimeout(finish, 500); } }, 38);
      }, { threshold: 0.5 }).observe(q);
    }
  }

  // Abas fixas: acompanham a rolagem e rolam até a história ao clicar
  var tabs = document.querySelectorAll(".stabs button");
  tabs.forEach(function (b) {
    b.addEventListener("click", function () { document.getElementById(b.getAttribute("data-go")).scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); });
  });
  if (io) {
    var storyObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        tabs.forEach(function (b) { b.classList.toggle("is-on", b.getAttribute("data-go") === e.target.id); });
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    document.querySelectorAll(".story").forEach(function (s) { storyObs.observe(s); });
  }

  // Sanfona da equipe de IA: abre ao passar o mouse/clicar; gira sozinha até o usuário interagir
  var acc = document.querySelector("[data-accordion]");
  if (acc) {
    var items = acc.querySelectorAll(".ac");
    var touched = false, idx = 0;
    function open(i) { idx = i; items.forEach(function (it, k) { it.classList.toggle("is-open", k === i); }); }
    items.forEach(function (it, k) {
      it.addEventListener("mouseenter", function () { touched = true; open(k); });
      it.addEventListener("click", function () { touched = true; open(k); });
    });
    if (!reduce) setInterval(function () { if (!touched) open((idx + 1) % items.length); }, 4200);
  }

  // Menu no celular
  var nav = document.querySelector(".nav"), burger = document.querySelector(".nav__burger");
  if (burger) burger.addEventListener("click", function () { burger.setAttribute("aria-expanded", String(nav.classList.toggle("is-open"))); });

  // Cookies de medição (LGPD): só existem se o ambiente definir CLARITY_ID
  // e/ou GA4_ID, e só carregam depois do "Aceitar". A escolha fica salva.
  (function () {
    var meta = document.querySelector('meta[name="insighta-analytics"]');
    var ids = (meta ? meta.getAttribute("content") : "|").split("|");
    var clarity = /^[a-z0-9]{6,20}$/i.test(ids[0] || "") ? ids[0] : "";
    var ga4 = /^G-[A-Z0-9]{4,20}$/.test(ids[1] || "") ? ids[1] : "";
    if (!clarity && !ga4) return;
    var KEY = "insighta_cookies";
    var banner = document.querySelector(".cookie");
    var prefs = document.querySelector("[data-cookie-prefs]");
    function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
    function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
    function load(src) { var s = document.createElement("script"); s.async = true; s.src = src; document.head.appendChild(s); }
    var loaded = false;
    function start() {
      if (loaded) return; loaded = true;
      if (clarity) {
        window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
        load("https://www.clarity.ms/tag/" + clarity);
        window.clarity("consent");
      }
      if (ga4) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag("js", new Date());
        window.gtag("config", ga4, { anonymize_ip: true });
        load("https://www.googletagmanager.com/gtag/js?id=" + ga4);
      }
    }
    function choose(v) { save(v); if (banner) banner.hidden = true; if (v === "accept") start(); else if (loaded) location.reload(); }
    if (prefs) { prefs.hidden = false; prefs.addEventListener("click", function () { if (banner) banner.hidden = false; }); }
    if (banner) banner.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cookie]"); if (b) choose(b.getAttribute("data-cookie"));
    });
    var choice = read();
    if (choice === "accept") start(); else if (choice !== "reject" && banner) banner.hidden = false;
  })();
})();
