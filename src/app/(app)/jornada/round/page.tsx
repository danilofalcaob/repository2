import Link from "next/link";
import { getUsuarioAtual } from "@/lib/auth";
import { getSetoresDoUsuario } from "@/lib/queries";
import { getJornadasDoFunil, getRevisadosNoRoundHoje } from "@/lib/jornada-queries";
import { prisma } from "@/lib/db";
import {
  CATEGORIAS_BARREIRA,
  CATEGORIA_BARREIRA_CLINICA,
  CATEGORIA_BARREIRA_LABEL,
  CONFIANCAS,
  CONFIANCA_LABEL,
  ETAPAS_JORNADA,
  ETAPA_LABEL,
  type EtapaJornada,
} from "@/lib/constants";
import { formatarData } from "@/lib/format";
import { proximaEtapa } from "@/lib/jornada";
import { BadgeDAP, BadgeEtapa, BarraProntidao, ChipsAlertas } from "@/components/JornadaBadges";
import BotaoAcao from "@/components/BotaoAcao";
import { mudarStatusBarreira, registrarRound } from "../actions";

export const dynamic = "force-dynamic";

export default async function RoundPage({
  searchParams,
}: {
  searchParams: { setor?: string; pendentes?: string };
}) {
  const u = (await getUsuarioAtual())!;
  const setores = await getSetoresDoUsuario(u.setoresIds);
  const setorFiltro =
    searchParams.setor && u.setoresIds.includes(searchParams.setor) ? searchParams.setor : undefined;

  const cards = await getJornadasDoFunil(u.setoresIds, { setorId: setorFiltro });
  const revisados = await getRevisadosNoRoundHoje(cards.map((c) => c.id));

  // Barreiras abertas de todos os casos, para resolver durante o próprio round.
  const barreiras = await prisma.barreira.findMany({
    where: { jornadaId: { in: cards.map((c) => c.id) }, status: { in: ["aberta", "em_andamento"] } },
    orderBy: { abertaEm: "asc" },
  });
  const barreirasPorJornada = new Map<string, typeof barreiras>();
  for (const b of barreiras) {
    barreirasPorJornada.set(b.jornadaId, [...(barreirasPorJornada.get(b.jornadaId) ?? []), b]);
  }

  const somentePendentes = searchParams.pendentes === "1";
  const lista = somentePendentes ? cards.filter((c) => !revisados.has(c.id)) : cards;
  const pct = cards.length ? Math.round((revisados.size / cards.length) * 100) : 0;
  const hoje = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Round multiprofissional</h1>
          <p className="text-sm capitalize text-clinic-muted">{hoje}</p>
        </div>
        <Link href="/jornada" className="btn-secondary">
          ← Funil
        </Link>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            {revisados.size} de {cards.length} casos revisados hoje
          </span>
          <span className="text-clinic-muted">{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-clinic-bg">
          <div
            className="h-full rounded-full bg-clinic-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-clinic-muted">
          Os casos aparecem na ordem em que precisam de decisão: previsão vencida, barreira com prazo
          estourado, paciente pronto travado por processo e casos sem movimentação.
        </p>
      </div>

      <form className="card flex flex-wrap items-end gap-3 p-3" method="get">
        <div className="min-w-[180px] flex-1">
          <label className="label" htmlFor="setor">
            Setor
          </label>
          <select id="setor" name="setor" defaultValue={setorFiltro ?? ""} className="input">
            <option value="">Todos os meus setores</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input
            type="checkbox"
            name="pendentes"
            value="1"
            defaultChecked={somentePendentes}
            className="h-4 w-4"
          />
          Só os ainda não revisados hoje
        </label>
        <button className="btn-secondary" type="submit">
          Aplicar
        </button>
      </form>

      {lista.length === 0 ? (
        <div className="card p-8 text-center text-clinic-muted">
          {somentePendentes
            ? "Todos os casos já foram revisados no round de hoje. 👏"
            : "Nenhum caso ativo no funil."}
        </div>
      ) : (
        <ul className="space-y-3">
          {lista.map((c) => {
            const jaRevisado = revisados.has(c.id);
            const abertas = barreirasPorJornada.get(c.id) ?? [];
            const sugestao = proximaEtapa(c.etapa);
            return (
              <li key={c.id} className="card p-4">
                <details open={!jaRevisado && lista.indexOf(c) < 3}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {jaRevisado && <span title="Revisado hoje">✅ </span>}
                          {c.identificador}
                        </p>
                        <p className="text-xs text-clinic-muted">
                          Leito {c.leito ?? "—"} · {c.diasInternacao}d · {c.diagnostico ?? "sem diagnóstico"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <BadgeEtapa valor={c.etapa} />
                        <BadgeDAP situacao={c.situacaoDAP} data={c.dataAltaPrevista} />
                        {abertas.length > 0 && (
                          <span className="badge bg-cuidado/15 text-cuidado">🚧 {abertas.length}</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <BarraProntidao
                        atendidos={c.prontidao.atendidos}
                        aplicaveis={c.prontidao.aplicaveis}
                        percentual={c.prontidao.percentual}
                        compacta
                      />
                    </div>
                    {c.alertas.length > 0 && (
                      <div className="mt-2">
                        <ChipsAlertas alertas={c.alertas} max={3} />
                      </div>
                    )}
                  </summary>

                  <div className="mt-3 space-y-3 border-t border-clinic-border pt-3">
                    {abertas.length > 0 && (
                      <div>
                        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-clinic-muted">
                          Barreiras em aberto
                        </h3>
                        <ul className="space-y-1.5">
                          {abertas.map((b) => (
                            <li
                              key={b.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-clinic-bg px-2.5 py-2"
                            >
                              <div className="min-w-0 text-xs">
                                <span className="font-semibold">
                                  {CATEGORIA_BARREIRA_LABEL[
                                    b.categoria as keyof typeof CATEGORIA_BARREIRA_LABEL
                                  ] ?? b.categoria}
                                </span>{" "}
                                · {b.descricao}
                                {b.prazo ? ` · prazo ${formatarData(b.prazo)}` : ""}
                              </div>
                              <BotaoAcao
                                acao={mudarStatusBarreira.bind(null, b.id, "resolvida", "Resolvida no round")}
                                className="btn-primary !py-1.5 text-xs"
                              >
                                ✓ Resolver
                              </BotaoAcao>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <form action={registrarRound} className="space-y-3">
                      <input type="hidden" name="jornadaId" value={c.id} />

                      <div>
                        <label className="label" htmlFor={`nota-${c.id}`}>
                          O que a equipe definiu agora?
                        </label>
                        <textarea
                          id={`nota-${c.id}`}
                          name="nota"
                          rows={2}
                          className="input"
                          placeholder="Ex.: mantém ATB até sexta; @servico_social confirma cuidador para sábado."
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="label" htmlFor={`dap-${c.id}`}>
                            Data de alta prevista
                          </label>
                          <input
                            id={`dap-${c.id}`}
                            name="dataAltaPrevista"
                            type="date"
                            defaultValue={
                              c.dataAltaPrevista
                                ? new Date(c.dataAltaPrevista).toISOString().slice(0, 10)
                                : ""
                            }
                            className="input"
                          />
                        </div>
                        <div>
                          <label className="label" htmlFor={`conf-${c.id}`}>
                            Confiança
                          </label>
                          <select
                            id={`conf-${c.id}`}
                            name="confiancaAlta"
                            defaultValue={c.confiancaAlta}
                            className="input"
                          >
                            {CONFIANCAS.map((x) => (
                              <option key={x} value={x}>
                                {CONFIANCA_LABEL[x]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label className="label" htmlFor={`barreira-${c.id}`}>
                            Surgiu alguma barreira?
                          </label>
                          <input
                            id={`barreira-${c.id}`}
                            name="barreiraDescricao"
                            className="input"
                            placeholder="Descreva o que trava a alta (opcional)"
                          />
                        </div>
                        <div>
                          <label className="label" htmlFor={`barreira-cat-${c.id}`}>
                            Categoria
                          </label>
                          <select
                            id={`barreira-cat-${c.id}`}
                            name="barreiraCategoria"
                            defaultValue="clinica"
                            className="input"
                          >
                            {CATEGORIAS_BARREIRA.map((cat) => (
                              <option key={cat} value={cat}>
                                {CATEGORIA_BARREIRA_LABEL[cat]}
                                {CATEGORIA_BARREIRA_CLINICA[cat] ? "" : " (não clínica)"}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-end gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="avancar" value="1" className="h-4 w-4" />
                          Avançar etapa para
                        </label>
                        <select
                          name="destino"
                          defaultValue={sugestao ?? c.etapa}
                          className="input !w-auto !py-2 text-sm"
                          aria-label={`Etapa de destino para ${c.identificador}`}
                        >
                          {ETAPAS_JORNADA.filter((e) => e !== c.etapa).map((e) => (
                            <option key={e} value={e}>
                              {ETAPA_LABEL[e as EtapaJornada]}
                            </option>
                          ))}
                        </select>
                        <div className="ml-auto flex gap-2">
                          <Link href={`/jornada/${c.id}`} className="btn-secondary !py-2 text-sm">
                            Abrir caso
                          </Link>
                          <button className="btn-primary !py-2 text-sm">Registrar no round</button>
                        </div>
                      </div>
                    </form>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
