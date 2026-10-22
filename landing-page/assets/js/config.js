/*
 * Configuração da landing page — edite só este arquivo.
 * Campos vazios ("") ficam ocultos na página. Enquanto WhatsApp ou CRM
 * estiverem vazios, aparece uma faixa de aviso no topo do site.
 */
window.SITE_CONFIG = {
  // WhatsApp da equipe: DDI + DDD + número, só dígitos. Ex.: "5531999999999"
  whatsapp: "",

  // Mensagem padrão que já chega escrita no WhatsApp
  whatsappMessage: "Olá! Vim pelo site e gostaria de agendar uma consulta com o Dr. Danilo Falcão.",

  // Obrigatórios na publicidade médica (Resolução CFM nº 2.336/2023)
  crm: "", // ex.: "CRM-MG 00000"
  rqe: "", // ex.: "RQE 00000" — preencha só se houver especialidade registrada

  // Título exibido junto ao nome (ex.: "Médico", ou a especialidade com RQE)
  titulo: "Médico",

  // Formação e experiência exibidas na seção "Sobre" (uma linha por item)
  credenciais: [
    // "Graduação em Medicina — Universidade X",
    // "Pós-graduação em ...",
  ],

  instagram: "", // ex.: "https://instagram.com/drdanilofalcao"
  email: "",

  // Depoimentos REAIS, com autorização do paciente. A seção só aparece se houver itens.
  depoimentos: [
    // { nome: "Maria S.", texto: "..." },
  ],
  googleReviewsUrl: "", // link para as avaliações do Google (opcional)

  // Opcional: URL que recebe cada lead em JSON (Make, Zapier, n8n, RD Station, planilha...)
  leadWebhookUrl: "",

  // Opcional: rastreamento de conversões
  ga4Id: "", // ex.: "G-XXXXXXXXXX"
  metaPixelId: "", // ex.: "123456789012345"
};
