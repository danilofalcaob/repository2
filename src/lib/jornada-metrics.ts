import "server-only";
import { prisma } from "./db";
import {
  CATEGORIA_BARREIRA_CLINICA,
  ETAPAS_JORNADA,
  type CategoriaBarreira,
  type EtapaJornada,
} from "./constants";
import {
  barreirasAbertas,
  desvioPrevisaoDias,
  diasEntre,
  diasInternacao,
  jornadaParada,
  previsaoAcertou,
  prontidaoAlta,
  situacaoDAP,
  tempoResolucaoBarreiraHoras,
} from "./jornada";

// Indicadores de deshospitalização. A pergunta que eles respondem é sempre a
// mesma: onde estamos perdendo dias de internação que poderiam ser evitados?
export async function calcularIndicadoresJornada(setoresIds: string[], de?: Date, ate?: Date) {
  const periodo: any = {};
  if (de) periodo.gte = de;
  if (ate) periodo.lte = ate;
  const temPeriodo = Boolean(de || ate);

  const [ativas, concluidas, barreiras, movimentacoes, encerramentos] = await Promise.all([
    prisma.jornada.findMany({
      where: { setorId: { in: setoresIds }, status: "aberta" },
      include: { paciente: true, criterios: true, barreiras: true },
    }),
    prisma.jornada.findMany({
      where: {
        setorId: { in: setoresIds },
        status: "concluida",
        ...(temPeriodo ? { altaEfetivadaEm: periodo } : {}),
      },
      include: { paciente: true, barreiras: true },
    }),
    prisma.barreira.findMany({
      where: {
        jornada: { setorId: { in: setoresIds } },
        ...(temPeriodo ? { abertaEm: periodo } : {}),
      },
    }),
    prisma.movimentacaoEtapa.findMany({
      where: { jornada: { setorId: { in: setoresIds } } },
      orderBy: { criadoEm: "asc" },
    }),
    // Fim de cada jornada encerrada (independente do período) — necessário para
    // não contar tempo de etapa depois que o paciente já saiu.
    prisma.jornada.findMany({
      where: { setorId: { in: setoresIds }, status: { not: "aberta" } },
      select: { id: true, altaEfetivadaEm: true, encerradaEm: true },
    }),
  ]);

  const agora = new Date();

  // --- Casos em andamento -------------------------------------------------
  const casosAtivos = ativas.length;
  const permanenciaMediaAtivos = casosAtivos
    ? ativas.reduce((acc, j) => acc + diasInternacao(j.paciente.dataAdmissao, agora), 0) / casosAtivos
    : 0;

  const semPrevisao = ativas.filter((j) => !j.dataAltaPrevista).length;
  const previsaoVencida = ativas.filter(
    (j) => situacaoDAP(j.dataAltaPrevista, agora) === "vencida",
  ).length;
  const altasPrevistasHoje = ativas.filter(
    (j) => situacaoDAP(j.dataAltaPrevista, agora) === "hoje",
  ).length;
  const altasPrevistasAmanha = ativas.filter(
    (j) => situacaoDAP(j.dataAltaPrevista, agora) === "amanha",
  ).length;
  const altasPrevistas7d = ativas.filter((j) => {
    if (!j.dataAltaPrevista) return false;
    const dias = diasEntre(agora, j.dataAltaPrevista);
    return dias >= 0 && dias <= 7;
  }).length;
  const paradas = ativas.filter((j) => jornadaParada(j.ultimaInteracaoEm, agora)).length;
  const semGestor = ativas.filter((j) => !j.gestorCasoId).length;

  // Casos clinicamente prontos (≥80% dos critérios) que seguem internados por
  // barreira não clínica: a medida mais direta de dia de internação evitável.
  const prontosTravados = ativas.filter((j) => {
    const p = prontidaoAlta(j.criterios);
    if (!p.aplicaveis || p.percentual < 0.8) return false;
    return barreirasAbertas(j.barreiras).some(
      (b) => !(CATEGORIA_BARREIRA_CLINICA[b.categoria as CategoriaBarreira] ?? true),
    );
  }).length;

  const porEtapaMap = new Map<EtapaJornada, number>();
  for (const e of ETAPAS_JORNADA) porEtapaMap.set(e, 0);
  for (const j of ativas) {
    const e = j.etapa as EtapaJornada;
    porEtapaMap.set(e, (porEtapaMap.get(e) ?? 0) + 1);
  }
  const casosPorEtapa = Array.from(porEtapaMap.entries()).map(([etapa, qtd]) => ({ etapa, qtd }));

  // --- Altas concluídas ---------------------------------------------------
  const totalAltas = concluidas.length;
  const permanenciaMediaAltas = totalAltas
    ? concluidas.reduce(
        (acc, j) => acc + Math.max(0, diasEntre(j.paciente.dataAdmissao, j.altaEfetivadaEm!)),
        0,
      ) / totalAltas
    : 0;

  // Alta até as 12h libera o leito no mesmo turno — indicador clássico de fluxo.
  const altasAteMeioDia = concluidas.filter((j) => (j.altaEfetivadaEm?.getHours() ?? 24) < 12).length;
  const taxaAltaAteMeioDia = totalAltas ? altasAteMeioDia / totalAltas : 0;

  const desvios = concluidas
    .map((j) => desvioPrevisaoDias(j.dataAltaPrevistaInicial, j.altaEfetivadaEm))
    .filter((d): d is number => d !== null);
  const acuraciaPrevisao = desvios.length
    ? desvios.filter((d) => previsaoAcertou(d)).length / desvios.length
    : 0;
  const desvioMedioDias = desvios.length
    ? desvios.reduce((a, b) => a + b, 0) / desvios.length
    : 0;

  const altasPorDiaMap = new Map<string, number>();
  for (const j of concluidas) {
    if (!j.altaEfetivadaEm) continue;
    const dia = j.altaEfetivadaEm.toISOString().slice(0, 10);
    altasPorDiaMap.set(dia, (altasPorDiaMap.get(dia) ?? 0) + 1);
  }
  const altasPorDia = Array.from(altasPorDiaMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, qtd]) => ({ dia, qtd }));

  // --- Barreiras ----------------------------------------------------------
  const abertasTotal = barreiras.filter((b) => b.status === "aberta" || b.status === "em_andamento");
  const resolvidas = barreiras.filter((b) => b.status === "resolvida" && b.resolvidaEm);

  const porCategoria = new Map<
    string,
    { categoria: string; abertas: number; resolvidas: number; horasSoma: number; horasN: number }
  >();
  for (const b of barreiras) {
    const item =
      porCategoria.get(b.categoria) ??
      { categoria: b.categoria, abertas: 0, resolvidas: 0, horasSoma: 0, horasN: 0 };
    if (b.status === "aberta" || b.status === "em_andamento") item.abertas += 1;
    if (b.status === "resolvida") {
      item.resolvidas += 1;
      const h = tempoResolucaoBarreiraHoras(b);
      if (h !== null) {
        item.horasSoma += h;
        item.horasN += 1;
      }
    }
    porCategoria.set(b.categoria, item);
  }
  const barreirasPorCategoria = Array.from(porCategoria.values())
    .map((i) => ({
      categoria: i.categoria,
      abertas: i.abertas,
      resolvidas: i.resolvidas,
      tempoMedioH: i.horasN ? i.horasSoma / i.horasN : 0,
      clinica: CATEGORIA_BARREIRA_CLINICA[i.categoria as CategoriaBarreira] ?? true,
    }))
    .sort((a, b) => b.abertas + b.resolvidas - (a.abertas + a.resolvidas));

  const naoClinicasAbertas = abertasTotal.filter(
    (b) => !(CATEGORIA_BARREIRA_CLINICA[b.categoria as CategoriaBarreira] ?? true),
  ).length;
  const temposResolucao = resolvidas
    .map(tempoResolucaoBarreiraHoras)
    .filter((h): h is number => h !== null);
  const tempoMedioResolucaoH = temposResolucao.length
    ? temposResolucao.reduce((a, b) => a + b, 0) / temposResolucao.length
    : 0;

  // Dias de internação potencialmente evitáveis: impacto declarado das
  // barreiras NÃO clínicas (as que dependem de processo, não do paciente).
  const diasEvitaveis = barreiras
    .filter((b) => !(CATEGORIA_BARREIRA_CLINICA[b.categoria as CategoriaBarreira] ?? true))
    .reduce((acc, b) => acc + (b.impactoDias ?? 0), 0);

  // --- Gargalos do funil (tempo médio em cada etapa) ----------------------
  // Para a jornada ainda aberta o relógio corre até agora; para a encerrada,
  // para no momento da alta (ou do encerramento), senão a última etapa
  // acumularia todo o tempo decorrido desde que o paciente já foi embora.
  const fimDaJornada = new Map<string, Date>();
  for (const j of encerramentos) {
    const fim = j.altaEfetivadaEm ?? j.encerradaEm;
    if (fim) fimDaJornada.set(j.id, fim);
  }

  const porJornada = new Map<string, typeof movimentacoes>();
  for (const m of movimentacoes) {
    const lista = porJornada.get(m.jornadaId) ?? [];
    lista.push(m);
    porJornada.set(m.jornadaId, lista);
  }
  const horasPorEtapa = new Map<string, { soma: number; n: number }>();
  for (const [jornadaId, lista] of porJornada) {
    for (let i = 0; i < lista.length; i++) {
      const atual = lista[i];
      // "Alta efetivada" é o fim do funil, não uma etapa com duração.
      if (atual.para === "alta_efetivada") continue;
      const proxima = lista[i + 1];
      const fim = proxima ? proxima.criadoEm : (fimDaJornada.get(jornadaId) ?? agora);
      const horas = (fim.getTime() - atual.criadoEm.getTime()) / 3600000;
      if (horas < 0) continue;
      const acc = horasPorEtapa.get(atual.para) ?? { soma: 0, n: 0 };
      acc.soma += horas;
      acc.n += 1;
      horasPorEtapa.set(atual.para, acc);
    }
  }
  const tempoMedioPorEtapa = ETAPAS_JORNADA.filter((e) => e !== "alta_efetivada").map((etapa) => {
    const acc = horasPorEtapa.get(etapa);
    return { etapa, horas: acc && acc.n ? acc.soma / acc.n : 0 };
  });

  // --- Cobertura do round de hoje ----------------------------------------
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const roundsHoje = await prisma.interacaoJornada.findMany({
    where: {
      tipo: "round",
      criadoEm: { gte: inicioHoje },
      jornada: { setorId: { in: setoresIds }, status: "aberta" },
    },
    select: { jornadaId: true },
  });
  const revisadosHoje = new Set(roundsHoje.map((r) => r.jornadaId)).size;
  const coberturaRound = casosAtivos ? revisadosHoje / casosAtivos : 0;

  return {
    casosAtivos,
    permanenciaMediaAtivos,
    semPrevisao,
    previsaoVencida,
    altasPrevistasHoje,
    altasPrevistasAmanha,
    altasPrevistas7d,
    paradas,
    semGestor,
    prontosTravados,
    casosPorEtapa,
    totalAltas,
    permanenciaMediaAltas,
    taxaAltaAteMeioDia,
    acuraciaPrevisao,
    desvioMedioDias,
    altasPorDia,
    barreiras: {
      total: barreiras.length,
      abertas: abertasTotal.length,
      naoClinicasAbertas,
      resolvidas: resolvidas.length,
      tempoMedioResolucaoH,
      diasEvitaveis,
      porCategoria: barreirasPorCategoria,
    },
    tempoMedioPorEtapa,
    revisadosHoje,
    coberturaRound,
  };
}

export type IndicadoresJornada = Awaited<ReturnType<typeof calcularIndicadoresJornada>>;
