import { getUsuarioAtual } from "@/lib/auth";
import { getSetoresDoUsuario } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { iniciarPassagem } from "../actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NovaPassagemPage() {
  const u = (await getUsuarioAtual())!;
  const setores = await getSetoresDoUsuario(u.setoresIds);

  // Possíveis receptores: usuários ativos com acesso a algum setor do usuário.
  const colegas = await prisma.usuario.findMany({
    where: {
      ativo: true,
      id: { not: u.id },
      setores: { some: { setorId: { in: u.setoresIds } } },
    },
    orderBy: { nome: "asc" },
  });

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/quadro" className="text-sm text-clinic-muted hover:underline">
        ← Voltar
      </Link>
      <h1 className="text-2xl font-bold">Nova passagem de plantão</h1>
      <p className="text-sm text-clinic-muted">
        Será criado um snapshot I-PASS para cada paciente ativo do setor,
        pré-preenchido com o estado da última passagem.
      </p>

      <form action={iniciarPassagem} className="card space-y-4 p-5">
        <div>
          <label className="label">Médico que passa</label>
          <input className="input bg-clinic-bg" value={u.nome} disabled />
        </div>

        <div>
          <label className="label" htmlFor="setorId">
            Setor *
          </label>
          <select id="setorId" name="setorId" className="input" required>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="medicoRecebeId">
            Médico que recebe
          </label>
          <select id="medicoRecebeId" name="medicoRecebeId" className="input">
            <option value="">Definir depois</option>
            {colegas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} {c.registro ? `(${c.registro})` : ""}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn-primary w-full">
          Iniciar passagem →
        </button>
      </form>
    </div>
  );
}
