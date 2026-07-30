import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', name: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = mode === 'login' ? await api.login(form) : await api.register(form);
      onLogin(d.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-xl font-bold text-brand-700 mb-1">PTx Adaptativo</h1>
        <p className="text-sm text-slate-500 mb-4">
          Assistente de plano terapêutico com aprendizado do serviço.
        </p>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="label">Nome</label>
              <input className="input" value={form.name} onChange={set('name')} required />
            </div>
          )}
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div>
            <label className="label">Senha</label>
            <input className="input" type="password" value={form.password} onChange={set('password')} required minLength={6} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        <button
          className="mt-3 text-sm text-brand-600 hover:underline"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>
        <p className="mt-4 text-xs text-slate-400">
          O primeiro usuário cadastrado torna-se administrador do serviço.
        </p>
      </div>
    </div>
  );
}
