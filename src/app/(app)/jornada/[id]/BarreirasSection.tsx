import BotaoAcao from "@/components/BotaoAcao";
import { BadgeCategoriaBarreira, BadgeDisciplina, BadgeStatusBarreira } from "@/components/JornadaBadges";
import {
  CATEGORIAS_BARREIRA,
  CATEGORIA_BARREIRA_CLINICA,
  CATEGORIA_BARREIRA_LABEL,
  DISCIPLINAS,
  DISCIPLINA_LABEL,
  PRIORIDADES,
  PRIORIDADE_LABEL,
  type CategoriaBarreira,
  type Disciplina,
} from "@/lib/constants";
import { formatarData } from "@/lib/format";
import { estaVencida } from "@/lib/format";
import { criarBarreira, mudarStatusBarreira, resolverBarreiraForm } from "../actions";

type BarreiraComResponsavel = {
  id: string;
  categoria: string;
  descricao: string;
  disciplina: string;
  prazo: Date | null;
  prioridade: string;
  bloqueiaAlta: boolean;
  impactoDias: number | null;
  status: string;
  resolucao: string | null;
  abertaEm: Date;
  resolvidaEm: Date | null;
  responsavel: { id: string; nome: string } | null;
};

export default function BarreirasSection({
  jornadaId,
  barreiras,
  profissionais,
  encerrada,
}: {
  jornadaId: string;
  barreiras: BarreiraComResponsavel[];
  profissionais: { id: string; nome: string; disciplina: string | null }[];
  encerrada: boolean;
}) {
  const abertas = barreiras.filter((b) => b.status === "aberta" || b.status === "em_andamento");
  const fechadas = barreiras.filter((b) => b.status === "resolvida" || b.status === "cancelada");
  const naoClinicas = abertas.filter(
    (b) => !(CATEGORIA_BARREIRA_CLINICA[b.categoria as CategoriaBarreira] ?? true),
  ).length;

  return (
    <section className="card p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">🚧 Barreiras à alta</h2>
          <p className="text-xs text-clinic-muted">
            {abertas.length} em aberto
            {naoClinicas > 0 ? ` · ${naoClinicas} não clínica(s)` : ""} · {fechadas.length} resolvida(s)
          </p>
        </div>
      </header>

      {abertas.length === 0 ? (
        <p className="rounded-lg bg-estavel/10 px-3 py-2 text-sm text-estavel">
          Nenhuma barreira em aberto — nada além da evolução clínica segura este paciente.
        </p>
      ) : (
        <ul className="space-y-2">
          {abertas.map((b) => {
            const clinica = CATEGORIA_BARREIRA_CLINICA[b.categoria as CategoriaBarreira] ?? true;
            const vencida = estaVencida(b.prazo);
            return (
              <li
                key={b.id}
                className={`rounded-lg border p-3 ${
                  vencida ? "border-instavel/40 bg-instavel/5" : "border-clinic-border"
                }`}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <BadgeCategoriaBarreira valor={b.categoria} clinica={clinica} />
                  <BadgeDisciplina valor={b.disciplina} />
                  <BadgeStatusBarreira valor={b.status} />
                  {b.bloqueiaAlta && (
                    <span className="badge bg-instavel/15 text-instavel" title="Impede a alta">
                      bloqueia alta
                    </span>
                  )}
                  {b.impactoDias ? (
                    <span className="badge bg-clinic-bg text-clinic-muted">
                      ~{b.impactoDias}d de impacto
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm">{b.descricao}</p>

                <p className="mt-1 text-[11px] text-clinic-muted">
                  Responsável: {b.responsavel?.nome ?? DISCIPLINA_LABEL[b.disciplina as Disciplina]} ·
                  Aberta em {formatarData(b.abertaEm)}
                  {b.prazo ? ` · Prazo ${formatarData(b.prazo)}${vencida ? " (vencido)" : ""}` : " · sem prazo"}
                </p>

                {!encerrada && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {b.status === "aberta" && (
                      <BotaoAcao acao={mudarStatusBarreira.bind(null, b.id, "em_andamento", undefined)}>
                        ▶ Assumir
                      </BotaoAcao>
                    )}
                    <details className="inline-block">
                      <summary className="btn-primary !py-1.5 cursor-pointer text-xs">
                        ✓ Resolver
                      </summary>
                      <form
                        action={resolverBarreiraForm}
                        className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-clinic-bg p-2"
                      >
                        <input type="hidden" name="barreiraId" value={b.id} />
                        <input type="hidden" name="status" value="resolvida" />
                        <input
                          name="resolucao"
                          className="input min-w-[200px] flex-1 !py-2 text-sm"
                          placeholder="Como foi resolvida?"
                        />
                        <button className="btn-primary !py-2 text-sm">Confirmar</button>
                      </form>
                    </details>
                    <BotaoAcao
                      acao={mudarStatusBarreira.bind(null, b.id, "cancelada", undefined)}
                      confirmar="Cancelar esta barreira? Ela deixará de bloquear a alta."
                    >
                      Cancelar
                    </BotaoAcao>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {fechadas.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-clinic-muted">
            Histórico de barreiras resolvidas ({fechadas.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {fechadas.map((b) => (
              <li key={b.id} className="rounded-lg bg-clinic-bg px-3 py-2 text-xs">
                <span className="font-semibold">
                  {CATEGORIA_BARREIRA_LABEL[b.categoria as CategoriaBarreira] ?? b.categoria}
                </span>{" "}
                · {b.descricao}
                {b.resolucao ? ` — ${b.resolucao}` : ""}{" "}
                <span className="text-clinic-muted">({formatarData(b.resolvidaEm)})</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {!encerrada && (
        <details className="mt-3">
          <summary className="btn-secondary !py-2 inline-block cursor-pointer text-sm">
            ＋ Registrar barreira
          </summary>
          <form action={criarBarreira} className="mt-3 space-y-3 rounded-lg bg-clinic-bg p-3">
            <input type="hidden" name="jornadaId" value={jornadaId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor={`categoria-${jornadaId}`}>
                  Categoria *
                </label>
                <select id={`categoria-${jornadaId}`} name="categoria" className="input" required>
                  {CATEGORIAS_BARREIRA.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIA_BARREIRA_LABEL[c]}
                      {CATEGORIA_BARREIRA_CLINICA[c] ? "" : " (não clínica)"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`disciplina-${jornadaId}`}>
                  Disciplina responsável
                </label>
                <select id={`disciplina-${jornadaId}`} name="disciplina" className="input">
                  <option value="">Sugerida pela categoria</option>
                  {DISCIPLINAS.map((d) => (
                    <option key={d} value={d}>
                      {DISCIPLINA_LABEL[d]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label" htmlFor={`descricao-${jornadaId}`}>
                O que exatamente está travando a alta? *
              </label>
              <input
                id={`descricao-${jornadaId}`}
                name="descricao"
                className="input"
                required
                placeholder="Ex.: Aguardando autorização do convênio para oxigênio domiciliar"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="label" htmlFor={`responsavel-${jornadaId}`}>
                  Pessoa responsável
                </label>
                <select id={`responsavel-${jornadaId}`} name="responsavelId" className="input">
                  <option value="">Toda a disciplina</option>
                  {profissionais.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`prazo-${jornadaId}`}>
                  Prazo
                </label>
                <input id={`prazo-${jornadaId}`} name="prazo" type="date" className="input" />
              </div>
              <div>
                <label className="label" htmlFor={`prioridade-${jornadaId}`}>
                  Prioridade
                </label>
                <select
                  id={`prioridade-${jornadaId}`}
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
              <div>
                <label className="label" htmlFor={`impacto-${jornadaId}`}>
                  Impacto (dias)
                </label>
                <input
                  id={`impacto-${jornadaId}`}
                  name="impactoDias"
                  type="number"
                  min={0}
                  max={90}
                  className="input"
                  placeholder="0"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="bloqueiaAlta" defaultChecked className="h-4 w-4" />
              Bloqueia a alta (impede efetivar a saída enquanto não for resolvida)
            </label>

            <button className="btn-primary w-full">Registrar barreira</button>
          </form>
        </details>
      )}
    </section>
  );
}
