import { useMemo, useState } from 'react';
import { api } from '../api.js';

const SETORES = [
  { valor: '', rotulo: 'Setor (opcional)' },
  { valor: 'enfermaria', rotulo: 'Enfermaria' },
  { valor: 'uti', rotulo: 'UTI' },
  { valor: 'pa', rotulo: 'Pronto atendimento' },
];

const MOTIVOS = [
  'não disponível no serviço',
  'logística inviável',
  'não se aplica ao perfil de pacientes',
  'redundante',
];

const COR_PRIORIDADE = {
  alta: 'bg-red-100 text-red-800',
  'média': 'bg-amber-100 text-amber-800',
  baixa: 'bg-slate-100 text-slate-600',
};

export default function Plano() {
  // ---- formulário ----
  const [problemas, setProblemas] = useState(['']);
  const [hpma, setHpma] = useState('');
  const [evolucao, setEvolucao] = useState('');
  const [planoExistente, setPlanoExistente] = useState('');
  const [estruturado, setEstruturado] = useState({ diasInternacao: '', setor: '', dispositivos: '', dieta: '', oxigenio: '' });
  const [mostrarOpcionais, setMostrarOpcionais] = useState(false);

  // ---- resultado ----
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null); // { geracaoId, contexto, plano }
  // estado por item: { decisao: null|'conforme'|'nao_conforme'|'aceito_modificado', texto, motivo, editando, enviado }
  const [itens, setItens] = useState([]);
  const [copiado, setCopiado] = useState(false);

  const campoEstruturado = (k) => (e) => setEstruturado({ ...estruturado, [k]: e.target.value });

  function atualizarProblema(i, v) {
    const lista = [...problemas];
    lista[i] = v;
    setProblemas(lista);
  }

  async function gerar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    setResultado(null);
    setCopiado(false);
    try {
      const r = await api('/api/plano/gerar', {
        metodo: 'POST',
        corpo: {
          problemas: problemas.map((p) => p.trim()).filter(Boolean),
          hpma, evolucao, planoExistente,
          diasInternacao: estruturado.diasInternacao || undefined,
          setor: estruturado.setor || undefined,
          dispositivos: estruturado.dispositivos || undefined,
          dieta: estruturado.dieta || undefined,
          oxigenio: estruturado.oxigenio || undefined,
        },
      });
      setResultado(r);
      setItens(r.plano.itens.map((it) => ({ ...it, decisao: null, texto: it.item, motivo: '', editando: false, enviado: false })));
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function enviarFeedback(indice, decisao, extras = {}) {
    const it = itens[indice];
    const corpo = {
      geracaoId: resultado.geracaoId,
      categoria: it.categoria,
      item: it.item,
      decisao,
      motivo: extras.motivo ?? it.motivo ?? '',
      textoEditado: decisao === 'aceito_modificado' ? it.texto : '',
      contextoClinico: resultado.contexto.problemas,
      setor: resultado.contexto.setor ?? undefined,
    };
    try {
      await api('/api/feedback', { metodo: 'POST', corpo });
      setItens((atual) => atual.map((x, i) => (i === indice ? { ...x, decisao, editando: false, enviado: true, ...extras } : x)));
    } catch (err) {
      setErro(`Falha ao registrar feedback: ${err.message}`);
    }
  }

  const grupos = useMemo(() => {
    const m = new Map();
    itens.forEach((it, indice) => {
      if (!m.has(it.categoria)) m.set(it.categoria, []);
      m.get(it.categoria).push({ ...it, indice });
    });
    return [...m.entries()];
  }, [itens]);

  function textoPlanoFinal() {
    const p = resultado.plano;
    const aceitos = itens.filter((i) => i.decisao === 'conforme' || i.decisao === 'aceito_modificado');
    const linhas = ['PLANO TERAPÊUTICO'];
    if (p.objetivo_internacao) linhas.push(`Objetivo da internação: ${p.objetivo_internacao}`);
    linhas.push('');
    const porCategoria = new Map();
    for (const it of aceitos) {
      if (!porCategoria.has(it.categoria)) porCategoria.set(it.categoria, []);
      porCategoria.get(it.categoria).push(it);
    }
    for (const [cat, lista] of porCategoria) {
      linhas.push(cat.toUpperCase() + ':');
      for (const it of lista) {
        linhas.push(`- ${it.texto}${it.meta ? ` | Meta: ${it.meta}` : ''}`);
      }
      linhas.push('');
    }
    if (p.criterios_alta?.length) {
      linhas.push('CRITÉRIOS DE ALTA:');
      for (const c of p.criterios_alta) linhas.push(`- ${c}`);
    }
    if (p.dpa_estimada) linhas.push(`DPA (data provável de alta): ${p.dpa_estimada}`);
    return linhas.join('\n').trim();
  }

  async function copiarPlano() {
    try {
      await navigator.clipboard.writeText(textoPlanoFinal());
    } catch {
      // fallback para contextos sem clipboard API
      const ta = document.createElement('textarea');
      ta.value = textoPlanoFinal();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  const nAceitos = itens.filter((i) => i.decisao === 'conforme' || i.decisao === 'aceito_modificado').length;

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded px-3 py-2">
        ⚠️ Não insira identificadores do paciente (nome, registro, nascimento). Informe apenas o contexto clínico mínimo.
      </div>

      {/* ---------------- formulário ---------------- */}
      <form onSubmit={gerar} className="bg-white rounded-xl shadow p-4 space-y-3">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Hipóteses diagnósticas / problemas ativos *</label>
          {problemas.map((p, i) => (
            <div key={i} className="flex gap-2 mb-1">
              <input
                className="flex-1 border rounded px-3 py-2 text-sm"
                placeholder={`Problema ${i + 1} — ex.: Pneumonia comunitária`}
                value={p}
                onChange={(e) => atualizarProblema(i, e.target.value)}
                required={i === 0}
              />
              {problemas.length > 1 && (
                <button type="button" className="text-red-600 px-2" title="Remover" onClick={() => setProblemas(problemas.filter((_, j) => j !== i))}>✕</button>
              )}
            </div>
          ))}
          <button type="button" className="text-sm text-teal-700 hover:underline" onClick={() => setProblemas([...problemas, ''])}>+ adicionar problema</button>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Evolução do dia *</label>
          <textarea className="w-full border rounded px-3 py-2 text-sm" rows={3} required value={evolucao} onChange={(e) => setEvolucao(e.target.value)}
            placeholder="Ex.: Afebril há 24h, mantém O2 em cateter nasal 2 L/min, aceitando dieta, deambulou com fisioterapia…" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Plano terapêutico já elaborado (opcional)</label>
          <textarea className="w-full border rounded px-3 py-2 text-sm" rows={3} value={planoExistente} onChange={(e) => setPlanoExistente(e.target.value)}
            placeholder="Cole aqui o plano existente — o app apontará lacunas e sugerirá complementos em vez de gerar do zero." />
        </div>

        <button type="button" className="text-sm text-teal-700 hover:underline" onClick={() => setMostrarOpcionais(!mostrarOpcionais)}>
          {mostrarOpcionais ? '▾ ocultar campos opcionais' : '▸ HPMA e campos estruturados (opcional)'}
        </button>

        {mostrarOpcionais && (
          <div className="space-y-3 border-t pt-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">HPMA</label>
              <textarea className="w-full border rounded px-3 py-2 text-sm" rows={2} value={hpma} onChange={(e) => setHpma(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <input className="border rounded px-2 py-2 text-sm" type="number" min="0" placeholder="Dias de internação" value={estruturado.diasInternacao} onChange={campoEstruturado('diasInternacao')} />
              <select className="border rounded px-2 py-2 text-sm" value={estruturado.setor} onChange={campoEstruturado('setor')}>
                {SETORES.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
              </select>
              <input className="border rounded px-2 py-2 text-sm" placeholder="Dispositivos (SVD, CVC…)" value={estruturado.dispositivos} onChange={campoEstruturado('dispositivos')} />
              <input className="border rounded px-2 py-2 text-sm" placeholder="Dieta atual" value={estruturado.dieta} onChange={campoEstruturado('dieta')} />
              <input className="border rounded px-2 py-2 text-sm" placeholder="O2 (ex.: CN 2 L/min)" value={estruturado.oxigenio} onChange={campoEstruturado('oxigenio')} />
            </div>
          </div>
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button disabled={carregando} className="w-full sm:w-auto bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white rounded px-6 py-2 font-semibold">
          {carregando ? 'Gerando sugestões…' : planoExistente.trim() ? 'Analisar plano e complementar' : 'Gerar plano sugerido'}
        </button>
      </form>

      {/* ---------------- resultado ---------------- */}
      {resultado && (
        <div className="space-y-4">
          {resultado.plano.objetivo_internacao && (
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="text-sm font-bold text-slate-500 uppercase">Objetivo da internação</h2>
              <p className="text-slate-800">{resultado.plano.objetivo_internacao}</p>
            </div>
          )}

          {resultado.plano.modo === 'analise' && resultado.plano.lacunas.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <h2 className="text-sm font-bold text-orange-800 uppercase mb-2">Lacunas do plano atual</h2>
              <ul className="space-y-1 text-sm text-orange-900">
                {resultado.plano.lacunas.map((l, i) => (
                  <li key={i}><span className="font-semibold">{l.componente}:</span> {l.descricao}</li>
                ))}
              </ul>
            </div>
          )}

          {grupos.map(([categoria, lista]) => (
            <div key={categoria} className="bg-white rounded-xl shadow p-4">
              <h2 className="text-sm font-bold text-teal-800 uppercase mb-2">{categoria}</h2>
              <div className="space-y-3">
                {lista.map((it) => (
                  <div key={it.indice} className={`border rounded-lg p-3 ${it.decisao === 'nao_conforme' ? 'opacity-60 border-red-200' : it.decisao ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'}`}>
                    <div className="flex flex-wrap items-start gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${COR_PRIORIDADE[it.prioridade] ?? COR_PRIORIDADE['média']}`}>{it.prioridade}</span>
                      <div className="flex-1 min-w-[200px]">
                        {it.editando ? (
                          <textarea
                            className="w-full border rounded px-2 py-1 text-sm"
                            rows={2}
                            value={it.texto}
                            onChange={(e) => setItens((a) => a.map((x, i) => (i === it.indice ? { ...x, texto: e.target.value } : x)))}
                          />
                        ) : (
                          <p className="text-sm text-slate-800">{it.texto}</p>
                        )}
                        {it.meta && (
                          <p className="text-sm mt-1"><span className="bg-teal-100 text-teal-900 font-semibold px-2 py-0.5 rounded">🎯 Meta: {it.meta}</span></p>
                        )}
                        {it.justificativa && <p className="text-xs text-slate-500 mt-1">{it.justificativa}</p>}
                      </div>
                    </div>

                    {/* ações */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {it.decisao === null && !it.editando && (
                        <>
                          <button className="text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-1" onClick={() => enviarFeedback(it.indice, 'conforme')}>👍 Conforme</button>
                          <button className="text-sm bg-slate-200 hover:bg-slate-300 rounded px-3 py-1" onClick={() => setItens((a) => a.map((x, i) => (i === it.indice ? { ...x, editando: true } : x)))}>✏️ Editar</button>
                          <select
                            className="text-sm border rounded px-2 py-1 text-slate-600"
                            value={it.motivo}
                            onChange={(e) => setItens((a) => a.map((x, i) => (i === it.indice ? { ...x, motivo: e.target.value } : x)))}
                          >
                            <option value="">👎 motivo (opcional)…</option>
                            {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <button className="text-sm bg-red-600 hover:bg-red-500 text-white rounded px-3 py-1" onClick={() => enviarFeedback(it.indice, 'nao_conforme')}>👎 Não conforme</button>
                        </>
                      )}
                      {it.editando && (
                        <>
                          <button className="text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-1" onClick={() => enviarFeedback(it.indice, 'aceito_modificado')}>Salvar e aceitar (modificado)</button>
                          <button className="text-sm text-slate-500 hover:underline" onClick={() => setItens((a) => a.map((x, i) => (i === it.indice ? { ...x, editando: false, texto: x.item } : x)))}>cancelar</button>
                        </>
                      )}
                      {it.decisao === 'conforme' && <span className="text-xs text-emerald-700 font-semibold">✔ aceito</span>}
                      {it.decisao === 'aceito_modificado' && <span className="text-xs text-emerald-700 font-semibold">✔ aceito com modificação</span>}
                      {it.decisao === 'nao_conforme' && <span className="text-xs text-red-600 font-semibold">✖ rejeitado{it.motivo ? ` — ${it.motivo}` : ''}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {(resultado.plano.criterios_alta.length > 0 || resultado.plano.dpa_estimada) && (
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="text-sm font-bold text-teal-800 uppercase mb-2">Critérios de alta e DPA</h2>
              <ul className="list-disc pl-5 text-sm text-slate-800 space-y-1">
                {resultado.plano.criterios_alta.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
              {resultado.plano.dpa_estimada && (
                <p className="mt-2 text-sm"><span className="bg-indigo-100 text-indigo-900 font-semibold px-2 py-0.5 rounded">📅 DPA: {resultado.plano.dpa_estimada}</span></p>
              )}
            </div>
          )}

          {resultado.plano.observacao && (
            <p className="text-xs text-slate-500 px-1">{resultado.plano.observacao}</p>
          )}

          <div className="sticky bottom-3 flex justify-center">
            <button
              onClick={copiarPlano}
              disabled={nAceitos === 0}
              className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-white rounded-full shadow-lg px-6 py-3 font-semibold"
            >
              {copiado ? '✔ Copiado para a área de transferência' : `📋 Copiar plano final (${nAceitos} ${nAceitos === 1 ? 'item aceito' : 'itens aceitos'})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
