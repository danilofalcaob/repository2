import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUltimoSnapshotConcluido } from "@/lib/queries";
import { descreverMudanca } from "@/lib/diff";
import PassagemEditor from "./PassagemEditor";

export const dynamic = "force-dynamic";

export default async function PassagemPage({ params }: { params: { id: string } }) {
  const u = (await getUsuarioAtual())!;
  const passagem = await prisma.passagemEvento.findUnique({
    where: { id: params.id },
    include: {
      setor: true,
      medicoPassa: true,
      medicoRecebe: true,
      snapshots: {
        include: {
          paciente: {
            include: {
              contingencias: { orderBy: { criadaEm: "desc" } },
              pendencias: { where: { status: "aberta" }, orderBy: { criadaEm: "desc" } },
            },
          },
        },
      },
    },
  });
  if (!passagem || !u.setoresIds.includes(passagem.setorId)) notFound();

  // Passagem já concluída → ver no histórico (imutável).
  if (passagem.status === "concluida") redirect(`/historico/${passagem.id}`);

  // Receptores possíveis.
  const colegas = await prisma.usuario.findMany({
    where: { ativo: true, id: { not: passagem.medicoPassaId }, setores: { some: { setorId: passagem.setorId } } },
    orderBy: { nome: "asc" },
  });

  // Monta dados de cada snapshot + "o que mudou" comparando com a última passagem.
  const snapshots = await Promise.all(
    passagem.snapshots.map(async (s) => {
      const anterior = await getUltimoSnapshotConcluido(s.pacienteId, passagem.inicioEm);
      const dicaMudanca = descreverMudanca(
        anterior ? { gravidade: anterior.gravidade, nivelPreocupacao: anterior.nivelPreocupacao } : null,
        { gravidade: s.gravidade, nivelPreocupacao: s.nivelPreocupacao },
      );
      return {
        id: s.id,
        pacienteId: s.pacienteId,
        identificador: s.paciente.identificador,
        leito: s.paciente.leito,
        gravidade: s.gravidade,
        resumoPaciente: s.resumoPaciente,
        nivelPreocupacao: s.nivelPreocupacao,
        oQueMePreocupa: s.oQueMePreocupa ?? "",
        sinteseReceptor: s.sinteseReceptor ?? "",
        resumoMudancas: s.resumoMudancas ?? "",
        reconhecido: s.reconhecido,
        dicaMudanca,
        anteriorResumo: anterior?.resumoPaciente ?? null,
        pendencias: s.paciente.pendencias.map((p) => ({
          descricao: p.descricao,
          prioridade: p.prioridade,
          responsavel: p.responsavel,
        })),
        contingencias: s.paciente.contingencias.map((c) => ({
          id: c.id,
          parametro: c.parametro,
          limiar: c.limiar,
          acao: c.acao,
          prioridade: c.prioridade,
          status: c.status,
        })),
      };
    }),
  );

  // O usuário atual é o receptor? (habilita ações de read-back)
  const ehReceptor = passagem.medicoRecebeId === u.id;

  return (
    <div className="space-y-4">
      <Link href="/quadro" className="text-sm text-clinic-muted hover:underline">
        ← Voltar ao quadro
      </Link>

      <PassagemEditor
        passagemId={passagem.id}
        setorNome={passagem.setor.nome}
        medicoPassa={passagem.medicoPassa.nome}
        medicoRecebeId={passagem.medicoRecebeId}
        medicoRecebeNome={passagem.medicoRecebe?.nome ?? null}
        inicioEm={passagem.inicioEm.toISOString()}
        colegas={colegas.map((c) => ({ id: c.id, nome: c.nome }))}
        snapshots={snapshots}
        ehReceptor={ehReceptor}
        usuarioId={u.id}
      />
    </div>
  );
}
