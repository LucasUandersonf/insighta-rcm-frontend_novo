// Tipos espelhando os schemas Pydantic do backend (app/schemas/*.py).
// Mantidos manualmente por enquanto — se o projeto crescer, vale gerar
// isso automaticamente a partir do OpenAPI (/openapi.json) que o
// FastAPI já expõe, em vez de manter os dois em sincronia na mão.
//
// S4: separado por área em src/lib/types/ (conta, dashboards, clínica,
// contratos, plataforma). Este arquivo só reexporta: todo import
// "@/lib/types" continua igual.
export type * from "./types/account";
export type * from "./types/analytics";
export type * from "./types/clinic";
export type * from "./types/contracts";
export type * from "./types/platform";
export type * from "./types/moneyPath";
