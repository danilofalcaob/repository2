import Link from "next/link";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUltimoSnapshotConcluido } from "@/lib/queries";
import { registrarTRR } from "../actions";
import { BadgeGravidade, BadgePreocupacao } from "@/components/Badges";
import { formatarDataHora } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NovoTRRPage({
  searchParams,
}: {
  searchParams: { paciente?: string };
}) {
  const u = (await getUsuarioAtual())!;
  const pacientes = await prisma.paciente.findMany({
    where: { setorId: { in: u.setoresIds }, status: { in: ["ativo", "transferido"] } },
    orderBy: { identificador: "asc" },
  });

  const selecionado = searchParams.paciente;
  // Contexto da última passagem do paciente selecionado.
  let contexto: any = null;
  if (selecionado) {
    const snap = await getUltimoSnapshotConcluido(selecionado);
    if (snap) {
      const contingencias = await prisma.contingencia.findMany({
        where: { pacienteId: selecionado, status: { in: ["ativa", "reconhecida", "disparada"] } },
      });
      contexto = { snap, contingencias };
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/trr" className="text-sm text-clinic-muted hover:underline">
        ← Voltar
      </Link>
      <h1 className="text-2xl font-bold">Registrar acionamento de TRR</h1>

      {/* Contexto da última passagem */}
      {contexto && (
        <div className="card border-cuidado/40 bg-cuidado/5 p-4 text-sm">
          <p className="mb-2 font-semibold">Contexto da última passagem</p>
          <div className="flex flex-wrap gap-2">
            <BadgeGravidade valor={contexto.snap.gravidade} />
            <BadgePreocupacao valor={contexto.snap.nivelPreocupacao} />
            <span className="text-xs text-clinic-muted">
              {formatarDataHora(contexto.snap.passagem.concluidaEm)}
            </span>
          </div>
          {contexto.snap.oQueMePreocupa && (
            <p className="mt-2">⚠ {contexto.snap.oQueMePreocupa}</p>
          )}
          {contexto.contingencias.length > 0 && (
            <ul className="mt-2 ml-4 list-disc text-xs">
              {contexto.contingencias.map((c: any) => (
                <li key={c.id}>
                  {c.parametro} {c.limiar} → {c.acao}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form action={registrarTRR} className="card space-y-3 p-5">
        <div>
          <label className="label">Paciente *</label>
          <select name="pacienteId" defaultValue={selecionado ?? ""} className="input" required>
            <option value="">Selecione…</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.identificador} — Leito {p.leito ?? "—"}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-clinic-muted">
            Para ver o contexto da última passagem, selecione e recarregue a página.
          </p>
        </div>
        <div>
          <label className="label">Critério/motivo do acionamento *</label>
          <textarea name="criterio" className="input min-h-[70px]" required placeholder="Ex.: hipotensão sustentada + rebaixamento" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Equipe</label>
            <input name="equipe" className="input" placeholder="Ex.: TRR Plantão A" />
          </div>
          <div>
            <label className="label">Data/hora</label>
            <input name="ocorridoEm" type="datetime-local" className="input" />
          </div>
        </div>
        <div>
          <label className="label">Desfecho</label>
          <input name="desfecho" className="input" placeholder="Ex.: estabilizado / UTI / óbito" />
        </div>
        <button className="btn-primary w-full" type="submit">
          Registrar acionamento
        </button>
      </form>
    </div>
  );
}
