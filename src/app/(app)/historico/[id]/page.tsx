import Link from "next/link";
import { notFound } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registrarAuditoria } from "@/lib/audit";
import { BadgeGravidade, BadgePreocupacao } from "@/components/Badges";
import { formatarDataHora, formatarDuracao } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PassagemHistoricoPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { concluida?: string };
}) {
  const u = (await getUsuarioAtual())!;
  const p = await prisma.passagemEvento.findUnique({
    where: { id: params.id },
    include: {
      setor: true,
      medicoPassa: true,
      medicoRecebe: true,
      snapshots: {
        include: { paciente: true, versoes: { orderBy: { versao: "asc" } } },
        orderBy: { gravidade: "desc" },
      },
      reconhecimentos: { include: { usuario: true } },
    },
  });
  if (!p || !u.setoresIds.includes(p.setorId)) notFound();

  // Trilha de acesso: registra a visualização do histórico.
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "historico.visualizar",
    entidade: "PassagemEvento",
    entidadeId: p.id,
  });

  return (
    <div className="space-y-4">
      <Link href="/historico" className="text-sm text-clinic-muted hover:underline">
        ← Voltar ao histórico
      </Link>

      {searchParams.concluida && (
        <div className="card border-estavel/40 bg-estavel/10 p-3 text-sm text-estavel">
          ✓ Passagem concluída e registrada de forma imutável.
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">Passagem · {p.setor.nome}</h1>
            <p className="text-sm text-clinic-muted">
              {p.medicoPassa.nome} → {p.medicoRecebe?.nome ?? "—"}
            </p>
          </div>
          <span className="badge bg-estavel/15 text-estavel">Concluída</span>
        </div>
        <div className="mt-2 grid gap-1 text-sm text-clinic-muted sm:grid-cols-3">
          <p>Início: {formatarDataHora(p.inicioEm)}</p>
          <p>Conclusão: {formatarDataHora(p.concluidaEm)}</p>
          <p>Duração: {formatarDuracao(p.duracaoSeg)}</p>
        </div>
      </div>

      {p.snapshots.map((s) => {
        const acoes = s.acoesSnapshot ? (JSON.parse(s.acoesSnapshot) as any[]) : [];
        const conts = s.contingenciasSnapshot ? (JSON.parse(s.contingenciasSnapshot) as any[]) : [];
        const reconhecido = p.reconhecimentos.find(
          (r) => r.tipo === "snapshot" && r.referenciaId === s.id,
        );
        return (
          <div key={s.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">
                  <Link href={`/pacientes/${s.pacienteId}`} className="hover:underline">
                    {s.paciente.identificador}
                  </Link>
                </h3>
                <p className="text-xs text-clinic-muted">Leito {s.paciente.leito ?? "—"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <BadgeGravidade valor={s.gravidade} />
                <BadgePreocupacao valor={s.nivelPreocupacao} />
                {s.versoes.length > 1 && (
                  <span className="badge bg-cuidado/15 text-cuidado">v{s.versao} ({s.versoes.length} versões)</span>
                )}
              </div>
            </div>

            <div className="mt-3 space-y-2 text-sm">
              {s.resumoMudancas && (
                <p className="rounded bg-clinic-bg px-2 py-1 text-xs">
                  <strong>O que mudou:</strong> {s.resumoMudancas}
                </p>
              )}
              <p>
                <strong>P — Resumo:</strong> {s.resumoPaciente || "—"}
              </p>
              {s.oQueMePreocupa && (
                <p className="rounded bg-cuidado/10 px-2 py-1">
                  <strong>O que me preocupa:</strong> {s.oQueMePreocupa}
                </p>
              )}

              {acoes.length > 0 && (
                <div>
                  <strong>A — Pendências (congeladas):</strong>
                  <ul className="ml-4 list-disc">
                    {acoes.map((a, i) => (
                      <li key={i}>
                        {a.descricao} {a.responsavel ? `· ${a.responsavel}` : ""} ({a.status})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {conts.length > 0 && (
                <div>
                  <strong>S — Contingências (congeladas):</strong>
                  <ul className="ml-4 list-disc">
                    {conts.map((c, i) => (
                      <li key={i}>
                        {c.parametro} {c.limiar} → {c.acao} ({c.status})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {s.sinteseReceptor && (
                <p className="rounded bg-clinic-primary/10 px-2 py-1">
                  <strong>S — Síntese do receptor:</strong> {s.sinteseReceptor}
                </p>
              )}

              <p className="text-xs text-clinic-muted">
                {reconhecido
                  ? `✓ Reconhecido por ${reconhecido.usuario.nome} em ${formatarDataHora(reconhecido.criadoEm)}`
                  : "Sem reconhecimento registrado"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
