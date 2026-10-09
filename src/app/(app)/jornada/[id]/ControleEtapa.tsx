"use client";
import { useState, useTransition } from "react";
import { COR_ETAPA, ETAPAS_JORNADA, ETAPA_LABEL, type EtapaJornada } from "@/lib/constants";
import { moverEtapa } from "../actions";

// Trilha do funil + controle de movimentação, com o motivo da mudança e o
// retorno da regra de segurança quando a alta não pode ser efetivada.
export default function ControleEtapa({
  jornadaId,
  etapaAtual,
  encerrada,
}: {
  jornadaId: string;
  etapaAtual: EtapaJornada;
  encerrada: boolean;
}) {
  const [destino, setDestino] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function mover(alvo: string) {
    if (!alvo) return;
    setErro(null);
    startTransition(async () => {
      const r = await moverEtapa(jornadaId, alvo, motivo || undefined);
      if (r.ok) {
        setDestino("");
        setMotivo("");
      } else {
        setErro(r.erro ?? "Não foi possível mover o caso.");
      }
    });
  }

  const indiceAtual = ETAPAS_JORNADA.indexOf(etapaAtual);

  return (
    <div className="space-y-2">
      <ol className="flex flex-wrap items-center gap-1">
        {ETAPAS_JORNADA.map((e, i) => {
          const passada = i < indiceAtual;
          const atual = i === indiceAtual;
          return (
            <li key={e} className="flex items-center gap-1">
              <button
                type="button"
                disabled={encerrada || pendente || atual}
                onClick={() => mover(e)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  atual
                    ? "text-white"
                    : passada
                      ? "bg-clinic-bg text-clinic-muted hover:text-clinic-text"
                      : "bg-clinic-bg text-clinic-muted hover:text-clinic-text"
                } disabled:cursor-default`}
                style={atual ? { backgroundColor: COR_ETAPA[e] } : undefined}
                title={atual ? "Etapa atual" : `Mover para ${ETAPA_LABEL[e]}`}
              >
                {ETAPA_LABEL[e]}
              </button>
              {i < ETAPAS_JORNADA.length - 1 && (
                <span aria-hidden className="text-clinic-muted">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {!encerrada && (
        <div className="flex flex-wrap items-end gap-2">
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="input min-w-[200px] flex-1 !py-2 text-sm"
            placeholder="Motivo da mudança de etapa (opcional)"
          />
          <select
            value={destino}
            onChange={(e) => {
              setDestino(e.target.value);
              mover(e.target.value);
            }}
            disabled={pendente}
            className="input !w-auto !py-2 text-sm"
            aria-label="Mover para etapa"
          >
            <option value="">Mover para…</option>
            {ETAPAS_JORNADA.filter((e) => e !== etapaAtual).map((e) => (
              <option key={e} value={e}>
                {ETAPA_LABEL[e]}
              </option>
            ))}
          </select>
        </div>
      )}

      {erro && (
        <p role="alert" className="rounded-lg bg-instavel/10 px-3 py-2 text-sm text-instavel">
          {erro}
        </p>
      )}
    </div>
  );
}
