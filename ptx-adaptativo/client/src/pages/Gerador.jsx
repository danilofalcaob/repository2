import { useState } from 'react';
import { api } from '../lib/api.js';

const SETORES = ['', 'enfermaria', 'UTI', 'PA'];
const MOTIVOS = [
  ['nao disponivel no servico', 'Não disponível no serviço'],
  ['logistica inviavel', 'Logística inviável'],
  ['nao se aplica ao perfil de pacientes', 'Não se aplica ao perfil de pacientes'],
  ['redundante', 'Redundante'],
  ['outro', 'Outro'],
];
const CATEGORIA_LABEL = {
  'terapeutica medicamentosa': 'Terapêutica medicamentosa',
  dispositivos: 'Dispositivos',
  mobilidade: 'Mobilidade',
  'dieta/nutricao': 'Dieta / Nutrição',
  profilaxias: 'Profilaxias',
  'exames/monitorizacao': 'Exames / Monitorização',
  multidisciplinar: 'Multidisciplinar',
  'planejamento de alta': 'Planejamento de alta',
  'metas de cuidado': 'Metas de cuidado',
};
const PRIORIDADE_STYLE = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-amber-100 text-amber-700',
  baixa: 'bg-slate-100 text-slate-600',
};

// estado por item: { status: 'pendente'|'aceito'|'rejeitado'|'modificado', editText, motivo, enviando }
export default function Gerador() {
  const [problems, setProblems] = useState(['']);
  const [form, setForm] = useState({
    hpma: '', evolution: '', existingPlan: '',
    diasInternacao: '', setor: '', dispositivos: '', dieta: '', oxigenio: '',
  });
  const [result, setResult] = useState(null);
  const [items, setItems] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const gerar = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    setCopied(false);
    try {
      const d = await api.generate({ problems: problems.filter((p) => p.trim()), ...form });
      setResult(d);
      const st = {};
      for (const it of d.plan.itens) {
        st[it.id] = { status: 'pendente', editText: it.item, motivo: '', editing: false };
      }
      setItems(st);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const setItem = (id, patch) => setItems((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  const enviarFeedback = async (it, decision, extra = {}) => {
    setItem(it.id, { enviando: true });
    try {
      await api.feedback({ suggestionId: it.id, decision, ...extra });
      setItem(it.id, {
        status: decision === 'conforme' ? 'aceito' : decision === 'modificado' ? 'modificado' : 'rejeitado',
        enviando: false,
        editing: false,
        askMotivo: false,
      });
    } catch (err) {
      setItem(it.id, { enviando: false });
      setError(err.message);
    }
  };

  const aceitar = (it) => {
    const st = items[it.id];
    if (st.editText.trim() && st.editText.trim() !== it.item) {
      enviarFeedback(it, 'modificado', { editedText: st.editText.trim() });
    } else {
      enviarFeedback(it, 'conforme');
    }
  };

  const copiarPlano = async () => {
    const aceitos = result.plan.itens.filter((it) =>
      ['aceito', 'modificado'].includes(items[it.id]?.status)
    );
    const porCategoria = {};
    for (const it of aceitos) {
      const texto = items[it.id].status === 'modificado' ? items[it.id].editText : it.item;
      (porCategoria[it.categoria] ??= []).push({ texto, meta: it.meta });
    }
    const lines = ['PLANO TERAPÊUTICO'];
    if (result.plan.objetivo_internacao) {
      lines.push(`Objetivo da internação: ${result.plan.objetivo_internacao}`, '');
    }
    for (const [cat, its] of Object.entries(porCategoria)) {
      lines.push(`# ${CATEGORIA_LABEL[cat] || cat}`);
      for (const i of its) {
        lines.push(`- ${i.texto}${i.meta ? ` (Meta: ${i.meta})` : ''}`);
      }
      lines.push('');
    }
    if (result.plan.criterios_alta?.length) {
      lines.push('# Critérios de alta');
      for (const c of result.plan.criterios_alta) lines.push(`- ${c}`);
      lines.push('');
    }
    if (result.plan.dpa) lines.push(`DPA: ${result.plan.dpa}`);
    await navigator.clipboard.writeText(lines.join('\n').trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const grouped = result
    ? result.plan.itens.reduce((acc, it) => (((acc[it.categoria] ??= []).push(it)), acc), {})
    : {};
  const nAvaliados = result
    ? result.plan.itens.filter((it) => items[it.id]?.status !== 'pendente').length
    : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-800">
        <strong>LGPD:</strong> não insira nome, registro, leito, data de nascimento nem qualquer
        identificador do paciente. Apenas o contexto clínico mínimo é armazenado, com expurgo automático.
      </div>

      <form onSubmit={gerar} className="card space-y-4">
        <h2 className="font-semibold text-lg">Dados do caso</h2>

        <div>
          <label className="label">Hipóteses diagnósticas / problemas ativos *</label>
          {problems.map((p, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                className="input"
                value={p}
                placeholder={`Problema ${i + 1} — ex.: Pneumonia comunitária`}
                onChange={(e) =>
                  setProblems((ps) => ps.map((x, j) => (j === i ? e.target.value : x)))
                }
                required={i === 0}
              />
              {problems.length > 1 && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setProblems((ps) => ps.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn-secondary" onClick={() => setProblems((ps) => [...ps, ''])}>
            + Adicionar problema
          </button>
        </div>

        <div>
          <label className="label">Evolução do dia *</label>
          <textarea className="input" rows={3} value={form.evolution} onChange={set('evolution')} required
            placeholder="Ex.: Afebril há 24h, SpO2 94% em O2 2L/min, aceitando dieta, deambulou com auxílio…" />
        </div>

        <div>
          <label className="label">HPMA (opcional)</label>
          <textarea className="input" rows={2} value={form.hpma} onChange={set('hpma')} />
        </div>

        <div>
          <label className="label">Plano terapêutico já elaborado (opcional)</label>
          <textarea className="input" rows={3} value={form.existingPlan} onChange={set('existingPlan')}
            placeholder="Se preenchido, o app aponta lacunas e sugere complementos em vez de gerar do zero." />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="label">Dias de internação</label>
            <input className="input" type="number" min="0" value={form.diasInternacao} onChange={set('diasInternacao')} />
          </div>
          <div>
            <label className="label">Setor</label>
            <select className="input" value={form.setor} onChange={set('setor')}>
              {SETORES.map((s) => <option key={s} value={s}>{s || '—'}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Dispositivos</label>
            <input className="input" value={form.dispositivos} onChange={set('dispositivos')} placeholder="SVD, CVC…" />
          </div>
          <div>
            <label className="label">Dieta atual</label>
            <input className="input" value={form.dieta} onChange={set('dieta')} placeholder="oral, SNE…" />
          </div>
          <div>
            <label className="label">Uso de O2</label>
            <input className="input" value={form.oxigenio} onChange={set('oxigenio')} placeholder="CN 2L/min" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full sm:w-auto" disabled={busy}>
          {busy ? 'Gerando sugestões…' : result ? 'Gerar novamente' : 'Gerar plano sugerido'}
        </button>
      </form>

      {result && (
        <div className="space-y-4">
          {result.plan.objetivo_internacao && (
            <div className="card border-l-4 border-l-brand-600">
              <h3 className="font-semibold text-sm text-slate-500 uppercase">Objetivo da internação</h3>
              <p className="mt-1">{result.plan.objetivo_internacao}</p>
            </div>
          )}

          {result.plan.modo === 'complemento' && result.plan.lacunas.length > 0 && (
            <div className="card bg-amber-50 border-amber-200">
              <h3 className="font-semibold text-amber-800">Lacunas do plano existente</h3>
              <ul className="mt-2 list-disc list-inside text-sm text-amber-900 space-y-1">
                {result.plan.lacunas.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </div>
          )}

          {Object.entries(grouped).map(([cat, its]) => (
            <div key={cat} className="card">
              <h3 className="font-semibold mb-3">{CATEGORIA_LABEL[cat] || cat}</h3>
              <div className="space-y-3">
                {its.map((it) => {
                  const st = items[it.id] || {};
                  const done = st.status !== 'pendente';
                  return (
                    <div
                      key={it.id}
                      className={`rounded-lg border p-3 ${
                        st.status === 'aceito' || st.status === 'modificado'
                          ? 'border-green-300 bg-green-50'
                          : st.status === 'rejeitado'
                          ? 'border-red-200 bg-red-50 opacity-70'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${PRIORIDADE_STYLE[it.prioridade]}`}>
                          {it.prioridade}
                        </span>
                        <div className="flex-1 min-w-0">
                          {st.editing ? (
                            <textarea
                              className="input"
                              rows={2}
                              value={st.editText}
                              onChange={(e) => setItem(it.id, { editText: e.target.value })}
                            />
                          ) : (
                            <p className="text-sm">
                              {st.status === 'modificado' ? st.editText : it.item}
                            </p>
                          )}
                          {it.meta && (
                            <p className="mt-1 text-sm font-semibold text-brand-700">
                              🎯 Meta: {it.meta}
                            </p>
                          )}
                          {it.justificativa && (
                            <p className="mt-1 text-xs text-slate-500">{it.justificativa}</p>
                          )}
                        </div>
                      </div>

                      {!done && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button className="btn-secondary" disabled={st.enviando} onClick={() => aceitar(it)}>
                            👍 Conforme{st.editText.trim() !== it.item ? ' (editado)' : ''}
                          </button>
                          <button
                            className="btn-secondary"
                            disabled={st.enviando}
                            onClick={() => setItem(it.id, { askMotivo: !st.askMotivo })}
                          >
                            👎 Não conforme
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => setItem(it.id, { editing: !st.editing })}
                          >
                            ✏️ {st.editing ? 'Concluir edição' : 'Editar'}
                          </button>
                        </div>
                      )}

                      {!done && st.askMotivo && (
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                          <select
                            className="input max-w-xs"
                            value={st.motivo}
                            onChange={(e) => setItem(it.id, { motivo: e.target.value })}
                          >
                            <option value="">Motivo (opcional)</option>
                            {MOTIVOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          <button
                            className="btn bg-red-600 text-white hover:bg-red-700"
                            disabled={st.enviando}
                            onClick={() => enviarFeedback(it, 'nao_conforme', { motivo: st.motivo })}
                          >
                            Confirmar rejeição
                          </button>
                        </div>
                      )}

                      {done && (
                        <p className="mt-2 text-xs font-medium text-slate-500">
                          {st.status === 'aceito' && '✓ Aceito — registrado para aprendizado'}
                          {st.status === 'modificado' && '✓ Aceito com modificação — registrado para aprendizado'}
                          {st.status === 'rejeitado' && '✗ Rejeitado — registrado para aprendizado'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="grid sm:grid-cols-2 gap-4">
            {result.plan.criterios_alta?.length > 0 && (
              <div className="card">
                <h3 className="font-semibold mb-2">Critérios de alta</h3>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {result.plan.criterios_alta.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            {result.plan.dpa && (
              <div className="card">
                <h3 className="font-semibold mb-2">Data provável de alta (DPA)</h3>
                <p className="text-sm">{result.plan.dpa}</p>
              </div>
            )}
          </div>

          <div className="card flex flex-wrap items-center gap-3">
            <div className="flex-1 text-sm text-slate-500">
              {nAvaliados}/{result.plan.itens.length} itens avaliados — o plano copiado inclui apenas
              itens aceitos (com suas edições).
            </div>
            <button className="btn-primary" onClick={copiarPlano}>
              {copied ? '✓ Copiado!' : '📋 Copiar plano para o prontuário'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
