import Link from "next/link";
import { getUsuarioAtual } from "@/lib/auth";
import { getPacientesSemJornada, getProfissionaisDosSetores } from "@/lib/jornada-queries";
import {
  CONFIANCAS,
  CONFIANCA_LABEL,
  DESTINOS_ALTA,
  DESTINO_ALTA_LABEL,
  DISCIPLINA_LABEL,
  ETAPAS_JORNADA,
  ETAPA_LABEL,
  PRIORIDADES,
  PRIORIDADE_LABEL,
  type Disciplina,
} from "@/lib/constants";
import { formatarData } from "@/lib/format";
import { diasInternacao } from "@/lib/jornada";
import { abrirJornada } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovaJornadaPage({
  searchParams,
}: {
  searchParams: { paciente?: string };
}) {
  const u = (await getUsuarioAtual())!;
  const [pacientes, profissionais] = await Promise.all([
    getPacientesSemJornada(u.setoresIds),
    getProfissionaisDosSetores(u.setoresIds),
  ]);

  // Sugestão de alta prevista: 3 dias à frente, apenas como ponto de partida
  // para a equipe negociar — o valor padrão existe para evitar caso sem meta.
  const sugestao = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/jornada" className="text-sm text-clinic-primary">
          ← Voltar ao funil
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Abrir jornada de alta</h1>
        <p className="text-sm text-clinic-muted">
          A jornada é o caso compartilhado por toda a equipe: um plano, um responsável e uma data de
          alta prevista visível para todos.
        </p>
      </div>

      {pacientes.length === 0 ? (
        <div className="card p-8 text-center text-clinic-muted">
          Todos os pacientes internados já estão no funil.{" "}
          <Link href="/pacientes" className="text-clinic-primary underline">
            Cadastrar novo paciente
          </Link>
          .
        </div>
      ) : (
        <form action={abrirJornada} className="card space-y-4 p-4">
          <div>
            <label className="label" htmlFor="pacienteId">
              Paciente internado *
            </label>
            <select
              id="pacienteId"
              name="pacienteId"
              required
              defaultValue={searchParams.paciente ?? ""}
              className="input"
            >
              <option value="">Selecione…</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.identificador} · Leito {p.leito ?? "—"} · {p.setor.nome} ·{" "}
                  {diasInternacao(p.dataAdmissao)}d internado (desde {formatarData(p.dataAdmissao)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="etapa">
                Etapa inicial
              </label>
              <select id="etapa" name="etapa" defaultValue="admissao" className="input">
                {ETAPAS_JORNADA.filter((e) => e !== "alta_efetivada").map((e) => (
                  <option key={e} value={e}>
                    {ETAPA_LABEL[e]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="gestorCasoId">
                Gestor do caso
              </label>
              <select id="gestorCasoId" name="gestorCasoId" defaultValue={u.id} className="input">
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                    {p.disciplina ? ` · ${DISCIPLINA_LABEL[p.disciplina as Disciplina]}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="motivoInternacao">
              Motivo da internação
            </label>
            <input
              id="motivoInternacao"
              name="motivoInternacao"
              className="input"
              placeholder="Ex.: Pneumonia comunitária com necessidade de O₂"
            />
          </div>

          <div>
            <label className="label" htmlFor="planoTerapeutico">
              Plano terapêutico e meta da internação
            </label>
            <textarea
              id="planoTerapeutico"
              name="planoTerapeutico"
              rows={3}
              className="input"
              placeholder="O que precisa acontecer para este paciente ir para casa com segurança?"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="dataAltaPrevista">
                Data de alta prevista
              </label>
              <input
                id="dataAltaPrevista"
                name="dataAltaPrevista"
                type="date"
                defaultValue={sugestao}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="confiancaAlta">
                Confiança na previsão
              </label>
              <select id="confiancaAlta" name="confiancaAlta" defaultValue="media" className="input">
                {CONFIANCAS.map((c) => (
                  <option key={c} value={c}>
                    {CONFIANCA_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="destinoAlta">
                Destino provável
              </label>
              <select id="destinoAlta" name="destinoAlta" defaultValue="domicilio" className="input">
                {DESTINOS_ALTA.map((d) => (
                  <option key={d} value={d}>
                    {DESTINO_ALTA_LABEL[d]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="complexidade">
                Complexidade do caso
              </label>
              <select id="complexidade" name="complexidade" defaultValue="media" className="input">
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORIDADE_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="riscoReinternacao">
                Risco de reinternação
              </label>
              <select id="riscoReinternacao" name="riscoReinternacao" defaultValue="baixo" className="input">
                <option value="baixo">Baixo</option>
                <option value="medio">Médio</option>
                <option value="alto">Alto</option>
              </select>
            </div>
          </div>

          <p className="rounded-lg bg-clinic-bg p-3 text-xs text-clinic-muted">
            Ao abrir a jornada, o checklist padrão de critérios objetivos de alta (clínicos,
            funcionais, educacionais e logísticos) é criado automaticamente e pode ser ajustado caso
            a caso.
          </p>

          <button type="submit" className="btn-primary w-full">
            Abrir jornada
          </button>
        </form>
      )}
    </div>
  );
}
