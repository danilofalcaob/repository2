import Link from "next/link";
import { notFound } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatarData } from "@/lib/format";
import { BadgeStatusPaciente } from "@/components/Badges";
import { iaDisponivel } from "@/lib/exames/ia";
import { paraResultado } from "@/lib/exames/queries";
import type { Resultado } from "@/lib/exames/valores";
import PainelExames from "./PainelExames";
import LiberarLeito from "./LiberarLeito";
import type { Pendente } from "./Importador";

export const dynamic = "force-dynamic";

export default async function ExamesPacientePage({ params }: { params: { id: string } }) {
  const u = (await getUsuarioAtual())!;
  const p = await prisma.paciente.findUnique({
    where: { id: params.id },
    include: {
      setor: true,
      resultadosExame: { orderBy: { coletadoEm: "asc" } },
      documentosExame: {
        orderBy: [{ dataColeta: "desc" }, { criadoEm: "desc" }],
        select: {
          id: true,
          nomeArquivo: true,
          origem: true,
          metodo: true,
          status: true,
          dataColeta: true,
          criadoEm: true,
          enviadoPorNome: true,
          tamanhoBytes: true,
          tipoMime: true,
          rascunhoJson: true,
          avisosJson: true,
          _count: { select: { resultados: true } },
        },
      },
    },
  });
  if (!p || !u.setoresIds.includes(p.setorId)) notFound();

  const resultados = p.resultadosExame.map(paraResultado);
  const documentos = p.documentosExame.map((d) => ({
    id: d.id,
    nomeArquivo: d.nomeArquivo,
    origem: d.origem,
    metodo: d.metodo,
    status: d.status,
    dataColeta: d.dataColeta?.toISOString() ?? null,
    criadoEm: d.criadoEm.toISOString(),
    enviadoPorNome: d.enviadoPorNome,
    temArquivo: d.tipoMime !== "text/plain",
    qtdResultados: d._count.resultados,
  }));
  const pendentes: Pendente[] = p.documentosExame
    .filter((d) => d.status === "revisao")
    .map((d) => ({
      documentoId: d.id,
      titulo: d.nomeArquivo,
      metodo: d.metodo,
      avisos: d.avisosJson ? (JSON.parse(d.avisosJson) as string[]) : [],
      resultados: d.rascunhoJson ? (JSON.parse(d.rascunhoJson) as Resultado[]) : [],
    }));

  const diasUti = Math.max(1, Math.ceil((Date.now() - p.dataAdmissao.getTime()) / 86_400_000));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/uti?setor=${p.setorId}`} className="text-sm text-clinic-muted hover:underline">
          ← Mapa de leitos
        </Link>
        <Link href={`/pacientes/${p.id}`} className="text-sm text-clinic-primary hover:underline">
          Ficha clínica (I-PASS) →
        </Link>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-14 min-w-14 flex-col items-center justify-center rounded-xl bg-clinic-primary/15 px-2 text-clinic-primary">
              <span className="text-[10px] font-semibold uppercase">Leito</span>
              <span className="whitespace-nowrap text-lg font-bold leading-none">{p.leito ?? "—"}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">{p.identificador}</h1>
              <p className="text-sm text-clinic-muted">
                {p.setor.nome} · {p.idade ?? "?"}a · {p.sexo ?? "—"} · Admissão {formatarData(p.dataAdmissao)} (D{diasUti})
              </p>
              {p.diagnosticoPrincipal && <p className="mt-1 text-sm">{p.diagnosticoPrincipal}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <BadgeStatusPaciente valor={p.status} />
            {p.status === "ativo" && <LiberarLeito pacienteId={p.id} leito={p.leito} />}
          </div>
        </div>
      </div>

      <PainelExames
        pacienteId={p.id}
        sexo={p.sexo}
        iaDisponivel={iaDisponivel()}
        resultados={resultados}
        documentos={documentos}
        pendentes={pendentes}
      />
    </div>
  );
}
