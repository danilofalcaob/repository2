// Regras de negócio do CRM de deshospitalização ("Jornada de Alta").
//
// Este arquivo é intencionalmente PURO (sem acesso a banco ou a APIs do
// Next.js): é onde moram as decisões clínicas/organizacionais do funil, e por
// isso precisa ser diretamente testável (ver tests/jornada.test.ts).

import {
  DISCIPLINAS,
  ETAPA_ORDEM,
  ETAPA_LABEL,
  CATEGORIA_BARREIRA_CLINICA,
  CATEGORIA_BARREIRA_LABEL,
  type CategoriaBarreira,
  type Disciplina,
  type EtapaJornada,
} from "./constants";

export const MS_DIA = 24 * 60 * 60 * 1000;

// Horas sem nenhuma interação registrada a partir das quais a jornada é
// considerada "parada" — no CRM clássico, o negócio esquecido no funil.
export const HORAS_PARA_JORNADA_PARADA = 24;

export type BarreiraLite = {
  categoria: string;
  status: string;
  bloqueiaAlta: boolean;
  prazo?: Date | string | null;
  impactoDias?: number | null;
  abertaEm?: Date | string | null;
  resolvidaEm?: Date | string | null;
};

export type CriterioLite = {
  atendido: boolean;
  naoAplicavel: boolean;
};

export type TarefaLite = {
  status: string;
  prazo?: Date | string | null;
};

export type JornadaLite = {
  etapa: string;
  status: string;
  dataAltaPrevista?: Date | string | null;
  dataAltaPrevistaInicial?: Date | string | null;
  gestorCasoId?: string | null;
  ultimaInteracaoEm?: Date | string | null;
  criadaEm?: Date | string | null;
  altaEfetivadaEm?: Date | string | null;
  barreiras?: BarreiraLite[];
  criterios?: CriterioLite[];
  tarefas?: TarefaLite[];
  dataAdmissao?: Date | string | null;
};

function comoData(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  return typeof d === "string" ? new Date(d) : d;
}

// Início do dia — usado para contar dias "de calendário", que é como a equipe
// raciocina sobre permanência e data de alta.
export function inicioDoDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function diasEntre(de: Date | string, ate: Date | string = new Date()): number {
  const a = inicioDoDia(comoData(de)!);
  const b = inicioDoDia(comoData(ate)!);
  return Math.round((b.getTime() - a.getTime()) / MS_DIA);
}

// Tempo de permanência em dias (LOS).
export function diasInternacao(
  dataAdmissao: Date | string | null | undefined,
  referencia: Date = new Date(),
): number {
  const adm = comoData(dataAdmissao);
  if (!adm) return 0;
  return Math.max(0, diasEntre(adm, referencia));
}

// ---------------------------------------------------------------------------
// Prontidão para alta (o "grau de avanço do negócio" no CRM)
// ---------------------------------------------------------------------------

export type Prontidao = {
  atendidos: number;
  aplicaveis: number;
  percentual: number; // 0..1
};

export function prontidaoAlta(criterios: CriterioLite[] | undefined): Prontidao {
  const lista = (criterios ?? []).filter((c) => !c.naoAplicavel);
  const atendidos = lista.filter((c) => c.atendido).length;
  return {
    atendidos,
    aplicaveis: lista.length,
    percentual: lista.length ? atendidos / lista.length : 0,
  };
}

// ---------------------------------------------------------------------------
// Barreiras
// ---------------------------------------------------------------------------

export function barreiraAberta(b: BarreiraLite): boolean {
  return b.status === "aberta" || b.status === "em_andamento";
}

export function barreirasAbertas(barreiras: BarreiraLite[] | undefined): BarreiraLite[] {
  return (barreiras ?? []).filter(barreiraAberta);
}

export function barreirasBloqueantes(barreiras: BarreiraLite[] | undefined): BarreiraLite[] {
  return barreirasAbertas(barreiras).filter((b) => b.bloqueiaAlta);
}

export function barreirasVencidas(
  barreiras: BarreiraLite[] | undefined,
  agora: Date = new Date(),
): BarreiraLite[] {
  return barreirasAbertas(barreiras).filter((b) => {
    const prazo = comoData(b.prazo);
    return !!prazo && prazo.getTime() < agora.getTime();
  });
}

