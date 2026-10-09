"use client";
import { useState, useTransition } from "react";

// Botão que dispara uma server action já vinculada aos seus argumentos
// (ex.: mudarStatusTarefa.bind(null, id, "concluida")), com estado de
// carregamento, confirmação opcional e mensagem de erro no lugar da ação.
export default function BotaoAcao({
  acao,
  children,
  className = "btn-secondary !py-1.5 text-xs",
  confirmar,
  titulo,
}: {
  acao: () => Promise<void | { ok: boolean; erro?: string }>;
  children: React.ReactNode;
  className?: string;
  confirmar?: string;
  titulo?: string;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function executar() {
    if (confirmar && !window.confirm(confirmar)) return;
    setErro(null);
    startTransition(async () => {
      const r = await acao();
      if (r && typeof r === "object" && r.ok === false) {
        setErro(r.erro ?? "Não foi possível concluir a ação.");
      }
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={executar} disabled={pendente} className={className} title={titulo}>
        {pendente ? "…" : children}
      </button>
      {erro && <span className="text-[11px] text-instavel">{erro}</span>}
    </span>
  );
}
