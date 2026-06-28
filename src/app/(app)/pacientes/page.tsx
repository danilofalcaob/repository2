import Link from "next/link";
import { getUsuarioAtual } from "@/lib/auth";
import { getSetoresDoUsuario } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { BadgeStatusPaciente } from "@/components/Badges";
import NovoPacienteForm from "./NovoPacienteForm";

export const dynamic = "force-dynamic";

export default async function PacientesPage() {
  const u = (await getUsuarioAtual())!;
  const setores = await getSetoresDoUsuario(u.setoresIds);
  const pacientes = await prisma.paciente.findMany({
    where: { setorId: { in: u.setoresIds } },
    include: { setor: true },
    orderBy: [{ status: "asc" }, { criadoEm: "desc" }],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pacientes</h1>
      </div>

      <NovoPacienteForm setores={setores.map((s) => ({ id: s.id, nome: s.nome }))} />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-clinic-bg text-left text-xs uppercase text-clinic-muted">
            <tr>
              <th className="p-3">Identificador</th>
              <th className="p-3">Leito</th>
              <th className="hidden p-3 sm:table-cell">Setor</th>
              <th className="hidden p-3 md:table-cell">Diagnóstico</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {pacientes.map((p) => (
              <tr key={p.id} className="border-t border-clinic-border hover:bg-clinic-bg/50">
                <td className="p-3">
                  <Link href={`/pacientes/${p.id}`} className="font-medium text-clinic-primary hover:underline">
                    {p.identificador}
                  </Link>
                  <span className="block text-xs text-clinic-muted">
                    {p.idade ?? "?"}a · {p.sexo ?? "—"}
                  </span>
                </td>
                <td className="p-3">{p.leito ?? "—"}</td>
                <td className="hidden p-3 sm:table-cell">{p.setor.nome}</td>
                <td className="hidden max-w-[240px] truncate p-3 md:table-cell">
                  {p.diagnosticoPrincipal ?? "—"}
                </td>
                <td className="p-3">
                  <BadgeStatusPaciente valor={p.status} />
                </td>
              </tr>
            ))}
            {pacientes.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-clinic-muted">
                  Nenhum paciente cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