// Separa o que trava a alta por natureza: barreira clínica é evolução do
// paciente; barreira não clínica é processo — e processo pode ser antecipado.
export function barreirasPorNatureza(barreiras: BarreiraLite[] | undefined) {
  const abertas = barreirasAbertas(barreiras);
  const clinicas = abertas.filter(
    (b) => CATEGORIA_BARREIRA_CLINICA[b.categoria as CategoriaBarreira] ?? true,
  );
  const naoClinicas = abertas.filter(
    (b) => !(CATEGORIA_BARREIRA_CLINICA[b.categoria as CategoriaBarreira] ?? true),
  );
  return { clinicas, naoClinicas };
}

// Dias de atraso estimados: usa o maior impacto entre as barreiras abertas
// (elas costumam correr em paralelo, não em série).
export function atrasoEstimadoDias(barreiras: BarreiraLite[] | undefined): number {
  const abertas = barreirasAbertas(barreiras);
  return abertas.reduce((max, b) => Math.max(max, b.impactoDias ?? 0), 0);
}

export function tempoResolucaoBarreiraHoras(b: BarreiraLite): number | null {
  const abertaEm = comoData(b.abertaEm);
  const resolvidaEm = comoData(b.resolvidaEm);
  if (!abertaEm || !resolvidaEm) return null;
  return (resolvidaEm.getTime() - abertaEm.getTime()) / 3600000;
}

// ---------------------------------------------------------------------------
// Data de alta prevista (DAP)
// ---------------------------------------------------------------------------

export type SituacaoDAP = "sem_previsao" | "vencida" | "hoje" | "amanha" | "proximos_dias" | "futura";

export function situacaoDAP(
  dataAltaPrevista: Date | string | null | undefined,
  agora: Date = new Date(),
): SituacaoDAP {
  const dap = comoData(dataAltaPrevista);
  if (!dap) return "sem_previsao";
  const dias = diasEntre(agora, dap);
  if (dias < 0) return "vencida";
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanha";
  if (dias <= 3) return "proximos_dias";
  return "futura";
}

export const SITUACAO_DAP_LABEL: Record<SituacaoDAP, string> = {
  sem_previsao: "Sem previsão de alta",
  vencida: "Previsão vencida",
  hoje: "Alta prevista hoje",
  amanha: "Alta prevista amanhã",
  proximos_dias: "Alta nos próximos dias",
  futura: "Alta prevista adiante",
};

// Desvio entre a PRIMEIRA previsão e a alta real, em dias.
// Positivo = alta saiu depois do previsto; negativo = antes.
export function desvioPrevisaoDias(
  dataAltaPrevistaInicial: Date | string | null | undefined,
  altaEfetivadaEm: Date | string | null | undefined,
): number | null {
  const prevista = comoData(dataAltaPrevistaInicial);
  const real = comoData(altaEfetivadaEm);
  if (!prevista || !real) return null;
  return diasEntre(prevista, real);
}

// Consideramos a previsão "acertada" com tolerância de 1 dia — é a precisão
// que basta para organizar leito, transporte e família.
export function previsaoAcertou(desvio: number | null, tolerancia = 1): boolean {
  return desvio !== null && Math.abs(desvio) <= tolerancia;
}

// ---------------------------------------------------------------------------
// Alertas: o que a equipe precisa ver sem procurar
// ---------------------------------------------------------------------------

export type NivelAlerta = "critico" | "atencao" | "info";

export type Alerta = {
  tipo: string;
  nivel: NivelAlerta;
  texto: string;
};

export function horasSemInteracao(
  ultimaInteracaoEm: Date | string | null | undefined,
  agora: Date = new Date(),
): number | null {
  const ultima = comoData(ultimaInteracaoEm);
  if (!ultima) return null;
  return (agora.getTime() - ultima.getTime()) / 3600000;
}

export function jornadaParada(
  ultimaInteracaoEm: Date | string | null | undefined,
  agora: Date = new Date(),
  limiteHoras: number = HORAS_PARA_JORNADA_PARADA,
): boolean {
  const horas = horasSemInteracao(ultimaInteracaoEm, agora);
  return horas !== null && horas >= limiteHoras;
}

