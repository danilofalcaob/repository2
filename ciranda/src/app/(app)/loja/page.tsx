import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual, paginaInicial } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { liquidacaoDaCiranda } from "@/lib/ciranda-view";
import { normalizar } from "@/lib/normalizar";
import { BadgeCiranda, Kpi } from "@/components/Badges";
import { dataHora, percentual, reais } from "@/lib/format";
import { verificarPrazos } from "@/lib/motor";

export const dynamic = "force-dynamic";

const PROXIMO_PASSO: Record<string, string> = {
  em_avaliacao: "Agendar e registrar as vistorias",
  confirmacao_final: "Aguardando os clientes confirmarem os valores",
  em_liquidacao: "Acertar pagamentos e transferências",
};

const INCLUDE_LISTA = {
  elos: { select: { veiculoEntregueId: true, veiculoRecebidoId: true, valorProposta: true, valorAvaliado: true, avaliacao: true } },
} as const;

export default async function LojaPage() {
  const u = await getUsuarioAtual();
  if (!u) redirect("/entrar");
  if (u.perfil !== "loja" || !u.lojaId) redirect(paginaInicial(u.perfil));
  await verificarPrazos();
  const loja = await prisma.loja.findUnique({ where: { id: u.lojaId } });
  if (!loja) redirect("/");

  const [aguardando, minhas] = await Promise.all([
    prisma.ciranda.findMany({ where: { status: "aguardando_loja" }, include: INCLUDE_LISTA, orderBy: { criadoEm: "asc" } }),
    prisma.ciranda.findMany({ where: { lojaId: loja.id }, include: INCLUDE_LISTA, orderBy: { atualizadoEm: "desc" } }),
  ]);
  const disponiveis = loja.ativa ? aguardando.filter((c) => normalizar(c.cidade) === normalizar(loja.cidade)) : [];
  const emAndamento = minhas.filter((c) => ["em_avaliacao", "confirmacao_final", "em_liquidacao"].includes(c.status));
  const concluidas = minhas.filter((c) => c.status === "concluida");
  const totais = concluidas.reduce(
    (t, c) => {
      const l = liquidacaoDaCiranda(c);
      return {
        bruto: t.bruto + l.valorBruto,
        loja: t.loja + l.receitaLoja,
        plataforma: t.plataforma + l.receitaPlataforma,
        carros: t.carros + c.elos.filter((e) => e.veiculoEntregueId).length,
      };
    },
    { bruto: 0, loja: 0, plataforma: 0, carros: 0 },
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{loja.nome}</h1>
        <p className="text-sm text-app-muted">
          {loja.cidade} · taxa de serviço {percentual(loja.taxaServico)} por carro · {loja.ativa ? "ativa na plataforma" : "inativa"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi rotulo="Cirandas concluídas" valor={String(concluidas.length)} detalhe={`${totais.carros} carros negociados`} />
        <Kpi rotulo="Valor bruto negociado" valor={reais(totais.bruto)} />
        <Kpi rotulo="Receita da loja" valor={reais(totais.loja)} detalhe="taxas de serviço" />
        <Kpi rotulo="Repasse à plataforma" valor={reais(totais.plataforma)} detalhe="5% do valor bruto" />
      </div>

      <section>
        <h2 className="titulo-secao">Disponíveis na sua cidade</h2>
        {disponiveis.length === 0 && (
          <p className="text-sm text-app-muted">Nenhuma ciranda aguardando loja agora. Elas aparecem aqui quando todos os participantes aceitam.</p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {disponiveis.map((c) => {
            const l = liquidacaoDaCiranda(c, loja.taxaServico);
            return (
              <Link key={c.id} href={`/cirandas/${c.id}`} className="card block p-4 transition hover:border-app-primary">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold">{c.codigo}</span>
                  <BadgeCiranda status={c.status} />
                </div>
                <p className="mt-2 text-sm">
                  {c.elos.length} participantes · {c.elos.filter((e) => e.veiculoEntregueId).length} carros · {reais(l.valorBruto)}
                </p>
                <p className="mt-1 text-sm font-semibold text-ok">Sua receita estimada: {reais(l.receitaLoja)}</p>
                <p className="mt-2 text-xs text-app-primary">Ver detalhes e assumir →</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="titulo-secao">Em andamento</h2>
        {emAndamento.length === 0 && <p className="text-sm text-app-muted">Nenhuma ciranda em andamento.</p>}
        <div className="card divide-y divide-app-border">
          {emAndamento.map((c) => {
            const pendentes = c.elos.filter((e) => e.veiculoEntregueId && e.avaliacao === "pendente").length;
            return (
              <Link key={c.id} href={`/cirandas/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-app-bg">
                <div>
                  <p className="font-mono font-bold">{c.codigo}</p>
                  <p className="text-sm text-app-muted">
                    {PROXIMO_PASSO[c.status]}
                    {c.status === "em_avaliacao" && ` (${pendentes} pendente${pendentes === 1 ? "" : "s"})`}
                  </p>
                </div>
                <BadgeCiranda status={c.status} />
              </Link>
            );
          })}
        </div>
      </section>

      {concluidas.length > 0 && (
        <section>
          <h2 className="titulo-secao">Concluídas</h2>
          <div className="card divide-y divide-app-border">
            {concluidas.map((c) => {
              const l = liquidacaoDaCiranda(c);
              return (
                <Link key={c.id} href={`/cirandas/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm hover:bg-app-bg">
                  <span className="font-mono font-bold">{c.codigo}</span>
                  <span className="text-app-muted">{c.concluidaEm ? dataHora(c.concluidaEm) : ""}</span>
                  <span className="tabular-nums">{reais(l.valorBruto)} em carros</span>
                  <span className="tabular-nums text-ok">+ {reais(l.receitaLoja)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
