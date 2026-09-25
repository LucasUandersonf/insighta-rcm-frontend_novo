// Insighta landing v3 — animações e interações. A página funciona sem JS.
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 1. Entrada ao rolar + contadores
  function countUp(el) {
    var target = Number(el.getAttribute("data-count"));
    var prefix = el.getAttribute("data-prefix") || "";
    if (reduce || !target) return;
    var start = null;
    function step(t) {
      if (!start) start = t;
      var p = Math.min((t - start) / 1400, 1);
      var v = Math.round(target * (1 - Math.pow(1 - p, 3)));
      el.textContent = prefix + v.toLocaleString("pt-BR");
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      e.target.querySelectorAll("[data-count]").forEach(countUp);
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 }) : null;
  document.querySelectorAll(".reveal").forEach(function (el) { io ? io.observe(el) : el.classList.add("is-in"); });

  // 2. Espaços de vídeo: se o arquivo existir, troca a ilustração pelo vídeo (5 s, mudo, em loop)
  document.querySelectorAll(".video-slot").forEach(function (slot) {
    var src = slot.getAttribute("data-video");
    var tag = document.createElement("span");
    tag.className = "slot-tag";
    tag.textContent = slot.getAttribute("data-label") || src;
    slot.appendChild(tag);
    if (!src) return;
    fetch(src, { method: "HEAD" }).then(function (r) {
      if (!r.ok || !(r.headers.get("content-type") || "").startsWith("video")) return;
      var v = document.createElement("video");
      v.src = src; v.muted = true; v.loop = true; v.autoplay = !reduce; v.playsInline = true; v.setAttribute("preload", "metadata");
      slot.prepend(v);
      slot.classList.add("has-video");
    }).catch(function () {});
  });

  // 3. Caixa "Pergunte": digitação de perguntas + resposta
  var typing = document.querySelector("[data-typing]");
  var answer = document.querySelector("[data-answers]");
  if (typing && answer && !reduce) {
    var qs = JSON.parse(typing.getAttribute("data-typing"));
    var as = JSON.parse(answer.getAttribute("data-answers"));
    var i = 0;
    function type(text, cb) {
      var n = 0; typing.textContent = "";
      var t = setInterval(function () { typing.textContent = text.slice(0, ++n); if (n >= text.length) { clearInterval(t); cb(); } }, 45);
    }
    function loop() {
      answer.style.opacity = 0;
      type(qs[i], function () {
        setTimeout(function () { answer.querySelector(".answer__txt").textContent = as[i]; answer.style.opacity = 1; }, 400);
        setTimeout(function () { i = (i + 1) % qs.length; loop(); }, 4200);
      });
    }
    setTimeout(loop, 1500);
  }

  // 4. Abas
  var tabs = document.querySelectorAll("[data-tab]");
  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabs.forEach(function (b) { b.setAttribute("aria-selected", "false"); });
      btn.setAttribute("aria-selected", "true");
      document.querySelectorAll(".panel").forEach(function (p) { p.hidden = true; p.classList.remove("is-on"); });
      var panel = document.getElementById(btn.getAttribute("data-tab"));
      panel.hidden = false; panel.classList.add("is-on");
    });
  });

  // 5. Carrossel
  var car = document.querySelector(".carousel");
  document.querySelectorAll(".carousel__nav button").forEach(function (b) {
    b.addEventListener("click", function () { car.scrollBy({ left: Number(b.getAttribute("data-dir")) * 320, behavior: "smooth" }); });
  });

  // 6. Menu no celular
  var nav = document.querySelector(".nav");
  var burger = document.querySelector(".nav__burger");
  if (burger) burger.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  });
})();
