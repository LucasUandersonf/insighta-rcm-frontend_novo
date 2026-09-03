import { useEffect, useRef } from "react";
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

/**
 * Botão "Continuar com Google" — renderizado pelo PRÓPRIO Google (Google
 * Identity Services), não um botão nosso estilizado: é assim que o
 * fluxo evita lidar com senha/client_secret no frontend. Some por
 * completo quando VITE_GOOGLE_OAUTH_CLIENT_ID não está configurado.
 *
 * DECISÃO — sempre theme="outline" (nunca "filled_black" no escuro)
 * -------------------------------------------------------------------
 * O tema "filled_black" do GIS tem um bug de renderização conhecido:
 * deixa uma faixa/caixa branca ao redor do pill escuro em vez de um
 * fundo sólido (evidência visual reportada pelo usuário). Em vez de
 * brigar com esse bug, assumimos o branding OFICIAL do Google (fundo
 * claro, logo colorido) nos dois temas, encaixado num cartão branco
 * ARREDONDADO e do TAMANHO CERTO por nós mesmos — o branco fica
 * intencional (é a marca do Google), não um vazamento de estilo.
 */
export function GoogleSignInButton({ onCredential, text = "continue_with" }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => onCredential(response.credential),
        });
        container.innerHTML = "";
        window.google.accounts.id.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text,
          width: 300,
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
  }, [onCredential, text]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="flex justify-center">
      {/* Cartão branco justo ao tamanho do botão — o branding oficial do
          Google é sobre fundo claro; isolar isso aqui (em vez de deixar
          o botão "solto" sobre o vidro escuro do card) é o que faz o
          branco parecer proposital, não um remendo. */}
      <div ref={containerRef} className="overflow-hidden rounded-full bg-white shadow-card" />
    </div>
  );
}