export function alertasJornada(j: JornadaLite, agora: Date = new Date()): Alerta[] {
  const alertas: Alerta[] = [];
  if (j.status !== "aberta") return alertas;

  const situacao = situacaoDAP(j.dataAltaPrevista, agora);
  if (situacao === "sem_previsao") {
    alertas.push({
      tipo: "sem_dap",
      nivel: "atencao",
      texto: "Sem data de alta prevista — o caso não tem meta compartilhada.",
    });
  }
  if (situacao === "vencida") {
    const dias = Math.abs(diasEntre(agora, comoData(j.dataAltaPrevista)!));
    alertas.push({
      tipo: "dap_vencida",
      nivel: "critico",
      texto: `Previsão de alta vencida há ${dias} dia(s) e sem repactuação.`,
    });
  }

  const vencidas = barreirasVencidas(j.barreiras, agora);
  if (vencidas.length) {
    alertas.push({
      tipo: "barreira_vencida",
      nivel: "critico",
      texto: `${vencidas.length} barreira(s) com prazo vencido.`,
    });
  }

  const { naoClinicas } = barreirasPorNatureza(j.barreiras);
  const pront = prontidaoAlta(j.criterios);
  if (pront.aplicaveis > 0 && pront.percentual >= 0.8 && naoClinicas.length > 0) {
    alertas.push({
      tipo: "alta_travada_processo",
      nivel: "critico",
      texto: `Critérios clínicos quase completos, mas ${naoClinicas.length} barreira(s) não clínica(s) seguram a alta.`,
    });
  }

  if (jornadaParada(j.ultimaInteracaoEm, agora)) {
    const horas = Math.floor(horasSemInteracao(j.ultimaInteracaoEm, agora)!);
    alertas.push({
      tipo: "parada",
      nivel: "atencao",
      texto: `Sem registro da equipe há ${horas}h.`,
    });
  }

  if (!j.gestorCasoId) {
    alertas.push({
      tipo: "sem_gestor",
      nivel: "atencao",
      texto: "Caso sem gestor definido — ninguém responde pelo plano de alta.",
    });
  }

  const tarefasVencidas = (j.tarefas ?? []).filter((t) => {
    if (t.status !== "aberta") return false;
    const prazo = comoData(t.prazo);
    return !!prazo && prazo.getTime() < agora.getTime();
  });
  if (tarefasVencidas.length) {
    alertas.push({
      tipo: "tarefa_vencida",
      nivel: "atencao",
      texto: `${tarefasVencidas.length} tarefa(s) vencida(s).`,
    });
  }

  return alertas;
}

// Score de priorização do funil: quem a equipe precisa discutir primeiro no
// round. Pesos maiores para o que gera dia de internação evitável.
export function scorePrioridade(j: JornadaLite, agora: Date = new Date()): number {
  if (j.status !== "aberta") return -1;
  let score = 0;

  const situacao = situacaoDAP(j.dataAltaPrevista, agora);
  if (situacao === "vencida") score += 50;
  else if (situacao === "hoje") score += 30;
  else if (situacao === "amanha") score += 20;
  else if (situacao === "sem_previsao") score += 15;

  score += barreirasVencidas(j.barreiras, agora).length * 12;

  const { clinicas, naoClinicas } = barreirasPorNatureza(j.barreiras);
  // Barreira não clínica pesa mais: é a que costuma ser evitável.
  score += naoClinicas.length * 8 + clinicas.length * 3;

  const pront = prontidaoAlta(j.criterios);
  if (pront.aplicaveis > 0 && pront.percentual >= 0.8) score += 18;

  if (jornadaParada(j.ultimaInteracaoEm, agora)) score += 14;
  if (!j.gestorCasoId) score += 6;

  // Permanência longa entra com peso leve e teto, para não ofuscar o resto.
  score += Math.min(15, diasInternacao(j.dataAdmissao ?? j.criadaEm, agora));

  return score;
}

// ---------------------------------------------------------------------------
// Movimentação no funil
// ---------------------------------------------------------------------------

export function proximaEtapa(etapa: string): EtapaJornada | null {
  const ordem = ETAPA_ORDEM[etapa as EtapaJornada];
  if (!ordem) return null;
  const proxima = (Object.keys(ETAPA_ORDEM) as EtapaJornada[]).find(
    (e) => ETAPA_ORDEM[e] === ordem + 1,
  );
  return proxima ?? null;
}

