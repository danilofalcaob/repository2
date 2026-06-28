import "server-only";
import { prisma } from "./db";

// Calcula indicadores de gestão a partir das passagens concluídas dos setores
// informados, opcionalmente restritas a um período.
export async function calcularIndicadores(setoresIds: string[], de?: Date, ate?: Date) {
  const wherePassagem: any = {
    status: "concluida",
    setorId: { in: setoresIds },
  };
  if (de || ate) {
    wherePassagem.concluidaEm = {};
    if (de) wherePassagem.concluidaEm.gte = de;
    if (ate) wherePassagem.concluidaEm.lte = ate;
  }

  const passagens = await prisma.passagemEvento.findMany({
    where: wherePassagem,
    include: { snapshots: true, reconhecimentos: true, setor: true },
  });

  const totalPassagens = passagens.length;
  const totalSnapshots = passagens.reduce((acc, p) => acc + p.snapshots.length, 0);
  const mediaPacientes = totalPassagens ? totalSnapshots / totalPassagens : 0;

  const duracoes = passagens.map((p) => p.duracaoSeg ?? 0).filter((d) => d > 0);
  const duracaoMediaSeg = duracoes.length
    ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length)
    : 0;

  // Completude I-PASS: fração de campos essenciais preenchidos por snapshot.
  // Campos: gravidade (sempre), resumoPaciente, nivelPreocupacao (sempre),
  // sinteseReceptor, reconhecido.
  let camposPreenchidos = 0;
  let camposTotais = 0;
  let snapshotsReconhecidos = 0;
  for (const p of passagens) {
    for (const s of p.snapshots) {
      const checks = [
        true, // gravidade sempre definida
        s.resumoPaciente.trim().length > 0,
        true, // preocupação sempre definida
        (s.sinteseReceptor ?? "").trim().length > 0,
        s.reconhecido,
      ];
      camposPreenchidos += checks.filter(Boolean).length;
      camposTotais += checks.length;
      if (s.reconhecido) snapshotsReconhecidos += 1;
    }
  }
  const completudeIPass = camposTotais ? camposPreenchidos / camposTotais : 0;
  const taxaReadback = totalSnapshots ? snapshotsReconhecidos / totalSnapshots : 0;

  // Pendências (em todos os pacientes dos setores)
  const pendencias = await prisma.pendencia.findMany({
    where: { paciente: { setorId: { in: setoresIds } } },
  });
  const agora = Date.now();
  const pendCriadas = pendencias.length;
  const pendConcluidas = pendencias.filter((p) => p.status === "concluida").length;
  const pendVencidas = pendencias.filter(
    (p) => p.status === "aberta" && p.prazo && p.prazo.getTime() < agora,
  ).length;
  const pendHerdadas = pendencias.filter((p) => p.herdada).length;
  const taxaHeranca = pendCriadas ? pendHerdadas / pendCriadas : 0;
  const temposResolucao = pendencias
    .filter((p) => p.status === "concluida" && p.concluidaEm)
    .map((p) => (p.concluidaEm!.getTime() - p.criadaEm.getTime()) / 3600000);
  const tempoMedioResolucaoH = temposResolucao.length
    ? temposResolucao.reduce((a, b) => a + b, 0) / temposResolucao.length
    : 0;

  // Contingências
  const contingencias = await prisma.contingencia.findMany({
    where: { paciente: { setorId: { in: setoresIds } } },
  });
  const contPorStatus = {
    criadas: contingencias.length,
    ativas: contingencias.filter((c) => c.status === "ativa").length,
    reconhecidas: contingencias.filter((c) => c.status === "reconhecida").length,
    disparadas: contingencias.filter((c) => c.status === "disparada").length,
    resolvidas: contingencias.filter((c) => c.status === "resolvida").length,
  };

  // TRR e cruzamentos
  const eventosTRR = await prisma.eventoTRR.findMany({
    where: { paciente: { setorId: { in: setoresIds } } },
  });
  const trrTotal = eventosTRR.length;
  const trrComContingencia = eventosTRR.filter((e) => e.tinhaContingencia).length;
  const trrComPreocupacao = eventosTRR.filter((e) => e.tinhaPreocupacao).length;

  // Pacientes sinalizados com preocupação alta (em qualquer snapshot concluído)
  const snapsPreocupacaoAlta = passagens.flatMap((p) =>
    p.snapshots.filter((s) => s.nivelPreocupacao === "alto"),
  );
  const pacientesPreocupacaoAlta = new Set(snapsPreocupacaoAlta.map((s) => s.pacienteId)).size;

  // Série temporal: passagens por dia.
  const porDiaMap = new Map<string, number>();
  for (const p of passagens) {
    if (!p.concluidaEm) continue;
    const dia = p.concluidaEm.toISOString().slice(0, 10);
    porDiaMap.set(dia, (porDiaMap.get(dia) ?? 0) + 1);
  }
  const passagensPorDia = Array.from(porDiaMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, qtd]) => ({ dia, qtd }));

  // Passagens por setor.
  const porSetorMap = new Map<string, number>();
  for (const p of passagens) {
    porSetorMap.set(p.setor.nome, (porSetorMap.get(p.setor.nome) ?? 0) + 1);
  }
  const passagensPorSetor = Array.from(porSetorMap.entries()).map(([setor, qtd]) => ({ setor, qtd }));

  return {
    totalPassagens,
    mediaPacientes,
    duracaoMediaSeg,
    completudeIPass,
    taxaReadback,
    pendencias: {
      criadas: pendCriadas,
      concluidas: pendConcluidas,
      vencidas: pendVencidas,
      herdadas: pendHerdadas,
      taxaHeranca,
      tempoMedioResolucaoH,
    },
    contingencias: contPorStatus,
    trr: { total: trrTotal, comContingencia: trrComContingencia, comPreocupacao: trrComPreocupacao },
    pacientesPreocupacaoAlta,
    passagensPorDia,
    passagensPorSetor,
  };
}

export type Indicadores = Awaited<ReturnType<typeof calcularIndicadores>>;
