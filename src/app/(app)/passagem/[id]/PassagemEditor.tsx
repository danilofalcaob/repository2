"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import VoiceInput from "@/components/VoiceInput";
import DitadoContinuo, { type CampoDestino } from "@/components/DitadoContinuo";
import { BadgeGravidade, BadgePreocupacao, BadgeStatusContingencia, BadgePrioridade } from "@/components/Badges";
import { GRAVIDADES, PREOCUPACOES, GRAVIDADE_LABEL, PREOCUPACAO_LABEL, type Gravidade, type Preocupacao } from "@/lib/constants";
import {
  salvarSnapshot,
  reconhecerSnapshot,
  reconhecerContingencia,
  definirReceptor,
  concluirPassagem,
} from "../actions";
import { formatarHora } from "@/lib/format";

type Contingencia = {
  id: string;
  parametro: string;
  limiar: string;
  acao: string;
  prioridade: string;
  status: string;
};
type Snap = {
  id: string;
  pacienteId: string;
  identificador: string;
  leito: string | null;
  gravidade: string;
  resumoPaciente: string;
  nivelPreocupacao: string;
  oQueMePreocupa: string;
  sinteseReceptor: string;
  resumoMudancas: string;
  reconhecido: boolean;
  dicaMudanca: string;
  anteriorResumo: string | null;
  pendencias: { descricao: string; prioridade: string; responsavel: string | null }[];
  contingencias: Contingencia[];
};

