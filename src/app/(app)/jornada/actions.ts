"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { exigirUsuario, type UsuarioSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import {
  CRITERIOS_ALTA_PADRAO,
  CATEGORIA_BARREIRA_DISCIPLINA,
  CATEGORIA_BARREIRA_LABEL,
  DISCIPLINA_LABEL,
  ETAPA_LABEL,
  type CategoriaBarreira,
  type Disciplina,
  type EtapaJornada,
} from "@/lib/constants";
import { extrairMencoes, validarMudancaEtapa } from "@/lib/jornada";

function val(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function data(fd: FormData, k: string): Date | null {
  const v = val(fd, k);
  return v ? new Date(v) : null;
}

function revalidarJornada(jornadaId: string, pacienteId?: string) {
  revalidatePath("/jornada");
  revalidatePath("/jornada/round");
  revalidatePath("/jornada/painel");
  revalidatePath(`/jornada/${jornadaId}`);
  if (pacienteId) revalidatePath(`/pacientes/${pacienteId}`);
}

// Carrega a jornada garantindo que o usuário tem acesso ao setor dela.
async function carregarComAcesso(jornadaId: string, u: UsuarioSessao) {
  const j = await prisma.jornada.findUnique({
    where: { id: jornadaId },
    include: { barreiras: true, criterios: true, paciente: true },
  });
  if (!j) throw new Error("Jornada não encontrada.");
  if (!u.setoresIds.includes(j.setorId)) throw new Error("Sem acesso a este setor.");
  return j;
}

// Toda escrita relevante alimenta a timeline e "acorda" a jornada — é assim que
// o funil sabe distinguir caso em movimento de caso esquecido.
async function registrarNaTimeline(params: {
  jornadaId: string;
  usuario: UsuarioSessao;
  tipo: string;
  texto: string;
  mencoes?: string[];
}) {
  await prisma.interacaoJornada.create({
    data: {
      jornadaId: params.jornadaId,
      autorId: params.usuario.id,
      autorNome: params.usuario.nome,
      disciplina: params.usuario.disciplina ?? null,
      tipo: params.tipo,
      texto: params.texto,
      mencoesJson: params.mencoes?.length ? JSON.stringify(params.mencoes) : null,
    },
  });
  await prisma.jornada.update({
    where: { id: params.jornadaId },
    data: { ultimaInteracaoEm: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Abertura da jornada
// ---------------------------------------------------------------------------

export async function abrirJornada(fd: FormData) {
  const u = await exigirUsuario();
  const pacienteId = val(fd, "pacienteId");
  if (!pacienteId) throw new Error("Selecione o paciente.");

  const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId } });
  if (!paciente) throw new Error("Paciente não encontrado.");
  if (!u.setoresIds.includes(paciente.setorId)) throw new Error("Sem acesso a este setor.");

  const existente = await prisma.jornada.findFirst({
    where: { pacienteId, status: "aberta" },
  });
  if (existente) redirect(`/jornada/${existente.id}`);

  const dap = data(fd, "dataAltaPrevista");
  const jornada = await prisma.jornada.create({
    data: {
      pacienteId,
      setorId: paciente.setorId,
      etapa: val(fd, "etapa") ?? "admissao",
      gestorCasoId: val(fd, "gestorCasoId") ?? u.id,
      motivoInternacao: val(fd, "motivoInternacao") ?? paciente.diagnosticoPrincipal,
      planoTerapeutico: val(fd, "planoTerapeutico"),
      dataAltaPrevista: dap,
      dataAltaPrevistaInicial: dap,
      confiancaAlta: val(fd, "confiancaAlta") ?? "media",
      destinoAlta: val(fd, "destinoAlta"),
      complexidade: val(fd, "complexidade") ?? "media",
      riscoReinternacao: val(fd, "riscoReinternacao") ?? "baixo",
      criterios: {
        create: CRITERIOS_ALTA_PADRAO.map((c, i) => ({
          categoria: c.categoria,
          descricao: c.descricao,
          ordem: i,
        })),
      },
      movimentacoes: {
        create: {
          para: val(fd, "etapa") ?? "admissao",
          motivo: "Abertura da jornada de alta",
          usuarioId: u.id,
          usuarioNome: u.nome,
        },
      },
    },
  });

  // O próprio autor entra na equipe do caso.
  if (u.disciplina) {
    await prisma.membroEquipe.create({
      data: { jornadaId: jornada.id, usuarioId: u.id, disciplina: u.disciplina },
    });
  }

  await registrarNaTimeline({
    jornadaId: jornada.id,
    usuario: u,
    tipo: "etapa",
    texto: `Jornada de alta aberta${dap ? ` com alta prevista para ${dap.toLocaleDateString("pt-BR")}` : " (ainda sem data de alta prevista)"}.`,
  });

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "jornada.abrir",
    entidade: "Jornada",
    entidadeId: jornada.id,
    valorNovo: { pacienteId, etapa: jornada.etapa },
  });

  revalidarJornada(jornada.id, pacienteId);
  redirect(`/jornada/${jornada.id}`);
}

