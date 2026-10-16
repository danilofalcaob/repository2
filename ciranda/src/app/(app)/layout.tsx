import { redirect } from "next/navigation";
import { getUsuarioAtual, paginaInicial } from "@/lib/auth";
import { prisma } from "@/lib/db";
import NavBar, { type ItemMenu } from "@/components/NavBar";
import { PERFIL_LABEL } from "@/lib/constants";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await getUsuarioAtual();
  if (!u) redirect("/entrar");

  let itens: ItemMenu[];
  let papel: string = PERFIL_LABEL[u.perfil];
  if (u.perfil === "admin") {
    itens = [
      { href: "/admin", label: "Visão geral", icone: "📊" },
      { href: "/admin/cirandas", label: "Cirandas", icone: "🔄" },
      { href: "/admin/lojas", label: "Lojas", icone: "🏪" },
    ];
  } else if (u.perfil === "loja") {
    itens = [{ href: "/loja", label: "Minha loja", icone: "🏪" }];
    const loja = u.lojaId ? await prisma.loja.findUnique({ where: { id: u.lojaId } }) : null;
    if (loja) papel = loja.nome;
  } else {
    itens = [
      { href: "/painel", label: "Meu painel", icone: "🏠" },
      { href: "/intencoes/nova", label: "Novo cadastro", icone: "➕" },
    ];
  }

  return (
    <div className="min-h-screen">
      <NavBar nome={u.nome} papel={papel} itens={itens} inicio={paginaInicial(u.perfil)} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-6 text-center text-[11px] text-app-muted">
        Ciranda · protótipo com dados fictícios. Valores de carros e taxas são ilustrativos.
      </footer>
    </div>
  );
}
