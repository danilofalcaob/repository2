"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigirUsuario, podeVerGestao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { getPacienteAutorizado, normalizarLeito } from "@/lib/exames/queries";
import { getAnalito } from "@/lib/exames/catalogo";
import { identificarAnalito } from "@/lib/exames/parser";
import { completarResultado, parseNumeroBR } from "@/lib/exames/valores";

type Retorno = { ok: true; id?: string; mensagem?: string } | { ok: false; erro: string };

const falha = (erro: string): Retorno => ({ ok: false, erro });

function texto(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

// ---------------------------------------------------------------------------
// Configuração de leitos
// ---------------------------------------------------------------------------

const LeitosSchema = z.object({
  setorId: z.string().nullable(),
  nomeUnidade: z.string().trim().min(2, "Informe o nome da UTI.").max(80),
  leitos: z.array(z.string().trim().min(1).max(20)).min(1, "Configure ao menos um leito.").max(300),
});

export async function salvarLeitos(entrada: z.infer<typeof LeitosSchema>): Promise<Retorno> {
  const u = await exigirUsuario();
  const dados = LeitosSchema.safeParse(entrada);
  if (!dados.success) return falha(dados.error.issues[0]?.message ?? "Dados inválidos.");
  const { nomeUnidade, leitos } = dados.data;
  if (u.perfil === "profissional") return falha("Apenas médicos e gestores configuram os leitos.");

  const normalizados = leitos.map(normalizarLeito);
  const repetido = normalizados.find((n, i) => normalizados.indexOf(n) !== i);
  if (repetido) return falha(`Leito repetido na lista: ${leitos[normalizados.indexOf(repetido)]}.`);

  let setorId = dados.data.setorId;
  if (setorId) {
    if (!u.setoresIds.includes(setorId)) return falha("Sem acesso a esta unidade.");
    await prisma.setor.update({ where: { id: setorId }, data: { nome: nomeUnidade } });
  } else {
    if (!podeVerGestao(u.perfil)) return falha("Apenas coordenação/administração cria uma nova UTI.");
    const setor = await prisma.setor.create({
      data: { nome: nomeUnidade, tipo: "UTI", usuarios: { create: { usuarioId: u.id } } },
    });
    setorId = setor.id;
  }

  const existentes = await prisma.leito.findMany({ where: { setorId } });
  const ocupantes = await prisma.paciente.findMany({ where: { setorId, status: "ativo" }, select: { leito: true } });
  const ocupados = new Set(ocupantes.map((p) => normalizarLeito(p.leito)));

  const removidos = existentes.filter((l) => l.ativo && !normalizados.includes(normalizarLeito(l.numero)));
  const removidosOcupados = removidos.filter((l) => ocupados.has(normalizarLeito(l.numero)));
  if (removidosOcupados.length) {
    return falha(
      `Não é possível remover leito ocupado: ${removidosOcupados.map((l) => l.numero).join(", ")}. Libere o leito antes.`,
    );
  }

  await prisma.$transaction([
    ...removidos.map((l) => prisma.leito.update({ where: { id: l.id }, data: { ativo: false } })),
    ...leitos.map((numero, ordem) => {
      const atual = existentes.find((l) => normalizarLeito(l.numero) === normalizarLeito(numero));
      return atual
        ? prisma.leito.update({ where: { id: atual.id }, data: { numero, ordem, ativo: true } })
        : prisma.leito.create({ data: { setorId: setorId!, numero, ordem } });
    }),
  ]);

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "uti.configurar_leitos",
    entidade: "Setor",
    entidadeId: setorId,
    valorNovo: { nomeUnidade, leitos },
  });
  revalidatePath("/uti");
  return { ok: true, id: setorId };
}

// ---------------------------------------------------------------------------
// Ocupação dos leitos
// ---------------------------------------------------------------------------

async function leitoLivre(setorId: string, leito: string, excetoPacienteId?: string) {
  const ativos = await prisma.paciente.findMany({ where: { setorId, status: "ativo" }, select: { id: true, leito: true } });
  return !ativos.some((p) => p.id !== excetoPacienteId && normalizarLeito(p.leito) === normalizarLeito(leito));
}

export async function admitirPaciente(fd: FormData): Promise<Retorno> {
  const u = await exigirUsuario();
  const setorId = texto(fd, "setorId");
  const leito = texto(fd, "leito");
  const identificador = texto(fd, "identificador");
  if (!setorId || !leito || !identificador) return falha("Leito e identificador são obrigatórios.");
  if (!u.setoresIds.includes(setorId)) return falha("Sem acesso a esta unidade.");
  if (!(await leitoLivre(setorId, leito))) return falha(`O leito ${leito} já está ocupado.`);

  const idade = texto(fd, "idade");
  const admissao = texto(fd, "dataAdmissao");
  const p = await prisma.paciente.create({
    data: {
      setorId,
      leito,
      identificador,
      idade: idade ? parseInt(idade, 10) : null,
      sexo: texto(fd, "sexo"),
      diagnosticoPrincipal: texto(fd, "diagnostico"),
      alergias: texto(fd, "alergias"),
      dataAdmissao: admissao ? new Date(`${admissao}T12:00:00-03:00`) : new Date(),
    },
  });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "uti.admitir",
    entidade: "Paciente",
    entidadeId: p.id,
    valorNovo: { identificador, leito },
  });
  revalidatePath("/uti");
  revalidatePath("/pacientes");
  revalidatePath("/quadro");
  return { ok: true, id: p.id };
}

