import "server-only";
import type { ResultadoExame } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { UsuarioSessao } from "@/lib/auth";
import { pontosDeAtencao } from "./atencao";
import type { Flag, Resultado } from "./valores";

export function paraResultado(r: ResultadoExame): Resultado {
  return {
    id: r.id,
    analito: r.analito,
    nome: r.nome,
    valor: r.valor,
    valorTexto: r.valorTexto,
    casas: r.casas,
    comparador: r.comparador,
    unidade: r.unidade,
    refMin: r.refMin,
    refMax: r.refMax,
    refTexto: r.refTexto,
    flag: r.flag as Flag,
    observacao: r.observacao,
    coletadoEm: r.coletadoEm.toISOString(),
    documentoId: r.documentoId,
  };
}

// Unidades de terapia intensiva acessíveis ao usuário, com os leitos ativos.
export async function getUtisDoUsuario(u: UsuarioSessao) {
  return prisma.setor.findMany({
    where: { id: { in: u.setoresIds }, tipo: "UTI", ativo: true },
    include: { leitos: { where: { ativo: true }, orderBy: [{ ordem: "asc" }, { numero: "asc" }] } },
    orderBy: { nome: "asc" },
  });
}

export function normalizarLeito(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/^leito\s+/, "").replace(/\s+/g, "");
}

export type ResumoLeito = {
  leitoId: string;
  numero: string;
  paciente: {
    id: string;
    identificador: string;
    idade: number | null;
    sexo: string | null;
    diagnostico: string | null;
    admissao: string;
    alterados: number;
    criticos: number;
    ultimaColeta: string | null;
    destaques: string[]; // rótulos dos alterados mais importantes
  } | null;
};

// Mapa de leitos de uma UTI: ocupação e resumo laboratorial de cada paciente.
export async function getMapaLeitos(setorId: string) {
  const [leitos, pacientes] = await Promise.all([
    prisma.leito.findMany({ where: { setorId, ativo: true }, orderBy: [{ ordem: "asc" }, { numero: "asc" }] }),
    prisma.paciente.findMany({
      where: { setorId, status: "ativo" },
      include: { resultadosExame: { orderBy: { coletadoEm: "asc" } } },
      orderBy: { dataAdmissao: "asc" },
    }),
  ]);

  const resumoPaciente = (p: (typeof pacientes)[number]) => {
    const painel = pontosDeAtencao(p.resultadosExame.map(paraResultado));
    return {
      id: p.id,
      identificador: p.identificador,
      idade: p.idade,
      sexo: p.sexo,
      diagnostico: p.diagnosticoPrincipal,
      admissao: p.dataAdmissao.toISOString(),
      alterados: painel.alterados.length,
      criticos: painel.criticos,
      ultimaColeta: painel.ultimaColeta,
      destaques: painel.alterados.slice(0, 4).map((a) => `${a.rotulo} ${a.valor}`),
    };
  };

  const usados = new Set<string>();
  const mapa: ResumoLeito[] = leitos.map((l) => {
    const p = pacientes.find((x) => !usados.has(x.id) && normalizarLeito(x.leito) === normalizarLeito(l.numero));
    if (p) usados.add(p.id);
    return { leitoId: l.id, numero: l.numero, paciente: p ? resumoPaciente(p) : null };
  });
  const semLeito = pacientes
    .filter((p) => !usados.has(p.id))
    .map((p) => ({ ...resumoPaciente(p), leitoAtual: p.leito }));
  return { mapa, semLeito };
}

// Garante que o paciente existe e pertence a um setor do usuário.
export async function getPacienteAutorizado(u: UsuarioSessao, pacienteId: string) {
  const p = await prisma.paciente.findUnique({ where: { id: pacienteId }, include: { setor: true } });
  if (!p || !u.setoresIds.includes(p.setorId)) return null;
  return p;
}
