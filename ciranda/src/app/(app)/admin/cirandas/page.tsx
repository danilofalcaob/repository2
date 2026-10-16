import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual, paginaInicial } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { liquidacaoDaCiranda } from "@/lib/ciranda-view";
import { BadgeCiranda } from "@/components/Badges";
import { STATUS_CIRANDA, STATUS_CIRANDA_LABEL } from "@/lib/constants";
import { dataHora, primeiroNome, reais } from "@/lib/format";
import { verificarPrazos } from "@/lib/motor";

export const dynamic = "force-dynamic";

export default async function AdminCirandasPage({ searchParams }: { searchParams: { status?: string } }) {
  const u = await getUsuarioAtual();
  if (!u) redirect("/entrar");
  if (u.perfil !== "admin") redirect(paginaInicial(u.perfil));
  await verificarPrazos();
  const filtro = STATUS_CIRANDA.find((s) => s === searchParams.status);

  const cirandas = await prisma.ciranda.findMany({
    where: filtro ? { status: filtro } : undefined,
    include: { loja: true, elos: { orderBy: { posicao: "asc" }, include: { intencao: { include: { usuario: true } } } } },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cirandas</h1>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/cirandas" className={`badge ${!filtro ? "bg-app-primary text-app-primaryfg" : "bg-app-surface border border-app-border"}`}>
          Todas
        </Link>
        {STATUS_CIRANDA.map((s) => (
          <Link
            key={s}
            href={`/admin/cirandas?status=${s}`}
            className={`badge ${filtro === s ? "bg-app-primary text-app-primaryfg" : "border border-app-border bg-app-surface"}`}
          >
            {STATUS_CIRANDA_LABEL[s]}
          </Link>
        ))}
      </div>
      {cirandas.length === 0 && <p className="text-sm text-app-muted">Nenhuma ciranda neste filtro.</p>}
      <div className="card divide-y divide-app-border">
        {cirandas.map((c) => {
          const l = liquidacaoDaCiranda(c);
          return (
            <Link key={c.id} href={`/cirandas/${c.id}`} className="grid gap-2 p-4 text-sm hover:bg-app-bg sm:grid-cols-[7rem_1fr_auto_auto] sm:items-center">
              <span className="font-mono font-bold">{c.codigo}</span>
              <span>
                {c.elos.map((e) => primeiroNome(e.intencao.usuario.nome)).join(" → ")}
                <span className="block text-xs text-app-muted">
                  {c.cidade} · {dataHora(c.criadoEm)}
                  {c.loja ? ` · ${c.loja.nome}` : ""}
                </span>
              </span>
              <span className="tabular-nums text-app-muted">
                {reais(l.valorBruto)} · 5% = {reais(l.receitaPlataforma)}
              </span>
              <BadgeCiranda status={c.status} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
