import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { estadoDaJornada, getJornada, getProfissionaisDosSetores } from "@/lib/jornada-queries";
import { getUltimoSnapshotConcluido } from "@/lib/queries";
import {
  CONFIANCAS,
  CONFIANCA_LABEL,
  DESTINOS_ALTA,
  DESTINO_ALTA_LABEL,
  DISCIPLINA_LABEL,
  PRIORIDADES,
  PRIORIDADE_LABEL,
  STATUS_JORNADA_LABEL,
  type Disciplina,
  type EtapaJornada,
  type StatusJornada,
} from "@/lib/constants";
import { formatarData, formatarDataHora, tempoRelativo } from "@/lib/format";
import { desvioPrevisaoDias, resumoJornada } from "@/lib/jornada";
import { BadgeGravidade, BadgePreocupacao } from "@/components/Badges";
import {
  BadgeConfianca,
  BadgeDAP,
  BadgeDestino,
  BadgeDisciplina,
  BadgeEtapa,
  ChipsAlertas,
} from "@/components/JornadaBadges";
import BotaoAcao from "@/components/BotaoAcao";
import ControleEtapa from "./ControleEtapa";
import BarreirasSection from "./BarreirasSection";
import TarefasSection from "./TarefasSection";
import CriteriosSection from "./CriteriosSection";
import TimelineSection from "./TimelineSection";
import { adicionarMembro, atualizarPlano, encerrarJornada, removerMembro } from "../actions";

export const dynamic = "force-dynamic";

