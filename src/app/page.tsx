import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";

export default async function Home() {
  const u = await getUsuarioAtual();
  redirect(u ? "/quadro" : "/login");
}
