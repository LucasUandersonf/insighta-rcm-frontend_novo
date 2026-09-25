/**
 * Motivos do motor de glosa (app/services/denial_risk_engine.py) em
 * português — as tabelas de risco mostravam o código técnico
 * ("no_contract_reference, procedure_patient_sex_mismatch").
 * Código desconhecido (regra nova no backend) aparece como veio.
 */
const LABELS: Record<string, string> = {
  missing_cid: "Falta o CID",
  missing_procedure_code: "Falta o código do procedimento",
  no_contract_reference: "Sem tabela de preço",
  duplicate_billing: "Cobrança duplicada",
  value_above_contract: "Acima do valor do contrato",
  value_below_contract_revenue_leak: "Abaixo do valor do contrato",
  tuss_code_not_yet_valid: "Código TUSS ainda não vigente",
  tuss_code_no_longer_valid: "Código TUSS fora de vigência",
  procedure_patient_sex_mismatch: "Procedimento incompatível com o sexo do paciente",
  procedure_patient_age_below_min: "Paciente abaixo da idade indicada",
  procedure_patient_age_above_max: "Paciente acima da idade indicada",
  ml_predicted_high_denial_risk: "Histórico indica alta chance de glosa",
};

export function denialReasonLabel(code: string): string {
  return LABELS[code] ?? code;
}

export function denialReasonsText(codes: string[]): string {
  return codes.map(denialReasonLabel).join(" · ");
}
