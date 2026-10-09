import "server-only";
import { prisma } from "./db";
import {
  alertasJornada,
  barreirasAbertas,
  barreirasPorNatureza,
  barreirasVencidas,
  diasInternacao,
  prontidaoAlta,
  scorePrioridade,
  situacaoDAP,
  type Alerta,
  type Prontidao,
  type SituacaoDAP,
} from "./jornada";
import type { EtapaJornada } from "./constants";

// Conjunto de relações necessário para calcular o estado de uma jornada.
const INCLUDE_JORNADA = {
  paciente: true,
  setor: true,
  gestorCaso: { select: { id: true, nome: true, disciplina: true } },
  barreiras: { orderBy: { abertaEm: "asc" } },
  criterios: { orderBy: { ordem: "asc" } },
  tarefas: { orderBy: { criadaEm: "asc" } },
  equipe: { include: { usuario: { select: { id: true, nome: true, disciplina: true } } } },
} as const;

export type JornadaCard = {
  id: string;
  pacienteId: string;
  identificador: string;
  leito: string | null;
  idade: number | null;
  diagnostico: string | null;
  setorId: string;
  setorNome: string;
  etapa: EtapaJornada;
  status: string;
  gestorNome: string | null;
  gestorCasoId: string | null;
  diasInternacao: number;
  dataAltaPrevista: Date | null;
  situacaoDAP: SituacaoDAP;
  confiancaAlta: string;
  destinoAlta: string | null;
  prontidao: Prontidao;
  barreirasAbertas: number;
  barreirasNaoClinicas: number;
  barreirasVencidas: number;
  disciplinasBarreiras: string[];
  tarefasAbertas: number;
  alertas: Alerta[];
  score: number;
  ultimaInteracaoEm: Date;
  equipe: { id: string; nome: string; disciplina: string }[];
};

type FiltrosFunil = {
  setorId?: string;
  disciplina?: string;
  busca?: string;
  // Só casos em que a disciplina informada tem barreira ou tarefa aberta.
  somenteMinhaDisciplina?: boolean;
  incluirEncerradas?: boolean;
};

function montarCard(j: any, agora: Date): JornadaCard {
  const lite = {
    etapa: j.etapa,
    status: j.status,
    dataAltaPrevista: j.dataAltaPrevista,
    dataAltaPrevistaInicial: j.dataAltaPrevistaInicial,
    gestorCasoId: j.gestorCasoId,
    ultimaInteracaoEm: j.ultimaInteracaoEm,
    criadaEm: j.criadaEm,
    altaEfetivadaEm: j.altaEfetivadaEm,
    barreiras: j.barreiras,
    criterios: j.criterios,
    tarefas: j.tarefas,
    dataAdmissao: j.paciente?.dataAdmissao,
  };
  const abertas = barreirasAbertas(j.barreiras);
  const { naoClinicas } = barreirasPorNatureza(j.barreiras);

  return {
    id: j.id,
    pacienteId: j.pacienteId,
    identificador: j.paciente.identificador,
    leito: j.paciente.leito,
    idade: j.paciente.idade,
    diagnostico: j.paciente.diagnosticoPrincipal,
    setorId: j.setorId,
    setorNome: j.setor.nome,
    etapa: j.etapa as EtapaJornada,
    status: j.status,
    gestorNome: j.gestorCaso?.nome ?? null,
    gestorCasoId: j.gestorCasoId ?? null,
    diasInternacao: diasInternacao(j.paciente.dataAdmissao, agora),
    dataAltaPrevista: j.dataAltaPrevista,
    situacaoDAP: situacaoDAP(j.dataAltaPrevista, agora),
    confiancaAlta: j.confiancaAlta,
    destinoAlta: j.destinoAlta,
    prontidao: prontidaoAlta(j.criterios),
    barreirasAbertas: abertas.length,
    barreirasNaoClinicas: naoClinicas.length,
    barreirasVencidas: barreirasVencidas(j.barreiras, agora).length,
    disciplinasBarreiras: Array.from(new Set(abertas.map((b: any) => b.disciplina))),
    tarefasAbertas: j.tarefas.filter((t: any) => t.status === "aberta").length,
    alertas: alertasJornada(lite, agora),
    score: scorePrioridade(lite, agora),
    ultimaInteracaoEm: j.ultimaInteracaoEm,
    equipe: (j.equipe ?? []).map((m: any) => ({
      id: m.usuario.id,
      nome: m.usuario.nome,
      disciplina: m.disciplina,
    })),
  };
}

