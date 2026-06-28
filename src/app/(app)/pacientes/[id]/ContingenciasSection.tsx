"use client";
import { useState, useTransition } from "react";
import { criarContingencia, dispararContingencia, resolverContingencia } from "../actions";
import { BadgeStatusContingencia, BadgePrioridade } from "@/components/Badges";
import { formatarDataHora } from "@/lib/format";

type Cont = {
  id: string;
  parametro: string;
  limiar: string;
  acao: string;
  prioridade: string;
  status: string;
  lembreteEm: string | null;
  reconhecidaPor: string | null;
};

export default function ContingenciasSection({
  pacienteId,
  contingencias,
}: {
  pacienteId: string;
  contingencias: Cont[];
}) {
  const [aberto, setAberto] = useState(false);
  const [pendente, startTransition] = useTransition();

  const ativas = contingencias.filter((c) => c.status === "ativa" || c.status === "disparada");
  const resolvidas = contingencias.filter((c) => c.status === "resolvida" || c.status === "reconhecida");

  function enviar(fd: FormData) {
    fd.set("pacienteId", pacienteId);
    startTransition(async () => {
      await criarContingencia(fd);
      setAberto(false);
    });
  }

  return (
    <section className="card border-instavel/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">🛡️ Contingências (S — Rede de segurança)</h2>
        <button className="btn-secondary !py-1.5 text-xs" onClick={() => setAberto((v) => !v)}>
          ＋ Nova contingência
        </button>
      </div>

      {aberto && (
        <form action={enviar} className="mb-4 space-y-2 rounded-lg border border-clinic-border p-3">
          <p className="text-xs text-clinic-muted">
            Estruture como <strong>parâmetro + limiar → ação</strong>.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="parametro" className="input" placeholder="Parâmetro (ex.: SatO₂) *" required />
            <input name="limiar" className="input" placeholder="Limiar (ex.: < 90%) *" required />
          </div>
          <input name="acao" className="input" placeholder="Ação esperada *" required />
          <div className="grid gap-2 sm:grid-cols-2">
            <select name="prioridade" className="input" defaultValue="alta">
              <option value="alta">Prioridade alta</option>
              <option value="media">Prioridade média</option>
              <option value="baixa">Prioridade baixa</option>
            </select>
            <input name="lembreteEm" type="datetime-local" className="input" title="Lembrete (opcional)" />
          </div>
          <button className="btn-primary !py-1.5 text-xs" disabled={pendente}>
            {pendente ? "Salvando…" : "Adicionar"}
          </button>
        </form>
      )}

      {ativas.length === 0 && resolvidas.length === 0 && (
        <p className="text-sm text-clinic-muted">Nenhuma contingência cadastrada.</p>
      )}

      <ul className="space-y-2">
        {ativas.map((c) => (
          <li
            key={c.id}
            className={`rounded-lg border p-3 text-sm ${
              c.status === "disparada" ? "border-instavel bg-instavel/10" : "border-instavel/40"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-semibold">
                  {c.parametro} {c.limiar} → {c.acao}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <BadgePrioridade valor={c.prioridade} />
                  <BadgeStatusContingencia valor={c.status} />
                  {c.lembreteEm && (
                    <span className="text-clinic-muted">⏰ lembrete {formatarDataHora(c.lembreteEm)}</span>
                  )}
                  {c.reconhecidaPor && (
                    <span className="text-clinic-muted">✓ reconhecida por {c.reconhecidaPor}</span>
                  )}
                </p>
              </div>
              <div className="flex gap-1">
                {c.status !== "disparada" && (
                  <button
                    onClick={() => startTransition(() => dispararContingencia(c.id))}
                    className="btn-danger !px-2 !py-1 text-xs"
                    disabled={pendente}
                    title="Registrar que o gatilho ocorreu"
                  >
                    ⚡ Gatilho ocorreu
                  </button>
                )}
                <button
                  onClick={() => startTransition(() => resolverContingencia(c.id))}
                  className="btn-secondary !px-2 !py-1 text-xs"
                  disabled={pendente}
                >
                  Resolver
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {resolvidas.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-clinic-muted">
            {resolvidas.length} resolvida(s)
          </summary>
          <ul className="mt-2 space-y-1">
            {resolvidas.map((c) => (
              <li key={c.id} className="text-xs text-clinic-muted">
                {c.parametro} {c.limiar} → {c.acao} ({c.status})
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-3 text-[11px] text-clinic-muted">
        Disparo automático a partir de sinal vital ao vivo depende de integração com
        monitor/PEP (fora deste escopo). Aqui o registro é manual/estruturado, com a
        arquitetura preparada para essa automação futura.
      </p>
    </section>
  );
}
