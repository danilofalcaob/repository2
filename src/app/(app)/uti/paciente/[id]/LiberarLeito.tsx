"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { liberarLeito } from "../../actions";

export default function LiberarLeito({ pacienteId, leito }: { pacienteId: string; leito: string | null }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [pendente, startTransition] = useTransition();

  function liberar(desfecho: string, rotulo: string) {
    if (!window.confirm(`Registrar ${rotulo} e liberar o leito ${leito ?? ""}? Os exames continuam no histórico.`)) return;
    startTransition(async () => {
      const r = await liberarLeito(pacienteId, desfecho);
      if (!r.ok) setErro(r.erro);
      else router.push("/uti");
    });
  }

  if (!aberto) {
    return (
      <button type="button" className="btn-secondary !py-1.5 text-sm" onClick={() => setAberto(true)}>
        Liberar leito
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-clinic-muted">Desfecho:</span>
      <button className="btn-secondary !py-1.5 text-xs" disabled={pendente} onClick={() => liberar("alta", "alta da UTI")}>
        Alta da UTI
      </button>
      <button className="btn-secondary !py-1.5 text-xs" disabled={pendente} onClick={() => liberar("transferido", "transferência")}>
        Transferência
      </button>
      <button className="btn-secondary !py-1.5 text-xs" disabled={pendente} onClick={() => liberar("obito", "óbito")}>
        Óbito
      </button>
      <button className="text-xs text-clinic-muted hover:underline" onClick={() => setAberto(false)}>
        cancelar
      </button>
      {erro && <span className="text-xs text-instavel">{erro}</span>}
    </div>
  );
}