// ---------------------------------------------------------------------------
// Funil
// ---------------------------------------------------------------------------

export type ResultadoAcao = { ok: boolean; erro?: string };

// Retorna o resultado em vez de lançar: a validação do funil é uma resposta
// esperada da regra de negócio (e precisa chegar legível à equipe, inclusive
// em produção, onde o Next mascara mensagens de exceção).
export async function moverEtapa(
  jornadaId: string,
  destino: string,
  motivo?: string,
): Promise<ResultadoAcao> {
  const u = await exigirUsuario();
  const j = await carregarComAcesso(jornadaId, u);

  const validacao = validarMudancaEtapa(
    {
      etapa: j.etapa,
      status: j.status,
      dataAltaPrevista: j.dataAltaPrevista,
      barreiras: j.barreiras,
      criterios: j.criterios,
    },
    destino,
  );
  if (!validacao.ok) return { ok: false, erro: validacao.motivo ?? "Movimentação não permitida." };

  const efetivandoAlta = destino === "alta_efetivada";
  await prisma.jornada.update({
    where: { id: jornadaId },
    data: {
      etapa: destino,
      ...(efetivandoAlta
        ? { status: "concluida", altaEfetivadaEm: new Date() }
        : {}),
      movimentacoes: {
        create: {
          de: j.etapa,
          para: destino,
          motivo: motivo ?? null,
          usuarioId: u.id,
          usuarioNome: u.nome,
        },
      },
    },
  });

  if (efetivandoAlta) {
    await prisma.paciente.update({ where: { id: j.pacienteId }, data: { status: "alta" } });
  }

  await registrarNaTimeline({
    jornadaId,
    usuario: u,
    tipo: efetivandoAlta ? "alta" : "etapa",
    texto: efetivandoAlta
      ? `Alta efetivada.${motivo ? ` ${motivo}` : ""}`
      : `Etapa alterada de "${ETAPA_LABEL[j.etapa as EtapaJornada] ?? j.etapa}" para "${
          ETAPA_LABEL[destino as EtapaJornada] ?? destino
        }".${motivo ? ` Motivo: ${motivo}` : ""}`,
  });

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "jornada.etapa",
    entidade: "Jornada",
    entidadeId: jornadaId,
    valorAnterior: j.etapa,
    valorNovo: destino,
  });

  revalidarJornada(jornadaId, j.pacienteId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Plano de alta (cabeçalho do caso)
// ---------------------------------------------------------------------------

export async function atualizarPlano(fd: FormData) {
  const u = await exigirUsuario();
  const jornadaId = String(fd.get("jornadaId") ?? "");
  const j = await carregarComAcesso(jornadaId, u);

  const novaDAP = data(fd, "dataAltaPrevista");
  const anteriorDAP = j.dataAltaPrevista;
  const motivo = val(fd, "motivoRepactuacao");

  await prisma.jornada.update({
    where: { id: jornadaId },
    data: {
      dataAltaPrevista: novaDAP,
      // A primeira previsão nunca é sobrescrita: é a referência de acurácia.
      dataAltaPrevistaInicial: j.dataAltaPrevistaInicial ?? novaDAP,
      confiancaAlta: val(fd, "confiancaAlta") ?? j.confiancaAlta,
      destinoAlta: val(fd, "destinoAlta"),
      gestorCasoId: val(fd, "gestorCasoId"),
      motivoInternacao: val(fd, "motivoInternacao"),
      planoTerapeutico: val(fd, "planoTerapeutico"),
      complexidade: val(fd, "complexidade") ?? j.complexidade,
      riscoReinternacao: val(fd, "riscoReinternacao") ?? j.riscoReinternacao,
    },
  });

  const mudouDAP = (anteriorDAP?.getTime() ?? 0) !== (novaDAP?.getTime() ?? 0);
  if (mudouDAP) {
    const de = anteriorDAP ? anteriorDAP.toLocaleDateString("pt-BR") : "sem data";
    const para = novaDAP ? novaDAP.toLocaleDateString("pt-BR") : "sem data";
    await registrarNaTimeline({
      jornadaId,
      usuario: u,
      tipo: "decisao",
      texto: `Data de alta prevista repactuada: ${de} → ${para}.${motivo ? ` Motivo: ${motivo}` : ""}`,
    });
  } else {
    await prisma.jornada.update({
      where: { id: jornadaId },
      data: { ultimaInteracaoEm: new Date() },
    });
  }

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "jornada.plano",
    entidade: "Jornada",
    entidadeId: jornadaId,
    valorAnterior: { dataAltaPrevista: anteriorDAP },
    valorNovo: { dataAltaPrevista: novaDAP },
  });

  revalidarJornada(jornadaId, j.pacienteId);
}

