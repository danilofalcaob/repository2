import { redirect } from "next/navigation";
import { getUsuarioAtual, podeVerGestao, podeAdministrar } from "@/lib/auth";
import NavBar from "@/components/NavBar";
import { PERFIL_LABEL } from "@/lib/constants";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await getUsuarioAtual();
  if (!u) redirect("/login");

  return (
    <div className="min-h-screen">
      <NavBar
        nome={u.nome}
        perfil={PERFIL_LABEL[u.perfil]}
        podeGestao={podeVerGestao(u.perfil)}
        podeAdmin={podeAdministrar(u.perfil)}
      />
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-6 text-center text-[11px] text-clinic-muted">
        Dados fictícios de demonstração. Não utilize dados reais de pacientes sem
        aprovação LGPD/institucional. Registros são imutáveis e auditados.
      </footer>
    </div>
  );
}
