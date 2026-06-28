import { redirect } from "next/navigation";
import { getUsuarioAtual, podeAdministrar } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TIPO_SETOR_LABEL, PERFIL_LABEL, TIPOS_SETOR, TIPOS_TURNO, PERFIS, type TipoSetor, type Perfil } from "@/lib/constants";
import { criarSetor, criarTurno, criarUsuario } from "./actions";
import { formatarDataHora } from "@/lib/format";
import UsuarioAtivoToggle from "./UsuarioAtivoToggle";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const u = (await getUsuarioAtual())!;
  if (!podeAdministrar(u.perfil)) redirect("/quadro");

  const [setores, usuarios, turnos] = await Promise.all([
    prisma.setor.findMany({ orderBy: { nome: "asc" } }),
    prisma.usuario.findMany({ include: { setores: { include: { setor: true } } }, orderBy: { nome: "asc" } }),
    prisma.turno.findMany({ include: { setor: true, responsavel: true }, orderBy: { inicio: "desc" }, take: 20 }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Administração</h1>

      {/* Setores */}
      <section className="card p-4">
        <h2 className="mb-3 text-lg font-semibold">Setores</h2>
        <ul className="mb-4 grid gap-2 sm:grid-cols-2">
          {setores.map((s) => (
            <li key={s.id} className="rounded-lg border border-clinic-border p-3 text-sm">
              <p className="font-medium">{s.nome}</p>
              <p className="text-xs text-clinic-muted">
                {TIPO_SETOR_LABEL[s.tipo as TipoSetor] ?? s.tipo} · {s.instituicao}
              </p>
            </li>
          ))}
        </ul>
        <form action={criarSetor} className="grid gap-2 sm:grid-cols-4">
          <input name="nome" className="input sm:col-span-2" placeholder="Nome do setor *" required />
          <select name="tipo" className="input">
            {TIPOS_SETOR.map((t) => (
              <option key={t} value={t}>
                {TIPO_SETOR_LABEL[t]}
              </option>
            ))}
          </select>
          <input name="instituicao" className="input" placeholder="Instituição" />
          <button className="btn-primary sm:col-span-4">＋ Adicionar setor</button>
        </form>
      </section>

      {/* Usuários */}
      <section className="card p-4">
        <h2 className="mb-3 text-lg font-semibold">Usuários</h2>
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-clinic-muted">
              <tr>
                <th className="p-2">Nome</th>
                <th className="p-2">E-mail</th>
                <th className="p-2">Perfil</th>
                <th className="p-2">Setores</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((us) => (
                <tr key={us.id} className="border-t border-clinic-border">
                  <td className="p-2">{us.nome}</td>
                  <td className="p-2 text-xs">{us.email}</td>
                  <td className="p-2">{PERFIL_LABEL[us.perfil as Perfil] ?? us.perfil}</td>
                  <td className="p-2 text-xs">{us.setores.map((x) => x.setor.nome).join(", ") || "—"}</td>
                  <td className="p-2">
                    <UsuarioAtivoToggle usuarioId={us.id} ativo={us.ativo} ehProprio={us.id === u.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={criarUsuario} className="grid gap-2 sm:grid-cols-2">
          <input name="nome" className="input" placeholder="Nome *" required />
          <input name="email" type="email" className="input" placeholder="E-mail *" required />
          <input name="senha" type="password" className="input" placeholder="Senha (mín. 6) *" required />
          <input name="registro" className="input" placeholder="CRM/COREN" />
          <select name="perfil" className="input">
            {PERFIS.map((p) => (
              <option key={p} value={p}>
                {PERFIL_LABEL[p]}
              </option>
            ))}
          </select>
          <fieldset className="rounded-lg border border-clinic-border p-2 text-sm">
            <legend className="px-1 text-xs text-clinic-muted">Setores</legend>
            <div className="flex flex-wrap gap-3">
              {setores.map((s) => (
                <label key={s.id} className="flex items-center gap-1">
                  <input type="checkbox" name="setores" value={s.id} />
                  {s.nome}
                </label>
              ))}
            </div>
          </fieldset>
          <button className="btn-primary sm:col-span-2">＋ Criar usuário</button>
        </form>
      </section>

      {/* Turnos */}
      <section className="card p-4">
        <h2 className="mb-3 text-lg font-semibold">Turnos</h2>
        <ul className="mb-4 space-y-1 text-sm">
          {turnos.map((t) => (
            <li key={t.id} className="flex flex-wrap justify-between gap-2 border-b border-clinic-border py-1">
              <span>
                {t.setor.nome} · {t.rotulo ?? t.tipo}
              </span>
              <span className="text-xs text-clinic-muted">
                {formatarDataHora(t.inicio)} {t.responsavel ? `· ${t.responsavel.nome}` : ""}
              </span>
            </li>
          ))}
          {turnos.length === 0 && <li className="text-clinic-muted">Nenhum turno.</li>}
        </ul>
        <form action={criarTurno} className="grid gap-2 sm:grid-cols-3">
          <select name="setorId" className="input" required>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
          <select name="tipo" className="input">
            {TIPOS_TURNO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input name="rotulo" className="input" placeholder="Rótulo (ex.: Diurno 07-19)" />
          <label className="text-xs text-clinic-muted">
            Início *
            <input name="inicio" type="datetime-local" className="input" required />
          </label>
          <label className="text-xs text-clinic-muted">
            Fim
            <input name="fim" type="datetime-local" className="input" />
          </label>
          <select name="responsavelId" className="input">
            <option value="">Responsável…</option>
            {usuarios.map((us) => (
              <option key={us.id} value={us.id}>
                {us.nome}
              </option>
            ))}
          </select>
          <button className="btn-primary sm:col-span-3">＋ Adicionar turno</button>
        </form>
      </section>
    </div>
  );
}
