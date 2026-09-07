/**
 * src/test/setup.ts — carregado antes de cada arquivo de teste (ver
 * `test.setupFiles` em vite.config.ts). Ponto único de configuração
 * global do ambiente de teste, nunca duplicado arquivo a arquivo.
 */
import "@testing-library/jest-dom/vitest";

// jsdom não implementa matchMedia — usado por useTheme (dark mode) e
// por framer-motion's useReducedMotion (ver OnboardingTour.tsx). Sem
// este stub, qualquer componente que chame `window.matchMedia` quebra
// com "matchMedia is not a function" assim que é montado num teste.
if (!window.matchMedia) {
  window.matchMedia = function matchMedia(query: string): MediaQueryList {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  };
}

// jsdom não implementa ResizeObserver (usado por OnboardingTour.tsx para
// acompanhar o item destacado) — stub mínimo, suficiente para os testes
// não precisarem de medidas de layout reais.
if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom não implementa scrollIntoView (chamado por OnboardingTour.tsx) —
// stub vazio, o teste não depende de rolagem real acontecer.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
