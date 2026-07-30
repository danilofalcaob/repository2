import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

function Bar({ value }) {
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-full">
      <div
        className={`h-full rounded-full ${value >= 0.7 ? 'bg-green-500' : value >= 0.4 ? 'bg-amber-500' : 'bg-red-500'}`}
        style={{ width: `${Math.round((value || 0) * 100)}%` }}
      />
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.dashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Carregando…</p>;

  const { totals, total, conformidade, porCategoria, evolucao, motivosRejeicao, maisAceitos, maisRejeitados } = data;

  const maxEvol = Math.max(1, ...evolucao.map((e) => e.total));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Painel de aprendizado</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-brand-700">{pct(conformidade)}</p>
          <p className="text-xs text-slate-500 mt-1">Conformidade global</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">{totals.conforme}</p>
          <p className="text-xs text-slate-500 mt-1">Conformes 👍</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-amber-600">{totals.modificado}</p>
          <p className="text-xs text-slate-500 mt-1">Aceitos com modificação</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-red-600">{totals.nao_conforme}</p>
          <p className="text-xs text-slate-500 mt-1">Não conformes 👎</p>
        </div>
      </div>

      {total === 0 && (
        <p className="text-sm text-slate-500">
          Ainda não há feedback registrado. Avalie sugestões na aba Plano para alimentar o aprendizado.
        </p>
      )}

      {evolucao.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3">Evolução da assertividade (por semana)</h3>
          <div className="flex items-end gap-2 h-36">
            {evolucao.map((e) => (
              <div key={e.week} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <span className="text-[10px] text-slate-500">{pct(e.conformidade)}</span>
                <div
                  className="w-full max-w-10 rounded-t bg-brand-500"
                  style={{ height: `${Math.max(4, (e.conformidade || 0) * 100)}px` }}
                  title={`${e.week}: ${e.total} avaliações`}
                />
                <span className="text-[10px] text-slate-400 truncate w-full text-center">{e.week}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {porCategoria.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3">Conformidade por categoria</h3>
          <div className="space-y-2">
            {porCategoria
              .sort((a, b) => (b.conformidade ?? 0) - (a.conformidade ?? 0))
              .map((c) => (
                <div key={c.categoria} className="flex items-center gap-3 text-sm">
                  <span className="w-52 shrink-0 truncate">{c.categoria}</span>
                  <Bar value={c.conformidade} />
                  <span className="w-20 text-right text-slate-500 shrink-0">
                    {pct(c.conformidade)} (n={c.total})
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold mb-2">Itens mais aceitos</h3>
          {maisAceitos.length === 0 && <p className="text-sm text-slate-400">Sem dados suficientes.</p>}
          <ul className="space-y-2 text-sm">
            {maisAceitos.map((s, i) => (
              <li key={i} className="border-b border-slate-100 pb-1">
                <span className="font-medium text-green-700">{pct(s.score)}</span> — {s.item}
                <span className="text-xs text-slate-400"> ({s.contexto}, n={s.n})</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-2">Itens mais rejeitados</h3>
          {maisRejeitados.length === 0 && <p className="text-sm text-slate-400">Sem dados suficientes.</p>}
          <ul className="space-y-2 text-sm">
            {maisRejeitados.map((s, i) => (
              <li key={i} className="border-b border-slate-100 pb-1">
                <span className="font-medium text-red-600">{pct(s.score)}</span> — {s.item}
                <span className="text-xs text-slate-400"> ({s.contexto}, n={s.n})</span>
                {Object.keys(s.motivos).length > 0 && (
                  <p className="text-xs text-slate-500">
                    Motivos: {Object.entries(s.motivos).map(([m, c]) => `${m} (${c})`).join('; ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {motivosRejeicao.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3">Principais motivos de rejeição</h3>
          <div className="space-y-2">
            {motivosRejeicao.map((m) => {
              const max = motivosRejeicao[0].c;
              return (
                <div key={m.motivo} className="flex items-center gap-3 text-sm">
                  <span className="w-64 shrink-0 truncate">{m.motivo}</span>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-full">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${(m.c / max) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-slate-500 shrink-0">{m.c}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
