import Link from "next/link";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatarDataHora } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TRRPage() {
  const u = (await getUsuarioAtual())!;
  const eventos = await prisma.eventoTRR.findMany({
    where: { paciente: { setorId: { in: u.setoresIds } } },
    include: { paciente: true, passagem: true },
    orderBy: { ocorridoEm: "desc" },
    take: 100,
  });

  const comContingencia = eventos.filter((e) => e.tinhaContingencia).length;
  const comPreocupacao = eventos.filter((e) => e.tinhaPreocupacao).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Time de Resposta Rápida (TRR)</h1>
          <p className="text-sm text-clinic-muted">
            {eventos.length} acionamento(s) · {comContingencia} com contingência prévia ·{" "}
            {comPreocupacao} com preocupação prévia
          </p>
        </div>
        <Link href="/trr/novo" className="btn-primary">
          ＋ Registrar acionamento
        </Link>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-clinic-bg text-left text-xs uppercase text-clinic-muted">
            <tr>
              <th className="p-3">Quando</th>
              <th className="p-3">Paciente</th>
              <th className="hidden p-3 md:table-cell">Critério</th>
              <th className="hidden p-3 sm:table-cell">Desfecho</th>
              <th className="p-3">Sinais prévios</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id} className="border-t border-clinic-border">
                <td className="whitespace-nowrap p-3 text-xs">{formatarDataHora(e.ocorridoEm)}</td>
                <td className="p-3">
                  <Link href={`/pacientes/${e.pacienteId}`} className="text-clinic-primary hover:underline">
                    {e.paciente.identificador}
                  </Link>
                </td>
                <td className="hidden max-w-[260px] truncate p-3 md:table-cell">{e.criterio}</td>
                <td className="hidden p-3 sm:table-cell">{e.desfecho ?? "—"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {e.tinhaContingencia && (
                      <span className="badge bg-instavel/15 text-instavel">contingência</span>
                    )}
                    {e.tinhaPreocupacao && (
                      <span className="badge bg-cuidado/15 text-cuidado">preocupação</span>
                    )}
                    {!e.tinhaContingencia && !e.tinhaPreocupacao && (
                      <span className="text-xs text-clinic-muted">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {eventos.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-clinic-muted">
                  Nenhum acionamento registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