// ---------------------------------------------------------------------------
// Barreiras
// ---------------------------------------------------------------------------

export async function criarBarreira(fd: FormData) {
  const u = await exigirUsuario();
  const jornadaId = String(fd.get("jornadaId") ?? "");
  const j = await carregarComAcesso(jornadaId, u);

  const categoria = (val(fd, "categoria") ?? "clinica") as CategoriaBarreira;
  const descricao = val(fd, "descricao");
  if (!descricao) throw new Error("Descreva a barreira.");

  const disciplina =
    (val(fd, "disciplina") as Disciplina | null) ?? CATEGORIA_BARREIRA_DISCIPLINA[categoria];
  const impacto = val(fd, "impactoDias");

  const b = await prisma.barreira.create({
    data: {
      jornadaId,
      categoria,
      descricao,
      disciplina,
      responsavelId: val(fd, "responsavelId"),
      prazo: data(fd, "prazo"),
      prioridade: val(fd, "prioridade") ?? "media",
      bloqueiaAlta: fd.get("bloqueiaAlta") !== null,
      impactoDias: impacto ? parseInt(impacto, 10) : null,
      criadaPorNome: u.nome,
    },
  });

  await registrarNaTimeline({
    jornadaId,
    usuario: u,
    tipo: "barreira",
    texto: `Nova barreira (${CATEGORIA_BARREIRA_LABEL[categoria] ?? categoria}) para ${
      DISCIPLINA_LABEL[disciplina] ?? disciplina
    }: ${descricao}`,
    mencoes: [disciplina],
  });

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "barreira.criar",
    entidade: "Barreira",
    entidadeId: b.id,
    valorNovo: { categoria, descricao, disciplina },
  });

  revalidarJornada(jornadaId, j.pacienteId);
}

