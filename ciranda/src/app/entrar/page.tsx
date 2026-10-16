import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual, paginaInicial } from "@/lib/auth";
import { mensagemProblemaBanco, verificarBanco } from "@/lib/diagnostico";
import TextoComCodigo from "@/components/TextoComCodigo";
import Logo from "@/components/Logo";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function EntrarPage() {
  const banco = await verificarBanco();
  if (banco.ok) {
    const u = await getUsuarioAtual();
    if (u) redirect(paginaInicial(u.perfil));
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo tamanho={52} />
          <h1 className="text-2xl font-bold">Ciranda</h1>
          <p className="text-sm text-app-muted">Troca de carros em roda</p>
        </Link>

        {!banco.ok && (
          <div role="alert" className="card mb-4 border-alerta/50 bg-alerta/10 p-4 text-sm">
            <p className="mb-1 font-semibold">⚠️ O app ainda não está pronto para login</p>
            <p>
              <TextoComCodigo texto={mensagemProblemaBanco(banco.problema)} />
            </p>
          </div>
        )}

        <LoginForm />

        <div className="card mt-4 p-4 text-xs text-app-muted">
          <p className="mb-2 font-semibold text-app-text">Usuários de demonstração (senha demo123)</p>
          <ul className="space-y-1">
            <li>joao@, maria@, pedro@, guilherme@demo.com — a ciranda do exemplo, aguardando aceites</li>
            <li>ana@, bruno@, carla@demo.com — ciranda em avaliação na loja</li>
            <li>loja@demo.com — Prime Seminovos (São Paulo) · loja2@demo.com — Auto Vale (São Paulo)</li>
            <li>admin@demo.com — painel da plataforma</li>
          </ul>
        </div>
        <p className="mt-4 text-center text-sm">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-semibold text-app-primary">
            Cadastre-se
          </Link>
        </p>
      </div>
    </main>
  );
}
