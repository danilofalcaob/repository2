import { useEffect, useState } from 'react';
import { obterUsuario, limparSessao } from './api.js';
import Login from './pages/Login.jsx';
import Plano from './pages/Plano.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Regras from './pages/Regras.jsx';

const ABAS = [
  { id: 'plano', rotulo: 'Plano do dia' },
  { id: 'dashboard', rotulo: 'Painel de aprendizado' },
  { id: 'regras', rotulo: 'Regras do serviço' },
];

export default function App() {
  const [usuario, setUsuario] = useState(obterUsuario());
  const [aba, setAba] = useState('plano');

  useEffect(() => {
    const aoDeslogar = () => setUsuario(null);
    window.addEventListener('ptx:deslogado', aoDeslogar);
    return () => window.removeEventListener('ptx:deslogado', aoDeslogar);
  }, []);

  if (!usuario) return <Login aoEntrar={setUsuario} />;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-teal-800 text-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold leading-tight">PTx Adaptativo</h1>
            <p className="text-teal-100 text-xs">Plano terapêutico com apoio de IA — a conduta final é sempre do médico assistente</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline">{usuario.nome}{usuario.papel === 'admin' ? ' (admin)' : ''}</span>
            <button
              className="bg-teal-700 hover:bg-teal-600 rounded px-3 py-1"
              onClick={() => { limparSessao(); setUsuario(null); }}
            >Sair</button>
          </div>
        </div>
        <nav className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`px-3 py-2 text-sm rounded-t whitespace-nowrap ${aba === a.id ? 'bg-slate-100 text-teal-900 font-semibold' : 'text-teal-100 hover:bg-teal-700'}`}
            >{a.rotulo}</button>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4">
        {aba === 'plano' && <Plano usuario={usuario} />}
        {aba === 'dashboard' && <Dashboard />}
        {aba === 'regras' && <Regras usuario={usuario} />}
      </main>

      <footer className="text-center text-xs text-slate-500 py-3 px-4">
        Não insira nome, registro, data de nascimento ou qualquer identificador do paciente (LGPD).
        As sugestões são apoio à decisão e não substituem o julgamento clínico.
      </footer>
    </div>
  );
}