export async function mudarStatusBarreira(barreiraId: string, status: string, resolucao?: string) {
  const u = await exigirUsuario();
  const b = await prisma.barreira.findUnique({ where: { id: barreiraId }, include: { jornada: true } });
  if (!b) throw new Error("Barreira não encontrada.");
  if (!u.setoresIds.includes(b.jornada.setorId)) throw new Error("Sem acesso a este setor.");

  const finalizando = status === "resolvida" || status === "cancelada";
  await prisma.barreira.update({
    where: { id: barreiraId },
    data: {
      status,
      resolucao: resolucao ?? b.resolucao,
      resolvidaEm: finalizando ? new Date() : null,
    },
  });

  const rotulo = CATEGORIA_BARREIRA_LABEL[b.categoria as CategoriaBarreira] ?? b.categoria;
  await registrarNaTimeline({
    jornadaId: b.jornadaId,
    usuario: u,
    tipo: "barreira",
    texto:
      status === "resolvida"
        ? `Barreira resolvida (${rotulo}): ${b.descricao}.${resolucao ? ` ${resolucao}` : ""}`
        : status === "cancelada"
          ? `Barreira cancelada (${rotulo}): ${b.descricao}.`
          : `Barreira em andamento (${rotulo}): ${b.descricao}.`,
  });

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "barreira.status",
    entidade: "Barreira",
    entidadeId: barreiraId,
    valorAnterior: b.status,
    valorNovo: status,
  });

  revalidarJornada(b.jornadaId);
}

export async function resolverBarreiraForm(fd: FormData) {
  const barreiraId = String(fd.get("barreiraId") ?? "");
  await mudarStatusBarreira(barreiraId, String(fd.get("status") ?? "resolvida"), val(fd, "resolucao") ?? undefined);
}

// ---------------------------------------------------------------------------
// Tarefas por disciplina
// ---------------------------------------------------------------------------

export async function criarTarefa(fd: FormData) {
  const u = await exigirUsuario();
  const jornadaId = String(fd.get("jornadaId") ?? "");
  const j = await carregarComAcesso(jornadaId, u);

  const titulo = val(fd, "titulo");
  if (!titulo) throw new Error("Descreva a tarefa.");
  const disciplina = (val(fd, "disciplina") ?? "medicina") as Disciplina;

  const t = await prisma.tarefaJornada.create({
    data: {
      jornadaId,
      titulo,
      detalhe: val(fd, "detalhe"),
      disciplina,
      responsavelId: val(fd, "responsavelId"),
      prazo: data(fd, "prazo"),
      prioridade: val(fd, "prioridade") ?? "media",
      barreiraId: val(fd, "barreiraId"),
    },
  });

  await registrarNaTimeline({
    jornadaId,
    usuario: u,
    tipo: "tarefa",
    texto: `Tarefa para ${DISCIPLINA_LABEL[disciplina] ?? disciplina}: ${titulo}`,
    mencoes: [disciplina],
  });

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "tarefa.criar",
    entidade: "TarefaJornada",
    entidadeId: t.id,
    valorNovo: { titulo, disciplina },
  });

  revalidarJornada(jornadaId, j.pacienteId);
}

export async function mudarStatusTarefa(tarefaId: string, status: string) {
  const u = await exigirUsuario();
  const t = await prisma.tarefaJornada.findUnique({
    where: { id: tarefaId },
    include: { jornada: true },
  });
  if (!t) throw new Error("Tarefa não encontrada.");
  if (!u.setoresIds.includes(t.jornada.setorId)) throw new Error("Sem acesso a este setor.");

  await prisma.tarefaJornada.update({
    where: { id: tarefaId },
    data: {
      status,
      concluidaEm: status === "concluida" ? new Date() : null,
      concluidaPor: status === "concluida" ? u.nome : null,
    },
  });

  await registrarNaTimeline({
    jornadaId: t.jornadaId,
    usuario: u,
    tipo: "tarefa",
    texto:
      status === "concluida"
        ? `Tarefa concluída: ${t.titulo}`
        : `Tarefa cancelada: ${t.titulo}`,
  });

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "tarefa.status",
    entidade: "TarefaJornada",
    entidadeId: tarefaId,
    valorAnterior: t.status,
    valorNovo: status,
  });

  revalidarJornada(t.jornadaId);
}

// ---------------------------------------------------------------------------
// Critérios de alta
// ---------------------------------------------------------------------------

