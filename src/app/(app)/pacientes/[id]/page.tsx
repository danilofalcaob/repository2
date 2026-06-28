import Link from "next/link";
import { notFound } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  BadgeGravidade,
  BadgePreocupacao,
  BadgeStatusPaciente,
} from "@/components/Badges";
import { formatarData, formatarDataHora } from "@/lib/format";
import { STATUS_PACIENTE_LABEL } from "@/lib/constants";
import PendenciasSection from "./PendenciasSection";
import ContingenciasSection from "./ContingenciasSection";
import StatusControl from "./StatusControl";

export const dynamic = "force-dynamic";

export default async function PacientePage({ params }: { params: { id: string } }) {
  const u = (await getUsuarioAtual())!;
  const p = await prisma.paciente.findUnique({
    where: { id: params.id },
    include: {
      setor: true,
      pendencias: { orderBy: [{ status: "asc" }, { criadaEm: "desc" }] },
      contingencias: { orderBy: { criadaEm: "desc" } },
      eventosTRR: { orderBy: { ocorridoEm: "desc" } },
      snapshots: {
        orderBy: { criadoEm: "desc" },
        include: { passagem: { include: { medicoPassa: true, medicoRecebe: true } } },
      },
    },
  });
  if (!p || !u.setoresIds.includes(p.setorId)) notFound();

  const snapAtual = p.snapshots[0];
  const concluidos = p.snapshots.filter((s) => s.passagem.status === "concluida");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/quadro" className="text-sm text-clinic-muted hover:underline">
          ← Voltar ao quadro
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{p.identificador}</h1>
            <p className="text-sm text-clinic-muted">
              {p.setor.nome} · Leito {p.leito ?? "—"} · {p.idade ?? "?"}a · {p.sexo ?? "—"} ·
              Admissão {formatarData(p.dataAdmissao)}
            </p>
          </div>
          <BadgeStatusPaciente valor={p.status} />
        </div>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-clinic-muted">Diagnóstico: </span>
            {p.diagnosticoPrincipal ?? "—"}
          </p>
          <p>
            <span className="text-clinic-muted">Alergias: </span>
            <span className={p.alergias && p.alergias.toLowerCase() !== "nega" ? "font-semibold text-instavel" : ""}>
              {p.alergias ?? "—"}
            </span>
          </p>
        </div>
        <StatusControl pacienteId={p.id} statusAtual={p.status} />
      </div>

      {/* Estado I-PASS atual (do snapshot mais recente) */}
      <section className="card p-4">
        <h2 className="mb-3 text-lg font-semibold">Estado I-PASS atual</h2>
        {snapAtual ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <BadgeGravidade valor={snapAtual.gravidade} />
              <BadgePreocupacao valor={snapAtual.nivelPreocupacao} />
              <span className="text-xs text-clinic-muted">
                Última atualização: {formatarDataHora(snapAtual.atualizadoEm)} (
                {snapAtual.passagem.status === "concluida" ? "passagem concluída" : "rascunho"})
              </span>
            </div>
            {snapAtual.resumoPaciente && (
              <p className="text-sm">
                <span className="font-semibold">Resumo (P): </span>
                {snapAtual.resumoPaciente}
              </p>
            )}
            {snapAtual.oQueMePreocupa && (
              <p className="rounded-lg bg-cuidado/10 px-3 py-2 text-sm">
                <span className="font-semibold">O que me preocupa: </span>
                {snapAtual.oQueMePreocupa}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-clinic-muted">
            Ainda não há passagem registrada para este paciente. Os campos I-PASS são
            preenchidos durante uma passagem de plantão.
          </p>
        )}
      </section>

      {/* Contingências */}
      <ContingenciasSection
        pacienteId={p.id}
        contingencias={p.contingencias.map((c) => ({
          id: c.id,
          parametro: c.parametro,
          limiar: c.limiar,
          acao: c.acao,
          prioridade: c.prioridade,
          status: c.status,
          lembreteEm: c.lembreteEm?.toISOString() ?? null,
          reconhecidaPor: c.reconhecidaPor,
        }))}
      />

      {/* Pendências */}
      <PendenciasSection
        pacienteId={p.id}
        pendencias={p.pendencias.map((x) => ({
          id: x.id,
          descricao: x.descricao,
          responsavel: x.responsavel,
          prioridade: x.prioridade,
          status: x.status,
          herdada: x.herdada,
          prazo: x.prazo?.toISOString() ?? null,
          criadaEm: x.criadaEm.toISOString(),
        }))}
      />

      {/* TRR */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Acionamentos de TRR</h2>
          <Link href={`/trr/novo?paciente=${p.id}`} className="btn-secondary !py-1.5 text-xs">
            ＋ Registrar TRR
          </Link>
        </div>
        {p.eventosTRR.length === 0 ? (
          <p className="text-sm text-clinic-muted">Nenhum acionamento registrado.</p>
        ) : (
          <ul className="space-y-2">
            {p.eventosTRR.map((e) => (
              <li key={e.id} className="rounded-lg border border-clinic-border p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{e.criterio}</span>
                  <span className="text-xs text-clinic-muted">{formatarDataHora(e.ocorridoEm)}</span>
                </div>
                <p className="text-xs text-clinic-muted">
                  Equipe: {e.equipe ?? "—"} · Desfecho: {e.desfecho ?? "—"}
                  {e.tinhaContingencia && " · tinha contingência prévia"}
                  {e.tinhaPreocupacao && " · tinha preocupação prévia"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Linha do tempo (passagens concluídas) */}
      <section className="card p-4">
        <h2 className="mb-3 text-lg font-semibold">Linha do tempo do paciente</h2>
        {concluidos.length === 0 ? (
          <p className="text-sm text-clinic-muted">Nenhuma passagem concluída ainda.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-clinic-border pl-5">
            {concluidos.map((s) => (
              <li key={s.id} className="relative">
                <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-clinic-primary" />
                <Link
                  href={`/historico/${s.passagemId}`}
                  className="block rounded-lg border border-clinic-border p-3 text-sm hover:border-clinic-primary"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{formatarDataHora(s.passagem.concluidaEm)}</span>
                    <BadgeGravidade valor={s.gravidade} />
                  </div>
                  <p className="mt-1 text-xs text-clinic-muted">
                    {s.passagem.medicoPassa.nome} → {s.passagem.medicoRecebe?.nome ?? "—"}
                  </p>
                  {s.resumoPaciente && <p className="mt-1 line-clamp-2">{s.resumoPaciente}</p>}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
