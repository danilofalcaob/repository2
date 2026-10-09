"use client";
import { useTransition } from "react";
import { alternarCriterio } from "../actions";

// Alternador de critério de alta. O clique é otimista do ponto de vista de
// interação (transição), mas o estado real vem sempre do servidor.
export default function CriterioToggle({
  criterioId,
  descricao,
  atendido,
  naoAplicavel,
  avaliadoPor,
}: {
  criterioId: string;
  descricao: string;
  atendido: boolean;
  naoAplicavel: boolean;
  avaliadoPor?: string | null;
}) {
  const [pendente, startTransition] = useTransition();

  function alternar(campo: "atendido" | "naoAplicavel") {
    startTransition(async () => {
      await alternarCriterio(criterioId, campo);
    });
  }

  return (
    <li
      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${
        naoAplicavel ? "opacity-50" : atendido ? "bg-estavel/10" : ""
      } ${pendente ? "animate-pulse" : ""}`}
    >
      <button
        type="button"
        onClick={() => alternar("atendido")}
        disabled={pendente || naoAplicavel}
        role="checkbox"
        aria-checked={atendido}
        aria-label={`Critério atendido: ${descricao}`}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
          atendido
            ? "border-estavel bg-estavel text-white"
            : "border-clinic-border bg-clinic-surface"
        } disabled:cursor-not-allowed`}
      >
        {atendido ? "✓" : ""}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${naoAplicavel ? "line-through" : ""}`}>{descricao}</p>
        {atendido && avaliadoPor && (
          <p className="text-[11px] text-clinic-muted">Validado por {avaliadoPor}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => alternar("naoAplicavel")}
        disabled={pendente}
        className="shrink-0 text-[11px] text-clinic-muted underline hover:text-clinic-text"
        title="Marcar que este critério não se aplica a este caso"
      >
        {naoAplicavel ? "aplicar" : "n/a"}
      </button>
    </li>
  );
}
