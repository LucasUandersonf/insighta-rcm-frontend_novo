import { useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";
import { loadGoogleIdentityScript } from "@/lib/googleIdentity";

// Client ID PÚBLICO do Google Cloud Console (OAuth client ID > Web
// application) — nunca um segredo, vai literalmente no HTML. Sem ele
// configurado, o botão simplesmente não renderiza (mesma degradação
// graciosa do backend quando GOOGLE_OAUTH_CLIENT_ID está ausente — ver
// app/services/google_oauth_client.py). Exportado para as telas que usam
// este botão poderem esconder também o divisor "ou" ao redor dele
// quando não há credencial configurada (ver LoginPage.tsx/SignUpPage.tsx).
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined;
export const isGoogleAuthConfigured = Boolean(GOOGLE_CLIENT_ID);

interface GoogleSignInButtonProps {
  /** Chamado com o ID token assinado pelo Google — o componente nunca
   * decide sozinho o que fazer com ele (login vs. cadastro é decisão de
   * quem usa o botão, ver LoginPage.tsx/SignUpPage.tsx). */
  onCredential: (credential: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
}

/** Botão "Continuar com Google" — renderizado pelo PRÓPRIO Google
 * (Google Identity Services), não um botão nosso estilizado: é assim
 * que o fluxo evita lidar com senha/client_secret no frontend. Some por
 * completo quando VITE_GOOGLE_OAUTH_CLIENT_ID não está configurado. */
export function GoogleSignInButton({ onCredential, text = "continue_with" }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => onCredential(response.credential),
        });
        // Reflete o tema atual — o GIS não escuta mudança de classe .dark
        // sozinho, então precisa re-renderizar o botão quando resolvedTheme
        // muda (ver dependência do efeito abaixo).
        containerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: resolvedTheme === "dark" ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text,
          width: 320,
        });
      })
      .catch(() => {
        // Falha ao carregar o script (ex: sem rede) — degrada em
        // silêncio, o mesmo espírito de "sem credencial configurada":
        // o resto da tela (formulário tradicional) continua funcionando.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme, text]);

  if (!GOOGLE_CLIENT_ID) return null;

  return <div ref={containerRef} className="flex justify-center" />;
}
