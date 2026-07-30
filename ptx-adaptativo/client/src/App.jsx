import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { api } from './lib/api.js';
import Login from './pages/Login.jsx';
import Gerador from './pages/Gerador.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Regras from './pages/Regras.jsx';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = carregando
  const navigate = useNavigate();

  useEffect(() => {
    api.me()
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
    navigate('/login');
  };

  if (user === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const tab = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium ${
      isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
          <span className="font-bold text-brand-700 text-lg mr-2">PTx Adaptativo</span>
          <nav className="flex gap-1 flex-1">
            <NavLink to="/" end className={tab}>Plano</NavLink>
            <NavLink to="/dashboard" className={tab}>Painel</NavLink>
            {user.role === 'admin' && <NavLink to="/regras" className={tab}>Regras</NavLink>}
          </nav>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="hidden sm:inline">{user.name}{user.role === 'admin' ? ' (admin)' : ''}</span>
            <button onClick={logout} className="btn-secondary">Sair</button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Gerador />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {user.role === 'admin' && <Route path="/regras" element={<Regras />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="max-w-5xl mx-auto px-4 pb-6 text-xs text-slate-400">
        As sugestões geradas são apoio à decisão clínica — a conduta final é sempre do médico assistente.
        Não insira nome, registro, data de nascimento ou qualquer identificador do paciente.
      </footer>
    </div>
  );
}
