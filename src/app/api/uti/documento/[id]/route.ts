import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

// Exibe o laudo original (para conferência dos valores). Acesso auditado.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await getUsuarioAtual();
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const doc = await prisma.documentoExame.findUnique({
    where: { id: params.id },
    include: { paciente: { select: { setorId: true } } },
  });
  if (!doc || !u.setoresIds.includes(doc.paciente.setorId)) {
    return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });
  }
  await registrarAuditoria({ usuarioId: u.id, acao: "exame.ver_laudo", entidade: "DocumentoExame", entidadeId: doc.id });

  if (!doc.conteudo) {
    return new NextResponse(doc.textoExtraido ?? "", {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }
  const nome = encodeURIComponent(doc.nomeArquivo);
  return new NextResponse(new Uint8Array(doc.conteudo), {
    headers: {
      "Content-Type": doc.tipoMime,
      "Content-Disposition": `inline; filename*=UTF-8''${nome}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
