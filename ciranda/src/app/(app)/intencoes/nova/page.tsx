import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import IntencaoForm from "./IntencaoForm";

export default async function NovaIntencaoPage() {
  const u = await getUsuarioAtual();
  if (!u || u.perfil !== "cliente") redirect("/");
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">Novo cadastro</h1>
      <p className="mb-6 mt-1 text-sm text-app-muted">
        Assim que você salvar, o motor procura uma roda de trocas com as pessoas já cadastradas na sua cidade.
      </p>
      <IntencaoForm cidade={u.cidade} />
    </div>
  );
}
