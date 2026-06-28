import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual, podeVerGestao } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatarDataHora } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const u = (await getUsuarioAtual())!;
  if (!podeVerGestao(u.perfil)) redirect("/quadro");

  const logs = await prisma.logAuditoria.findMany({
    include: { usuario: true },
    orderBy: { criadoEm: "desc" },
    take: 300,
  });

  return (
    <div className="space-y-4">
      <Link href="/historico" className="text-sm text-clinic-muted hover:underline">
        ← Voltar ao histórico
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Trilha de auditoria</h1>
        <p className="text-sm text-clinic-muted">
          Registro append-only de ações relevantes, acessos e exportações. A
          própria auditoria é auditável.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-clinic-bg text-left text-xs uppercase text-clinic-muted">
            <tr>
              <th className="p-3">Quando</th>
              <th className="p-3">Quem</th>
              <th className="p-3">Ação</th>
              <th className="hidden p-3 md:table-cell">Entidade</th>
              <th className="hidden p-3 lg:table-cell">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-clinic-border">
                <td className="whitespace-nowrap p-3 text-xs">{formatarDataHora(l.criadoEm)}</td>
                <td className="p-3">{l.usuario?.nome ?? "Sistema"}</td>
                <td className="p-3 font-mono text-xs">{l.acao}</td>
                <td className="hidden p-3 text-xs md:table-cell">
                  {l.entidade ?? "—"}
                  {l.entidadeId ? ` · ${l.entidadeId.slice(0, 8)}` : ""}
                </td>
                <td className="hidden max-w-[300px] truncate p-3 text-xs text-clinic-muted lg:table-cell">
                  {l.detalhe ??
                    [l.valorAnterior && `de: ${l.valorAnterior}`, l.valorNovo && `para: ${l.valorNovo}`]
                      .filter(Boolean)
                      .join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
