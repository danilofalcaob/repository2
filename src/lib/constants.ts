// Constantes e rótulos pt-BR. Centralizam os "enums" (mantidos como String no
// banco para compatibilidade SQLite/PostgreSQL) e a validação de domínio.

export const PERFIS = ["plantonista", "coordenador", "admin"] as const;
export type Perfil = (typeof PERFIS)[number];

export const PERFIL_LABEL: Record<Perfil, string> = {
  plantonista: "Plantonista",
  coordenador: "Coordenador",
  admin: "Administrador",
};

export const TIPOS_SETOR = ["PS", "enfermaria", "UTI", "outro"] as const;
export type TipoSetor = (typeof TIPOS_SETOR)[number];

export const TIPO_SETOR_LABEL: Record<TipoSetor, string> = {
  PS: "Pronto-Socorro",
  enfermaria: "Enfermaria",
  UTI: "UTI",
  outro: "Outro",
};

export const TIPOS_TURNO = ["diurno", "noturno", "custom"] as const;
export type TipoTurno = (typeof TIPOS_TURNO)[number];

export const STATUS_PACIENTE = ["ativo", "alta", "obito", "transferido"] as const;
export type StatusPaciente = (typeof STATUS_PACIENTE)[number];

export const STATUS_PACIENTE_LABEL: Record<StatusPaciente, string> = {
  ativo: "Ativo",
  alta: "Alta",
  obito: "Óbito",
  transferido: "Transferido",
};

// I — Gravidade da doença
export const GRAVIDADES = ["estavel", "cuidado", "instavel"] as const;
export type Gravidade = (typeof GRAVIDADES)[number];

export const GRAVIDADE_LABEL: Record<Gravidade, string> = {
  estavel: "Estável",
  cuidado: "Requer cuidado",
  instavel: "Instável",
};

// Ordem para priorização (maior = mais grave) — usada na ordenação do quadro.
export const GRAVIDADE_ORDEM: Record<Gravidade, number> = {
  instavel: 3,
  cuidado: 2,
  estavel: 1,
};

// Nível de preocupação / intuição clínica
export const PREOCUPACOES = ["baixo", "medio", "alto"] as const;
export type Preocupacao = (typeof PREOCUPACOES)[number];

export const PREOCUPACAO_LABEL: Record<Preocupacao, string> = {
  baixo: "Baixa",
  medio: "Média",
  alto: "Alta",
};

export const PREOCUPACAO_ORDEM: Record<Preocupacao, number> = {
  alto: 3,
  medio: 2,
  baixo: 1,
};

export const PRIORIDADES = ["baixa", "media", "alta"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const STATUS_PENDENCIA = ["aberta", "concluida", "cancelada"] as const;
export type StatusPendencia = (typeof STATUS_PENDENCIA)[number];

export const STATUS_CONTINGENCIA = ["ativa", "reconhecida", "disparada", "resolvida"] as const;
export type StatusContingencia = (typeof STATUS_CONTINGENCIA)[number];

export const STATUS_CONTINGENCIA_LABEL: Record<StatusContingencia, string> = {
  ativa: "Ativa",
  reconhecida: "Reconhecida",
  disparada: "Disparada",
  resolvida: "Resolvida",
};

// Cores semânticas (hex) para uso em badges/gráficos.
export const COR_GRAVIDADE: Record<Gravidade, string> = {
  estavel: "#16a34a",
  cuidado: "#d97706",
  instavel: "#dc2626",
};

export const COR_PREOCUPACAO: Record<Preocupacao, string> = {
  baixo: "#16a34a",
  medio: "#d97706",
  alto: "#dc2626",
};
