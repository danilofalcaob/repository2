import { useEffect, useState } from 'react';
import { api } from '../api.js';

function pct(n) { return `${(n * 100).toFixed(0)}%`; }

function taxaGlobal(g) {
  if (!g || !g.total) return null;
  return (Number(g.conformes) + Number(g.modificados)) / Number(g.total);
}

function Barra({ rotulo, valor, total, detalhe }) {
  const proporcao = total > 0 ? valor / total : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-slate-600 mb-0.5">
        <span className="truncate pr-2">{rotulo}</span>
        <span>{detalhe ?? pct(proporcao)}</span>
      </div>
      <div className="h-2 bg-slate-200 rounded overflow-hidden">
        <div className="h-full bg-teal-600 rounded" style={{ width: pct(proporcao) }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api('/api/dashboard').then(setDados).catch((e) => setErro(e.message));
  }, []);

  if (erro) return <p className="text-red-600">{erro}</p>;
  if (!dados) return <p className="text-slate-500">Carregando painel…</p>;

  const g = dados.global;
  const taxa = taxaGlobal(g);

  return (
    <div className="space-y-4">
      {/* cartões-resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Cartao titulo="Avaliações" valor={g.total ?? 0} />
        <Cartao titulo="Taxa de conformidade" valor={taxa === null ? '—' : pct(taxa)} destaque />
        <Cartao titulo="Aceitos c/ modificação" valor={g.modificados ?? 0} />
        <Cartao titulo="Não conformes" valor={g.nao_conformes ?? 0} />
      </div>

      {g.total === 0 && (
        <p className="text-sm text-slate-500 bg-white rounded-xl shadow p-4">
          Ainda não há feedback registrado. Gere planos e avalie os itens (👍/👎) para o painel ganhar vida — e para as próximas sugestões se adaptarem ao serviço.
        </p>
      )}

      {/* evolução semanal */}
      {dados.serieSemanal.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-bold text-teal-800 uppercase mb-3">Evolução da assertividade (semanal)</h2>
          {dados.serieSemanal.map((s) => (
            <Barra key={s.semana} rotulo={`Semana ${s.semana}`} valor={Number(s.aceitos)} total={Number(s.total)}
              detalhe={`${pct(Number(s.aceitos) / Number(s.total))} de ${s.total}`} />
          ))}
        </div>
      )}

      {/* por categoria */}
      {dados.porCategoria.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-bold text-teal-800 uppercase mb-3">Conformidade por categoria</h2>
          {dados.porCategoria.map((c) => (
            <Barra key={c.categoria} rotulo={c.categoria}
              valor={Number(c.conformes) + Number(c.modificados)} total={Number(c.total)}
              detalhe={`${pct((Number(c.conformes) + Number(c.modificados)) / Number(c.total))} de ${c.total}`} />
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <ListaItens titulo="Itens mais aceitos" itens={dados.maisAceitos} cor="text-emerald-700" formato={(s) => `${pct(s.taxa)} de aceitação em ${s.n}`} />
        <ListaItens titulo="Itens mais rejeitados" itens={dados.maisRejeitados} cor="text-red-700" formato={(s) => `${pct(1 - s.taxa)} de rejeição em ${s.n}`} />
      </div>

      {/* motivos de rejeição */}
      {dados.motivosRejeicao.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-bold text-teal-800 uppercase mb-3">Principais motivos de rejeição</h2>
          {dados.motivosRejeicao.map((m) => (
            <Barra key={m.motivo} rotulo={m.motivo} valor={Number(m.total)} total={Number(dados.motivosRejeicao[0].total)} detalhe={`${m.total}×`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Cartao({ titulo, valor, destaque }) {
  return (
    <div className={`rounded-xl shadow p-3 ${destaque ? 'bg-teal-700 text-white' : 'bg-white'}`}>
      <p className={`text-xs ${destaque ? 'text-teal-100' : 'text-slate-500'}`}>{titulo}</p>
      <p className="text-2xl font-bold">{valor}</p>
    </div>
  );
}

function ListaItens({ titulo, itens, cor, formato }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h2 className={`text-sm font-bold uppercase mb-2 ${cor}`}>{titulo}</h2>
      {itens.length === 0 ? (
        <p className="text-sm text-slate-400">Sem dados ainda.</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((s) => (
            <li key={s.id} className="text-sm">
              <p className="text-slate-800">{s.item_exemplo}</p>
              <p className="text-xs text-slate-500">
                {s.categoria}{s.setor ? ` · ${s.setor}` : ''} · {formato(s)}
                {s.motivos?.length ? ` · motivos: ${s.motivos.join('; ')}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