export default async function JornadaPage({ params }: { params: { id: string } }) {
  const u = (await getUsuarioAtual())!;
  const jornada = await getJornada(params.id);
  if (!jornada) notFound();
  if (!u.setoresIds.includes(jornada.setorId)) redirect("/jornada");

  const [profissionais, ultimoSnapshot, pendencias, contingencias] = await Promise.all([
    getProfissionaisDosSetores(u.setoresIds),
    getUltimoSnapshotConcluido(jornada.pacienteId),
    prisma.pendencia.findMany({
      where: { pacienteId: jornada.pacienteId, status: "aberta" },
      orderBy: { criadaEm: "asc" },
    }),
    prisma.contingencia.findMany({
      where: { pacienteId: jornada.pacienteId, status: { in: ["ativa", "disparada"] } },
    }),
  ]);

  const estado = estadoDaJornada(jornada);
  const encerrada = jornada.status !== "aberta";
  const avaliadores = new Map(profissionais.map((p) => [p.id, p.nome]));
  const desvio = desvioPrevisaoDias(jornada.dataAltaPrevistaInicial, jornada.altaEfetivadaEm);
  const idsNaEquipe = new Set(jornada.equipe.map((m) => m.usuarioId));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/jornada" className="text-sm text-clinic-primary">
          ← Funil de alta
        </Link>
        <Link href={`/pacientes/${jornada.pacienteId}`} className="text-sm text-clinic-primary">
          Ficha clínica do paciente →
        </Link>
      </div>

      {/* Cabeçalho do caso */}
      <header className="card space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{jornada.paciente.identificador}</h1>
            <p className="text-sm text-clinic-muted">
              Leito {jornada.paciente.leito ?? "—"} · {jornada.paciente.idade ?? "?"} anos ·{" "}
              {jornada.setor.nome} · internado há {estado.diasInternacao} dia(s) (desde{" "}
              {formatarData(jornada.paciente.dataAdmissao)})
            </p>
            {jornada.motivoInternacao && (
              <p className="mt-1 text-sm">{jornada.motivoInternacao}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <BadgeEtapa valor={jornada.etapa} />
            <BadgeDAP situacao={estado.situacaoDAP} data={jornada.dataAltaPrevista} />
            <BadgeConfianca valor={jornada.confiancaAlta} />
            {jornada.destinoAlta && <BadgeDestino valor={jornada.destinoAlta} />}
            {encerrada && (
              <span className="badge bg-clinic-bg text-clinic-muted">
                {STATUS_JORNADA_LABEL[jornada.status as StatusJornada]}
              </span>
            )}
          </div>
        </div>

        {estado.alertas.length > 0 && <ChipsAlertas alertas={estado.alertas} max={6} />}

        <p className="rounded-lg bg-clinic-bg px-3 py-2 text-xs text-clinic-muted">
          {resumoJornada({
            etapa: jornada.etapa,
            status: jornada.status,
            dataAltaPrevista: jornada.dataAltaPrevista,
            criterios: jornada.criterios,
            barreiras: jornada.barreiras,
            dataAdmissao: jornada.paciente.dataAdmissao,
          })}
        </p>

        <ControleEtapa
          jornadaId={jornada.id}
          etapaAtual={jornada.etapa as EtapaJornada}
          encerrada={encerrada}
        />

        {encerrada && (
          <p className="rounded-lg bg-clinic-bg px-3 py-2 text-sm">
            {jornada.altaEfetivadaEm
              ? `Alta efetivada em ${formatarDataHora(jornada.altaEfetivadaEm)}.`
              : `Jornada encerrada em ${formatarDataHora(jornada.encerradaEm)} (${jornada.encerradaMotivo}).`}
            {desvio !== null && (
              <>
                {" "}
                Primeira previsão: {formatarData(jornada.dataAltaPrevistaInicial)} —{" "}
                {desvio === 0
                  ? "alta no dia previsto."
                  : desvio > 0
                    ? `${desvio} dia(s) depois do previsto.`
                    : `${Math.abs(desvio)} dia(s) antes do previsto.`}
              </>
            )}
          </p>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <BarreirasSection
            jornadaId={jornada.id}
            barreiras={jornada.barreiras}
            profissionais={profissionais}
            encerrada={encerrada}
          />
          <TarefasSection
            jornadaId={jornada.id}
            tarefas={jornada.tarefas}
            profissionais={profissionais}
            barreiras={jornada.barreiras}
            encerrada={encerrada}
          />
          <TimelineSection
            jornadaId={jornada.id}
            interacoes={jornada.interacoes}
            encerrada={encerrada}
          />
        </div>

        <div className="space-y-4">
          <CriteriosSection
            criterios={jornada.criterios}
            prontidao={estado.prontidao}
            avaliadores={avaliadores}
          />

          {/* Plano de alta — o "negócio" do CRM: meta, dono e destino */}
          <section className="card p-4">
            <h2 className="mb-3 text-lg font-bold">🎯 Plano de alta</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-clinic-muted">Gestor do caso</dt>
                <dd className="text-right font-medium">{jornada.gestorCaso?.nome ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-clinic-muted">Alta prevista</dt>
                <dd className="text-right font-medium">{formatarData(jornada.dataAltaPrevista)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-clinic-muted">Primeira previsão</dt>
                <dd className="text-right font-medium">
                  {formatarData(jornada.dataAltaPrevistaInicial)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-clinic-muted">Complexidade</dt>
                <dd className="text-right font-medium">
                  {PRIORIDADE_LABEL[jornada.complexidade as keyof typeof PRIORIDADE_LABEL] ??
                    jornada.complexidade}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-clinic-muted">Risco de reinternação</dt>
                <dd className="text-right font-medium capitalize">{jornada.riscoReinternacao}</dd>
              </div>
            </dl>

            {jornada.planoTerapeutico && (
              <p className="mt-3 whitespace-pre-line rounded-lg bg-clinic-bg p-2.5 text-sm">
                {jornada.planoTerapeutico}
              </p>
            )}

            {!encerrada && (
              <details className="mt-3">
                <summary className="btn-secondary !py-2 inline-block cursor-pointer text-sm">
                  Repactuar plano
                </summary>
                <form action={atualizarPlano} className="mt-3 space-y-3">
                  <input type="hidden" name="jornadaId" value={jornada.id} />
                  <div>
                    <label className="label" htmlFor="dataAltaPrevista">
                      Data de alta prevista
                    </label>
                    <input
                      id="dataAltaPrevista"
                      name="dataAltaPrevista"
                      type="date"
                      defaultValue={
                        jornada.dataAltaPrevista
                          ? jornada.dataAltaPrevista.toISOString().slice(0, 10)
                          : ""
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="motivoRepactuacao">
                      Motivo da repactuação
                    </label>
                    <input
                      id="motivoRepactuacao"
                      name="motivoRepactuacao"
                      className="input"
                      placeholder="Ex.: aguardando parecer da cirurgia"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="confiancaAlta">
                      Confiança
                    </label>
                    <select
                      id="confiancaAlta"
                      name="confiancaAlta"
                      defaultValue={jornada.confiancaAlta}
                      className="input"
                    >
                      {CONFIANCAS.map((c) => (
                        <option key={c} value={c}>
                          {CONFIANCA_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="destinoAlta">
                      Destino
                    </label>
                    <select
                      id="destinoAlta"
                      name="destinoAlta"
                      defaultValue={jornada.destinoAlta ?? ""}
                      className="input"
                    >
                      <option value="">Indefinido</option>
                      {DESTINOS_ALTA.map((d) => (
                        <option key={d} value={d}>
                          {DESTINO_ALTA_LABEL[d]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="gestorCasoId">
                      Gestor do caso
                    </label>
                    <select
                      id="gestorCasoId"
                      name="gestorCasoId"
                      defaultValue={jornada.gestorCasoId ?? ""}
                      className="input"
                    >
                      <option value="">Sem gestor</option>
                      {profissionais.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="complexidade">
                      Complexidade
                    </label>
                    <select
                      id="complexidade"
                      name="complexidade"
                      defaultValue={jornada.complexidade}
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
                    <label className="label" htmlFor="riscoReinternacao">
                      Risco de reinternação
                    </label>
                    <select
                      id="riscoReinternacao"
                      name="riscoReinternacao"
                      defaultValue={jornada.riscoReinternacao}
                      className="input"
                    >
                      <option value="baixo">Baixo</option>
                      <option value="medio">Médio</option>
                      <option value="alto">Alto</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="motivoInternacao">
                      Motivo da internação
                    </label>
                    <input
                      id="motivoInternacao"
                      name="motivoInternacao"
                      defaultValue={jornada.motivoInternacao ?? ""}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="planoTerapeutico">
                      Plano terapêutico
                    </label>
                    <textarea
                      id="planoTerapeutico"
                      name="planoTerapeutico"
                      rows={3}
                      defaultValue={jornada.planoTerapeutico ?? ""}
                      className="input"
                    />
                  </div>
                  <button className="btn-primary w-full">Salvar plano</button>
                </form>
              </details>
            )}
          </section>

          {/* Equipe do caso */}
          <section className="card p-4">
            <h2 className="mb-3 text-lg font-bold">👥 Equipe do caso</h2>
            {jornada.equipe.length === 0 ? (
              <p className="text-sm text-clinic-muted">Nenhum profissional vinculado ainda.</p>
            ) : (
              <ul className="space-y-1.5">
                {jornada.equipe.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.usuario.nome}</p>
                      <BadgeDisciplina valor={m.disciplina} />
                    </div>
                    {!encerrada && (
                      <BotaoAcao
                        acao={removerMembro.bind(null, m.id)}
                        confirmar={`Remover ${m.usuario.nome} da equipe do caso?`}
                      >
                        ✕
                      </BotaoAcao>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!encerrada && (
              <form action={adicionarMembro} className="mt-3 flex gap-2">
                <input type="hidden" name="jornadaId" value={jornada.id} />
                <select name="usuarioId" className="input !py-2 text-sm" required>
                  <option value="">Adicionar profissional…</option>
                  {profissionais
                    .filter((p) => !idsNaEquipe.has(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                        {p.disciplina ? ` · ${DISCIPLINA_LABEL[p.disciplina as Disciplina]}` : ""}
                      </option>
                    ))}
                </select>
                <button className="btn-secondary !py-2 text-sm">＋</button>
              </form>
            )}
          </section>

          {/* Ponte com a passagem de plantão: o CRM não vive isolado */}
          <section className="card p-4">
            <h2 className="mb-2 text-lg font-bold">🩺 Contexto clínico</h2>
            {ultimoSnapshot ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <BadgeGravidade valor={ultimoSnapshot.gravidade} />
                  <BadgePreocupacao valor={ultimoSnapshot.nivelPreocupacao} />
                </div>
                <p className="text-sm">{ultimoSnapshot.resumoPaciente || "Sem resumo registrado."}</p>
                <p className="text-[11px] text-clinic-muted">
                  Última passagem concluída {tempoRelativo(ultimoSnapshot.passagem.concluidaEm)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-clinic-muted">
                Ainda sem passagem de plantão concluída para este paciente.
              </p>
            )}

            {contingencias.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-clinic-muted">
                  Contingências ativas
                </h3>
                <ul className="mt-1 space-y-1">
                  {contingencias.map((c) => (
                    <li key={c.id} className="rounded-lg bg-instavel/10 px-2 py-1.5 text-xs text-instavel">
                      {c.parametro} {c.limiar} → {c.acao}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pendencias.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-clinic-muted">
                  Pendências do plantão
                </h3>
                <ul className="mt-1 space-y-1">
                  {pendencias.map((p) => (
                    <li key={p.id} className="rounded-lg bg-clinic-bg px-2 py-1.5 text-xs">
                      {p.descricao}
                      {p.prazo ? ` · até ${formatarData(p.prazo)}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {!encerrada && (
            <details className="card p-4">
              <summary className="cursor-pointer text-sm text-clinic-muted">
                Encerrar jornada sem alta
              </summary>
              <form action={encerrarJornada} className="mt-3 space-y-3">
                <input type="hidden" name="jornadaId" value={jornada.id} />
                <div>
                  <label className="label" htmlFor="encerradaMotivo">
                    Motivo
                  </label>
                  <select id="encerradaMotivo" name="encerradaMotivo" className="input">
                    <option value="transferencia">Transferência de setor/serviço</option>
                    <option value="obito">Óbito</option>
                    <option value="evasao">Evasão</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="detalhe">
                    Observação
                  </label>
                  <input id="detalhe" name="detalhe" className="input" />
                </div>
                <button className="btn-danger w-full">Encerrar jornada</button>
              </form>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