export function etapaAnterior(etapa: string): EtapaJornada | null {
  const ordem = ETAPA_ORDEM[etapa as EtapaJornada];
  if (!ordem) return null;
  const anterior = (Object.keys(ETAPA_ORDEM) as EtapaJornada[]).find(
    (e) => ETAPA_ORDEM[e] === ordem - 1,
  );
  return anterior ?? null;
}

export type ValidacaoEtapa = { ok: boolean; motivo?: string };

// Trava de segurança do funil: a alta só é efetivada com as barreiras
// bloqueantes resolvidas. O objetivo é alta PRECOCE **e** SEGURA — antecipar
// sem resolver o que trava é como empurrar o problema para a reinternação.
export function validarMudancaEtapa(
  j: JornadaLite,
  destino: string,
  agora: Date = new Date(),
): ValidacaoEtapa {
  if (!(destino in ETAPA_ORDEM)) return { ok: false, motivo: "Etapa desconhecida." };
  if (j.status !== "aberta") return { ok: false, motivo: "Jornada já encerrada." };
  if (destino === j.etapa) return { ok: false, motivo: "O caso já está nesta etapa." };

  if (destino === "alta_efetivada") {
    const bloqueantes = barreirasBloqueantes(j.barreiras);
    if (bloqueantes.length) {
      const lista = bloqueantes
        .map((b) => CATEGORIA_BARREIRA_LABEL[b.categoria as CategoriaBarreira] ?? b.categoria)
        .join(", ");
      return {
        ok: false,
        motivo: `Existem ${bloqueantes.length} barreira(s) bloqueante(s) em aberto (${lista}). Resolva ou marque como não bloqueante antes de registrar a alta.`,
      };
    }
    const pront = prontidaoAlta(j.criterios);
    if (pront.aplicaveis > 0 && pront.percentual < 1) {
      const faltam = pront.aplicaveis - pront.atendidos;
      return {
        ok: false,
        motivo: `Faltam ${faltam} critério(s) de alta. Marque como "não se aplica" o que não couber neste caso.`,
      };
    }
  }

  if (destino === "alta_pactuada" && !j.dataAltaPrevista) {
    return { ok: false, motivo: "Defina a data de alta prevista antes de pactuar a alta." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Menções a disciplinas na timeline (@fisioterapia, @servico_social ...)
// ---------------------------------------------------------------------------

// Aceita tanto a chave (@servico_social) quanto a forma sem underscore
// (@serviço social não é suportada de propósito: menção precisa ser inequívoca).
export function extrairMencoes(texto: string): Disciplina[] {
  const encontradas = new Set<Disciplina>();
  const regex = /@([a-zA-Z_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto)) !== null) {
    const alvo = m[1].toLowerCase();
    const disciplina = DISCIPLINAS.find((d) => d === alvo || d.replace(/_/g, "") === alvo);
    if (disciplina) encontradas.add(disciplina);
  }
  return Array.from(encontradas);
}

// Resumo textual do caso para o round, a passagem de plantão ou a família.
export function resumoJornada(j: JornadaLite, agora: Date = new Date()): string {
  const partes: string[] = [];
  partes.push(`Etapa: ${ETAPA_LABEL[j.etapa as EtapaJornada] ?? j.etapa}`);
  partes.push(`${diasInternacao(j.dataAdmissao ?? j.criadaEm, agora)} dia(s) de internação`);

  const dap = comoData(j.dataAltaPrevista);
  partes.push(
    dap
      ? `DAP ${dap.toLocaleDateString("pt-BR")} (${SITUACAO_DAP_LABEL[situacaoDAP(dap, agora)].toLowerCase()})`
      : "sem data de alta prevista",
  );

  const pront = prontidaoAlta(j.criterios);
  if (pront.aplicaveis) {
    partes.push(`critérios ${pront.atendidos}/${pront.aplicaveis}`);
  }

  const abertas = barreirasAbertas(j.barreiras);
  partes.push(
    abertas.length
      ? `${abertas.length} barreira(s): ${abertas
          .map((b) => CATEGORIA_BARREIRA_LABEL[b.categoria as CategoriaBarreira] ?? b.categoria)
          .join(", ")}`
      : "sem barreiras em aberto",
  );

  return partes.join(" · ");
}
