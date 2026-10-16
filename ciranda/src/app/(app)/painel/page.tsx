import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual, paginaInicial } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { INCLUDE_CIRANDA, liquidacaoDaCiranda, vizinhos } from "@/lib/ciranda-view";
import { BadgeCiranda, BadgeIntencao } from "@/components/Badges";
import { STATUS_CIRANDA_EM_ANDAMENTO, TIPO_INTENCAO_LABEL, type StatusCiranda, type TipoIntencao } from "@/lib/constants";
import { descreverDesejo, km, nomeCarro, primeiroNome, reais, tempoRestante } from "@/lib/format";
import { ajustarValores, cancelarIntencao, pausarIntencao, reativarIntencao } from "../intencoes/actions";
import { verificarPrazos } from "@/lib/motor";

export const dynamic = "force-dynamic";

export default async function PainelPage({ searchParams }: { searchParams: { cadastro?: string } }) {
  const u = await getUsuarioAtual();
  if (!u) redirect("/entrar");
  if (u.perfil !== "cliente") redirect(paginaInicial(u.perfil));
  await verificarPrazos();

  const [intencoes, cirandas] = await Promise.all([
    prisma.intencao.findMany({
      where: { usuarioId: u.id },
      include: { veiculo: true, desejos: { orderBy: { ordem: "asc" } } },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.ciranda.findMany({
      where: { elos: { some: { intencao: { usuarioId: u.id } } } },
      include: INCLUDE_CIRANDA,
      orderBy: { criadoEm: "desc" },
    }),
  ]);

  const cards = cirandas.map((c) => {
    const i = c.elos.findIndex((e) => e.intencao.usuarioId === u.id);
    const meu = c.elos[i];
    const pendente =
      (c.status === "proposta" && meu.aceite === "pendente") ||
      (c.status === "confirmacao_final" && meu.confirmacao === "pendente");
    return {
      c,
      meu,
      recebeDe: vizinhos(c.elos, i).recebeDe,
      linha: liquidacaoDaCiranda(c).linhas[i],
      pendente,
      emAndamento: STATUS_CIRANDA_EM_ANDAMENTO.includes(c.status as StatusCiranda),
    };
  });
  const pendentes = cards.filter((x) => x.pendente);
  const ordenados = [...cards.filter((x) => x.emAndamento), ...cards.filter((x) => !x.emAndamento)];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Olá, {primeiroNome(u.nome)}</h1>
          <p className="text-sm text-app-muted">Acompanhe seus cadastros e as cirandas propostas para você.</p>
        </div>
        <Link href="/intencoes/nova" className="btn-primary">
          + Novo cadastro
        </Link>
      </div>

      {searchParams.cadastro === "ok" && (
        <div className="card border-app-primary/40 bg-app-primary/5 p-4 text-sm">
          <p className="font-semibold">Cadastro salvo e na fila. 🔄</p>
          <p className="text-app-muted">
            Ainda não há uma roda completa para o seu carro. O motor tenta de novo a cada novo cadastro na sua cidade — a
            ciranda aparece aqui assim que fechar.
          </p>
        </div>
      )}

      {pendentes.length > 0 && (
        <section className="card border-alerta/50 bg-alerta/10 p-4">
          <h2 className="font-bold">⏳ Precisa da sua resposta</h2>
          <ul className="mt-2 space-y-2">
            {pendentes.map(({ c }) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  Ciranda <strong>{c.codigo}</strong> —{" "}
                  {c.status === "proposta" ? "aceite ou recuse a proposta" : "confirme os valores validados pela loja"} ·{" "}
                  {tempoRestante(c.prazo)}
                </span>
                <Link href={`/cirandas/${c.id}`} className="btn-primary !py-1.5">
                  Responder
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="titulo-secao">Minhas cirandas</h2>
        {cards.length === 0 && <p className="text-sm text-app-muted">Nenhuma ciranda ainda.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {ordenados.map(({ c, meu, recebeDe, linha }) => (
            <Link
              key={c.id}
              href={`/cirandas/${c.id}`}
              className={`card block p-4 transition hover:border-app-primary ${c.status === "cancelada" ? "opacity-70" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold">{c.codigo}</span>
                <BadgeCiranda status={c.status} />
              </div>
              <p className="mt-2 text-sm">
                {meu.veiculoEntregue ? (
                  <>
                    Você entrega <strong>{nomeCarro(meu.veiculoEntregue)}</strong>
                  </>
                ) : (
                  "Você paga em dinheiro"
                )}
                {" → "}
                {meu.veiculoRecebido ? (
                  <>
                    recebe <strong>{nomeCarro(meu.veiculoRecebido)}</strong> de {primeiroNome(recebeDe.intencao.usuario.nome)}
                  </>
                ) : (
                  "recebe o valor em dinheiro"
                )}
              </p>
              <p className="mt-1 text-xs text-app-muted">
                Roda de {c.elos.length} participantes · {c.cidade}
                {c.loja ? ` · ${c.loja.nome}` : ""}
              </p>
              <p className={`mt-2 text-sm font-semibold tabular-nums ${linha.saldo > 0 ? "text-erro" : "text-ok"}`}>
                {linha.saldo > 0 ? `Você paga ${reais(linha.saldo)}` : `Você recebe ${reais(-linha.saldo)}`}
                <span className="font-normal text-app-muted"> (troco + taxas{c.taxaLoja == null ? ", estimado" : ""})</span>
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="titulo-secao">Meus cadastros</h2>
        {intencoes.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-app-muted">Você ainda não cadastrou nenhum carro.</p>
            <Link href="/intencoes/nova" className="btn-primary mt-3">
              Cadastrar meu carro
            </Link>
          </div>
        )}
        <div className="space-y-4">
          {intencoes.map((i) => (
            <article key={i.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {TIPO_INTENCAO_LABEL[i.tipo as TipoIntencao]} · {i.cidade}
                </p>
                <BadgeIntencao status={i.status} />
              </div>
              {i.motivoStatus && i.status === "pausada" && <p className="mt-1 text-sm text-alerta">{i.motivoStatus}</p>}
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                {i.veiculo && (
                  <div>
                    <p className="text-xs font-medium uppercase text-app-muted">Entrego</p>
                    <p>
                      {nomeCarro(i.veiculo)} · {km(i.veiculo.km)}
                    </p>
                    <p className="text-app-muted">Pedindo {reais(i.veiculo.valorPretendido)}</p>
                  </div>
                )}
                {i.desejos.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase text-app-muted">Quero</p>
                    <ol className="list-inside list-decimal">
                      {i.desejos.map((d) => (
                        <li key={d.id}>{descreverDesejo(d)}</li>
                      ))}
                    </ol>
                    <p className="text-app-muted">
                      {i.tipo === "compra" ? "Orçamento" : "Aceito pagar de diferença"} até {reais(i.maxPagar)}
                    </p>
                  </div>
                )}
              </div>
              {(i.status === "ativa" || i.status === "pausada") && (
                <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-app-border pt-3">
                  <form action={ajustarValores.bind(null, i.id)} className="flex flex-wrap items-end gap-2">
                    {i.veiculo && (
                      <div>
                        <label className="block text-xs text-app-muted" htmlFor={`v-${i.id}`}>
                          Preço pedido
                        </label>
                        <input
                          id={`v-${i.id}`}
                          name="valorPretendido"
                          defaultValue={i.veiculo.valorPretendido}
                          className="input !w-32 !py-1.5"
                          inputMode="numeric"
                        />
                      </div>
                    )}
                    {i.tipo !== "venda" && (
                      <div>
                        <label className="block text-xs text-app-muted" htmlFor={`m-${i.id}`}>
                          {i.tipo === "compra" ? "Orçamento" : "Diferença máx."}
                        </label>
                        <input
                          id={`m-${i.id}`}
                          name="maxPagar"
                          defaultValue={i.maxPagar}
                          className="input !w-32 !py-1.5"
                          inputMode="numeric"
                        />
                      </div>
                    )}
                    <button className="btn-secondary !py-1.5">
                      {i.status === "pausada" ? "Ajustar e reativar" : "Ajustar valores"}
                    </button>
                  </form>
                  <div className="ml-auto flex gap-2">
                    {i.status === "ativa" && (
                      <form action={pausarIntencao.bind(null, i.id)}>
                        <button className="btn-secondary !py-1.5">Pausar</button>
                      </form>
                    )}
                    {i.status === "pausada" && (
                      <form action={reativarIntencao.bind(null, i.id)}>
                        <button className="btn-secondary !py-1.5">Reativar</button>
                      </form>
                    )}
                    <form action={cancelarIntencao.bind(null, i.id)}>
                      <button className="btn-secondary !py-1.5 text-erro">Cancelar</button>
                    </form>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
