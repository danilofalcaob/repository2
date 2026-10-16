// Regras de negócio e vocabulário do app. Centralizado para que a interface,
// o motor de casamento e os testes falem a mesma língua.

// Comissão da plataforma sobre o valor bruto de cada carro vendido na ciranda.
export const TAXA_PLATAFORMA = 0.05;

// Taxa de serviço padrão de uma loja nova (cada loja define a sua).
export const TAXA_LOJA_PADRAO = 0.03;

// Prazo para os participantes responderem (aceite e confirmação final).
export const PRAZO_RESPOSTA_HORAS = 48;

// Ciclos longos fecham mais negócios, mas cada elo a mais é mais um ponto de
// desistência: 6 é um teto prático para a logística de uma loja.
export const TAMANHO_MAXIMO_CIRANDA = 6;

export const MAX_DESEJOS = 3;

export const PERFIS = ["cliente", "loja", "admin"] as const;
export type Perfil = (typeof PERFIS)[number];
export const PERFIL_LABEL: Record<Perfil, string> = {
  cliente: "Cliente",
  loja: "Loja parceira",
  admin: "Plataforma",
};

export const TIPOS_INTENCAO = ["troca", "venda", "compra"] as const;
export type TipoIntencao = (typeof TIPOS_INTENCAO)[number];
export const TIPO_INTENCAO_LABEL: Record<TipoIntencao, string> = {
  troca: "Trocar meu carro",
  venda: "Só vender",
  compra: "Só comprar",
};

export const STATUS_INTENCAO = ["ativa", "em_ciranda", "pausada", "concluida", "cancelada"] as const;
export type StatusIntencao = (typeof STATUS_INTENCAO)[number];
export const STATUS_INTENCAO_LABEL: Record<StatusIntencao, string> = {
  ativa: "Procurando ciranda",
  em_ciranda: "Em negociação",
  pausada: "Pausado",
  concluida: "Concluído",
  cancelada: "Cancelado",
};

export const STATUS_CIRANDA = [
  "proposta",
  "aguardando_loja",
  "em_avaliacao",
  "confirmacao_final",
  "em_liquidacao",
  "concluida",
  "cancelada",
] as const;
export type StatusCiranda = (typeof STATUS_CIRANDA)[number];
export const STATUS_CIRANDA_LABEL: Record<StatusCiranda, string> = {
  proposta: "Aguardando aceites",
  aguardando_loja: "Aguardando loja",
  em_avaliacao: "Em avaliação na loja",
  confirmacao_final: "Confirmação final",
  em_liquidacao: "Pagamentos e transferências",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
export const STATUS_CIRANDA_EM_ANDAMENTO: StatusCiranda[] = [
  "proposta",
  "aguardando_loja",
  "em_avaliacao",
  "confirmacao_final",
  "em_liquidacao",
];

export const CAMBIOS = ["manual", "automatico"] as const;
export const CAMBIO_LABEL: Record<string, string> = { manual: "Manual", automatico: "Automático" };

export const COMBUSTIVEIS = ["Flex", "Gasolina", "Diesel", "Híbrido", "Elétrico"] as const;

// Cores canônicas (masculino) — o motor compara por esta forma.
export const CORES = [
  "branco",
  "preto",
  "prata",
  "cinza",
  "vermelho",
  "azul",
  "verde",
  "marrom",
  "bege",
  "amarelo",
  "laranja",
  "dourado",
  "vinho",
] as const;

// Sugestões para os campos de marca/modelo (o usuário pode digitar outros).
export const CATALOGO: Record<string, string[]> = {
  Audi: ["A3", "A4", "A5", "Q3", "Q5"],
  BMW: ["320i", "X1", "X3", "X5"],
  BYD: ["Dolphin", "Song Plus", "Seal"],
  Chevrolet: ["Onix", "Onix Plus", "Tracker", "Equinox", "S10", "Spin", "Montana"],
  Fiat: ["Argo", "Cronos", "Pulse", "Fastback", "Toro", "Strada", "Mobi"],
  Ford: ["Ranger", "Territory", "Bronco Sport", "Maverick"],
  Honda: ["City", "Civic", "HR-V", "WR-V", "ZR-V"],
  Hyundai: ["HB20", "HB20S", "Creta", "Tucson"],
  Jeep: ["Renegade", "Compass", "Commander"],
  Mercedes: ["Classe A", "Classe C", "GLA"],
  Mitsubishi: ["L200", "Eclipse Cross", "Outlander"],
  Nissan: ["Kicks", "Versa", "Sentra", "Frontier"],
  Peugeot: ["208", "2008", "3008"],
  Renault: ["Kwid", "Sandero", "Duster", "Oroch", "Kardian"],
  Toyota: ["Yaris", "Corolla", "Corolla Cross", "Hilux", "SW4"],
  Volkswagen: ["Polo", "Virtus", "Nivus", "T-Cross", "Taos", "Amarok", "Saveiro"],
  Volvo: ["XC40", "XC60"],
};
