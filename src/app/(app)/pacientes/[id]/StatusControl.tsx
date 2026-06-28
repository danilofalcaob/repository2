"use client";
import { useTransition } from "react";
import { atualizarStatusPaciente } from "../actions";
import { STATUS_PACIENTE, STATUS_PACIENTE_LABEL, type StatusPaciente } from "@/lib/constants";

export default function StatusControl({
  pacienteId,
  statusAtual,
}: {
  pacienteId: string;
  statusAtual: string;
}) {
  const [pendente, startTransition] = useTransition();
  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      <label className="text-clinic-muted">Status:</label>
      <select
        className="input !w-auto !py-1.5"
        defaultValue={statusAtual}
        disabled={pendente}
        onChange={(e) =>
          startTransition(() => atualizarStatusPaciente(pacienteId, e.target.value))
        }
      >
        {STATUS_PACIENTE.map((s) => (
          <option key={s} value={s}>
            {STATUS_PACIENTE_LABEL[s as StatusPaciente]}
          </option>
        ))}
      </select>
      {pendente && <span className="text-xs text-clinic-muted">salvando…</span>}
    </div>
  );
}
