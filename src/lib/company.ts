/**
 * Dados da empresa que aparecem nos documentos legais (Termos, Política de
 * Privacidade e Contrato de Tratamento de Dados). Vêm do ambiente de build
 * (Railway → variáveis VITE_COMPANY_*); enquanto a empresa não existe,
 * aparecem como "[a preencher: ...]". Preencher = definir as variáveis e
 * publicar de novo, sem mudar código.
 */
function value(raw: string | undefined, label: string): string {
  const v = (raw ?? "").trim();
  return v || `[a preencher: ${label}]`;
}

const env = import.meta.env;

export const COMPANY = {
  legalName: value(env.VITE_COMPANY_LEGAL_NAME, "razão social"),
  cnpj: value(env.VITE_COMPANY_CNPJ, "CNPJ"),
  address: value(env.VITE_COMPANY_ADDRESS, "endereço da sede"),
  forumCity: value(env.VITE_COMPANY_FORUM_CITY, "cidade da sede"),
  dpoName: value(env.VITE_DPO_NAME, "nome do encarregado"),
  dpoEmail: value(env.VITE_DPO_EMAIL, "e-mail de privacidade"),
};

/** Versão vigente dos três documentos; igual a TERMS_VERSION no backend. */
export const LEGAL_VERSION = "2026-09-27";
export const LEGAL_UPDATED_AT = "27/09/2026";