export async function alternarCriterio(criterioId: string, campo: "atendido" | "naoAplicavel") {
  const u = await exigirUsuario();
  const c = await prisma.criterioAlta.findUnique({
    where: { id: criterioId },
    include: { jornada: true },
  });
  if (!c) throw new Error("Critério não encontrado.");
  if (!u.setoresIds.includes(c.jornada.setorId)) throw new Error("Sem acesso a este setor.");

  const novoValor = !c[campo];
  await prisma.criterioAlta.update({
    where: { id: criterioId },
    data: {
      [campo]: novoValor,
      // Um critério marcado como "não se aplica" deixa de contar como atendido.
      ...(campo === "naoAplicavel" && novoValor ? { atendido: false } : {}),
      avaliadoPorId: u.id,
      avaliadoEm: new Date(),
    },
  });

  await prisma.jornada.update({
    where: { id: c.jornadaId },
    data: { ultimaInteracaoEm: new Date() },
  });

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "criterio.avaliar",
    entidade: "CriterioAlta",
    entidadeId: criterioId,
    valorNovo: { [campo]: novoValor },
  });

  revalidarJornada(c.jornadaId);
}

// ---------------------------------------------------------------------------
// Timeline e equipe
// ---------------------------------------------------------------------------

export async function registrarInteracao(fd: FormData) {
  const u = await exigirUsuario();
  const jornadaId = String(fd.get("jornadaId") ?? "");
  const j = await carregarComAcesso(jornadaId, u);

  const texto = val(fd, "texto");
  if (!texto) throw new Error("Escreva a anotação.");

  await registrarNaTimeline({
    jornadaId,
    usuario: u,
    tipo: val(fd, "tipo") ?? "nota",
    texto,
    mencoes: extrairMencoes(texto),
  });

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "jornada.interacao",
    entidade: "Jornada",
    entidadeId: jornadaId,
  });

  revalidarJornada(jornadaId, j.pacienteId);
}

export async function adicionarMembro(fd: FormData) {
  const u = await exigirUsuario();
  const jornadaId = String(fd.get("jornadaId") ?? "");
  await carregarComAcesso(jornadaId, u);
  const usuarioId = val(fd, "usuarioId");
  if (!usuarioId) throw new Error("Selecione o profissional.");

  const prof = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!prof) throw new Error("Profissional não encontrado.");

  await prisma.membroEquipe.upsert({
    where: { jornadaId_usuarioId: { jornadaId, usuarioId } },
    create: { jornadaId, usuarioId, disciplina: prof.disciplina ?? "medicina" },
    update: { disciplina: prof.disciplina ?? "medicina" },
  });

  await registrarNaTimeline({
    jornadaId,
    usuario: u,
    tipo: "nota",
    texto: `${prof.nome} entrou na equipe do caso.`,
  });

  revalidarJornada(jornadaId);
}

export async function removerMembro(membroId: string) {
  const u = await exigirUsuario();
  const m = await prisma.membroEquipe.findUnique({
    where: { id: membroId },
    include: { jornada: true },
  });
  if (!m) return;
  if (!u.setoresIds.includes(m.jornada.setorId)) throw new Error("Sem acesso a este setor.");
  await prisma.membroEquipe.delete({ where: { id: membroId } });
  revalidarJornada(m.jornadaId);
}

// ---------------------------------------------------------------------------
// Round multiprofissional (o ritual que mantém todo mundo alinhado)
// ---------------------------------------------------------------------------