export async function vincularLeito(pacienteId: string, leito: string): Promise<Retorno> {
  const u = await exigirUsuario();
  const p = await getPacienteAutorizado(u, pacienteId);
  if (!p) return falha("Paciente não encontrado.");
  if (!(await leitoLivre(p.setorId, leito, p.id))) return falha(`O leito ${leito} já está ocupado.`);
  await prisma.paciente.update({ where: { id: p.id }, data: { leito } });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "uti.vincular_leito",
    entidade: "Paciente",
    entidadeId: p.id,
    valorAnterior: p.leito,
    valorNovo: leito,
  });
  revalidatePath("/uti");
  return { ok: true };
}

export async function liberarLeito(pacienteId: string, desfecho: string): Promise<Retorno> {
  const u = await exigirUsuario();
  if (!["alta", "obito", "transferido"].includes(desfecho)) return falha("Desfecho inválido.");
  const p = await getPacienteAutorizado(u, pacienteId);
  if (!p) return falha("Paciente não encontrado.");
  await prisma.paciente.update({ where: { id: p.id }, data: { status: desfecho } });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "uti.liberar_leito",
    entidade: "Paciente",
    entidadeId: p.id,
    valorAnterior: p.status,
    valorNovo: desfecho,
    detalhe: `Leito ${p.leito ?? "—"}`,
  });
  revalidatePath("/uti");
  revalidatePath(`/uti/paciente/${p.id}`);
  revalidatePath("/quadro");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Resultados de exames
// ---------------------------------------------------------------------------

const ItemSchema = z.object({
  analito: z.string().min(1),
  nome: z.string().trim().max(120),
  valorTexto: z.string().trim().min(1, "Há linha sem valor.").max(60),
  unidade: z.string().trim().max(40).nullable(),
  refMin: z.number().finite().nullable(),
  refMax: z.number().finite().nullable(),
  observacao: z.string().trim().max(200).nullable(),
  coletadoEm: z.string().datetime({ offset: true }),
  alterado: z.boolean().optional(), // para resultados qualitativos
});

export type ItemRevisao = z.infer<typeof ItemSchema>;

async function gravarItens(
  pacienteId: string,
  sexo: string | null,
  documentoId: string,
  itens: ItemRevisao[],
  usuarioNome: string,
) {
  let salvos = 0;
  let substituidos = 0;
  let ignorados = 0;
  for (const item of itens) {
    const analito = getAnalito(item.analito) ? item.analito : (identificarAnalito(item.nome) ?? "outro");
    const semComparador = item.valorTexto.replace(/^\s*(<=|>=|≤|≥|<|>)\s*/, "");
    const comparador = item.valorTexto.match(/^\s*(<=|>=|≤|≥|<|>)/)?.[1] ?? null;
    const num = parseNumeroBR(semComparador);
    const resultado = completarResultado(
      {
        analito,
        nome: item.nome || getAnalito(analito)?.rotulo || "Exame",
        valor: num?.valor ?? null,
        valorTexto: item.valorTexto,
        casas: num?.casas ?? 0,
        comparador,
        unidade: item.unidade,
        refMin: item.refMin,
        refMax: item.refMax,
        observacao: item.observacao,
        coletadoEm: item.coletadoEm,
        qualitativoAlterado: num == null && item.alterado === true,
      },
      sexo,
    );
    const coletadoEm = new Date(item.coletadoEm);
    const existente =
      analito !== "outro"
        ? await prisma.resultadoExame.findFirst({ where: { pacienteId, analito, coletadoEm } })
        : await prisma.resultadoExame.findFirst({ where: { pacienteId, analito, nome: resultado.nome, coletadoEm } });
    if (existente && existente.valorTexto === resultado.valorTexto) {
      ignorados++;
      continue;
    }
    if (existente) {
      await prisma.resultadoExame.delete({ where: { id: existente.id } });
      substituidos++;
    }
    await prisma.resultadoExame.create({
      data: {
        pacienteId,
        documentoId,
        analito,
        nome: resultado.nome,
        valor: resultado.valor,
        valorTexto: resultado.valorTexto,
        casas: resultado.casas,
        comparador: resultado.comparador,
        unidade: resultado.unidade,
        refMin: resultado.refMin,
        refMax: resultado.refMax,
        flag: resultado.flag,
        observacao: resultado.observacao,
        coletadoEm,
        criadoPor: usuarioNome,
      },
    });
    salvos++;
  }
  return { salvos, substituidos, ignorados };
}

