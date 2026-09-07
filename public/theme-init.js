// theme-init.js
//
// Aplica o tema salvo ANTES do primeiro paint — evita o "flash" de tema
// errado (ex: usuário escolheu claro, mas a página pisca escura por uma
// fração de segundo antes do React montar).
//
// Extraído para arquivo externo (era inline em index.html) por causa da
// Content-Security-Policy: um script inline exigiria liberar
// 'unsafe-inline' ou um hash frágil (que quebra a cada edição) na
// diretiva script-src — um arquivo próprio (mesma origem) não precisa de
// nenhuma exceção, `script-src 'self'` já cobre.
(function () {
  try {
    var stored = localStorage.getItem("insighta-rcm:theme");
    var theme =
      stored === "light" || stored === "dark"
        ? stored
        : stored === "system" || !stored
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
