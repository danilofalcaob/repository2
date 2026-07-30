import { useState } from 'react';
import { api, salvarSessao } from '../api.js';

export default function Login({ aoEntrar }) {
  const [modo, setModo] = useState('login');
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const campo = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const rota = modo === 'login' ? '/api/auth/login' : '/api/auth/registrar';
      const r = await api(rota, { metodo: 'POST', corpo: form });
      salvarSessao(r.token, r.usuario);
      aoEntrar(r.usuario);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-teal-800">PTx Adaptativo</h1>
        <p className="text-sm text-slate-600 mb-4">Assistente de plano terapêutico para pacientes internados.</p>

        <form onSubmit={enviar} className="space-y-3">
          {modo === 'registro' && (
            <input className="w-full border rounded px-3 py-2" placeholder="Nome" value={form.nome} onChange={campo('nome')} required />
          )}
          <input className="w-full border rounded px-3 py-2" type="email" placeholder="E-mail" value={form.email} onChange={campo('email')} required />
          <input className="w-full border rounded px-3 py-2" type="password" placeholder="Senha" value={form.senha} onChange={campo('senha')} required minLength={6} />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button disabled={carregando} className="w-full bg-teal-700 hover:bg-teal-600 disabled:opacity-50 text-white rounded py-2 font-semibold">
            {carregando ? 'Aguarde…' : modo === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button className="mt-3 text-sm text-teal-700 hover:underline" onClick={() => { setModo(modo === 'login' ? 'registro' : 'login'); setErro(''); }}>
          {modo === 'login' ? 'Primeiro acesso? Criar conta' : 'Já tenho conta — entrar'}
        </button>

        <p className="mt-4 text-xs text-slate-500 border-t pt-3">
          Este sistema não coleta dados identificáveis de pacientes (LGPD). Use apenas o contexto clínico mínimo necessário.
        </p>
      </div>
    </div>
  );
}
