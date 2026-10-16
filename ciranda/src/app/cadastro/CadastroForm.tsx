"use client";
import { useFormState, useFormStatus } from "react-dom";
import { cadastrar, type EstadoCadastro } from "./actions";

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Criando conta…" : "Criar conta"}
    </button>
  );
}

export default function CadastroForm() {
  const [estado, acao] = useFormState<EstadoCadastro, FormData>(cadastrar, {});
  return (
    <form action={acao} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="nome">Nome completo</label>
        <input id="nome" name="nome" className="input" autoComplete="name" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" className="input" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="telefone">Celular (WhatsApp)</label>
          <input id="telefone" name="telefone" className="input" inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cidade">Cidade</label>
          <input id="cidade" name="cidade" className="input" defaultValue="São Paulo" required />
          <p className="mt-1 text-xs text-app-muted">As cirandas se formam entre pessoas da mesma cidade.</p>
        </div>
        <div>
          <label className="label" htmlFor="senha">Senha</label>
          <input id="senha" name="senha" type="password" className="input" autoComplete="new-password" minLength={6} required />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="termos" className="mt-1" required />
        <span>
          Concordo que meu primeiro nome e os dados do meu carro sejam mostrados aos participantes das cirandas propostas,
          e que meu contato seja compartilhado com a loja parceira que conduzir a negociação.
        </span>
      </label>
      {estado.erro && (
        <p className="rounded-lg bg-erro/10 px-3 py-2 text-sm text-erro" role="alert">{estado.erro}</p>
      )}
      <Enviar />
    </form>
  );
}
