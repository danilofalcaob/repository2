import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const u = await getUsuarioAtual();
  if (u) redirect("/quadro");

  return (
    <main className="flex min-h-screen items-center justify-center bg-clinic-bg p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-clinic-primary text-2xl text-clinic-primaryfg">
            ＋
          </div>
          <h1 className="text-2xl font-bold">Passagem de Plantão</h1>
          <p className="mt-1 text-sm text-clinic-muted">
            Handoff médico estruturado no formato I-PASS
          </p>
        </div>

        <LoginForm />

        <div className="card mt-4 p-4 text-xs text-clinic-muted">
          <p className="mb-2 font-semibold text-clinic-text">Usuários de demonstração</p>
          <ul className="space-y-1">
            <li>admin@demo.com — Administrador</li>
            <li>coord@demo.com — Coordenador</li>
            <li>bruno@demo.com — Plantonista</li>
            <li>daniela@demo.com — Plantonista</li>
          </ul>
          <p className="mt-2">
            Senha para todos: <code className="rounded bg-clinic-bg px-1">demo123</code>
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-clinic-muted">
          ⚠️ Ambiente de demonstração com dados fictícios. Não insira dados reais
          de pacientes sem hospedagem adequada e aprovação LGPD/institucional.
        </p>
      </div>
    </main>
  );
}
