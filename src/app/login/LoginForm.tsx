"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErro(d.erro ?? "Falha ao entrar.");
        return;
      }
      router.push("/quadro");
      router.refresh();
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  function preencher(e: string) {
    setEmail(e);
    setSenha("demo123");
  }

  return (
    <form onSubmit={enviar} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="senha">
          Senha
        </label>
        <input
          id="senha"
          type="password"
          autoComplete="current-password"
          className="input"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="••••••••"
          required
        />
      </div>

      {erro && (
        <p className="rounded-lg bg-instavel/10 px-3 py-2 text-sm text-instavel" role="alert">
          {erro}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={carregando}>
        {carregando ? "Entrando…" : "Entrar"}
      </button>

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => preencher("admin@demo.com")}>
          Entrar como Admin
        </button>
        <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => preencher("bruno@demo.com")}>
          Entrar como Plantonista
        </button>
      </div>
    </form>
  );
}
