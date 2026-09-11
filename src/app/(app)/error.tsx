"use client";
import Link from "next/link";
import { useEffect } from "react";

// Erros de ação (validações de formulário, acesso negado) não devem derrubar a
// tela: a equipe precisa entender o que aconteceu e continuar de onde estava.
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card mx-auto max-w-lg space-y-3 p-6 text-center">
      <h1 className="text-xl font-bold">Não foi possível concluir a ação</h1>
      <p className="text-sm text-clinic-muted">
        {error.message && !error.message.startsWith("An error occurred")
          ? error.message
          : "Verifique os campos obrigatórios e tente novamente. Se o problema persistir, avise a coordenação."}
      </p>
      <div className="flex justify-center gap-2">
        <button onClick={reset} className="btn-primary">
          Tentar novamente
        </button>
        <Link href="/jornada" className="btn-secondary">
          Voltar ao funil
        </Link>
      </div>
    </div>
  );
}
