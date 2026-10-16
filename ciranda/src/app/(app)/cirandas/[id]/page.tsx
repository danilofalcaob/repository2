import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { INCLUDE_CIRANDA, liquidacaoDaCiranda, valorAtual } from "@/lib/ciranda-view";
import { normalizar } from "@/lib/normalizar";
import { aguardaRespostaDosParticipantes, podeConcluir } from "@/lib/fluxo";
import { CAMBIO_LABEL, TAXA_LOJA_PADRAO } from "@/lib/constants";
import { dataHora, km, nomeCarro, percentual, primeiroNome, reais, reaisComSinal, tempoRestante } from "@/lib/format";
import RodaCiranda from "@/components/RodaCiranda";
import { BadgeCiranda } from "@/components/Badges";
import {
  assumirCiranda,
  avaliarVeiculo,
  cancelarPelaOperacao,
  concluirCiranda,
  confirmarFinal,
  marcarLiquidacao,
  responderProposta,
} from "../actions";
import { verificarPrazos } from "@/lib/motor";

export const dynamic = "force-dynamic";

const ETAPAS = [
  { status: "proposta", rotulo: "Aceites" },
  { status: "aguardando_loja", rotulo: "Loja" },
  { status: "em_avaliacao", rotulo: "Vistoria" },
  { status: "confirmacao_final", rotulo: "Confirmação" },
  { status: "em_liquidacao", rotulo: "Pagamentos" },
  { status: "concluida", rotulo: "Concluída" },
];

const CHECKLIST = [
  { campo: "docOk", rotulo: "Documento, débitos, multas e IPVA em dia" },
  { campo: "gravameOk", rotulo: "Sem alienação/gravame (ou quitação no ato)" },
  { campo: "cautelarOk", rotulo: "Laudo cautelar aprovado (sem sinistro, leilão ou adulteração)" },
  { campo: "estadoOk", rotulo: "Estado geral condiz com o anunciado" },
] as const;

function Selo({ ok, pendente, texto }: { ok: boolean; pendente?: boolean; texto: string }) {
  const cor = ok ? "bg-ok/15 text-ok" : pendente ? "bg-alerta/15 text-alerta" : "bg-erro/15 text-erro";
  return <span className={`badge ${cor}`}>{texto}</span>;
}

