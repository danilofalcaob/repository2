import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { mensagemProblemaBanco, verificarBanco } from "@/lib/diagnostico";
import TextoComCodigo from "@/components/TextoComCodigo";
import LoginForm from "./LoginForm";

// O estado do banco precisa ser checado a cada acesso, nunca congelado no build.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const banco = await verificarBanco();
  if (banco.ok) {
    const u = await getUsuarioAtual();
    if (u) redirect("/jornada");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-clinic-bg p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-clinic-primary text-2xl text-clinic-primaryfg">
            ＋
          </div>
          <h1 className="text-2xl font-bold">Jornada do Paciente</h1>
          <p className="mt-1 text-sm text-clinic-muted">
            Deshospitalização precoce e segura: funil de alta multiprofissional e passagem de plantão
            I-PASS
          </p>
        </div>

        {!banco.ok && (
          <div
            role="alert"
            className="card mb-4 border-cuidado/50 bg-cuidado/10 p-4 text-sm text-clinic-text"
          >
            <p className="mb-1 font-semibold">⚠️ O app ainda não está pronto para login</p>
            <p>
              <TextoComCodigo texto={mensagemProblemaBanco(banco.problema)} />
            </p>
          </div>
        )}

        <LoginForm />

        <div className="card mt-4 p-4 text-xs text-clinic-muted">
          <p className="mb-2 font-semibold text-clinic-text">Usuários de demonstração</p>
          <ul className="space-y-1">
            <li>gustavo@demo.com — Medicina (gestor de casos da enfermaria)</li>
            <li>sofia@demo.com — Enfermagem</li>
            <li>rafael@demo.com — Fisioterapia</li>
            <li>marina@demo.com — Serviço Social</li>
            <li>helena@demo.com — Farmácia · camila@demo.com — Nutrição</li>
            <li>paula@demo.com — Gestão de Leitos / NIR</li>
            <li>coord@demo.com — Coordenação · admin@demo.com — Administrador</li>
            <li>bruno@demo.com / daniela@demo.com — Plantonistas do PS</li>
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