export default function PassagemEditor(props: {
  passagemId: string;
  setorNome: string;
  medicoPassa: string;
  medicoRecebeId: string | null;
  medicoRecebeNome: string | null;
  inicioEm: string;
  colegas: { id: string; nome: string }[];
  snapshots: Snap[];
  ehReceptor: boolean;
  usuarioId: string;
}) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState("");

  function definir(id: string) {
    startTransition(() => definirReceptor(props.passagemId, id));
  }

  function concluir() {
    setErro("");
    startTransition(async () => {
      try {
        await concluirPassagem(props.passagemId);
      } catch (e: any) {
        setErro(e?.message ?? "Não foi possível concluir.");
      }
    });
  }

  const criticosPendentes = props.snapshots.filter(
    (s) => s.gravidade === "instavel" && !s.reconhecido,
  ).length;
  const contingenciasPendentes = props.snapshots
    .flatMap((s) => s.contingencias)
    .filter((c) => c.status === "ativa").length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho da passagem */}
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">Passagem · {props.setorNome}</h1>
            <p className="text-sm text-clinic-muted">
              Início {formatarHora(props.inicioEm)} · {props.snapshots.length} paciente(s) ·{" "}
              <span className="badge bg-cuidado/15 text-cuidado">rascunho</span>
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="label">Médico que passa</span>
            <p className="text-sm font-medium">{props.medicoPassa}</p>
          </div>
          <div>
            <label className="label">Médico que recebe</label>
            {props.medicoRecebeNome ? (
              <p className="text-sm font-medium">
                {props.medicoRecebeNome}
                {props.ehReceptor && " (você)"}
              </p>
            ) : (
              <select
                className="input"
                defaultValue=""
                disabled={pendente}
                onChange={(e) => e.target.value && definir(e.target.value)}
              >
                <option value="">Selecionar receptor…</option>
                {props.colegas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {!props.ehReceptor && props.medicoRecebeNome && (
          <p className="rounded-lg bg-clinic-bg px-3 py-2 text-xs text-clinic-muted">
            O reconhecimento (read-back) dos pacientes e contingências deve ser feito
            pelo médico que recebe ({props.medicoRecebeNome}), logado na própria conta.
          </p>
        )}
      </div>

      {/* Pacientes */}
      {props.snapshots.map((s) => (
        <SnapshotCard
          key={s.id}
          snap={s}
          ehReceptor={props.ehReceptor}
          passagemId={props.passagemId}
        />
      ))}

      {/* Rodapé: concluir */}
      <div className="card sticky bottom-2 space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="text-clinic-muted">
            {criticosPendentes > 0 && (
              <p className="text-instavel">⚠ {criticosPendentes} instável(is) sem read-back</p>
            )}
            {contingenciasPendentes > 0 && (
              <p className="text-instavel">⚠ {contingenciasPendentes} contingência(s) sem read-back</p>
            )}
            {criticosPendentes === 0 && contingenciasPendentes === 0 && (
              <p className="text-estavel">✓ Pré-requisitos de read-back atendidos</p>
            )}
          </div>
          <button className="btn-primary" onClick={concluir} disabled={pendente}>
            {pendente ? "Concluindo…" : "Concluir passagem ✓"}
          </button>
        </div>
        {erro && <p className="text-sm text-instavel">{erro}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function SnapshotCard({
  snap,
  ehReceptor,
  passagemId,
}: {
  snap: Snap;
  ehReceptor: boolean;
  passagemId: string;
}) {
  const [pendente, startTransition] = useTransition();
  const [gravidade, setGravidade] = useState(snap.gravidade);
  const [resumo, setResumo] = useState(snap.resumoPaciente);
  const [preoc, setPreoc] = useState(snap.nivelPreocupacao);
  const [oQue, setOQue] = useState(snap.oQueMePreocupa);
  const [mudancas, setMudancas] = useState(snap.resumoMudancas);
  const [sintese, setSintese] = useState(snap.sinteseReceptor);
  const [salvo, setSalvo] = useState(true);
  const chaveLocal = `rascunho:${snap.id}`;

  // Recupera rascunho local (resiliência a conexão instável) na montagem.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(chaveLocal);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.resumo && !snap.resumoPaciente) setResumo(d.resumo);
        if (d.oQue && !snap.oQueMePreocupa) setOQue(d.oQue);
        if (d.sintese && !snap.sinteseReceptor) setSintese(d.sintese);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backup local a cada mudança.
  useEffect(() => {
    try {
      localStorage.setItem(chaveLocal, JSON.stringify({ resumo, oQue, sintese }));
    } catch {}
  }, [resumo, oQue, sintese, chaveLocal]);

  function salvar() {
    const fd = new FormData();
    fd.set("snapshotId", snap.id);
    fd.set("gravidade", gravidade);
    fd.set("resumoPaciente", resumo);
    fd.set("nivelPreocupacao", preoc);
    fd.set("oQueMePreocupa", oQue);
    fd.set("resumoMudancas", mudancas);
    fd.set("sinteseReceptor", sintese);
    startTransition(async () => {
      await salvarSnapshot(fd);
      setSalvo(true);
      try {
        localStorage.removeItem(chaveLocal);
      } catch {}
    });
  }

  const alterado = () => setSalvo(false);
  const critico = gravidade === "instavel";

  // Campos-destino da escuta contínua: cada trecho de fala é encaminhado ao
  // campo pertinente conforme o comando de voz reconhecido (ou o alvo manual).
  const camposDitado: CampoDestino[] = [
    {
      chave: "resumo",
      label: "P — Resumo",
      atalhos: ["resumo", "resumo do paciente", "paciente"],
      anexar: (t) => {
        setResumo((v) => (v ? v + " " + t : t));
        alterado();
      },
    },
    {
      chave: "preocupa",
      label: "O que me preocupa",
      atalhos: ["o que me preocupa", "me preocupa", "preocupacao", "preocupa"],
      anexar: (t) => {
        setOQue((v) => (v ? v + " " + t : t));
        alterado();
      },
    },
    {
      chave: "mudancas",
      label: "O que mudou",
      atalhos: ["o que mudou", "mudancas", "mudou", "mudanca"],
      anexar: (t) => {
        setMudancas((v) => (v ? v + " " + t : t));
        alterado();
      },
    },
    {
      chave: "sintese",
      label: "S — Síntese (receptor)",
      atalhos: ["sintese", "read-back", "readback", "sintese do receptor"],
      habilitado: ehReceptor,
      anexar: (t) => {
        setSintese((v) => (v ? v + " " + t : t));
        alterado();
      },
    },
  ];

  return (
    <div className={`card p-4 ${critico ? "ring-1 ring-instavel/40" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{snap.identificador}</h3>
          <p className="text-xs text-clinic-muted">Leito {snap.leito ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <BadgeGravidade valor={gravidade} />
          {snap.reconhecido && <span className="badge bg-estavel/15 text-estavel">✓ reconhecido</span>}
        </div>
      </div>

      {/* Escuta contínua da passagem: transcreve e roteia para a seção certa */}
      <div className="mt-3">
        <DitadoContinuo campos={camposDitado} alvoInicial="resumo" />
      </div>

      {/* O que mudou */}
      <div className="mt-3 rounded-lg bg-clinic-bg p-3 text-sm">
        <p className="text-xs font-semibold uppercase text-clinic-muted">O que mudou desde a última passagem</p>
        <p className="mt-1 text-clinic-muted">Resumo automático: {snap.dicaMudanca}</p>
        {snap.anteriorResumo && (
          <p className="mt-1 text-xs text-clinic-muted">Antes: “{snap.anteriorResumo}”</p>
        )}
        <input
          className="input mt-2"
          placeholder="Notas do que mudou (opcional)"
          value={mudancas}
          onChange={(e) => {
            setMudancas(e.target.value);
            alterado();
          }}
        />
      </div>

      {/* I — Gravidade */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">I — Gravidade</label>
          <div className="flex gap-1">
            {GRAVIDADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGravidade(g);
                  alterado();
                }}
                className={`btn flex-1 !px-2 !py-2 text-xs ${
                  gravidade === g
                    ? g === "instavel"
                      ? "bg-instavel text-white"
                      : g === "cuidado"
                        ? "bg-cuidado text-white"
                        : "bg-estavel text-white"
                    : "border border-clinic-border bg-clinic-surface"
                }`}
              >
                {GRAVIDADE_LABEL[g as Gravidade]}
              </button>
            ))}
          </div>
        </div>

        {/* Preocupação */}
        <div>
          <label className="label">Nível de preocupação (intuição)</label>
          <div className="flex gap-1">
            {PREOCUPACOES.map((pr) => (
              <button
                key={pr}
                type="button"
                onClick={() => {
                  setPreoc(pr);
                  alterado();
                }}
                className={`btn flex-1 !px-2 !py-2 text-xs ${
                  preoc === pr
                    ? pr === "alto"
                      ? "bg-instavel text-white"
                      : pr === "medio"
                        ? "bg-cuidado text-white"
                        : "bg-estavel text-white"
                    : "border border-clinic-border bg-clinic-surface"
                }`}
              >
                {PREOCUPACAO_LABEL[pr as Preocupacao]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* P — Resumo */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <label className="label">P — Resumo do paciente</label>
          <VoiceInput onTexto={(t) => { setResumo((v) => (v ? v + " " + t : t)); alterado(); }} />
        </div>
        <textarea
          className="input min-h-[80px]"
          value={resumo}
          onChange={(e) => {
            setResumo(e.target.value);
            alterado();
          }}
          placeholder="História, diagnóstico, evolução…"
        />
      </div>

      {/* O que me preocupa */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <label className="label">O que me preocupa</label>
          <VoiceInput onTexto={(t) => { setOQue((v) => (v ? v + " " + t : t)); alterado(); }} />
        </div>
        <textarea
          className="input min-h-[56px]"
          value={oQue}
          onChange={(e) => {
            setOQue(e.target.value);
            alterado();
          }}
          placeholder="Intuição clínica, sinais de alerta…"
        />
      </div>

      {/* Pendências (A) — somente leitura aqui; geridas na ficha */}
      {snap.pendencias.length > 0 && (
        <div className="mt-3">
          <p className="label">A — Pendências abertas</p>
          <ul className="space-y-1 text-sm">
            {snap.pendencias.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                <BadgePrioridade valor={p.prioridade} />
                <span>{p.descricao}</span>
                {p.responsavel && <span className="text-xs text-clinic-muted">· {p.responsavel}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* S — Contingências com read-back */}
      {snap.contingencias.length > 0 && (
        <div className="mt-3 rounded-lg border border-instavel/30 p-3">
          <p className="label">🛡️ S — Contingências (rede de segurança)</p>
          <ul className="space-y-2">
            {snap.contingencias.map((c) => (
              <li key={c.id} className="text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{c.parametro} {c.limiar}</strong> → {c.acao}
                  </span>
                  <span className="flex items-center gap-2">
                    <BadgeStatusContingencia valor={c.status} />
                    {ehReceptor && c.status === "ativa" && (
                      <button
                        className="btn-primary !px-2 !py-1 text-xs"
                        disabled={pendente}
                        onClick={() =>
                          startTransition(() => reconhecerContingencia(c.id, passagemId))
                        }
                      >
                        Reconhecer (read-back)
                      </button>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* S — Síntese do receptor */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <label className="label">S — Síntese do receptor (read-back)</label>
          {ehReceptor && (
            <VoiceInput onTexto={(t) => { setSintese((v) => (v ? v + " " + t : t)); alterado(); }} />
          )}
        </div>
        <textarea
          className="input min-h-[56px]"
          value={sintese}
          onChange={(e) => {
            setSintese(e.target.value);
            alterado();
          }}
          disabled={!ehReceptor}
          placeholder={ehReceptor ? "Confirme o entendimento e o plano…" : "Preenchido pelo receptor"}
        />
      </div>

      {/* Ações do card */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-clinic-muted">
          {salvo ? "✓ salvo" : "alterações não salvas"}
        </span>
        <div className="flex gap-2">
          <button className="btn-secondary !py-1.5 text-xs" onClick={salvar} disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar"}
          </button>
          {ehReceptor && !snap.reconhecido && (
            <button
              className="btn-primary !py-1.5 text-xs"
              disabled={pendente}
              onClick={() => {
                salvar();
                startTransition(() => reconhecerSnapshot(snap.id));
              }}
            >
              ✓ Reconhecer paciente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
