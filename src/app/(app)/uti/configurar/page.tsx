import Link from "next/link";
import { getUsuarioAtual, podeVerGestao } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUtisDoUsuario } from "@/lib/exames/queries";
import ConfigurarLeitos from "./ConfigurarLeitos";

export const dynamic = "force-dynamic";

export default async function ConfigurarLeitosPage({ searchParams }: { searchParams: { setor?: string; nova?: string } }) {
  const u = (await getUsuarioAtual())!;
  if (u.perfil === "profissional") {
    return <p className="card p-6 text-sm text-clinic-muted">Apenas médicos e gestores configuram os leitos da UTI.</p>;
  }
  const utis = await getUtisDoUsuario(u);
  // Sem ?setor: edita a primeira UTI do usuário que ainda não tem leitos (configuração inicial).
  const alvo = searchParams.nova
    ? null
    : (utis.find((s) => s.id === searchParams.setor) ?? utis.find((s) => s.leitos.length === 0) ?? utis[0] ?? null);
  if (!alvo && !podeVerGestao(u.perfil)) {
    return <p className="card p-6 text-sm text-clinic-muted">Nenhuma UTI vinculada ao seu usuário. Peça à coordenação para criá-la.</p>;
  }
  const ocupados = alvo
    ? (await prisma.paciente.findMany({ where: { setorId: alvo.id, status: "ativo" }, select: { leito: true } }))
        .map((p) => p.leito)
        .filter((l): l is string => !!l)
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/uti" className="text-sm text-clinic-muted hover:underline">
        ← Mapa de leitos
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{alvo ? "Leitos da UTI" : "Nova UTI"}</h1>
        <p className="text-sm text-clinic-muted">
          Defina quantos leitos a unidade tem e a numeração usada na rotina. É possível alterar depois (leitos ocupados
          não podem ser removidos).
        </p>
      </div>
      {utis.length > 1 && !searchParams.nova && (
        <div className="flex flex-wrap gap-1">
          {utis.map((s) => (
            <Link
              key={s.id}
              href={`/uti/configurar?setor=${s.id}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${s.id === alvo?.id ? "bg-clinic-primary/15 font-semibold text-clinic-primary" : "text-clinic-muted"}`}
            >
              {s.nome}
            </Link>
          ))}
        </div>
      )}
      <ConfigurarLeitos
        key={alvo?.id ?? "nova"}
        setorId={alvo?.id ?? null}
        nomeInicial={alvo?.nome ?? ""}
        leitosIniciais={alvo?.leitos.map((l) => l.numero) ?? []}
        ocupados={ocupados}
      />
    </div>
  );
}
