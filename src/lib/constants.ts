// Constantes e rótulos pt-BR. Centralizam os "enums" (mantidos como String no
// banco para compatibilidade SQLite/PostgreSQL) e a validação de domínio.

export const PERFIS = ["plantonista", "profissional", "coordenador", "admin"] as const;
export type Perfil = (typeof PERFIS)[number];

export const PERFIL_LABEL: Record<Perfil, string> = {
  plantonista: "Plantonista",
  profissional: "Profissional assistencial",
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

// ---------------------------------------------------------------------------
// CRM de deshospitalização — Jornada de Alta
// ---------------------------------------------------------------------------

// Disciplinas assistenciais. Cada barreira/tarefa tem uma disciplina dona, e
// cada profissional enxerga sua própria "caixa de entrada" por esse campo.
export const DISCIPLINAS = [
  "medicina",
  "enfermagem",
  "fisioterapia",
  "servico_social",
  "farmacia",
  "nutricao",
  "fonoaudiologia",
  "psicologia",
  "terapia_ocupacional",
  "gestao_leitos",
] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

export const DISCIPLINA_LABEL: Record<Disciplina, string> = {
  medicina: "Medicina",
  enfermagem: "Enfermagem",
  fisioterapia: "Fisioterapia",
  servico_social: "Serviço Social",
  farmacia: "Farmácia",
  nutricao: "Nutrição",
  fonoaudiologia: "Fonoaudiologia",
  psicologia: "Psicologia",
  terapia_ocupacional: "Terapia Ocupacional",
  gestao_leitos: "Gestão de Leitos / NIR",
};

export const DISCIPLINA_ICONE: Record<Disciplina, string> = {
  medicina: "🩺",
  enfermagem: "💉",
  fisioterapia: "🦵",
  servico_social: "🤝",
  farmacia: "💊",
  nutricao: "🥗",
  fonoaudiologia: "🗣️",
  psicologia: "🧠",
  terapia_ocupacional: "✋",
  gestao_leitos: "🛏️",
};

// Funil (pipeline) da jornada de internação até a alta.
export const ETAPAS_JORNADA = [
  "admissao",
  "investigacao",
  "tratamento",
  "criterios",
  "planejamento",
  "alta_pactuada",
  "alta_efetivada",
] as const;
export type EtapaJornada = (typeof ETAPAS_JORNADA)[number];

export const ETAPA_LABEL: Record<EtapaJornada, string> = {
  admissao: "Admissão",
  investigacao: "Investigação",
  tratamento: "Tratamento",
  criterios: "Critérios de alta",
  planejamento: "Planejamento de alta",
  alta_pactuada: "Alta pactuada (D-1)",
  alta_efetivada: "Alta efetivada",
};

// O que precisa acontecer em cada etapa — mostrado no funil e no round para
// alinhar a equipe sobre o significado de cada coluna.
export const ETAPA_DESCRICAO: Record<EtapaJornada, string> = {
  admissao: "Caso admitido: definir hipótese, gestor do caso e primeira previsão de alta.",
  investigacao: "Exames e pareceres em curso para fechar o diagnóstico.",
  tratamento: "Tratamento definido em andamento; acompanhar resposta clínica.",
  criterios: "Resposta clínica adequada: validar os critérios objetivos de alta.",
  planejamento: "Resolver barreiras não clínicas (social, transporte, insumos, autorizações).",
  alta_pactuada: "Data e hora combinadas com paciente, família e equipe; preparar documentação.",
  alta_efetivada: "Paciente saiu do hospital com plano de seguimento definido.",
};

export const ETAPA_ORDEM: Record<EtapaJornada, number> = {
  admissao: 1,
  investigacao: 2,
  tratamento: 3,
  criterios: 4,
  planejamento: 5,
  alta_pactuada: 6,
  alta_efetivada: 7,
};

export const STATUS_JORNADA = ["aberta", "concluida", "encerrada"] as const;
export type StatusJornada = (typeof STATUS_JORNADA)[number];

export const STATUS_JORNADA_LABEL: Record<StatusJornada, string> = {
  aberta: "Em andamento",
  concluida: "Alta efetivada",
  encerrada: "Encerrada",
};

// Categorias de barreira à alta. A distinção clínica × não clínica é o que
// permite atacar o desperdício: paciente clinicamente pronto que segue internado.
export const CATEGORIAS_BARREIRA = [
  "clinica",
  "exame",
  "parecer",
  "procedimento",
  "medicamento",
  "reabilitacao",
  "social",
  "transporte",
  "domiciliar",
  "autorizacao",
  "documentacao",
  "vaga_externa",
] as const;
export type CategoriaBarreira = (typeof CATEGORIAS_BARREIRA)[number];

export const CATEGORIA_BARREIRA_LABEL: Record<CategoriaBarreira, string> = {
  clinica: "Condição clínica",
  exame: "Exame pendente",
  parecer: "Parecer/interconsulta",
  procedimento: "Procedimento/cirurgia",
  medicamento: "Medicamento/antibiótico EV",
  reabilitacao: "Reabilitação/funcionalidade",
  social: "Social/cuidador",
  transporte: "Transporte/remoção",
  domiciliar: "Suporte domiciliar (O₂, cama, dieta)",
  autorizacao: "Autorização/convênio/regulação",
  documentacao: "Documentação e orientações",
  vaga_externa: "Vaga externa (retaguarda/ILPI)",
};

// Barreiras clínicas dependem da evolução do paciente; as demais são
// organizacionais e, em geral, poderiam ser antecipadas.
export const CATEGORIA_BARREIRA_CLINICA: Record<CategoriaBarreira, boolean> = {
  clinica: true,
  exame: true,
  parecer: true,
  procedimento: true,
  medicamento: true,
  reabilitacao: true,
  social: false,
  transporte: false,
  domiciliar: false,
  autorizacao: false,
  documentacao: false,
  vaga_externa: false,
};

// Disciplina sugerida ao abrir uma barreira de cada categoria.
export const CATEGORIA_BARREIRA_DISCIPLINA: Record<CategoriaBarreira, Disciplina> = {
  clinica: "medicina",
  exame: "medicina",
  parecer: "medicina",
  procedimento: "medicina",
  medicamento: "farmacia",
  reabilitacao: "fisioterapia",
  social: "servico_social",
  transporte: "servico_social",
  domiciliar: "servico_social",
  autorizacao: "gestao_leitos",
  documentacao: "enfermagem",
  vaga_externa: "gestao_leitos",
};

export const STATUS_BARREIRA = ["aberta", "em_andamento", "resolvida", "cancelada"] as const;
export type StatusBarreira = (typeof STATUS_BARREIRA)[number];

export const STATUS_BARREIRA_LABEL: Record<StatusBarreira, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  resolvida: "Resolvida",
  cancelada: "Cancelada",
};

