import { useEffect, useState } from 'react';
import { api } from '../api.js';

const TIPOS = [
  { valor: 'evitar', rotulo: 'Evitar' },
  { valor: 'preferir', rotulo: 'Preferir' },
  { valor: 'fraseado', rotulo: 'Fraseado/logística' },
];

export default function Regras({ usuario }) {
  const [regras, setRegras] = useState([]);
  const [rejeitados, setRejeitados] = useState([]);
  const [nova, setNova] = useState({ tipo: 'evitar', texto: '' });
  const [erro, setErro] = useState('');
  const admin = usuario.papel === 'admin';

  async function carregar() {
    try {
      const r = await api('/api/regras');
      setRegras(r.regras);
      if (admin) {
        const d = await api('/api/dashboard');
        setRejeitados(d.maisRejeitados.filter((s) => s.taxa <= 0.4 && s.n >= 2));
      }
    } catch (e) {
      setErro(e.message);
    }
  }
  useEffect(() => { carregar(); }, []);

  async function criar(e) {
    e.preventDefault();
    setErro('');
    try {
      await api('/api/regras', { metodo: 'POST', corpo: nova });
      setNova({ tipo: 'evitar', texto: '' });
      carregar();
    } catch (err) { setErro(err.message); }
  }

  async function alternar(regra) {
    await api(`/api/regras/${regra.id}`, { metodo: 'PUT', corpo: { ativo: !regra.ativo } });
    carregar();
  }

  async function remover(regra) {
    if (!window.confirm('Remover esta regra?')) return;
    await api(`/api/regras/${regra.id}`, { metodo: 'DELETE' });
    carregar();
  }

  async function promover(score) {
    const motivos = score.motivos?.length ? ` (motivos: ${score.motivos.join('; ')})` : '';
    const texto = `Não sugerir "${score.item_exemplo}"${score.setor ? ` no setor ${score.setor}` : ''} — padrão rejeitado pelo serviço${motivos}. Adaptar à alternativa usada localmente.`;
    await api('/api/regras', { metodo: 'POST', corpo: { tipo: 'evitar', texto, origem: 'promovida' } });
    carregar();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Regras aprovadas são injetadas em toda geração de plano e têm prioridade sobre o histórico estatístico.
        {!admin && ' Apenas administradores podem criar ou editar regras.'}
      </p>
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {admin && (
        <form onSubmit={criar} className="bg-white rounded-xl shadow p-4 space-y-2">
          <h2 className="text-sm font-bold text-teal-800 uppercase">Nova regra</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <select className="border rounded px-2 py-2 text-sm" value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value })}>
              {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
            </select>
            <input className="flex-1 border rounded px-3 py-2 text-sm" required value={nova.texto}
              onChange={(e) => setNova({ ...nova, texto: e.target.value })}
              placeholder='Ex.: Não sugerir levofloxacino; o serviço usa amoxicilina-clavulanato.' />
            <button className="bg-teal-700 hover:bg-teal-600 text-white rounded px-4 py-2 text-sm font-semibold">Criar</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-sm font-bold text-teal-800 uppercase mb-2">Regras do serviço</h2>
        {regras.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma regra cadastrada.</p>
        ) : (
          <ul className="divide-y">
            {regras.map((r) => (
              <li key={r.id} className="py-2 flex flex-wrap items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${r.ativo ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-500'}`}>
                  {TIPOS.find((t) => t.valor === r.tipo)?.rotulo ?? r.tipo}{r.origem === 'promovida' ? ' · promovida' : ''}
                </span>
                <span className={`flex-1 text-sm min-w-[200px] ${r.ativo ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{r.texto}</span>
                {admin && (
                  <span className="flex gap-2">
                    <button className="text-xs text-teal-700 hover:underline" onClick={() => alternar(r)}>{r.ativo ? 'desativar' : 'ativar'}</button>
                    <button className="text-xs text-red-600 hover:underline" onClick={() => remover(r)}>remover</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {admin && rejeitados.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-bold text-red-700 uppercase mb-2">Padrões rejeitados — promover a regra?</h2>
          <p className="text-xs text-slate-500 mb-2">Transforme um padrão de rejeição recorrente em regra explícita do serviço.</p>
          <ul className="space-y-2">
            {rejeitados.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex-1 min-w-[200px] text-slate-800">{s.item_exemplo}
                  <span className="text-xs text-slate-500"> · {s.categoria} · rejeição {((1 - s.taxa) * 100).toFixed(0)}% em {s.n}</span>
                </span>
                <button className="text-xs bg-red-600 hover:bg-red-500 text-white rounded px-3 py-1" onClick={() => promover(s)}>Promover a regra</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
