import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual, paginaInicial } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { liquidacaoDaCiranda } from "@/lib/ciranda-view";
import { Kpi } from "@/components/Badges";
import {
  STATUS_CIRANDA,
  STATUS_CIRANDA_EM_ANDAMENTO,
  STATUS_CIRANDA_LABEL,
  TIPO_INTENCAO_LABEL,
  type StatusCiranda,
  type TipoIntencao,
} from "@/lib/constants";
import { descreverDesejo, nomeCarro, reais } from "@/lib/format";
import { rodarCasamentoAgora } from "./actions";
import { verificarPrazos } from "@/lib/motor";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { formadas?: string; fila?: string; candidatos?: string };
}) {
  const u = await getUsuarioAtual();
  if (!u) redirect("/entrar");
  if (u.perfil !== "admin") redirect(paginaInicial(u.perfil));
  await verificarPrazos();

  const [cirandas, fila, contagemIntencoes, lojasAtivas] = await Promise.all([
    prisma.ciranda.findMany({
      select: {
        status: true,
        taxaPlataforma: true,
        taxaLoja: true,
        elos: { select: { veiculoEntregueId: true, veiculoRecebidoId: true, valorProposta: true, valorAvaliado: true } },
      },
    }),
    prisma.intencao.findMany({
      where: { status: "ativa" },
      include: { usuario: true, veiculo: true, desejos: { orderBy: { ordem: "asc" } } },
      orderBy: [{ cidade: "asc" }, { criadoEm: "asc" }],
    }),
    prisma.intencao.groupBy({ by: ["status"], _count: true }),
    prisma.loja.count({ where: { ativa: true } }),
  ]);

  const porStatus = Object.fromEntries(STATUS_CIRANDA.map((s) => [s, 0])) as Record<StatusCiranda, number>;
  let brutoConcluido = 0;
  let receitaRealizada = 0;
  let receitaPipeline = 0;
  let carrosConcluidos = 0;
  for (const c of cirandas) {
    porStatus[c.status as StatusCiranda]++;
    const l = liquidacaoDaCiranda(c);
    if (c.status === "concluida") {
      brutoConcluido += l.valorBruto;
      receitaRealizada += l.receitaPlataforma;
      carrosConcluidos += c.elos.filter((e) => e.veiculoEntregueId).length;
    } else if (STATUS_CIRANDA_EM_ANDAMENTO.includes(c.status as StatusCiranda)) {
      receitaPipeline += l.receitaPlataforma;
    }
  }
  const intencoes = Object.fromEntries(contagemIntencoes.map((g) => [g.status, g._count]));
  const encerradas = porStatus.concluida + porStatus.cancelada;
  const conversao = encerradas > 0 ? Math.round((100 * porStatus.concluida) / encerradas) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Visão geral da plataforma</h1>
          <p className="text-sm text-app-muted">{lojasAtivas} loja(s) parceira(s) ativa(s)</p>
        </div>
        <form action={rodarCasamentoAgora}>
          <button className="btn-primary">🔄 Rodar casamento agora</button>
        </form>
      </div>

      {searchParams.formadas !== undefined && (
        <div className="card border-app-primary/40 bg-app-primary/5 p-4 text-sm">
          Motor executado: <strong>{searchParams.formadas}</strong> nova(s) ciranda(s) formada(s) a partir de{" "}
          {searchParams.candidatos} ciclo(s) candidato(s). <strong>{searchParams.fila}</strong> cadastro(s) seguem na fila.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Receita realizada (5%)" valor={reais(receitaRealizada)} detalhe={`${porStatus.concluida} cirandas concluídas`} />
        <Kpi rotulo="Receita em andamento" valor={reais(receitaPipeline)} detalhe="se as cirandas abertas concluírem" />
        <Kpi rotulo="Valor bruto negociado" valor={reais(brutoConcluido)} detalhe={`${carrosConcluidos} carros`} />
        <Kpi
          rotulo="Conversão"
          valor={conversao === null ? "—" : `${conversao}%`}
          detalhe="cirandas concluídas / encerradas"
        />
      </div>

      <section>
        <h2 className="titulo-secao">Funil de cirandas</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {STATUS_CIRANDA.map((s) => (
            <Link key={s} href={`/admin/cirandas?status=${s}`} className="card p-3 transition hover:border-app-primary">
              <p className="text-2xl font-bold tabular-nums">{porStatus[s]}</p>
              <p className="text-xs text-app-muted">{STATUS_CIRANDA_LABEL[s]}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="titulo-secao !mb-0">Fila de casamento ({fila.length})</h2>
          <p className="text-xs text-app-muted">
            Em negociação: {intencoes.em_ciranda ?? 0} · pausados: {intencoes.pausada ?? 0} · concluídos: {intencoes.concluida ?? 0}
          </p>
        </div>
        {fila.length === 0 ? (
          <p className="text-sm text-app-muted">Ninguém esperando. 🎉</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-app-border text-xs uppercase text-app-muted">
                <tr>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Cidade</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Entrega</th>
                  <th className="p-3">Quer (1ª opção)</th>
                  <th className="p-3 text-right">Paga até</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {fila.map((i) => (
                  <tr key={i.id}>
                    <td className="p-3">{i.usuario.nome}</td>
                    <td className="p-3">{i.cidade}</td>
                    <td className="p-3">{TIPO_INTENCAO_LABEL[i.tipo as TipoIntencao]}</td>
                    <td className="p-3">
                      {i.veiculo ? `${nomeCarro(i.veiculo)} · ${reais(i.veiculo.valorPretendido)}` : "—"}
                    </td>
                    <td className="p-3">
                      {i.desejos[0] ? descreverDesejo(i.desejos[0]) : "dinheiro"}
                      {i.desejos.length > 1 && <span className="text-app-muted"> (+{i.desejos.length - 1})</span>}
                    </td>
                    <td className="p-3 text-right tabular-nums">{i.tipo === "venda" ? "—" : reais(i.maxPagar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
