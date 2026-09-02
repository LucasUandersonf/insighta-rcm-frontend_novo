import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

interface AnimatedNumberProps {
  /** Valor numérico final a exibir. */
  value: number;
  /** Formata o número em cada frame da animação (ex: moeda, percentual). Padrão: inteiro arredondado. */
  format?: (n: number) => string;
  durationSeconds?: number;
}

/** Faz um número "subir" do valor anterior até o novo em vez de só
 * trocar de texto — o efeito clássico de terminal financeiro/dashboard
 * premium (Stripe, Linear). Respeita `prefers-reduced-motion`: quando
 * ativo, pula direto para o valor final sem tween. */
export function AnimatedNumber({ value, format = (n) => String(Math.round(n)), durationSeconds = 0.9 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const prevValueRef = useRef(0);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setDisplay(value);
      prevValueRef.current = value;
      return;
    }

    // No primeiro mount, sobe a partir de 0 (efeito de "carregamento");
    // em updates seguintes (troca de período, refetch), sobe a partir
    // do valor anterior — nunca reinicia do zero num dado que já existia.
    const from = hasMountedRef.current ? prevValueRef.current : 0;
    hasMountedRef.current = true;

    const controls = animate(from, value, {
      duration: durationSeconds,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    prevValueRef.current = value;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{format(display)}</>;
}
