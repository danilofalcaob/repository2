"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";

export type ItemMenu = { href: string; label: string; icone: string };

export default function NavBar({ nome, papel, itens, inicio }: { nome: string; papel: string; itens: ItemMenu[]; inicio: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  // O item mais específico que casa com a rota é o ativo (/admin/lojas não acende /admin).
  const casa = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const ativo = (href: string) =>
    casa(href) && !itens.some((i) => i.href !== href && i.href.startsWith(href + "/") && casa(i.href));

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const link = (it: ItemMenu, mobile: boolean) => (
    <Link
      key={it.href}
      href={it.href}
      onClick={() => setAberto(false)}
      className={`rounded-lg px-3 text-sm font-medium transition ${mobile ? "py-3" : "py-2"} ${
        ativo(it.href) ? "bg-app-primary/15 text-app-primary" : "text-app-muted hover:bg-app-bg hover:text-app-text"
      }`}
    >
      <span className="mr-1" aria-hidden>
        {it.icone}
      </span>
      {it.label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-app-border bg-app-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link href={inicio} className="flex items-center gap-2 font-bold">
          <Logo />
          <span className="hidden sm:inline">Ciranda</span>
        </Link>
        <nav className="ml-2 hidden flex-1 flex-wrap items-center gap-1 md:flex">{itens.map((it) => link(it, false))}</nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold leading-tight">{nome}</p>
            <p className="text-xs text-app-muted">{papel}</p>
          </div>
          <ThemeToggle />
          <button onClick={sair} className="btn-secondary !px-3 text-sm">
            Sair
          </button>
          <button className="btn-secondary !px-3 md:hidden" onClick={() => setAberto((v) => !v)} aria-label="Menu">
            ☰
          </button>
        </div>
      </div>
      {aberto && <nav className="grid grid-cols-2 gap-1 border-t border-app-border p-2 md:hidden">{itens.map((it) => link(it, true))}</nav>}
    </header>
  );
}
