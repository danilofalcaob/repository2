"use client";
import { useState, useTransition } from "react";
import { vincularLeito } from "./actions";

export default function VincularLeito({ pacienteId, leitosLivres }: { pacienteId: string; leitosLivres: string[] }) {
  const [leito, setLeito] = useState(leitosLivres[0] ?? "");
  const [erro, setErro] = useState("");
  const [pendente, startTransition] = useTransition();

  if (!leitosLivres.length) return <span className="text-xs text-clinic-muted">sem leito livre</span>;

  return (
    <span className="inline-flex items-center gap-2">
      <select className="input !w-auto !py-1 text-xs" value={leito} onChange={(e) => setLeito(e.target.value)} aria-label="Leito">
        {leitosLivres.map((l) => (
          <option key={l} value={l}>
            Leito {l}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn-secondary !py-1 text-xs"
        disabled={pendente}
        onClick={() =>
          startTransition(async () => {
            const r = await vincularLeito(pacienteId, leito);
            if (!r.ok) setErro(r.erro);
          })
        }
      >
        Vincular
      </button>
      {erro && <span className="text-xs text-instavel">{erro}</span>}
    </span>
  );
}
