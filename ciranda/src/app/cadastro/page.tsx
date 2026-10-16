import Link from "next/link";
import Logo from "@/components/Logo";
import CadastroForm from "./CadastroForm";

export default function CadastroPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo tamanho={52} />
          <h1 className="text-2xl font-bold">Criar conta na Ciranda</h1>
          <p className="text-sm text-app-muted">Depois você cadastra o carro que tem e o que quer.</p>
        </Link>
        <CadastroForm />
        <p className="mt-4 text-center text-sm">
          Já tem conta?{" "}
          <Link href="/entrar" className="font-semibold text-app-primary">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
