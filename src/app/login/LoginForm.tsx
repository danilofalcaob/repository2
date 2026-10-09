"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import TextoComCodigo from "@/components/TextoComCodigo";

const ATALHOS = [
  { rotulo: "Medicina", email: "gustavo@demo.com" },
  { rotulo: "Enfermagem", email: "sofia@demo.com" },
  { rotulo: "Fisioterapia", email: "rafael@demo.com" },
  { rotulo: "Serviço Social", email: "marina@demo.com" },
  { rotulo: "Coordenação", email: "coord@demo.com" },
  { rotulo: "Admin", email: "admin@demo.com" },
];

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
        setErro(
          d.erro ??
            "O servidor encontrou um erro inesperado. Veja a mensagem no terminal onde o app está rodando.",
        );
        return;
      }
      router.push("/jornada");
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
          <TextoComCodigo texto={erro} />
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={carregando}>
        {carregando ? "Entrando…" : "Entrar"}
      </button>

      <div className="space-y-1.5 pt-1">
        <p className="text-xs text-clinic-muted">Preencher com um usuário de demonstração:</p>
        <div className="flex flex-wrap gap-2">
          {ATALHOS.map((a) => (
            <button
              key={a.email}
              type="button"
              className="btn-secondary !px-2 !py-1 text-xs"
              onClick={() => preencher(a.email)}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
