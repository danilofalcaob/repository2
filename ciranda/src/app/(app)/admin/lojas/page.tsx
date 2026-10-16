import { redirect } from "next/navigation";
import { getUsuarioAtual, paginaInicial } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { liquidacaoDaCiranda } from "@/lib/ciranda-view";
import { percentual, reais } from "@/lib/format";
import { alternarLoja, ajustarTaxaLoja } from "../actions";
import NovaLojaForm from "./NovaLojaForm";

export const dynamic = "force-dynamic";

export default async function AdminLojasPage() {
  const u = await getUsuarioAtual();
  if (!u) redirect("/entrar");
  if (u.perfil !== "admin") redirect(paginaInicial(u.perfil));

  const lojas = await prisma.loja.findMany({
    include: {
      usuarios: { select: { email: true } },
      cirandas: {
        select: {
          status: true,
          taxaPlataforma: true,
          taxaLoja: true,
          elos: { select: { veiculoEntregueId: true, veiculoRecebidoId: true, valorProposta: true, valorAvaliado: true } },
        },
      },
    },
    orderBy: [{ cidade: "asc" }, { nome: "asc" }],
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lojas parceiras</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {lojas.map((l) => {
          const concluidas = l.cirandas.filter((c) => c.status === "concluida");
          const andamento = l.cirandas.filter((c) => !["concluida", "cancelada"].includes(c.status)).length;
          const repasse = concluidas.reduce((s, c) => s + liquidacaoDaCiranda(c).receitaPlataforma, 0);
          return (
            <article key={l.id} className={`card p-4 ${l.ativa ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{l.nome}</p>
                  <p className="text-sm text-app-muted">
                    {l.cidade}
                    {l.cnpj ? ` · CNPJ ${l.cnpj}` : ""}
                  </p>
                  <p className="text-xs text-app-muted">{l.usuarios.map((x) => x.email).join(", ")}</p>
                </div>
                <form action={alternarLoja.bind(null, l.id)}>
                  <button className="btn-secondary !px-2 !py-1 text-xs">{l.ativa ? "Desativar" : "Ativar"}</button>
                </form>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-app-bg p-2">
                  <dt className="text-xs text-app-muted">Em andamento</dt>
                  <dd className="font-bold">{andamento}</dd>
                </div>
                <div className="rounded-lg bg-app-bg p-2">
                  <dt className="text-xs text-app-muted">Concluídas</dt>
                  <dd className="font-bold">{concluidas.length}</dd>
                </div>
                <div className="rounded-lg bg-app-bg p-2">
                  <dt className="text-xs text-app-muted">Repasse 5%</dt>
                  <dd className="font-bold tabular-nums">{reais(repasse)}</dd>
                </div>
              </dl>
              <form action={ajustarTaxaLoja.bind(null, l.id)} className="mt-3 flex items-end gap-2">
                <div>
                  <label className="block text-xs text-app-muted" htmlFor={`t-${l.id}`}>
                    Taxa de serviço (hoje {percentual(l.taxaServico)})
                  </label>
                  <input id={`t-${l.id}`} name="taxa" type="number" step="0.1" min={0} max={20} defaultValue={Math.round(l.taxaServico * 1000) / 10} className="input !w-28 !py-1.5" />
                </div>
                <button className="btn-secondary !py-1.5">Salvar</button>
              </form>
            </article>
          );
        })}
      </div>
      <NovaLojaForm />
    </div>
  );
}
