import BotaoAcao from "@/components/BotaoAcao";
import { BadgeDisciplina } from "@/components/JornadaBadges";
import { BadgePrioridade } from "@/components/Badges";
import {
  DISCIPLINAS,
  DISCIPLINA_LABEL,
  PRIORIDADES,
  PRIORIDADE_LABEL,
  type Disciplina,
} from "@/lib/constants";
import { estaVencida, formatarData } from "@/lib/format";
import { criarTarefa, mudarStatusTarefa } from "../actions";

type TarefaComResponsavel = {
  id: string;
  titulo: string;
  detalhe: string | null;
  disciplina: string;
  prazo: Date | null;
  prioridade: string;
  status: string;
  concluidaEm: Date | null;
  concluidaPor: string | null;
  responsavel: { id: string; nome: string } | null;
};

export default function TarefasSection({
  jornadaId,
  tarefas,
  profissionais,
  barreiras,
  encerrada,
}: {
  jornadaId: string;
  tarefas: TarefaComResponsavel[];
  profissionais: { id: string; nome: string; disciplina: string | null }[];
  barreiras: { id: string; descricao: string; status: string }[];
  encerrada: boolean;
}) {
  const abertas = tarefas.filter((t) => t.status === "aberta");
  const feitas = tarefas.filter((t) => t.status !== "aberta");

  // Agrupa por disciplina: cada equipe enxerga a sua parte do plano de alta.
  const porDisciplina = new Map<string, TarefaComResponsavel[]>();
  for (const t of abertas) {
    porDisciplina.set(t.disciplina, [...(porDisciplina.get(t.disciplina) ?? []), t]);
  }

  return (
    <section className="card p-4">
      <header className="mb-3">
        <h2 className="text-lg font-bold">✅ Tarefas da equipe</h2>
        <p className="text-xs text-clinic-muted">
          {abertas.length} aberta(s) em {porDisciplina.size} disciplina(s) · {feitas.length} concluída(s)
        </p>
      </header>

      {abertas.length === 0 ? (
        <p className="text-sm text-clinic-muted">Nenhuma tarefa em aberto.</p>
      ) : (
        <div className="space-y-3">
          {Array.from(porDisciplina.entries()).map(([disciplina, lista]) => (
            <div key={disciplina}>
              <BadgeDisciplina valor={disciplina} />
              <ul className="mt-1.5 space-y-1.5">
                {lista.map((t) => {
                  const vencida = estaVencida(t.prazo);
                  return (
                    <li
                      key={t.id}
                      className={`flex flex-wrap items-start gap-2 rounded-lg border p-2.5 ${
                        vencida ? "border-instavel/40 bg-instavel/5" : "border-clinic-border"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{t.titulo}</p>
                        {t.detalhe && <p className="text-xs text-clinic-muted">{t.detalhe}</p>}
                        <p className="mt-0.5 text-[11px] text-clinic-muted">
                          {t.responsavel?.nome ?? "Sem responsável nominal"}
                          {t.prazo ? ` · prazo ${formatarData(t.prazo)}${vencida ? " (vencido)" : ""}` : ""}
                        </p>
                      </div>
                      <BadgePrioridade valor={t.prioridade} />
                      {!encerrada && (
                        <div className="flex gap-1">
                          <BotaoAcao
                            acao={mudarStatusTarefa.bind(null, t.id, "concluida")}
                            className="btn-primary !py-1.5 text-xs"
                          >
                            ✓ Concluir
                          </BotaoAcao>
                          <BotaoAcao
                            acao={mudarStatusTarefa.bind(null, t.id, "cancelada")}
                            confirmar="Cancelar esta tarefa?"
                          >
                            ✕
                          </BotaoAcao>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {feitas.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-clinic-muted">
            Tarefas concluídas ({feitas.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {feitas.map((t) => (
              <li key={t.id} className="rounded-lg bg-clinic-bg px-3 py-2 text-xs">
                <span className={t.status === "cancelada" ? "line-through" : ""}>{t.titulo}</span>{" "}
                <span className="text-clinic-muted">
                  · {DISCIPLINA_LABEL[t.disciplina as Disciplina] ?? t.disciplina}
                  {t.concluidaPor ? ` · ${t.concluidaPor}` : ""}
                  {t.concluidaEm ? ` · ${formatarData(t.concluidaEm)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {!encerrada && (
        <details className="mt-3">
          <summary className="btn-secondary !py-2 inline-block cursor-pointer text-sm">
            ＋ Nova tarefa
          </summary>
          <form action={criarTarefa} className="mt-3 space-y-3 rounded-lg bg-clinic-bg p-3">
            <input type="hidden" name="jornadaId" value={jornadaId} />
            <div>
              <label className="label" htmlFor={`titulo-${jornadaId}`}>
                Tarefa *
              </label>
              <input
                id={`titulo-${jornadaId}`}
                name="titulo"
                className="input"
                required
                placeholder="Ex.: Treinar cuidador para aspiração antes da alta"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="label" htmlFor={`tarefa-disciplina-${jornadaId}`}>
                  Disciplina *
                </label>
                <select
                  id={`tarefa-disciplina-${jornadaId}`}
                  name="disciplina"
                  className="input"
                  required
                >
                  {DISCIPLINAS.map((d) => (
                    <option key={d} value={d}>
                      {DISCIPLINA_LABEL[d]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`tarefa-resp-${jornadaId}`}>
                  Responsável
                </label>
                <select id={`tarefa-resp-${jornadaId}`} name="responsavelId" className="input">
                  <option value="">Toda a disciplina</option>
                  {profissionais.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`tarefa-prazo-${jornadaId}`}>
                  Prazo
                </label>
                <input id={`tarefa-prazo-${jornadaId}`} name="prazo" type="date" className="input" />
              </div>
              <div>
                <label className="label" htmlFor={`tarefa-prio-${jornadaId}`}>
                  Prioridade
                </label>
                <select
                  id={`tarefa-prio-${jornadaId}`}
                  name="prioridade"
                  defaultValue="media"
                  className="input"
                >
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORIDADE_LABEL[p]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {barreiras.length > 0 && (
              <div>
                <label className="label" htmlFor={`tarefa-barreira-${jornadaId}`}>
                  Vincular a uma barreira
                </label>
                <select id={`tarefa-barreira-${jornadaId}`} name="barreiraId" className="input">
                  <option value="">Nenhuma</option>
                  {barreiras
                    .filter((b) => b.status === "aberta" || b.status === "em_andamento")
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.descricao}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <button className="btn-primary w-full">Criar tarefa</button>
          </form>
        </details>
      )}
    </section>
  );
}
