"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { admitirPaciente } from "./actions";

export default function AdmitirPaciente({ setorId, leito }: { setorId: string; leito: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [pendente, startTransition] = useTransition();

  function enviar(fd: FormData) {
    setErro("");
    startTransition(async () => {
      const r = await admitirPaciente(fd);
      if (!r.ok) setErro(r.erro);
      else router.push(`/uti/paciente/${r.id}`);
    });
  }

  if (!aberto) {
    return (
      <button type="button" className="btn-secondary w-full !py-1.5 text-sm" onClick={() => setAberto(true)}>
        ＋ Admitir paciente
      </button>
    );
  }

  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="setorId" value={setorId} />
      <input type="hidden" name="leito" value={leito} />
      <input name="identificador" className="input !py-1.5 text-sm" placeholder="Identificador (ex.: iniciais, registro)" required autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <input name="idade" type="number" min="0" max="130" className="input !py-1.5 text-sm" placeholder="Idade" />
        <select name="sexo" className="input !py-1.5 text-sm" defaultValue="">
          <option value="">Sexo</option>
          <option value="F">F</option>
          <option value="M">M</option>
        </select>
      </div>
      <input name="diagnostico" className="input !py-1.5 text-sm" placeholder="Diagnóstico principal" />
      <label className="block text-[11px] text-clinic-muted">
        Admissão na UTI
        <input name="dataAdmissao" type="date" className="input !py-1.5 text-sm" defaultValue={new Date().toLocaleDateString("en-CA")} />
      </label>
      <p className="text-[11px] text-clinic-muted">O sexo define as referências padrão quando o laudo não traz a faixa.</p>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1 !py-1.5 text-sm" disabled={pendente}>
          {pendente ? "…" : "Admitir"}
        </button>
        <button type="button" className="btn-secondary !py-1.5 text-sm" onClick={() => setAberto(false)}>
          ✕
        </button>
      </div>
      {erro && <p className="text-xs text-instavel">{erro}</p>}
    </form>
  );
}