export async function registrarRound(fd: FormData) {
  const u = await exigirUsuario();
  const jornadaId = String(fd.get("jornadaId") ?? "");
  const j = await carregarComAcesso(jornadaId, u);

  const nota = val(fd, "nota");
  const novaDAP = data(fd, "dataAltaPrevista");
  const confianca = val(fd, "confiancaAlta");
  const avancar = fd.get("avancar") !== null;

  const mudouDAP = (j.dataAltaPrevista?.getTime() ?? 0) !== (novaDAP?.getTime() ?? 0);
  await prisma.jornada.update({
    where: { id: jornadaId },
    data: {
      dataAltaPrevista: novaDAP,
      dataAltaPrevistaInicial: j.dataAltaPrevistaInicial ?? novaDAP,
      confiancaAlta: confianca ?? j.confiancaAlta,
    },
  });

  const partes: string[] = [];
  if (nota) partes.push(nota);
  if (mudouDAP) {
    partes.push(
      `Alta prevista: ${j.dataAltaPrevista ? j.dataAltaPrevista.toLocaleDateString("pt-BR") : "sem data"} → ${
        novaDAP ? novaDAP.toLocaleDateString("pt-BR") : "sem data"
      }.`,
    );
  }
  if (!partes.length) partes.push("Caso revisado no round, sem alterações.");

  await registrarNaTimeline({
    jornadaId,
    usuario: u,
    tipo: "round",
    texto: partes.join(" "),
    mencoes: nota ? extrairMencoes(nota) : [],
  });

  // Barreira adicionada direto do round (o momento em que ela costuma aparecer).
  const descricaoBarreira = val(fd, "barreiraDescricao");
  if (descricaoBarreira) {
    const categoria = (val(fd, "barreiraCategoria") ?? "clinica") as CategoriaBarreira;
    const disciplina = CATEGORIA_BARREIRA_DISCIPLINA[categoria];
    await prisma.barreira.create({
      data: {
        jornadaId,
        categoria,
        descricao: descricaoBarreira,
        disciplina,
        prioridade: "media",
        criadaPorNome: u.nome,
      },
    });
    await registrarNaTimeline({
      jornadaId,
      usuario: u,
      tipo: "barreira",
      texto: `Barreira registrada no round (${CATEGORIA_BARREIRA_LABEL[categoria]}): ${descricaoBarreira}`,
      mencoes: [disciplina],
    });
  }

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "jornada.round",
    entidade: "Jornada",
    entidadeId: jornadaId,
    valorNovo: { dataAltaPrevista: novaDAP, confianca },
  });

  revalidarJornada(jornadaId, j.pacienteId);

  // Avançar etapa é a última coisa: se a validação barrar, o round já ficou
  // registrado e o motivo do bloqueio entra na timeline, à vista da equipe.
  if (avancar) {
    const destino = String(fd.get("destino") ?? "");
    if (destino) {
      const resultado = await moverEtapa(jornadaId, destino);
      if (!resultado.ok) {
        await registrarNaTimeline({
          jornadaId,
          usuario: u,
          tipo: "alerta",
          texto: `Avanço de etapa bloqueado no round: ${resultado.erro}`,
        });
        revalidarJornada(jornadaId, j.pacienteId);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Encerramento sem alta (óbito, transferência, evasão)
// ---------------------------------------------------------------------------

export async function encerrarJornada(fd: FormData) {
  const u = await exigirUsuario();
  const jornadaId = String(fd.get("jornadaId") ?? "");
  const j = await carregarComAcesso(jornadaId, u);
  const motivo = val(fd, "encerradaMotivo") ?? "outro";
  const detalhe = val(fd, "detalhe");

  await prisma.jornada.update({
    where: { id: jornadaId },
    data: { status: "encerrada", encerradaEm: new Date(), encerradaMotivo: motivo },
  });

  const statusPaciente =
    motivo === "obito" ? "obito" : motivo === "transferencia" ? "transferido" : null;
  if (statusPaciente) {
    await prisma.paciente.update({ where: { id: j.pacienteId }, data: { status: statusPaciente } });
  }

  await registrarNaTimeline({
    jornadaId,
    usuario: u,
    tipo: "decisao",
    texto: `Jornada encerrada (${motivo}).${detalhe ? ` ${detalhe}` : ""}`,
  });

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "jornada.encerrar",
    entidade: "Jornada",
    entidadeId: jornadaId,
    valorNovo: { motivo, detalhe },
  });

  revalidarJornada(jornadaId, j.pacienteId);
}
