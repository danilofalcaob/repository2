import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { getPacienteAutorizado } from "@/lib/exames/queries";
import { extrairDeTexto } from "@/lib/exames/parser";
import { extrairComIA, iaDisponivel } from "@/lib/exames/ia";
import { textoDoPdf } from "@/lib/exames/pdf";
import type { Resultado } from "@/lib/exames/valores";

// Recebe UM laudo por requisição (PDF, imagem ou texto) — o navegador envia os
// arquivos um a um, sem limite de quantidade. O arquivo original é guardado e
// os valores extraídos ficam como rascunho até a confirmação na revisão.
export const runtime = "nodejs";
export const maxDuration = 300;

const TAMANHO_MAX = 20 * 1024 * 1024; // 20 MB por arquivo
const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(req: Request) {
  const u = await getUsuarioAtual();
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const fd = await req.formData();
  const pacienteId = String(fd.get("pacienteId") ?? "");
  const paciente = await getPacienteAutorizado(u, pacienteId);
  if (!paciente) return NextResponse.json({ erro: "Paciente não encontrado." }, { status: 404 });

  const arquivo = fd.get("arquivo");
  const textoInformado = String(fd.get("texto") ?? "").trim(); // texto colado ou OCR do navegador
  const querIA = fd.get("modo") === "ia" && iaDisponivel();
  const agora = new Date().toISOString();

  let bytes: Uint8Array | null = null;
  let nomeArquivo = "texto-colado.txt";
  let tipoMime = "text/plain";
  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > TAMANHO_MAX) {
      return NextResponse.json({ erro: "Arquivo maior que 20 MB." }, { status: 413 });
    }
    tipoMime = arquivo.type || (arquivo.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
    if (tipoMime !== "application/pdf" && !TIPOS_IMAGEM.includes(tipoMime)) {
      return NextResponse.json({ erro: "Envie PDF ou imagem (PNG, JPG, WEBP)." }, { status: 415 });
    }
    bytes = new Uint8Array(await arquivo.arrayBuffer());
    nomeArquivo = arquivo.name || (tipoMime === "application/pdf" ? "laudo.pdf" : "print.png");
  } else if (!textoInformado) {
    return NextResponse.json({ erro: "Nenhum arquivo ou texto enviado." }, { status: 400 });
  }

  const origem = !bytes ? "texto" : tipoMime === "application/pdf" ? "pdf" : "imagem";
  let metodo = "texto";
  let textoExtraido: string | null = textoInformado || null;
  let resultados: Resultado[] = [];
  let avisos: string[] = [];
  let dataColetaISO: string | null = null;

  try {
    if (bytes && querIA) {
      metodo = "ia";
      const r = await extrairComIA({ bytes, tipoMime, sexo: paciente.sexo, dataPadraoISO: agora });
      resultados = r.resultados;
      avisos = r.avisos;
      dataColetaISO = r.dataColetaISO;
    } else {
      if (bytes && origem === "pdf") {
        metodo = "pdf_texto";
        const { texto } = await textoDoPdf(bytes);
        textoExtraido = texto;
        if (!texto.trim()) {
          avisos.push(
            "Este PDF não tem texto (parece digitalizado). Use a leitura por IA, envie um print da tela ou digite os valores.",
          );
        }
      } else if (bytes && origem === "imagem") {
        metodo = textoInformado ? "ocr" : "manual";
        if (!textoInformado) avisos.push("Não foi possível ler o texto da imagem. Digite os valores ou use a IA.");
      }
      if (textoExtraido?.trim()) {
        const r = extrairDeTexto(textoExtraido, { sexo: paciente.sexo, dataPadraoISO: agora, ocr: metodo === "ocr" });
        resultados = r.resultados;
        avisos.push(...r.avisos);
        dataColetaISO = r.dataColeta?.iso ?? null;
      }
    }
  } catch (e) {
    console.error("Falha na extração do laudo:", e);
    avisos.push(
      e instanceof Error && metodo === "ia"
        ? `Leitura por IA falhou (${e.message}). Tente a leitura local ou digite os valores.`
        : "Falha ao ler o arquivo. Confira se o PDF/imagem está íntegro ou digite os valores.",
    );
  }

  const doc = await prisma.documentoExame.create({
    data: {
      pacienteId,
      nomeArquivo,
      tipoMime,
      tamanhoBytes: bytes?.byteLength ?? textoInformado.length,
      conteudo: bytes ? Buffer.from(bytes) : null,
      origem,
      metodo,
      textoExtraido,
      rascunhoJson: JSON.stringify(resultados),
      avisosJson: JSON.stringify(avisos),
      status: "revisao",
      dataColeta: dataColetaISO ? new Date(dataColetaISO) : null,
      enviadoPorId: u.id,
      enviadoPorNome: u.nome,
    },
  });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "exame.importar",
    entidade: "DocumentoExame",
    entidadeId: doc.id,
    valorNovo: { pacienteId, origem, metodo, itens: resultados.length },
  });

  return NextResponse.json({
    documentoId: doc.id,
    nomeArquivo,
    metodo,
    dataColetaISO,
    resultados,
    avisos,
  });
}
