import "server-only";
import { prisma } from "./db";
import { GRAVIDADE_ORDEM, PREOCUPACAO_ORDEM, type Gravidade, type Preocupacao } from "./constants";

// Estado "atual" de um paciente derivado do snapshot mais recente (qualquer
// passagem), combinado com pendências/contingências vivas.
export type PacienteQuadro = {
  id: string;
  identificador: string;
  leito: string | null;
  idade: number | null;
  sexo: string | null;
  status: string;
  diagnosticoPrincipal: string | null;
  gravidade: Gravidade;
  nivelPreocupacao: Preocupacao;
  oQueMePreocupa: string | null;
  pendenciasAbertas: number;
  pendenciasVencidas: number;
  contingenciasAtivas: number;
  setorNome: string;
  setorId: string;
};

export async function getPacientesDoQuadro(setoresIds: string[], setorFiltro?: string) {
  const where: any = {
    setorId: setorFiltro ? setorFiltro : { in: setoresIds },
    status: "ativo",
  };

  const pacientes = await prisma.paciente.findMany({
    where,
    include: {
      setor: true,
      snapshots: { orderBy: { criadoEm: "desc" }, take: 1 },
      pendencias: true,
      contingencias: true,
    },
    orderBy: { criadoEm: "asc" },
  });

  const agora = Date.now();
  const lista: PacienteQuadro[] = pacientes.map((p) => {
    const snap = p.snapshots[0];
    const abertas = p.pendencias.filter((x) => x.status === "aberta");
    const vencidas = abertas.filter((x) => x.prazo && x.prazo.getTime() < agora);
    const contAtivas = p.contingencias.filter(
      (c) => c.status === "ativa" || c.status === "disparada",
    );
    return {
      id: p.id,
      identificador: p.identificador,
      leito: p.leito,
      idade: p.idade,
      sexo: p.sexo,
      status: p.status,
      diagnosticoPrincipal: p.diagnosticoPrincipal,
      gravidade: (snap?.gravidade as Gravidade) ?? "estavel",
      nivelPreocupacao: (snap?.nivelPreocupacao as Preocupacao) ?? "baixo",
      oQueMePreocupa: snap?.oQueMePreocupa ?? null,
      pendenciasAbertas: abertas.length,
      pendenciasVencidas: vencidas.length,
      contingenciasAtivas: contAtivas.length,
      setorNome: p.setor.nome,
      setorId: p.setorId,
    };
  });

  // Ordenação por prioridade clínica: gravidade desc, preocupação desc,
  // contingências ativas desc, pendências vencidas desc.
  lista.sort((a, b) => {
    return (
      GRAVIDADE_ORDEM[b.gravidade] - GRAVIDADE_ORDEM[a.gravidade] ||
      PREOCUPACAO_ORDEM[b.nivelPreocupacao] - PREOCUPACAO_ORDEM[a.nivelPreocupacao] ||
      b.contingenciasAtivas - a.contingenciasAtivas ||
      b.pendenciasVencidas - a.pendenciasVencidas
    );
  });

  return lista;
}

// Setores que o usuário pode acessar.
export async function getSetoresDoUsuario(setoresIds: string[]) {
  return prisma.setor.findMany({
    where: { id: { in: setoresIds }, ativo: true },
    orderBy: { nome: "asc" },
  });
}

// Snapshot mais recente CONCLUÍDO de um paciente (para "o que mudou" e contexto TRR).
export async function getUltimoSnapshotConcluido(pacienteId: string, antesDe?: Date) {
  return prisma.snapshotPaciente.findFirst({
    where: {
      pacienteId,
      passagem: { status: "concluida", ...(antesDe ? { concluidaEm: { lt: antesDe } } : {}) },
    },
    orderBy: { criadoEm: "desc" },
    include: { passagem: true },
  });
}
