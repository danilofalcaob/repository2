"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Resultado } from "@/lib/exames/valores";
import RevisaoLaudo from "./RevisaoLaudo";

export type Pendente = {
  documentoId: string | null;
  titulo: string;
  metodo?: string;
  avisos: string[];
  resultados: Resultado[];
};

type ItemFila = {
  id: number;
  nome: string;
  estado: "aguardando" | "ocr" | "enviando" | "pronto" | "erro";
  progresso?: number;
  erro?: string;
};

let seq = 0;

// OCR no navegador (a imagem não sai do computador). O motor e o idioma
// português são servidos pelo próprio app (public/ocr, ver scripts/copiar-ocr.mjs).
async function ocrImagem(arquivo: File, aoProgredir: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  // Prints pequenos: amplia 2x para melhorar o reconhecimento.
  const bitmap = await createImageBitmap(arquivo);
  const escala = bitmap.width < 1600 ? 2 : 1;
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width * escala;
  canvas.height = bitmap.height * escala;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const worker = await createWorker("por", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/",
    langPath: "/ocr/lang",
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") aoProgredir(Math.round(m.progress * 100));
    },
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: "1" });
    const { data } = await worker.recognize(canvas);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export default function Importador({
  pacienteId,
  sexo,
  iaDisponivel,
  existentes,
  pendentesIniciais,
}: {
  pacienteId: string;
  sexo: string | null;
  iaDisponivel: boolean;
  existentes: Map<string, string>;
  pendentesIniciais: Pendente[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(pendentesIniciais.length > 0);
  const [modo, setModo] = useState<"ia" | "local">(iaDisponivel ? "ia" : "local");
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [texto, setTexto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const processando = useRef(false);
  const aguardando = useRef<{ id: number; arquivo?: File; texto?: string }[]>([]);

  // Após router.refresh(), a lista do servidor (laudos aguardando revisão) é a
  // referência; lançamentos manuais em edição são preservados.
  useEffect(() => {
    setPendentes((atual) => [...pendentesIniciais, ...atual.filter((p) => !p.documentoId)]);
  }, [pendentesIniciais]);

  const atualizarItem = (id: number, patch: Partial<ItemFila>) =>
    setFila((f) => f.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const enviar = useCallback(
    async (id: number, arquivo?: File, textoLivre?: string) => {
      const fd = new FormData();
      fd.set("pacienteId", pacienteId);
      fd.set("modo", modo);
      if (arquivo) {
        fd.set("arquivo", arquivo);
        if (arquivo.type.startsWith("image/") && modo === "local") {
          atualizarItem(id, { estado: "ocr", progresso: 0 });
          try {
            const lido = await ocrImagem(arquivo, (p) => atualizarItem(id, { progresso: p }));
            fd.set("texto", lido);
          } catch (e) {
            console.error(e);
          }
        }
      }
      if (textoLivre) fd.set("texto", textoLivre);
      atualizarItem(id, { estado: "enviando" });
      const resp = await fetch("/api/uti/importar", { method: "POST", body: fd });
      const json = await resp.json().catch(() => ({ erro: "Resposta inválida do servidor." }));
      if (!resp.ok) {
        atualizarItem(id, { estado: "erro", erro: json.erro ?? "Falha no envio." });
        return;
      }
      atualizarItem(id, { estado: "pronto" });
      setPendentes((p) => [
        ...p,
        {
          documentoId: json.documentoId,
          titulo: json.nomeArquivo,
          metodo: json.metodo,
          avisos: json.avisos ?? [],
          resultados: json.resultados ?? [],
        },
      ]);
    },
    [pacienteId, modo],
  );

  // Processa a fila um arquivo por vez (sem limite de quantidade).
  const processarFila = useCallback(async () => {
    if (processando.current) return;
    processando.current = true;
    while (aguardando.current.length) {
      const item = aguardando.current.shift()!;
      try {
        await enviar(item.id, item.arquivo, item.texto);
      } catch (e) {
        atualizarItem(item.id, { estado: "erro", erro: e instanceof Error ? e.message : "Falha no envio." });
      }
    }
    processando.current = false;
  }, [enviar]);

  const adicionarArquivos = useCallback(
    (arquivos: File[]) => {
      const validos = arquivos.filter((a) => a.type === "application/pdf" || a.type.startsWith("image/"));
      if (!validos.length) return;
      setAberto(true);
      for (const arquivo of validos) {
        const id = ++seq;
        setFila((f) => [...f, { id, nome: arquivo.name || "print colado", estado: "aguardando" }]);
        aguardando.current.push({ id, arquivo });
      }
      processarFila();
    },
    [processarFila],
  );

  // Colar um printscreen (Ctrl+V) em qualquer lugar da página.
  useEffect(() => {
    function aoColar(e: ClipboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "TEXTAREA" || alvo.tagName === "INPUT")) return;
      const imagens = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (!imagens.length) return;
      e.preventDefault();
      const nomeados = imagens.map(
        (f, i) => new File([f], `print-${new Date().toLocaleTimeString("pt-BR").replace(/:/g, "")}-${i + 1}.png`, { type: f.type }),
      );
      adicionarArquivos(nomeados);
    }
    window.addEventListener("paste", aoColar);
    return () => window.removeEventListener("paste", aoColar);
  }, [adicionarArquivos]);

  function enviarTexto() {
    if (!texto.trim()) return;
    const id = ++seq;
    setFila((f) => [...f, { id, nome: "Texto colado", estado: "aguardando" }]);
    aguardando.current.push({ id, texto });
    setTexto("");
    processarFila();
  }

  function concluir(indice: number, msg: string) {
    setPendentes((p) => p.filter((_, i) => i !== indice));
    if (msg) setMensagem(msg);
    router.refresh();
  }

  const emAndamento = fila.filter((f) => f.estado !== "pronto" && f.estado !== "erro");

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Adicionar exames</h2>
            <p className="text-xs text-clinic-muted">
              PDF do laboratório, printscreen (cole com Ctrl+V) ou texto copiado do sistema — quantos quiser.
            </p>
          </div>
          <button type="button" className="btn-secondary !py-1.5 text-sm" onClick={() => setAberto((v) => !v)}>
            {aberto ? "Fechar" : "＋ Adicionar"}
          </button>
        </div>

        {aberto && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-clinic-muted">Leitura:</span>
              <label className={`flex items-center gap-1.5 ${iaDisponivel ? "" : "opacity-50"}`}>
                <input
                  type="radio"
                  name="modo"
                  checked={modo === "ia"}
                  disabled={!iaDisponivel}
                  onChange={() => setModo("ia")}
                />
                IA (Claude) — mais precisa; envia o arquivo à API da Anthropic
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="modo" checked={modo === "local"} onChange={() => setModo("local")} />
                Local — texto do PDF / OCR no navegador
              </label>
              {!iaDisponivel && (
                <span className="text-clinic-muted">(IA desativada: configure ANTHROPIC_API_KEY no servidor)</span>
              )}
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastando(false);
                adicionarArquivos([...e.dataTransfer.files]);
              }}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-6 text-center transition ${
                arrastando ? "border-clinic-primary bg-clinic-primary/10" : "border-clinic-border hover:bg-clinic-bg"
              }`}
            >
              <span className="text-2xl">📄🖼️</span>
              <span className="text-sm font-medium">Arraste PDFs ou imagens aqui, ou clique para escolher</span>
              <span className="text-xs text-clinic-muted">Também pode colar um printscreen com Ctrl+V nesta página</span>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  adicionarArquivos([...(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
            </div>

            <details className="rounded-lg border border-clinic-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Colar texto do laudo ou linhas de exames</summary>
              <textarea
                className="input mt-2 min-h-[110px] font-mono text-xs"
                placeholder={"Cole aqui o texto do laudo, ou linhas no formato:\nLab 01/06/2026 - Hb 14,1 g/dL / K 4,5 mEq/L / Cr 0,62 mg/dL"}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn-primary !py-1.5 text-sm" onClick={enviarTexto} disabled={!texto.trim()}>
                  Ler texto
                </button>
                <button
                  type="button"
                  className="btn-secondary !py-1.5 text-sm"
                  onClick={() =>
                    setPendentes((p) => [...p, { documentoId: null, titulo: "Lançamento manual", avisos: [], resultados: [] }])
                  }
                >
                  Digitar valores manualmente
                </button>
              </div>
            </details>

            {fila.length > 0 && (
              <ul className="space-y-1 text-xs">
                {fila.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <span className="w-4 text-center">
                      {f.estado === "pronto" ? "✅" : f.estado === "erro" ? "❌" : "⏳"}
                    </span>
                    <span className="truncate font-medium">{f.nome}</span>
                    <span className="text-clinic-muted">
                      {f.estado === "aguardando" && "na fila"}
                      {f.estado === "ocr" && `lendo imagem (OCR) ${f.progresso ?? 0}%`}
                      {f.estado === "enviando" && (modo === "ia" ? "lendo com IA…" : "processando…")}
                      {f.estado === "pronto" && "pronto para revisão"}
                      {f.estado === "erro" && f.erro}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {emAndamento.length > 0 && (
              <p className="text-xs text-clinic-muted">
                Você pode revisar os laudos já lidos enquanto os demais são processados.
              </p>
            )}
          </div>
        )}
        {mensagem && (
          <p className="mt-3 rounded-lg bg-estavel/10 px-3 py-2 text-sm text-estavel" role="status">
            ✓ {mensagem}
          </p>
        )}
      </div>

      {pendentes.map((p, i) => (
        <RevisaoLaudo
          key={p.documentoId ?? `manual-${i}`}
          documentoId={p.documentoId}
          pacienteId={pacienteId}
          titulo={p.titulo}
          metodo={p.metodo}
          avisos={p.avisos}
          resultados={p.resultados}
          sexo={sexo}
          existentes={existentes}
          onConcluido={(msg) => concluir(i, msg)}
        />
      ))}
    </div>
  );
}
