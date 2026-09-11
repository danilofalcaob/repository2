import {
  DISCIPLINA_LABEL,
  TIPO_INTERACAO_ICONE,
  TIPO_INTERACAO_LABEL,
  type Disciplina,
  type TipoInteracao,
} from "@/lib/constants";
import { formatarDataHora, tempoRelativo } from "@/lib/format";
import NotaComposer from "./NotaComposer";

type Interacao = {
  id: string;
  autorNome: string;
  disciplina: string | null;
  tipo: string;
  texto: string;
  mencoesJson: string | null;
  criadoEm: Date;
};

export default function TimelineSection({
  jornadaId,
  interacoes,
  encerrada,
}: {
  jornadaId: string;
  interacoes: Interacao[];
  encerrada: boolean;
}) {
  return (
    <section className="card p-4">
      <header className="mb-3">
        <h2 className="text-lg font-bold">🧾 Linha do tempo do caso</h2>
        <p className="text-xs text-clinic-muted">
          Registro append-only de decisões, rounds e comunicação — a memória que atravessa turnos e
          equipes.
        </p>
      </header>

      {!encerrada && (
        <div className="mb-4">
          <NotaComposer jornadaId={jornadaId} />
        </div>
      )}

      {interacoes.length === 0 ? (
        <p className="text-sm text-clinic-muted">Nenhum registro ainda.</p>
      ) : (
        <ol className="space-y-3 border-l border-clinic-border pl-4">
          {interacoes.map((i) => {
            const mencoes: string[] = i.mencoesJson ? JSON.parse(i.mencoesJson) : [];
            return (
              <li key={i.id} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[22px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-clinic-surface text-[10px]"
                >
                  {TIPO_INTERACAO_ICONE[i.tipo as TipoInteracao] ?? "•"}
                </span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-clinic-muted">
                  <span className="font-semibold text-clinic-text">{i.autorNome}</span>
                  {i.disciplina && <span>· {DISCIPLINA_LABEL[i.disciplina as Disciplina]}</span>}
                  <span>· {TIPO_INTERACAO_LABEL[i.tipo as TipoInteracao] ?? i.tipo}</span>
                  <span title={formatarDataHora(i.criadoEm)}>· {tempoRelativo(i.criadoEm)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-line text-sm">{i.texto}</p>
                {mencoes.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {mencoes.map((m) => (
                      <span key={m} className="badge bg-clinic-primary/15 text-clinic-primary">
                        @{DISCIPLINA_LABEL[m as Disciplina] ?? m}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
