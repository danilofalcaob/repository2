"use client";
import { useState, useTransition } from "react";
import { criarPendencia, mudarStatusPendencia } from "../actions";
import { BadgePrioridade } from "@/components/Badges";
import { formatarDataHora, tempoRelativo, estaVencida } from "@/lib/format";

type Pend = {
  id: string;
  descricao: string;
  responsavel: string | null;
  prioridade: string;
  status: string;
  herdada: boolean;
  prazo: string | null;
  criadaEm: string;
};

export default function PendenciasSection({
  pacienteId,
  pendencias,
}: {
  pacienteId: string;
  pendencias: Pend[];
}) {
  const [aberto, setAberto] = useState(false);
  const [pendente, startTransition] = useTransition();

  const abertas = pendencias.filter((p) => p.status === "aberta");
  const outras = pendencias.filter((p) => p.status !== "aberta");

  function enviar(fd: FormData) {
    fd.set("pacienteId", pacienteId);
    startTransition(async () => {
      await criarPendencia(fd);
      setAberto(false);
    });
  }

  function alterar(id: string, status: string) {
    startTransition(() => mudarStatusPendencia(id, status));
  }

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pendências (A — Ações)</h2>
        <button className="btn-secondary !py-1.5 text-xs" onClick={() => setAberto((v) => !v)}>
          ＋ Nova pendência
        </button>
      </div>

      {aberto && (
        <form action={enviar} className="mb-4 space-y-2 rounded-lg border border-clinic-border p-3">
          <input name="descricao" className="input" placeholder="Descrição da ação *" required />
          <div className="grid gap-2 sm:grid-cols-3">
            <input name="responsavel" className="input" placeholder="Responsável" />
            <select name="prioridade" className="input" defaultValue="media">
              <option value="baixa">Prioridade baixa</option>
              <option value="media">Prioridade média</option>
              <option value="alta">Prioridade alta</option>
            </select>
            <input name="prazo" type="datetime-local" className="input" />
          </div>
          <button className="btn-primary !py-1.5 text-xs" disabled={pendente}>
            {pendente ? "Salvando…" : "Adicionar"}
          </button>
        </form>
      )}

      {abertas.length === 0 && outras.length === 0 && (
        <p className="text-sm text-clinic-muted">Nenhuma pendência.</p>
      )}

      <ul className="space-y-2">
        {abertas.map((p) => {
          const vencida = estaVencida(p.prazo);
          return (
            <li
              key={p.id}
              className={`rounded-lg border p-3 text-sm ${
                vencida ? "border-instavel/50 bg-instavel/5" : "border-clinic-border"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-medium">{p.descricao}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-clinic-muted">
                    <BadgePrioridade valor={p.prioridade} />
                    {p.responsavel && <span>👤 {p.responsavel}</span>}
                    {p.prazo && (
                      <span className={vencida ? "font-semibold text-instavel" : ""}>
                        ⏰ {formatarDataHora(p.prazo)} {vencida ? "(vencida)" : ""}
                      </span>
                    )}
                    {p.herdada && (
                      <span className="badge bg-cuidado/15 text-cuidado">
                        herdada · aberta {tempoRelativo(p.criadaEm)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => alterar(p.id, "concluida")}
                    className="btn-secondary !px-2 !py-1 text-xs"
                    disabled={pendente}
                  >
                    ✓ Concluir
                  </button>
                  <button
                    onClick={() => alterar(p.id, "cancelada")}
                    className="btn-secondary !px-2 !py-1 text-xs"
                    disabled={pendente}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {outras.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-clinic-muted">
            {outras.length} concluída(s)/cancelada(s)
          </summary>
          <ul className="mt-2 space-y-1">
            {outras.map((p) => (
              <li key={p.id} className="text-xs text-clinic-muted line-through">
                {p.descricao} — {p.status}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
