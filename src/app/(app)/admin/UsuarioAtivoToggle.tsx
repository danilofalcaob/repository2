"use client";
import { useTransition } from "react";
import { alternarUsuarioAtivo } from "./actions";

export default function UsuarioAtivoToggle({
  usuarioId,
  ativo,
  ehProprio,
}: {
  usuarioId: string;
  ativo: boolean;
  ehProprio: boolean;
}) {
  const [pendente, startTransition] = useTransition();
  if (ehProprio) {
    return <span className="badge bg-estavel/15 text-estavel">Você</span>;
  }
  return (
    <button
      className={`badge ${ativo ? "bg-estavel/15 text-estavel" : "bg-instavel/15 text-instavel"}`}
      disabled={pendente}
      onClick={() => startTransition(() => alternarUsuarioAtivo(usuarioId, !ativo))}
    >
      {ativo ? "Ativo" : "Inativo"} {pendente ? "…" : ""}
    </button>
  );
}
