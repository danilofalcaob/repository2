"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import ThemeToggle from "./ThemeToggle";

type Item = { href: string; label: string; icone: string };

export default function NavBar({
  nome,
  perfil,
  podeGestao,
  podeAdmin,
}: {
  nome: string;
  perfil: string;
  podeGestao: boolean;
  podeAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  const itens: Item[] = [
    { href: "/quadro", label: "Quadro", icone: "🩺" },
    { href: "/pacientes", label: "Pacientes", icone: "🛏️" },
    { href: "/trr", label: "TRR", icone: "🚨" },
    { href: "/historico", label: "Histórico", icone: "📚" },
  ];
  if (podeGestao) itens.push({ href: "/indicadores", label: "Indicadores", icone: "📊" });
  if (podeAdmin) itens.push({ href: "/admin", label: "Admin", icone: "⚙️" });

  const ativo = (href: string) => pathname === href || pathname.startsWith(href + "/");

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-clinic-border bg-clinic-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link href="/quadro" className="flex items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-clinic-primary text-clinic-primaryfg">
            ＋
          </span>
          <span className="hidden sm:inline">Passagem de Plantão</span>
        </Link>

        {/* Navegação desktop */}
        <nav className="ml-2 hidden flex-1 items-center gap-1 md:flex">
          {itens.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                ativo(it.href)
                  ? "bg-clinic-primary/15 text-clinic-primary"
                  : "text-clinic-muted hover:bg-clinic-bg hover:text-clinic-text"
              }`}
            >
              <span className="mr-1">{it.icone}</span>
              {it.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight">{nome}</p>
            <p className="text-xs capitalize text-clinic-muted">{perfil}</p>
          </div>
          <ThemeToggle />
          <button onClick={sair} className="btn-secondary !px-3 text-sm" title="Sair">
            Sair
          </button>
          <button
            className="btn-secondary !px-3 md:hidden"
            onClick={() => setAberto((v) => !v)}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Navegação mobile */}
      {aberto && (
        <nav className="grid grid-cols-2 gap-1 border-t border-clinic-border p-2 md:hidden">
          {itens.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setAberto(false)}
              className={`rounded-lg px-3 py-3 text-sm font-medium ${
                ativo(it.href)
                  ? "bg-clinic-primary/15 text-clinic-primary"
                  : "text-clinic-text hover:bg-clinic-bg"
              }`}
            >
              <span className="mr-1">{it.icone}</span>
              {it.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