function resumoGravacao(r: { salvos: number; substituidos: number; ignorados: number }) {
  const partes = [`${r.salvos} resultado(s) salvo(s)`];
  if (r.substituidos) partes.push(`${r.substituidos} corrigido(s)`);
  if (r.ignorados) partes.push(`${r.ignorados} já existente(s) ignorado(s)`);
  return partes.join(", ") + ".";
}

// Confirma a revisão de um laudo importado: grava os resultados conferidos.
export async function confirmarDocumento(documentoId: string, itens: ItemRevisao[]): Promise<Retorno> {
  const u = await exigirUsuario();
  const lista = z.array(ItemSchema).max(1000).safeParse(itens);
  if (!lista.success) return falha(lista.error.issues[0]?.message ?? "Dados inválidos.");
  const doc = await prisma.documentoExame.findUnique({ where: { id: documentoId } });
  if (!doc) return falha("Laudo não encontrado.");
  const p = await getPacienteAutorizado(u, doc.pacienteId);
  if (!p) return falha("Sem acesso a este paciente.");
  if (doc.status === "confirmado") return falha("Este laudo já foi confirmado.");

  const r = await gravarItens(p.id, p.sexo, doc.id, lista.data, u.nome);
  await prisma.documentoExame.update({
    where: { id: doc.id },
    data: {
      status: "confirmado",
      confirmadoEm: new Date(),
      rascunhoJson: null,
      dataColeta: lista.data[0] ? new Date(lista.data[0].coletadoEm) : doc.dataColeta,
    },
  });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "exame.confirmar",
    entidade: "DocumentoExame",
    entidadeId: doc.id,
    valorNovo: r,
  });
  revalidatePath(`/uti/paciente/${p.id}`);
  revalidatePath("/uti");
  return { ok: true, mensagem: resumoGravacao(r) };
}

// Lançamento manual (sem arquivo): cria um "documento" de origem manual.
export async function lancarManual(pacienteId: string, itens: ItemRevisao[]): Promise<Retorno> {
  const u = await exigirUsuario();
  const lista = z.array(ItemSchema).min(1, "Adicione ao menos um resultado.").max(500).safeParse(itens);
  if (!lista.success) return falha(lista.error.issues[0]?.message ?? "Dados inválidos.");
  const p = await getPacienteAutorizado(u, pacienteId);
  if (!p) return falha("Paciente não encontrado.");
  const doc = await prisma.documentoExame.create({
    data: {
      pacienteId: p.id,
      nomeArquivo: "Lançamento manual",
      tipoMime: "text/plain",
      origem: "texto",
      metodo: "manual",
      status: "confirmado",
      confirmadoEm: new Date(),
      dataColeta: new Date(lista.data[0].coletadoEm),
      enviadoPorId: u.id,
      enviadoPorNome: u.nome,
    },
  });
  const r = await gravarItens(p.id, p.sexo, doc.id, lista.data, u.nome);
  await registrarAuditoria({ usuarioId: u.id, acao: "exame.lancar_manual", entidade: "DocumentoExame", entidadeId: doc.id, valorNovo: r });
  revalidatePath(`/uti/paciente/${p.id}`);
  revalidatePath("/uti");
  return { ok: true, mensagem: resumoGravacao(r) };
}

// Exclui um laudo e todos os resultados extraídos dele.
export async function excluirDocumento(documentoId: string): Promise<Retorno> {
  const u = await exigirUsuario();
  const doc = await prisma.documentoExame.findUnique({ where: { id: documentoId }, include: { _count: { select: { resultados: true } } } });
  if (!doc) return falha("Laudo não encontrado.");
  const p = await getPacienteAutorizado(u, doc.pacienteId);
  if (!p) return falha("Sem acesso a este paciente.");
  await prisma.documentoExame.delete({ where: { id: doc.id } });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "exame.excluir_laudo",
    entidade: "DocumentoExame",
    entidadeId: doc.id,
    valorAnterior: { nomeArquivo: doc.nomeArquivo, resultados: doc._count.resultados },
  });
  revalidatePath(`/uti/paciente/${p.id}`);
  revalidatePath("/uti");
  return { ok: true };
}

export async function excluirResultado(resultadoId: string): Promise<Retorno> {
  const u = await exigirUsuario();
  const r = await prisma.resultadoExame.findUnique({ where: { id: resultadoId } });
  if (!r) return falha("Resultado não encontrado.");
  const p = await getPacienteAutorizado(u, r.pacienteId);
  if (!p) return falha("Sem acesso a este paciente.");
  await prisma.resultadoExame.delete({ where: { id: r.id } });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "exame.excluir_resultado",
    entidade: "ResultadoExame",
    entidadeId: r.id,
    valorAnterior: { analito: r.analito, valor: r.valorTexto, coletadoEm: r.coletadoEm },
  });
  revalidatePath(`/uti/paciente/${p.id}`);
  revalidatePath("/uti");
  return { ok: true };
}
