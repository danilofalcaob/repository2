import Link from "next/link";
import { getUsuarioAtual, paginaInicial } from "@/lib/auth";
import { verificarBanco } from "@/lib/diagnostico";
import RodaCiranda from "@/components/RodaCiranda";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import Simulador from "./Simulador";
import { TAXA_PLATAFORMA } from "@/lib/constants";
import { percentual } from "@/lib/format";

export const dynamic = "force-dynamic";

const PASSOS = [
  {
    titulo: "Cadastre o que tem e o que quer",
    texto: "Seu carro, quanto quer por ele e até 3 opções do carro que deseja — com cor, ano, km e o troco que aceita pagar.",
  },
  {
    titulo: "O motor fecha a roda",
    texto: "A Ciranda cruza todos os cadastros da cidade e encontra cadeias em que cada um recebe o carro que quer.",
  },
  {
    titulo: "Todos aceitam, a loja valida",
    texto: "Uma loja parceira assume a ciranda: vistoria, laudo cautelar, documentação e o valor real de cada carro.",
  },
  {
    titulo: "Tudo de uma vez",
    texto: "Com os valores validados, todos confirmam. A loja acerta os trocos e transfere os carros no mesmo dia.",
  },
];

export default async function Home() {
  const banco = await verificarBanco();
  const u = banco.ok ? await getUsuarioAtual() : null;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
        <Logo />
        <span className="text-lg font-bold">Ciranda</span>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {u ? (
            <Link href={paginaInicial(u.perfil)} className="btn-primary">
              Ir para o painel
            </Link>
          ) : (
            <>
              <Link href="/entrar" className="btn-secondary">
                Entrar
              </Link>
              <Link href="/cadastro" className="btn-primary hidden sm:inline-flex">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="grid items-center gap-8 py-8 md:grid-cols-2 md:py-14">
          <div>
            <p className="badge bg-app-primary/15 text-app-primary">Troca com troco, em roda</p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
              Troque de carro sem perder dinheiro vendendo para a loja.
            </h1>
            <p className="mt-4 text-app-muted">
              Quem vende o carro para uma loja de seminovos aceita um deságio grande — e depois paga preço de vitrine no
              próximo. Na Ciranda, quem quer trocar se cadastra, o app encontra a roda em que cada um recebe o carro que
              deseja, e uma loja parceira formaliza todas as trocas de uma só vez.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/cadastro" className="btn-primary">
                Quero trocar meu carro
              </Link>
              <a href="#como-funciona" className="btn-secondary">
                Como funciona
              </a>
            </div>
          </div>
          <div className="card p-3">
            <RodaCiranda
              idBase="exemplo"
              nos={[{ nome: "João" }, { nome: "Maria" }, { nome: "Guilherme" }, { nome: "Pedro" }]}
              recebe={[
                { titulo: "Jeep Compass azul", sub: "da Maria" },
                { titulo: "VW Nivus cinza", sub: "do Guilherme" },
                { titulo: "BMW X1 prata", sub: "do Pedro" },
                { titulo: "Audi A3 branco", sub: "do João" },
              ]}
            />
            <p className="px-2 pb-2 text-center text-xs text-app-muted">
              Quatro pessoas, quatro carros, quatro desejos atendidos — numa única negociação, numa única loja.
            </p>
          </div>
        </section>

        <section id="como-funciona" className="py-8">
          <h2 className="text-2xl font-bold">Como funciona</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="card p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-app-primary text-sm font-bold text-app-primaryfg">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{p.titulo}</h3>
                <p className="mt-1 text-sm text-app-muted">{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-6 py-8 md:grid-cols-2">
          <Simulador />
          <div className="card p-5">
            <h3 className="text-lg font-bold">Bom para todos os lados</h3>
            <ul className="mt-3 space-y-3 text-sm">
              <li>
                <strong>Cliente:</strong> vende pelo valor de mercado validado pela loja e compra o carro que escolheu,
                pagando ou recebendo só a diferença.
              </li>
              <li>
                <strong>Loja parceira:</strong> fecha várias vendas de uma vez, sem imobilizar capital em estoque, e é
                remunerada pelo serviço em cada carro.
              </li>
              <li>
                <strong>Plataforma:</strong> {percentual(TAXA_PLATAFORMA)} sobre o valor bruto dos carros negociados, só
                quando a ciranda é concluída.
              </li>
              <li>
                <strong>Segurança:</strong> nenhuma troca acontece sem vistoria, laudo cautelar, checagem de documentação e
                confirmação final de todos com os valores validados.
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-app-border py-6 text-center text-xs text-app-muted">
        Ciranda · protótipo de demonstração com dados fictícios.
      </footer>
    </div>
  );
}
