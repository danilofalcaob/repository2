"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  COR_ETAPA,
  ETAPAS_JORNADA,
  ETAPA_DESCRICAO,
  ETAPA_LABEL,
  type EtapaJornada,
} from "@/lib/constants";
import type { JornadaCard } from "@/lib/jornada-queries";
import { BadgeDAP, BarraProntidao, ChipsAlertas } from "@/components/JornadaBadges";
import { moverEtapa } from "./actions";

// Quadro do funil. Arrastar o cartão entre colunas move a jornada de etapa; em
// telas pequenas (ou com teclado) o mesmo é feito pelo seletor "mover para".
export default function FunilBoard({ cards }: { cards: JornadaCard[] }) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<EtapaJornada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function mover(jornadaId: string, destino: EtapaJornada) {
    setErro(null);
    startTransition(async () => {
      const r = await moverEtapa(jornadaId, destino);
      if (!r.ok) setErro(r.erro ?? "Não foi possível mover o caso.");
    });
  }

  const colunas = ETAPAS_JORNADA.map((etapa) => ({
    etapa,
    cards: cards.filter((c) => c.etapa === etapa),
  }));

  return (
    <div className="space-y-3">
      {erro && (
        <div
          role="alert"
          className="rounded-lg border border-instavel/40 bg-instavel/10 px-3 py-2 text-sm text-instavel"
        >
          {erro}
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex min-w-max gap-3">
          {colunas.map(({ etapa, cards: doEstagio }) => (
            <section
              key={etapa}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(etapa);
              }}
              onDragLeave={() => setSobre((s) => (s === etapa ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setSobre(null);
                const id = e.dataTransfer.getData("text/plain") || arrastando;
                if (id) {
                  const card = cards.find((c) => c.id === id);
                  if (card && card.etapa !== etapa) mover(id, etapa);
                }
                setArrastando(null);
              }}
              className={`w-[280px] shrink-0 rounded-xl border p-2 transition ${
                sobre === etapa
                  ? "border-clinic-primary bg-clinic-primary/5"
                  : "border-clinic-border bg-clinic-bg/40"
              }`}
            >
              <header className="mb-2 px-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-1.5 text-sm font-bold">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: COR_ETAPA[etapa] }}
                    />
                    {ETAPA_LABEL[etapa]}
                  </h2>
                  <span className="badge bg-clinic-surface text-clinic-muted">{doEstagio.length}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-clinic-muted">
                  {ETAPA_DESCRICAO[etapa]}
                </p>
              </header>

              <ul className="space-y-2">
                {doEstagio.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c.id);
                      e.dataTransfer.effectAllowed = "move";
                      setArrastando(c.id);
                    }}
                    onDragEnd={() => setArrastando(null)}
                    className={`card p-3 transition ${
                      arrastando === c.id ? "opacity-50" : ""
                    } ${
                      c.alertas.some((a) => a.nivel === "critico") ? "ring-1 ring-instavel/40" : ""
                    } ${pendente ? "pointer-events-none" : "cursor-grab active:cursor-grabbing"}`}
                  >
                    <Link href={`/jornada/${c.id}`} className="block">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{c.identificador}</p>
                          <p className="text-[11px] text-clinic-muted">
                            Leito {c.leito ?? "—"} · {c.diasInternacao}d de internação
                          </p>
                        </div>
                        {c.barreirasAbertas > 0 && (
                          <span
                            className={`badge ${
                              c.barreirasNaoClinicas > 0
                                ? "bg-cuidado/15 text-cuidado"
                                : "bg-clinic-primary/15 text-clinic-primary"
                            }`}
                            title={`${c.barreirasAbertas} barreira(s) aberta(s)`}
                          >
                            🚧 {c.barreirasAbertas}
                          </span>
                        )}
                      </div>

                      {c.diagnostico && (
                        <p className="mt-1 line-clamp-1 text-xs text-clinic-text">{c.diagnostico}</p>
                      )}

                      <div className="mt-2">
                        <BadgeDAP situacao={c.situacaoDAP} data={c.dataAltaPrevista} />
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
                          <ChipsAlertas alertas={c.alertas} max={2} />
                        </div>
                      )}

                      <p className="mt-2 truncate text-[11px] text-clinic-muted">
                        👤 {c.gestorNome ?? "sem gestor do caso"}
                        {c.tarefasAbertas > 0 ? ` · ${c.tarefasAbertas} tarefa(s)` : ""}
                      </p>
                    </Link>

                    {/* O rótulo vai no aria-label: um <span class="sr-only"> aqui
                        escaparia do contêiner de rolagem (position: absolute sem
                        ancestral posicionado) e alargaria a página no celular. */}
                    <div className="mt-2">
                      <select
                        className="input !py-1.5 text-xs"
                        aria-label={`Mover ${c.identificador} para outra etapa`}
                        value={c.etapa}
                        disabled={pendente}
                        onChange={(e) => mover(c.id, e.target.value as EtapaJornada)}
                      >
                        {ETAPAS_JORNADA.map((e) => (
                          <option key={e} value={e}>
                            {e === c.etapa ? `● ${ETAPA_LABEL[e]}` : `Mover para: ${ETAPA_LABEL[e]}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}

                {doEstagio.length === 0 && (
                  <li className="rounded-lg border border-dashed border-clinic-border p-4 text-center text-[11px] text-clinic-muted">
                    Nenhum caso nesta etapa
                  </li>
                )}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
