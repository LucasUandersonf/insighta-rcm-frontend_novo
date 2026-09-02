import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { login as loginRequest, register as registerRequest, storeToken, clearStoredToken, getStoredToken, ApiError } from "@/lib/api-client";
import { decodeJwtPayload, isTokenExpired } from "@/lib/jwt";
import type { CurrentUser, RegisterRequest, TenantOption } from "@/lib/types";

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
  logout: () => void;
  /** Erro amigável da última tentativa de login (null quando não há erro). */
  loginError: string | null;
  isLoggingIn: boolean;
  /**
   * Achado F-04 (Auditoria Go-Live): preenchido quando o mesmo e-mail
   * bate a senha em mais de um tenant — a UI deve mostrar um seletor de
   * clínica em vez de navegar direto. null quando não há ambiguidade.
   */
  tenantSelection: TenantOption[] | null;
  /** Completa o login depois que o usuário escolhe a clínica na lista acima. */
  selectTenant: (tenantId: string) => Promise<void>;
  /** Cancela a seleção pendente e volta para a tela normal de login. */
  cancelTenantSelection: () => void;
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
  const [tenantSelection, setTenantSelection] = useState<TenantOption[] | null>(null);
  // Guardados em memória só entre "seleciona clínica" e a segunda
  // chamada de login — nunca persistidos (mesmo tratamento que o campo
  // de senha do formulário já recebe).
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);

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

  const selectTenant = useCallback(
    async (tenantId: string) => {
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
    [pendingCredentials]
  );

  const cancelTenantSelection = useCallback(() => {
    setTenantSelection(null);
    setPendingCredentials(null);
    setLoginError(null);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
  }, []);

  // Escuta o evento disparado por api-client.ts em qualquer 401 vindo do
  // backend (token expirado/inválido) — desloga e deixa o ProtectedRoute
  // cuidar do redirecionamento, em vez de cada tela tratar isso na mão.
  useEffect(() => {
    const handleUnauthorized = () => logout();
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
        logout,
        loginError,
        isLoggingIn,
        tenantSelection,
        selectTenant,
        cancelTenantSelection,
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
