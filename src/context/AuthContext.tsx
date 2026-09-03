import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import {
  login as loginRequest,
  register as registerRequest,
  googleAuth as googleAuthRequest,
  storeToken,
  clearStoredToken,
  getStoredToken,
  ApiError,
} from "@/lib/api-client";
import { decodeJwtPayload, isTokenExpired } from "@/lib/jwt";
import type { CurrentUser, RegisterRequest, TenantOption } from "@/lib/types";

/** Resultado de loginWithGoogle — quem chama decide o que fazer com cada
 * caso (LoginPage e SignUpPage reagem de formas diferentes ao mesmo
 * needsRegistration, por exemplo), o context só reporta o que aconteceu. */
interface GoogleAuthResult {
  needsRegistration: boolean;
  requiresTenantSelection: boolean;
  email?: string;
  suggestedOwnerName?: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Cadastro público (self-signup) — autentica direto ao concluir
   * (ver DECISÃO em POST /auth/register no backend: sem etapa de
   * verificação de e-mail nesta primeira versão). */
  register: (data: RegisterRequest) => Promise<void>;
  /** Erro amigável da última tentativa de cadastro (null quando não há erro). */
  registerError: string | null;
  isRegistering: boolean;
  /** "Continuar com Google" — ver GoogleSignInButton.tsx. Não navega
   * sozinho: devolve o resultado para quem chamou decidir (ex: mandar
   * pro cadastro pré-preenchido quando needsRegistration=true). */
  loginWithGoogle: (credential: string) => Promise<GoogleAuthResult>;
  isLoggingInWithGoogle: boolean;
  logout: () => void;
  /** Erro amigável da última tentativa de login (null quando não há erro). */
  loginError: string | null;
  isLoggingIn: boolean;
  /**
   * Achado F-04 (Auditoria Go-Live): preenchido quando o mesmo e-mail
   * bate a senha em mais de um tenant — a UI deve mostrar um seletor de
   * clínica em vez de navegar direto. null quando não há ambiguidade.
   * Mesmo campo serve login tradicional e login com Google — o
   * componente de seleção (TenantSelector) não precisa saber qual dos
   * dois está em andamento, só chamar selectTenant.
   */
  tenantSelection: TenantOption[] | null;
  /** Completa o login depois que o usuário escolhe a clínica na lista acima. */
  selectTenant: (tenantId: string) => Promise<void>;
  /** Cancela a seleção pendente e volta para a tela normal de login. */
  cancelTenantSelection: () => void;
  /**
   * true quando o logout mais recente foi causado por um 401 em
   * pleno uso (token expirado/inválido), não por um clique manual em
   * "Sair" — a LoginPage usa isso para mostrar o aviso "Sua sessão
   * expirou por segurança" (ver Estados.dc.html) em vez de um login
   * silencioso e sem explicação.
   */
  sessionExpired: boolean;
  /** Chamado pela LoginPage depois de mostrar o aviso uma vez — evita
   * o aviso reaparecer se o usuário voltar para /login mais tarde na
   * mesma aba sem um novo 401 ter ocorrido. */
  dismissSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadInitialUser(): CurrentUser | null {
  const token = getStoredToken();
  if (!token || isTokenExpired(token)) return null;
  return decodeJwtPayload(token);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(loadInitialUser);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingInWithGoogle, setIsLoggingInWithGoogle] = useState(false);
  const [tenantSelection, setTenantSelection] = useState<TenantOption[] | null>(null);
  // Guardados em memória só entre "seleciona clínica" e a segunda
  // chamada de login — nunca persistidos (mesmo tratamento que o campo
  // de senha do formulário já recebe). Só um dos dois fica preenchido
  // por vez (login tradicional vs. login com Google).
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const response = await loginRequest(email, password);
      if (response.requires_tenant_selection) {
        // Ainda não há token — guarda as credenciais só até o usuário
        // escolher a clínica, e mostra o seletor em vez de autenticar.
        setPendingCredentials({ email, password });
        setTenantSelection(response.tenant_options);
        return;
      }
      storeToken(response.access_token!);
      setUser(decodeJwtPayload(response.access_token!));
    } catch (err) {
      // ApiError.message já vem em português, pronto para mostrar —
      // ver DECISÃO do envelope de erro em app/main.py do backend.
      setLoginError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.");
      throw err;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    setIsRegistering(true);
    setRegisterError(null);
    try {
      const response = await registerRequest(data);
      storeToken(response.access_token);
      setUser(decodeJwtPayload(response.access_token));
    } catch (err) {
      setRegisterError(err instanceof ApiError ? err.message : "Não foi possível concluir o cadastro. Tente novamente.");
      throw err;
    } finally {
      setIsRegistering(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async (credential: string): Promise<GoogleAuthResult> => {
    setIsLoggingInWithGoogle(true);
    setLoginError(null);
    try {
      const response = await googleAuthRequest(credential);

      if (response.needs_registration) {
        // Nenhuma conta com este e-mail — não é erro, é sinal para quem
        // chamou mandar a pessoa pro cadastro pré-preenchido. Nenhum
        // estado de sessão muda aqui.
        return { needsRegistration: true, requiresTenantSelection: false, email: response.email, suggestedOwnerName: response.suggested_owner_name };
      }

      if (response.requires_tenant_selection) {
        setPendingGoogleCredential(credential);
        setTenantSelection(response.tenant_options);
        return { needsRegistration: false, requiresTenantSelection: true };
      }

      storeToken(response.access_token!);
      setUser(decodeJwtPayload(response.access_token!));
      return { needsRegistration: false, requiresTenantSelection: false };
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : "Não foi possível entrar com o Google. Tente novamente.");
      throw err;
    } finally {
      setIsLoggingInWithGoogle(false);
    }
  }, []);

  const selectTenant = useCallback(
    async (tenantId: string) => {
      if (pendingGoogleCredential) {
        setIsLoggingInWithGoogle(true);
        setLoginError(null);
        try {
          const response = await googleAuthRequest(pendingGoogleCredential, tenantId);
          storeToken(response.access_token!);
          setUser(decodeJwtPayload(response.access_token!));
          setTenantSelection(null);
          setPendingGoogleCredential(null);
        } catch (err) {
          setLoginError(err instanceof ApiError ? err.message : "Não foi possível entrar com o Google. Tente novamente.");
          throw err;
        } finally {
          setIsLoggingInWithGoogle(false);
        }
        return;
      }

      if (!pendingCredentials) return;
      setIsLoggingIn(true);
      setLoginError(null);
      try {
        const response = await loginRequest(pendingCredentials.email, pendingCredentials.password, tenantId);
        storeToken(response.access_token!);
        setUser(decodeJwtPayload(response.access_token!));
        setTenantSelection(null);
        setPendingCredentials(null);
      } catch (err) {
        setLoginError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.");
        throw err;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [pendingCredentials, pendingGoogleCredential]
  );

  const cancelTenantSelection = useCallback(() => {
    setTenantSelection(null);
    setPendingCredentials(null);
    setPendingGoogleCredential(null);
    setLoginError(null);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
  }, []);

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), []);

  // Escuta o evento disparado por api-client.ts em qualquer 401 vindo do
  // backend (token expirado/inválido) — desloga e deixa o ProtectedRoute
  // cuidar do redirecionamento, em vez de cada tela tratar isso na mão.
  // api-client.ts só dispara este evento numa chamada AUTENTICADA
  // (`!skipAuth`), nunca no próprio /auth/login — então, ao contrário de
  // um logout manual, isto sempre significa "havia uma sessão e ela
  // caiu", daí marcar sessionExpired sem precisar checar se `user`
  // ainda estava preenchido.
  useEffect(() => {
    const handleUnauthorized = () => {
      setSessionExpired(true);
      logout();
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        register,
        registerError,
        isRegistering,
        loginWithGoogle,
        isLoggingInWithGoogle,
        logout,
        loginError,
        isLoggingIn,
        tenantSelection,
        selectTenant,
        cancelTenantSelection,
        sessionExpired,
        dismissSessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