export const CONFIANCAS = ["baixa", "media", "alta"] as const;
export type Confianca = (typeof CONFIANCAS)[number];

export const CONFIANCA_LABEL: Record<Confianca, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const DESTINOS_ALTA = [
  "domicilio",
  "domicilio_apoio",
  "home_care",
  "ilpi",
  "retaguarda",
  "outro_hospital",
] as const;
export type DestinoAlta = (typeof DESTINOS_ALTA)[number];

export const DESTINO_ALTA_LABEL: Record<DestinoAlta, string> = {
  domicilio: "Domicílio (independente)",
  domicilio_apoio: "Domicílio com cuidador",
  home_care: "Internação domiciliar (home care)",
  ilpi: "ILPI / casa de repouso",
  retaguarda: "Hospital de retaguarda",
  outro_hospital: "Transferência para outro hospital",
};

export const TIPOS_INTERACAO = [
  "nota",
  "round",
  "decisao",
  "familia",
  "etapa",
  "barreira",
  "tarefa",
  "alerta",
  "alta",
] as const;
export type TipoInteracao = (typeof TIPOS_INTERACAO)[number];

export const TIPO_INTERACAO_LABEL: Record<TipoInteracao, string> = {
  nota: "Nota",
  round: "Round multiprofissional",
  decisao: "Decisão",
  familia: "Comunicação com família",
  etapa: "Mudança de etapa",
  barreira: "Barreira",
  tarefa: "Tarefa",
  alerta: "Alerta",
  alta: "Alta",
};

export const TIPO_INTERACAO_ICONE: Record<TipoInteracao, string> = {
  nota: "📝",
  round: "👥",
  decisao: "⚖️",
  familia: "📞",
  etapa: "➡️",
  barreira: "🚧",
  tarefa: "✅",
  alerta: "⚠️",
  alta: "🏠",
};

export const CATEGORIAS_CRITERIO = ["clinico", "funcional", "educacional", "logistico"] as const;
export type CategoriaCriterio = (typeof CATEGORIAS_CRITERIO)[number];

export const CATEGORIA_CRITERIO_LABEL: Record<CategoriaCriterio, string> = {
  clinico: "Clínico",
  funcional: "Funcional",
  educacional: "Educação do paciente/cuidador",
  logistico: "Logístico",
};

// Checklist padrão de critérios objetivos de alta, criado junto com a jornada.
// Baseado nos domínios clássicos de prontidão para alta (estabilidade clínica,
// funcionalidade, educação do cuidador e logística de continuidade do cuidado).
export const CRITERIOS_ALTA_PADRAO: {
  categoria: CategoriaCriterio;
  descricao: string;
}[] = [
  { categoria: "clinico", descricao: "Afebril nas últimas 24h" },
  { categoria: "clinico", descricao: "Sinais vitais estáveis por 24h, sem necessidade de monitorização" },
  { categoria: "clinico", descricao: "Sem oxigênio suplementar (ou já na condição domiciliar definitiva)" },
  { categoria: "clinico", descricao: "Dor controlada com medicação por via oral" },
  { categoria: "clinico", descricao: "Antibiótico concluído ou convertido para via oral" },
  { categoria: "clinico", descricao: "Exames de controle sem alterações que exijam internação" },
  { categoria: "funcional", descricao: "Aceita dieta por via oral sem intercorrências" },
  { categoria: "funcional", descricao: "Mobilidade compatível com o destino de alta (avaliada pela fisioterapia)" },
  { categoria: "funcional", descricao: "Eliminações e dispositivos (sondas/acessos) resolvidos ou manejáveis fora do hospital" },
  { categoria: "educacional", descricao: "Paciente/cuidador orientados sobre medicações e sinais de alarme" },
  { categoria: "educacional", descricao: "Cuidador identificado e disponível no domicílio" },
  { categoria: "logistico", descricao: "Receitas, relatório de alta e atestados emitidos" },
  { categoria: "logistico", descricao: "Medicações e insumos garantidos para o domicílio" },
  { categoria: "logistico", descricao: "Transporte definido para a saída" },
  { categoria: "logistico", descricao: "Retorno/seguimento agendado (ambulatório, UBS ou home care)" },
];

// Cores por etapa do funil (cabeçalho das colunas e gráficos).
export const COR_ETAPA: Record<EtapaJornada, string> = {
  admissao: "#64748b",
  investigacao: "#6366f1",
  tratamento: "#0ea5e9",
  criterios: "#14b8a6",
  planejamento: "#d97706",
  alta_pactuada: "#16a34a",
  alta_efetivada: "#0f766e",
};
