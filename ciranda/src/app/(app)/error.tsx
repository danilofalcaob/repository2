"use client";
import { useEffect } from "react";

// Erros de ação não devem derrubar a tela. Em produção o Next omite a mensagem
// original; nesse caso o mais comum é a ciranda ter mudado enquanto a tela
// estava aberta (outra loja assumiu, alguém recusou, o prazo venceu).
export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const omitida = !error.message || error.message.startsWith("An error occurred");
  return (
    <div className="card mx-auto max-w-lg space-y-3 p-6 text-center">
      <h1 className="text-xl font-bold">Não foi possível concluir a ação</h1>
      <p className="text-sm text-app-muted">
        {omitida
          ? "A situação pode ter mudado enquanto a tela estava aberta (por exemplo, outra loja assumiu a ciranda ou um participante respondeu antes). Recarregue para ver o estado atual."
          : error.message}
      </p>
      <button
        onClick={() => {
          reset();
          window.location.reload();
        }}
        className="btn-primary"
      >
        Recarregar
      </button>
    </div>
  );
}
