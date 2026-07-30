import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function Regras() {
  const [rules, setRules] = useState([]);
  const [rejeitados, setRejeitados] = useState([]);
  const [form, setForm] = useState({ tipo: 'evitar', texto: '', contexto: '' });
  const [error, setError] = useState('');
  const [purgeMsg, setPurgeMsg] = useState('');

  const load = () => {
    api.rules().then((d) => setRules(d.rules)).catch((e) => setError(e.message));
    api.dashboard().then((d) => setRejeitados(d.maisRejeitados)).catch(() => {});
  };
  useEffect(load, []);

  const criar = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createRule(form);
      setForm({ tipo: 'evitar', texto: '', contexto: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const promover = async (s) => {
    const motivos = Object.keys(s.motivos).join('; ');
    await api.createRule({
      tipo: 'evitar',
      texto: `Não sugerir "${s.item}"${motivos ? ` (motivos registrados: ${motivos})` : ''}`,
      contexto: s.contexto.startsWith('outro') ? '' : s.contexto,
      origem: 'aprendida',
    });
    load();
  };

  const purgar = async () => {
    const d = await api.purge({ olderThanDays: 90 });
    setPurgeMsg(`Expurgo concluído: ${d.generations} gerações e ${d.feedback} feedbacks anonimizados.`);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Regras aprendidas do serviço</h2>
      <p className="text-sm text-slate-500">
        Regras ativas são injetadas em toda geração de plano. Use-as para transformar padrões de
        rejeição em orientações explícitas (ex.: “não sugerir X; o serviço usa Y”).
      </p>

      <form onSubmit={criar} className="card space-y-3">
        <h3 className="font-semibold">Nova regra</h3>
        <div className="flex flex-wrap gap-3">
          <select
            className="input max-w-36"
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
          >
            <option value="evitar">Evitar</option>
            <option value="preferir">Preferir</option>
          </select>
          <input
            className="input flex-1 min-w-60"
            placeholder='Ex.: Não sugerir levofloxacino; o serviço usa amoxicilina-clavulanato'
            value={form.texto}
            onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
            required
          />
          <input
            className="input max-w-48"
            placeholder="Contexto (ex.: pneumonia) — vazio = todos"
            value={form.contexto}
            onChange={(e) => setForm((f) => ({ ...f, contexto: e.target.value }))}
          />
          <button className="btn-primary">Adicionar</button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div className="card">
        <h3 className="font-semibold mb-3">Regras cadastradas</h3>
        {rules.length === 0 && <p className="text-sm text-slate-400">Nenhuma regra ainda.</p>}
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center gap-3 text-sm border-b border-slate-100 pb-2">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${r.tipo === 'evitar' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {r.tipo}
              </span>
              <span className={`flex-1 ${r.ativo ? '' : 'line-through text-slate-400'}`}>
                {r.texto}
                {r.contexto && <span className="text-xs text-slate-400"> [{r.contexto}]</span>}
                {r.origem === 'aprendida' && <span className="text-xs text-brand-600"> · aprendida</span>}
              </span>
              <button
                className="btn-secondary"
                onClick={() => api.updateRule(r.id, { ativo: !r.ativo }).then(load)}
              >
                {r.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <button
                className="btn-secondary text-red-600"
                onClick={() => api.deleteRule(r.id).then(load)}
              >
                Excluir
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-2">Padrões rejeitados — promover a regra</h3>
        <p className="text-sm text-slate-500 mb-3">
          Itens com baixa aceitação no serviço. Promova-os a regra explícita de “evitar”.
        </p>
        {rejeitados.filter((s) => s.score <= 0.4).length === 0 && (
          <p className="text-sm text-slate-400">Nenhum padrão de rejeição relevante ainda.</p>
        )}
        <div className="space-y-2">
          {rejeitados.filter((s) => s.score <= 0.4).map((s, i) => (
            <div key={i} className="flex items-center gap-3 text-sm border-b border-slate-100 pb-2">
              <span className="flex-1">
                {s.item}
                <span className="text-xs text-slate-400"> ({s.contexto}, aceitação {Math.round(s.score * 100)}%, n={s.n})</span>
              </span>
              <button className="btn-secondary" onClick={() => promover(s)}>Transformar em regra</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-2">LGPD — anonimização / expurgo</h3>
        <p className="text-sm text-slate-500 mb-3">
          Remove o texto clínico livre (problemas e edições) com mais de 90 dias, preservando apenas
          os agregados de aprendizado. Também roda automaticamente a cada 24h no servidor.
        </p>
        <button className="btn-secondary" onClick={purgar}>Executar expurgo agora</button>
        {purgeMsg && <p className="mt-2 text-sm text-green-700">{purgeMsg}</p>}
      </div>
    </div>
  );
}