export default async function CirandaPage({ params, searchParams }: { params: { id: string }; searchParams: { nova?: string } }) {
  const u = await getUsuarioAtual();
  if (!u) redirect("/entrar");
  await verificarPrazos();
  const c = await prisma.ciranda.findUnique({ where: { id: params.id }, include: INCLUDE_CIRANDA });
  if (!c) notFound();

  const minhaPos = c.elos.findIndex((e) => e.intencao.usuarioId === u.id);
  const ehParticipante = minhaPos >= 0;
  const ehMinhaLoja = u.perfil === "loja" && !!u.lojaId && c.lojaId === u.lojaId;
  const minhaLoja = u.perfil === "loja" && u.lojaId ? await prisma.loja.findUnique({ where: { id: u.lojaId } }) : null;
  const lojaPodeAssumir =
    !!minhaLoja?.ativa && c.status === "aguardando_loja" && normalizar(minhaLoja.cidade) === normalizar(c.cidade);
  const ehAdmin = u.perfil === "admin";
  if (!ehParticipante && !ehMinhaLoja && !lojaPodeAssumir && !ehAdmin) notFound();

  // Contato e sobrenome só para a loja que conduz a negociação e a plataforma.
  const veDados = ehMinhaLoja || ehAdmin;
  const veTodosValores = ehMinhaLoja || ehAdmin || lojaPodeAssumir;

  let taxaEstimada = TAXA_LOJA_PADRAO;
  if (c.taxaLoja == null) {
    if (lojaPodeAssumir && minhaLoja) taxaEstimada = minhaLoja.taxaServico;
    else {
      const lojas = await prisma.loja.findMany({ where: { ativa: true }, select: { cidade: true, taxaServico: true } });
      const daCidade = lojas.filter((l) => normalizar(l.cidade) === normalizar(c.cidade)).map((l) => l.taxaServico);
      if (daCidade.length) taxaEstimada = Math.max(...daCidade);
    }
  }
  const liq = liquidacaoDaCiranda(c, taxaEstimada);
  const nome = (i: number) => {
    const n = c.elos[i].intencao.usuario.nome;
    return veDados ? n : primeiroNome(n);
  };
  const etapaAtual = ETAPAS.findIndex((e) => e.status === c.status);
  const meu = ehParticipante ? c.elos[minhaPos] : null;
  const minhaLinha = ehParticipante ? liq.linhas[minhaPos] : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={ehParticipante ? "/painel" : u.perfil === "loja" ? "/loja" : "/admin/cirandas"} className="text-sm text-app-muted">
          ← Voltar
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold">{c.codigo}</h1>
          <BadgeCiranda status={c.status} />
          {aguardaRespostaDosParticipantes(c.status) && <span className="text-sm text-app-muted">⏱ {tempoRestante(c.prazo)}</span>}
        </div>
        <p className="text-sm text-app-muted">
          Roda de {c.elos.length} participantes · {c.cidade} · formada em {dataHora(c.criadoEm)}
          {c.loja && ` · conduzida por ${c.loja.nome}`}
        </p>
      </div>

      {searchParams.nova && c.status === "proposta" && (
        <div className="card border-app-primary/50 bg-app-primary/10 p-4">
          <p className="text-lg font-bold">🎉 Encontramos uma ciranda para você!</p>
          <p className="text-sm text-app-muted">
            Confira quem entrega o quê e o seu acerto estimado. Quando todos aceitarem, uma loja parceira assume a vistoria.
          </p>
        </div>
      )}

      {c.status === "cancelada" && (
        <div className="card border-app-muted/40 p-4 text-sm">
          <p className="font-semibold">Ciranda cancelada</p>
          <p className="text-app-muted">{c.motivoCancelamento}</p>
        </div>
      )}

      {c.status !== "cancelada" && (
        <ol className="grid grid-cols-6 gap-1 text-center text-[11px] sm:text-xs">
          {ETAPAS.map((e, i) => (
            <li key={e.status}>
              <div className={`h-1.5 rounded-full ${i <= etapaAtual ? "bg-app-primary" : "bg-app-border"}`} />
              {/* No celular só a etapa atual tem nome (seis rótulos não cabem lado a lado). */}
              <p className={`mt-1 ${i === etapaAtual ? "font-bold text-app-primary" : "hidden text-app-muted sm:block"}`}>{e.rotulo}</p>
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-3 lg:col-span-3">
          <RodaCiranda
            nos={c.elos.map((e, i) => ({ nome: primeiroNome(e.intencao.usuario.nome), destaque: i === minhaPos }))}
            recebe={c.elos.map((e) =>
              e.veiculoRecebido
                ? {
                    titulo: `${e.veiculoRecebido.marca} ${e.veiculoRecebido.modelo} ${e.veiculoRecebido.cor}`,
                    sub: `${e.veiculoRecebido.anoModelo} · ${km(e.veiculoRecebido.km)}`,
                  }
                : null,
            )}
          />
          <p className="px-2 pb-1 text-center text-xs text-app-muted">
            Cada seta é um carro indo para o próximo dono. Linha tracejada = pagamento em dinheiro.
          </p>
        </section>

        <aside className="space-y-4 lg:col-span-2">
          {meu && minhaLinha && (
            <section className="card p-4">
              <h2 className="font-bold">Sua parte</h2>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-app-muted">Você entrega</dt>
                  <dd className="text-right">
                    {meu.veiculoEntregue ? `${nomeCarro(meu.veiculoEntregue)} · ${reais(valorAtual(meu))}` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-app-muted">Você recebe</dt>
                  <dd className="text-right">
                    {meu.veiculoRecebido
                      ? `${nomeCarro(meu.veiculoRecebido)} · ${reais(liq.itens[minhaPos].valorRecebido)}`
                      : "o valor em dinheiro"}
                  </dd>
                </div>
                {meu.desejoAtendido && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-app-muted">Atende sua</dt>
                    <dd>{meu.desejoAtendido}ª opção</dd>
                  </div>
                )}
                {/* Ótica de extrato: positivo = dinheiro a seu favor. */}
                <div className="flex justify-between gap-2 border-t border-app-border pt-1.5">
                  <dt className="text-app-muted">{minhaLinha.diferenca > 0 ? "Diferença que você paga" : "Diferença a seu favor"}</dt>
                  <dd className="tabular-nums">{reaisComSinal(-minhaLinha.diferenca)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-app-muted">Comissão da plataforma ({percentual(c.taxaPlataforma)})</dt>
                  <dd className="tabular-nums">{reaisComSinal(-minhaLinha.taxaPlataforma)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-app-muted">
                    Taxa da loja ({percentual(liq.taxaLoja)}
                    {liq.taxaLojaEhEstimativa ? ", estimada" : ""})
                  </dt>
                  <dd className="tabular-nums">{reaisComSinal(-minhaLinha.taxaLoja)}</dd>
                </div>
                <div className={`flex justify-between gap-2 border-t border-app-border pt-1.5 font-bold ${minhaLinha.saldo > 0 ? "text-erro" : "text-ok"}`}>
                  <dt>{minhaLinha.saldo > 0 ? "Você paga" : "Você recebe"}</dt>
                  <dd className="tabular-nums">{reais(Math.abs(minhaLinha.saldo))}</dd>
                </div>
              </dl>
              {meu.veiculoEntregue && meu.valorAvaliado == null && c.status !== "concluida" && (
                <p className="mt-2 text-xs text-app-muted">Valores ainda sujeitos à vistoria da loja.</p>
              )}

              {c.status === "proposta" && meu.aceite === "pendente" && (
                <div className="mt-4 space-y-2">
                  <form action={responderProposta.bind(null, c.id, true)}>
                    <button className="btn-primary w-full">Aceitar a proposta</button>
                  </form>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-center text-app-muted">Não quero este carro</summary>
                    <form action={responderProposta.bind(null, c.id, false)} className="mt-2 space-y-2">
                      <textarea name="motivo" className="input" rows={2} placeholder="Por quê? (opcional — ajuda a melhorar as próximas)" />
                      <button className="btn-danger w-full">Recusar</button>
                      <p className="text-xs text-app-muted">
                        A ciranda é cancelada, os outros voltam para a fila e este carro não será proposto de novo para você.
                      </p>
                    </form>
                  </details>
                </div>
              )}
              {c.status === "proposta" && meu.aceite === "aceito" && (
                <p className="mt-3 rounded-lg bg-ok/10 p-2 text-center text-sm text-ok">Você aceitou. Aguardando os demais.</p>
              )}
              {c.status === "confirmacao_final" && meu.confirmacao === "pendente" && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm">A loja validou todos os carros. Confirme com os valores finais acima:</p>
                  <form action={confirmarFinal.bind(null, c.id, true)}>
                    <button className="btn-primary w-full">Confirmar e fechar negócio</button>
                  </form>
                  <form action={confirmarFinal.bind(null, c.id, false)}>
                    <button className="btn-secondary w-full text-erro">Desistir</button>
                  </form>
                </div>
              )}
              {c.status === "confirmacao_final" && meu.confirmacao === "confirmado" && (
                <p className="mt-3 rounded-lg bg-ok/10 p-2 text-center text-sm text-ok">Confirmado. Aguardando os demais.</p>
              )}
              {c.status === "aguardando_loja" && (
                <p className="mt-3 rounded-lg bg-ok/10 p-2 text-sm text-ok">
                  Todos aceitaram! 🎉 Agora uma loja parceira da cidade assume a ciranda e agenda a vistoria dos carros.
                </p>
              )}
              {c.status === "em_avaliacao" && (
                <p className="mt-3 rounded-lg bg-app-primary/10 p-2 text-sm">
                  {c.loja?.nome} está avaliando os carros e vai chamar você no celular para agendar a vistoria
                  {c.loja?.telefone ? ` (${c.loja.telefone})` : ""}.
                </p>
              )}
              {c.status === "em_liquidacao" && (
                <p className="mt-3 rounded-lg bg-app-primary/10 p-2 text-sm">
                  {c.loja?.nome} vai entrar em contato para o pagamento e a transferência
                  {c.loja?.telefone ? ` (${c.loja.telefone})` : ""}.
                </p>
              )}
              {c.status === "concluida" && (
                <p className="mt-3 rounded-lg bg-ok/10 p-2 text-sm text-ok">
                  Ciranda concluída. {meu.veiculoRecebido ? `Boas viagens com o ${nomeCarro(meu.veiculoRecebido, false)}!` : "Venda realizada."}
                </p>
              )}
            </section>
          )}

          {veTodosValores && (
            <section className="card p-4">
              <h2 className="font-bold">Números da ciranda</h2>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-app-muted">Valor bruto dos carros</dt>
                  <dd className="tabular-nums">{reais(liq.valorBruto)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-app-muted">Troco entre clientes</dt>
                  <dd className="tabular-nums">{reais(liq.trocoMovimentado)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-app-muted">Receita da loja ({percentual(liq.taxaLoja)})</dt>
                  <dd className="tabular-nums">{reais(liq.receitaLoja)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-app-muted">Comissão da plataforma ({percentual(c.taxaPlataforma)})</dt>
                  <dd className="tabular-nums">{reais(liq.receitaPlataforma)}</dd>
                </div>
                <div className="flex justify-between border-t border-app-border pt-1.5">
                  <dt className="text-app-muted">A receber dos clientes</dt>
                  <dd className="tabular-nums">{reais(liq.entradas)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-app-muted">A pagar aos clientes</dt>
                  <dd className="tabular-nums">{reais(liq.saidas)}</dd>
                </div>
              </dl>
              {lojaPodeAssumir && (
                <form action={assumirCiranda.bind(null, c.id)} className="mt-4">
                  <button className="btn-primary w-full">Assumir esta ciranda</button>
                  <p className="mt-1 text-xs text-app-muted">
                    Você passa a ver os contatos, agenda as vistorias e conduz a formalização.
                  </p>
                </form>
              )}
            </section>
          )}
        </aside>
      </div>

      <section className="card overflow-hidden">
        <h2 className="border-b border-app-border p-4 font-bold">Participantes</h2>
        <ul className="divide-y divide-app-border">
          {c.elos.map((e, i) => {
            const l = liq.linhas[i];
            const lojaAvalia = ehMinhaLoja && c.status === "em_avaliacao" && e.veiculoEntregue && e.avaliacao === "pendente";
            return (
              <li key={e.id} className={`p-4 ${i === minhaPos ? "bg-app-primary/5" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {nome(i)} {i === minhaPos && <span className="text-app-primary">(você)</span>}
                    </p>
                    {veDados && (
                      <p className="text-xs text-app-muted">
                        {e.intencao.usuario.telefone} · {e.intencao.usuario.email}
                      </p>
                    )}
                    <p className="mt-1 text-sm">
                      Entrega:{" "}
                      {e.veiculoEntregue ? (
                        <>
                          <strong>{nomeCarro(e.veiculoEntregue)}</strong> · {km(e.veiculoEntregue.km)} ·{" "}
                          {CAMBIO_LABEL[e.veiculoEntregue.cambio] ?? e.veiculoEntregue.cambio}
                          {e.veiculoEntregue.versao ? ` · ${e.veiculoEntregue.versao}` : ""}
                          {veDados && e.veiculoEntregue.placa ? ` · placa ${e.veiculoEntregue.placa}` : ""}
                        </>
                      ) : (
                        "pagamento em dinheiro"
                      )}
                    </p>
                    <p className="text-sm">
                      Recebe:{" "}
                      {e.veiculoRecebido ? (
                        <>
                          {nomeCarro(e.veiculoRecebido)} <span className="text-app-muted">de {nome((i + 1) % c.elos.length)}</span>
                        </>
                      ) : (
                        <>o valor em dinheiro <span className="text-app-muted">(pago via loja)</span></>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.status === "proposta" && (
                      <Selo ok={e.aceite === "aceito"} pendente={e.aceite === "pendente"} texto={e.aceite === "aceito" ? "Aceitou" : e.aceite === "pendente" ? "Aguardando aceite" : "Recusou"} />
                    )}
                    {e.veiculoEntregue && ["em_avaliacao", "confirmacao_final", "em_liquidacao", "concluida"].includes(c.status) && (
                      <Selo ok={e.avaliacao === "aprovado"} pendente={e.avaliacao === "pendente"} texto={e.avaliacao === "aprovado" ? "Carro aprovado" : e.avaliacao === "pendente" ? "Vistoria pendente" : "Carro reprovado"} />
                    )}
                    {c.status === "confirmacao_final" && (
                      <Selo ok={e.confirmacao === "confirmado"} pendente={e.confirmacao === "pendente"} texto={e.confirmacao === "confirmado" ? "Confirmou" : "Aguardando confirmação"} />
                    )}
                    {["em_liquidacao", "concluida"].includes(c.status) && (
                      <>
                        <Selo ok={e.pagamentoOk} pendente texto={e.pagamentoOk ? "Acerto feito" : "Acerto pendente"} />
                        {e.veiculoEntregue && <Selo ok={e.transferenciaOk} pendente texto={e.transferenciaOk ? "Transferido" : "Transferência pendente"} />}
                      </>
                    )}
                  </div>
                </div>

                {veTodosValores && (
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-app-muted tabular-nums">
                    {e.veiculoEntregue && (
                      <span>
                        Valor: {reais(valorAtual(e))}
                        {e.valorAvaliado != null && e.valorAvaliado !== e.valorProposta && ` (proposta ${reais(e.valorProposta)})`}
                        {e.veiculoEntregue.valorFipe ? ` · FIPE ${reais(e.veiculoEntregue.valorFipe)}` : ""}
                      </span>
                    )}
                    <span>Troco {reaisComSinal(l.diferenca)}</span>
                    <span>Taxas {reais(l.taxaPlataforma + l.taxaLoja)}</span>
                    <span className={`font-semibold ${l.saldo > 0 ? "text-erro" : "text-ok"}`}>
                      {l.saldo > 0 ? `Cobrar ${reais(l.saldo)}` : `Pagar ${reais(-l.saldo)}`}
                    </span>
                  </div>
                )}

                {e.obsAvaliacao && (veTodosValores || i === minhaPos) && (
                  <p className="mt-2 text-xs text-app-muted">Obs. da vistoria: {e.obsAvaliacao}</p>
                )}

                {lojaAvalia && e.veiculoEntregue && (
                  <div className="mt-3 space-y-3 rounded-lg border border-app-border bg-app-bg p-3">
                    <p className="text-sm font-semibold">Vistoria do {nomeCarro(e.veiculoEntregue)}</p>
                    {/* Aprovação e reprovação em formulários separados: cada um exige
                        no próprio navegador o que precisa (checklist ou motivo). */}
                    <form action={avaliarVeiculo.bind(null, e.id)} className="space-y-3">
                      <input type="hidden" name="decisao" value="aprovar" />
                      <div className="grid gap-2 sm:grid-cols-2">
                        {CHECKLIST.map((it) => (
                          <label key={it.campo} className="flex items-start gap-2 text-sm">
                            <input type="checkbox" name={it.campo} className="mt-1" required />
                            {it.rotulo}
                          </label>
                        ))}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="label" htmlFor={`va-${e.id}`}>Valor avaliado (R$)</label>
                          <input
                            id={`va-${e.id}`}
                            name="valorAvaliado"
                            className="input"
                            inputMode="numeric"
                            defaultValue={e.valorProposta}
                            required
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="label" htmlFor={`ob-${e.id}`}>Observações (opcional)</label>
                          <input id={`ob-${e.id}`} name="obsAvaliacao" className="input" placeholder="ex.: pneus trocados; para-choque com retoque" />
                        </div>
                      </div>
                      <button className="btn-primary">Aprovar carro</button>
                      <p className="text-xs text-app-muted">
                        Se só o valor mudou, aprove com o valor correto — todos confirmam os valores finais antes de fechar.
                      </p>
                    </form>
                    <details className="text-sm">
                      <summary className="cursor-pointer text-erro">Reprovar este carro</summary>
                      <form action={avaliarVeiculo.bind(null, e.id)} className="mt-2 space-y-2">
                        <input type="hidden" name="decisao" value="reprovar" />
                        <input name="obsAvaliacao" className="input" placeholder="Motivo (o dono vê esta mensagem)" required />
                        <button className="btn-danger">Reprovar e cancelar a ciranda</button>
                        <p className="text-xs text-app-muted">
                          O dono é avisado para regularizar e os demais participantes voltam à fila.
                        </p>
                      </form>
                    </details>
                  </div>
                )}

                {ehMinhaLoja && c.status === "em_liquidacao" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={marcarLiquidacao.bind(null, e.id, "pagamentoOk")}>
                      <button className="btn-secondary !py-1.5 text-xs">
                        {e.pagamentoOk ? "↺ Desfazer acerto" : l.saldo > 0 ? `✓ Recebi ${reais(l.saldo)}` : `✓ Paguei ${reais(-l.saldo)}`}
                      </button>
                    </form>
                    {e.veiculoEntregue && (
                      <form action={marcarLiquidacao.bind(null, e.id, "transferenciaOk")}>
                        <button className="btn-secondary !py-1.5 text-xs">
                          {e.transferenciaOk ? "↺ Desfazer transferência" : "✓ Transferência (ATPV-e) registrada"}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {ehMinhaLoja && c.status === "em_liquidacao" && (
          <div className="border-t border-app-border p-4">
            <form action={concluirCiranda.bind(null, c.id)}>
              <button className="btn-primary" disabled={!podeConcluir(c.elos)}>
                Concluir ciranda
              </button>
            </form>
            {!podeConcluir(c.elos) && (
              <p className="mt-1 text-xs text-app-muted">Registre todos os acertos e transferências para concluir.</p>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-bold">Histórico</h2>
          <ol className="mt-3 space-y-3 border-l border-app-border pl-4 text-sm">
            {c.eventos.map((ev) => (
              <li key={ev.id}>
                <p>{ev.descricao}</p>
                <p className="text-xs text-app-muted">{dataHora(ev.criadoEm)}</p>
              </li>
            ))}
          </ol>
        </section>

        {(ehMinhaLoja || ehAdmin) && c.status !== "concluida" && c.status !== "cancelada" && (
          <section className="card p-4">
            <h2 className="font-bold">Cancelar ciranda</h2>
            <form action={cancelarPelaOperacao.bind(null, c.id)} className="mt-3 space-y-2">
              <input name="motivo" className="input" placeholder="Motivo (fica visível para os participantes)" required />
              <button className="btn-danger">Cancelar e devolver todos à fila</button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
