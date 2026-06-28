import Link from "next/link";
import { getUsuarioAtual } from "@/lib/auth";
import { getSetoresDoUsuario } from "@/lib/queries";
import { prisma } from "@/lib/db";
import { formatarDataHora, formatarDuracao } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: { setor?: string; medico?: string; de?: string; ate?: string; q?: string };
}) {
  const u = (await getUsuarioAtual())!;
  const setores = await getSetoresDoUsuario(u.setoresIds);

  const where: any = {
    status: "concluida",
    setorId: searchParams.setor && u.setoresIds.includes(searchParams.setor)
      ? searchParams.setor
      : { in: u.setoresIds },
  };
  if (searchParams.medico) {
    where.OR = [
      { medicoPassaId: searchParams.medico },
      { medicoRecebeId: searchParams.medico },
    ];
  }
  if (searchParams.de || searchParams.ate) {
    where.concluidaEm = {};
    if (searchParams.de) where.concluidaEm.gte = new Date(searchParams.de);
    if (searchParams.ate) where.concluidaEm.lte = new Date(searchParams.ate + "T23:59:59");
  }

  let passagens = await prisma.passagemEvento.findMany({
    where,
    include: {
      setor: true,
      medicoPassa: true,
      medicoRecebe: true,
      _count: { select: { snapshots: true, reconhecimentos: true } },
    },
    orderBy: { concluidaEm: "desc" },
    take: 200,
  });

  const q = (searchParams.q ?? "").trim().toLowerCase();
  if (q) {
    // Busca textual por paciente dentro dos snapshots.
    const comPaciente = await prisma.passagemEvento.findMany({
      where: { ...where, snapshots: { some: { paciente: { identificador: { contains: q } } } } },
      select: { id: true },
    });
    const ids = new Set(comPaciente.map((p) => p.id));
    passagens = passagens.filter(
      (p) =>
        ids.has(p.id) ||
        p.medicoPassa.nome.toLowerCase().includes(q) ||
        (p.medicoRecebe?.nome.toLowerCase().includes(q) ?? false) ||
        p.setor.nome.toLowerCase().includes(q),
    );
  }

  const colegas = await prisma.usuario.findMany({
    where: { setores: { some: { setorId: { in: u.setoresIds } } } },
    orderBy: { nome: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Histórico de passagens</h1>
          <p className="text-sm text-clinic-muted">
            Registro imutável (append-only) · {passagens.length} resultado(s)
          </p>
        </div>
        <a
          href={`/api/export?${new URLSearchParams(searchParams as any).toString()}&formato=csv`}
          className="btn-secondary text-sm"
        >
          ⬇ Exportar (ver Indicadores p/ mais formatos)
        </a>
      </div>

      <form method="get" className="card grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label">Setor</label>
          <select name="setor" defaultValue={searchParams.setor ?? ""} className="input">
            <option value="">Todos</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Médico</label>
          <select name="medico" defaultValue={searchParams.medico ?? ""} className="input">
            <option value="">Todos</option>
            {colegas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">De</label>
          <input type="date" name="de" defaultValue={searchParams.de ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Até</label>
          <input type="date" name="ate" defaultValue={searchParams.ate ?? ""} className="input" />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label">Buscar</label>
            <input name="q" defaultValue={searchParams.q ?? ""} className="input" placeholder="Paciente/médico" />
          </div>
          <button className="btn-secondary">Filtrar</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-clinic-bg text-left text-xs uppercase text-clinic-muted">
            <tr>
              <th className="p-3">Concluída em</th>
              <th className="hidden p-3 sm:table-cell">Setor</th>
              <th className="p-3">Passa → Recebe</th>
              <th className="hidden p-3 md:table-cell">Pacientes</th>
              <th className="hidden p-3 md:table-cell">Duração</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {passagens.map((p) => (
              <tr key={p.id} className="border-t border-clinic-border hover:bg-clinic-bg/50">
                <td className="p-3">{formatarDataHora(p.concluidaEm)}</td>
                <td className="hidden p-3 sm:table-cell">{p.setor.nome}</td>
                <td className="p-3">
                  {p.medicoPassa.nome} → {p.medicoRecebe?.nome ?? "—"}
                </td>
                <td className="hidden p-3 md:table-cell">{p._count.snapshots}</td>
                <td className="hidden p-3 md:table-cell">{formatarDuracao(p.duracaoSeg)}</td>
                <td className="p-3 text-right">
                  <Link href={`/historico/${p.id}`} className="text-clinic-primary hover:underline">
                    Abrir →
                  </Link>
                </td>
              </tr>
            ))}
            {passagens.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-clinic-muted">
                  Nenhuma passagem concluída no filtro atual.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/historico/auditoria" className="btn-secondary text-sm">
          🔎 Trilha de acesso/auditoria
        </Link>
      </div>
    </div>
  );
}
