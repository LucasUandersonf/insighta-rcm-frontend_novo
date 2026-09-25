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
})();
