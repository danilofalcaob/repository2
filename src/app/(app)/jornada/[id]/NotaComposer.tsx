"use client";
import { useRef, useState, useTransition } from "react";
import VoiceInput from "@/components/VoiceInput";
import { DISCIPLINAS, DISCIPLINA_LABEL, TIPO_INTERACAO_LABEL } from "@/lib/constants";
import { registrarInteracao } from "../actions";

const TIPOS_DISPONIVEIS = ["nota", "decisao", "familia", "alerta"] as const;

// Campo de registro na timeline do caso. Menções (@fisioterapia) direcionam o
// recado a uma disciplina — é o que substitui o "avisa lá no corredor".
export default function NotaComposer({ jornadaId }: { jornadaId: string }) {
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<string>("nota");
  const [pendente, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  function enviar() {
    const conteudo = texto.trim();
    if (!conteudo) return;
    const fd = new FormData();
    fd.set("jornadaId", jornadaId);
    fd.set("tipo", tipo);
    fd.set("texto", conteudo);
    startTransition(async () => {
      await registrarInteracao(fd);
      setTexto("");
    });
  }

  function mencionar(disciplina: string) {
    setTexto((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}@${disciplina} `);
    ref.current?.focus();
  }

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        className="input"
        placeholder="Registre a decisão, a conversa com a família ou o pedido a outra equipe. Use @disciplina para direcionar (ex.: @servico_social)."
      />

      <div className="flex flex-wrap items-center gap-1">
        {DISCIPLINAS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => mencionar(d)}
            className="badge bg-clinic-bg text-clinic-muted hover:text-clinic-primary"
            title={`Mencionar ${DISCIPLINA_LABEL[d]}`}
          >
            @{DISCIPLINA_LABEL[d]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="input !w-auto !py-1.5 text-xs"
          aria-label="Tipo de registro"
        >
          {TIPOS_DISPONIVEIS.map((t) => (
            <option key={t} value={t}>
              {TIPO_INTERACAO_LABEL[t]}
            </option>
          ))}
        </select>
        <VoiceInput onTexto={(t) => setTexto((atual) => (atual ? `${atual} ${t}` : t))} />
        <button
          type="button"
          onClick={enviar}
          disabled={pendente || !texto.trim()}
          className="btn-primary ml-auto !py-2 text-sm"
        >
          {pendente ? "Registrando…" : "Registrar"}
        </button>
      </div>
    </div>
  );
}