// Todas as jornadas visíveis ao usuário, já com o estado derivado e ordenadas
// por prioridade (quem precisa de decisão primeiro aparece no topo da coluna).
export async function getJornadasDoFunil(
  setoresIds: string[],
  filtros: FiltrosFunil = {},
): Promise<JornadaCard[]> {
  const where: any = {
    setorId: filtros.setorId ? filtros.setorId : { in: setoresIds },
    status: filtros.incluirEncerradas ? undefined : "aberta",
  };
  if (where.status === undefined) delete where.status;

  const jornadas = await prisma.jornada.findMany({
    where,
    include: INCLUDE_JORNADA,
    orderBy: { criadaEm: "asc" },
  });

  const agora = new Date();
  let cards = jornadas.map((j) => montarCard(j, agora));

  const busca = (filtros.busca ?? "").trim().toLowerCase();
  if (busca) {
    cards = cards.filter(
      (c) =>
        c.identificador.toLowerCase().includes(busca) ||
        (c.leito ?? "").toLowerCase().includes(busca) ||
        (c.diagnostico ?? "").toLowerCase().includes(busca),
    );
  }

  if (filtros.somenteMinhaDisciplina && filtros.disciplina) {
    const d = filtros.disciplina;
    const ids = new Set(
      jornadas
        .filter(
          (j) =>
            j.barreiras.some((b) => b.disciplina === d && (b.status === "aberta" || b.status === "em_andamento")) ||
            j.tarefas.some((t) => t.disciplina === d && t.status === "aberta"),
        )
        .map((j) => j.id),
    );
    cards = cards.filter((c) => ids.has(c.id));
  }

  cards.sort((a, b) => b.score - a.score);
  return cards;
}

export type FunilAgrupado = { etapa: EtapaJornada; cards: JornadaCard[] }[];

export function agruparPorEtapa(cards: JornadaCard[], etapas: readonly EtapaJornada[]): FunilAgrupado {
  return etapas.map((etapa) => ({ etapa, cards: cards.filter((c) => c.etapa === etapa) }));
}

// Jornada completa para a ficha 360 do caso.
export async function getJornada(id: string) {
  return prisma.jornada.findUnique({
    where: { id },
    include: {
      ...INCLUDE_JORNADA,
      barreiras: {
        orderBy: [{ status: "asc" }, { abertaEm: "asc" }],
        include: { responsavel: { select: { id: true, nome: true } } },
      },
      tarefas: {
        orderBy: [{ status: "asc" }, { criadaEm: "asc" }],
        include: { responsavel: { select: { id: true, nome: true } } },
      },
      interacoes: { orderBy: { criadoEm: "desc" }, take: 100 },
      movimentacoes: { orderBy: { criadoEm: "asc" } },
    },
  });
}

export type JornadaCompleta = NonNullable<Awaited<ReturnType<typeof getJornada>>>;

// Estado derivado da ficha (mesma lógica do card, reaproveitada na tela do caso).
export function estadoDaJornada(j: JornadaCompleta, agora: Date = new Date()) {
  return montarCard(j, agora);
}

export async function getJornadaAbertaDoPaciente(pacienteId: string) {
  return prisma.jornada.findFirst({
    where: { pacienteId, status: "aberta" },
    orderBy: { criadaEm: "desc" },
  });
}

// Pacientes ativos do setor que ainda não entraram no funil.
export async function getPacientesSemJornada(setoresIds: string[]) {
  const pacientes = await prisma.paciente.findMany({
    where: { setorId: { in: setoresIds }, status: "ativo" },
    include: { setor: true, jornadas: { where: { status: "aberta" }, select: { id: true } } },
    orderBy: { dataAdmissao: "asc" },
  });
  return pacientes.filter((p) => p.jornadas.length === 0);
}

// Caixa de entrada do profissional: o que está no colo dele agora.
export async function getMinhaCaixa(usuarioId: string, disciplina: string | null, setoresIds: string[]) {
  const escopo = { jornada: { setorId: { in: setoresIds }, status: "aberta" } };

  const [tarefas, barreiras] = await Promise.all([
    prisma.tarefaJornada.findMany({
      where: {
        ...escopo,
        status: "aberta",
        OR: [{ responsavelId: usuarioId }, ...(disciplina ? [{ disciplina, responsavelId: null }] : [])],
      },
      include: { jornada: { include: { paciente: true } } },
      orderBy: [{ prazo: "asc" }, { criadaEm: "asc" }],
      take: 50,
    }),
    prisma.barreira.findMany({
      where: {
        ...escopo,
        status: { in: ["aberta", "em_andamento"] },
        OR: [{ responsavelId: usuarioId }, ...(disciplina ? [{ disciplina, responsavelId: null }] : [])],
      },
      include: { jornada: { include: { paciente: true } } },
      orderBy: [{ prazo: "asc" }, { abertaEm: "asc" }],
      take: 50,
    }),
  ]);

  return { tarefas, barreiras };
}

// Profissionais que podem assumir barreiras/tarefas nos setores do usuário.
export async function getProfissionaisDosSetores(setoresIds: string[]) {
  return prisma.usuario.findMany({
    where: { ativo: true, setores: { some: { setorId: { in: setoresIds } } } },
    select: { id: true, nome: true, disciplina: true, perfil: true },
    orderBy: { nome: "asc" },
  });
}

// Quem ainda não foi revisado no round de hoje (interação do tipo "round").
export async function getRevisadosNoRoundHoje(jornadasIds: string[]) {
  if (!jornadasIds.length) return new Set<string>();
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const interacoes = await prisma.interacaoJornada.findMany({
    where: { jornadaId: { in: jornadasIds }, tipo: "round", criadoEm: { gte: inicioHoje } },
    select: { jornadaId: true },
  });
  return new Set(interacoes.map((i) => i.jornadaId));
}
