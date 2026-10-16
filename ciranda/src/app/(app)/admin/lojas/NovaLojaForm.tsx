"use client";
import { useFormState, useFormStatus } from "react-dom";
import { criarLoja, type EstadoLoja } from "../actions";
import { TAXA_LOJA_PADRAO } from "@/lib/constants";

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending}>
      {pending ? "Salvando…" : "Cadastrar loja"}
    </button>
  );
}

export default function NovaLojaForm() {
  const [estado, acao] = useFormState<EstadoLoja, FormData>(criarLoja, {});
  return (
    <form action={acao} className="card space-y-3 p-4">
      <h2 className="font-bold">Nova loja parceira</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="nome" className="input" placeholder="Nome da loja" required />
        <input name="cnpj" className="input" placeholder="CNPJ" />
        <input name="cidade" className="input" placeholder="Cidade" required />
        <input name="telefone" className="input" placeholder="Telefone" />
        <input name="endereco" className="input sm:col-span-2" placeholder="Endereço" />
        <div>
          <label className="text-xs text-app-muted" htmlFor="taxa">Taxa de serviço por carro (%)</label>
          <input id="taxa" name="taxa" type="number" step="0.1" min={0} max={20} className="input" defaultValue={TAXA_LOJA_PADRAO * 100} required />
        </div>
      </div>
      <p className="pt-1 text-sm font-semibold">Acesso do responsável</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="responsavel" className="input" placeholder="Nome" required />
        <input name="email" type="email" className="input" placeholder="E-mail" required />
        <input name="senha" type="password" className="input" placeholder="Senha inicial" minLength={6} required />
      </div>
      {estado.erro && <p className="rounded-lg bg-erro/10 px-3 py-2 text-sm text-erro">{estado.erro}</p>}
      {estado.ok && <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">{estado.ok}</p>}
      <Enviar />
    </form>
  );
}
