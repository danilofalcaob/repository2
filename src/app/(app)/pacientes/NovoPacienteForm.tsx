"use client";
import { useRef, useState, useTransition } from "react";
import { criarPaciente } from "./actions";

export default function NovoPacienteForm({ setores }: { setores: { id: string; nome: string }[] }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function enviar(fd: FormData) {
    setErro("");
    startTransition(async () => {
      try {
        await criarPaciente(fd);
        formRef.current?.reset();
        setAberto(false);
      } catch (e: any) {
        setErro(e?.message ?? "Falha ao cadastrar.");
      }
    });
  }

  if (!aberto) {
    return (
      <button className="btn-primary" onClick={() => setAberto(true)}>
        ＋ Novo paciente
      </button>
    );
  }

  return (
    <form ref={formRef} action={enviar} className="card space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Identificador interno *</label>
          <input name="identificador" className="input" required placeholder="Ex.: PAC-0006 (iniciais)" />
        </div>
        <div>
          <label className="label">Setor *</label>
          <select name="setorId" className="input" required>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Leito</label>
          <input name="leito" className="input" placeholder="Ex.: B-15" />
        </div>
        <div>
          <label className="label">Idade</label>
          <input name="idade" type="number" min="0" max="130" className="input" />
        </div>
        <div>
          <label className="label">Sexo</label>
          <select name="sexo" className="input">
            <option value="">—</option>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Diagnóstico principal</label>
          <input name="diagnosticoPrincipal" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Alergias</label>
          <input name="alergias" className="input" placeholder="Nega / lista" />
        </div>
      </div>

      {erro && <p className="text-sm text-instavel">{erro}</p>}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar paciente"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
