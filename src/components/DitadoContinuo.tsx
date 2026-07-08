"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// -----------------------------------------------------------------------------
// Escuta contínua da passagem de plantão com ROTEAMENTO por seção.
//
// Enquanto os profissionais falam, o app escuta e vai transcrevendo direto no
// campo pertinente da passagem. O destino (seção) muda de duas formas:
//   1) por COMANDO DE VOZ: dizer o nome da seção antes de falar o conteúdo
//      ("resumo …", "o que me preocupa …", "síntese …", "o que mudou …").
//   2) manualmente, tocando na seção-alvo (útil no celular durante o plantão).
//
// Um mesmo trecho de fala pode conter várias seções: a frase é fatiada nos
// pontos onde um comando é reconhecido e cada pedaço vai para o seu campo.
//
// Usa a Web Speech API nativa (pt-BR). Em navegadores sem suporte, o componente
// fica oculto e a digitação/ditado por campo continua disponível.
// -----------------------------------------------------------------------------

export type CampoDestino = {
  chave: string;
  label: string;
  // Frases-gatilho ditas para direcionar a fala a esta seção (sem acento, minúsculas).
  atalhos: string[];
  // Anexa o texto reconhecido ao campo.
  anexar: (texto: string) => void;
  // Se falso, a seção não recebe ditado (ex.: síntese só pelo receptor).
  habilitado?: boolean;
};

// Remove acentos preservando o comprimento (índice-a-índice) para fatiar o
// texto original com base na versão normalizada.
function normalizar(s: string): string {
  const de = "áàâãäéèêëíìîïóòôõöúùûüçñ";
  const para = "aaaaaeeeeiiiiooooouuuucn";
  let out = "";
  for (const ch of s.toLowerCase()) {
    const i = de.indexOf(ch);
    out += i >= 0 ? para[i] : ch;
  }
  return out;
}

function ehLimite(ch: string | undefined): boolean {
  return ch === undefined || /[\s.,;:!?—–-]/.test(ch);
}

type Corte = { indice: number; fim: number; chave: string };

// Encontra ocorrências de qualquer atalho, respeitando limites de palavra.
function acharCortes(norm: string, campos: CampoDestino[]): Corte[] {
  const cortes: Corte[] = [];
  for (const campo of campos) {
    if (campo.habilitado === false) continue;
    for (const atalho of campo.atalhos) {
      let from = 0;
      for (;;) {
        const i = norm.indexOf(atalho, from);
        if (i < 0) break;
        const antes = i === 0 ? undefined : norm[i - 1];
        const depois = norm[i + atalho.length];
        if (ehLimite(antes) && ehLimite(depois)) {
          cortes.push({ indice: i, fim: i + atalho.length, chave: campo.chave });
        }
        from = i + atalho.length;
      }
    }
  }
  // Mais cedo primeiro; empate → atalho mais longo primeiro (mais específico).
  cortes.sort((a, b) => a.indice - b.indice || b.fim - a.fim);
  // Remove sobreposições.
  const limpos: Corte[] = [];
  let ultimoFim = -1;
  for (const c of cortes) {
    if (c.indice >= ultimoFim) {
      limpos.push(c);
      ultimoFim = c.fim;
    }
  }
  return limpos;
}

function limparTrecho(s: string): string {
  return s.replace(/^[\s.,;:!?—–-]+/, "").replace(/\s+/g, " ").trim();
}

export default function DitadoContinuo({
  campos,
  alvoInicial,
}: {
  campos: CampoDestino[];
  alvoInicial?: string;
}) {
  const disponiveis = useMemo(
    () => campos.filter((c) => c.habilitado !== false),
    [campos],
  );
  const [suportado, setSuportado] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [parcial, setParcial] = useState("");
  const [ultimo, setUltimo] = useState<{ chave: string; texto: string } | null>(null);
  const [alvo, setAlvo] = useState<string>(
    alvoInicial ?? disponiveis[0]?.chave ?? "",
  );

  const recRef = useRef<any>(null);
  const alvoRef = useRef(alvo);
  const camposRef = useRef(campos);
  const querParar = useRef(false);
  useEffect(() => {
    alvoRef.current = alvo;
  }, [alvo]);
  useEffect(() => {
    camposRef.current = campos;
  }, [campos]);

  // Encaminha um trecho final de fala às seções corretas.
  const rotear = useCallback((frase: string) => {
    const bruto = frase.trim();
    if (!bruto) return;
    const norm = normalizar(bruto);
    const cortes = acharCortes(norm, camposRef.current);
    const mapa = new Map(camposRef.current.map((c) => [c.chave, c]));

    // Sem comando reconhecido: tudo vai para o alvo atual.
    if (cortes.length === 0) {
      const campo = mapa.get(alvoRef.current);
      const t = limparTrecho(bruto);
      if (campo && t) {
        campo.anexar(t);
        setUltimo({ chave: campo.chave, texto: t });
      }
      return;
    }

    // Texto antes do primeiro comando pertence ao alvo atual.
    let ultimoRegistro: { chave: string; texto: string } | null = null;
    const antes = limparTrecho(bruto.slice(0, cortes[0].indice));
    if (antes) {
      const campo = mapa.get(alvoRef.current);
      if (campo) {
        campo.anexar(antes);
        ultimoRegistro = { chave: campo.chave, texto: antes };
      }
    }

    // Cada comando abre um segmento até o próximo comando.
    for (let k = 0; k < cortes.length; k++) {
      const corte = cortes[k];
      const proximo = k + 1 < cortes.length ? cortes[k + 1].indice : bruto.length;
      const conteudo = limparTrecho(bruto.slice(corte.fim, proximo));
      const campo = mapa.get(corte.chave);
      if (!campo) continue;
      setAlvo(corte.chave); // último comando define o alvo persistente
      if (conteudo) {
        campo.anexar(conteudo);
        ultimoRegistro = { chave: campo.chave, texto: conteudo };
      }
    }
    if (ultimoRegistro) setUltimo(ultimoRegistro);
  }, []);

  useEffect(() => {
    const SR =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition)) ||
      null;
    if (!SR) return;
    setSuportado(true);
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0]?.transcript ?? "";
        if (r.isFinal) {
          rotear(txt);
        } else {
          interim += txt;
        }
      }
      setParcial(interim.trim());
    };
    rec.onend = () => {
      setParcial("");
      // Reinicia automaticamente (o navegador encerra sessões longas sozinho).
      if (querParar.current) {
        setOuvindo(false);
        return;
      }
      try {
        rec.start();
      } catch {
        setOuvindo(false);
      }
    };
    rec.onerror = (ev: any) => {
      // "no-speech"/"aborted" são recuperáveis; erros graves param a escuta.
      if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
        querParar.current = true;
        setOuvindo(false);
      }
    };
    recRef.current = rec;
    return () => {
      querParar.current = true;
      try {
        rec.abort();
      } catch {}
    };
  }, [rotear]);

  if (!suportado) return null;

  function alternar() {
    const rec = recRef.current;
    if (!rec) return;
    if (ouvindo) {
      querParar.current = true;
      try {
        rec.stop();
      } catch {}
      setOuvindo(false);
      setParcial("");
    } else {
      querParar.current = false;
      try {
        rec.start();
        setOuvindo(true);
      } catch {}
    }
  }

  const alvoLabel = disponiveis.find((c) => c.chave === alvo)?.label ?? "—";

  return (
    <div className="rounded-lg border border-clinic-border bg-clinic-bg p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={alternar}
            className={`btn !px-3 !py-1.5 text-xs ${
              ouvindo
                ? "bg-instavel text-white"
                : "border border-clinic-border bg-clinic-surface"
            }`}
            aria-pressed={ouvindo}
            title="Escuta contínua da passagem"
          >
            {ouvindo ? "● Ouvindo a passagem… (parar)" : "🎧 Escutar a passagem"}
          </button>
          {ouvindo && (
            <span className="text-xs text-clinic-muted">
              Enviando para: <strong className="text-clinic-text">{alvoLabel}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Seleção do destino (manual) */}
      <div className="mt-2 flex flex-wrap gap-1">
        {disponiveis.map((c) => (
          <button
            key={c.chave}
            type="button"
            onClick={() => setAlvo(c.chave)}
            className={`badge border transition ${
              alvo === c.chave
                ? "border-clinic-primary bg-clinic-primary/15 text-clinic-primary"
                : "border-clinic-border bg-clinic-surface text-clinic-muted"
            }`}
            title={`Direcionar a fala para: ${c.label}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Transcrição ao vivo (interina) */}
      {ouvindo && (
        <p className="mt-2 min-h-[1.25rem] text-sm italic text-clinic-muted">
          {parcial ? `“${parcial}…”` : "Fale normalmente. Diga o nome da seção para trocar de destino."}
        </p>
      )}

      {/* Último trecho encaminhado (confirmação visual) */}
      {ultimo && (
        <p className="mt-1 text-xs text-clinic-muted">
          ↳ enviado para <strong className="text-clinic-text">
            {disponiveis.find((c) => c.chave === ultimo.chave)?.label ?? ultimo.chave}
          </strong>: “{ultimo.texto}”
        </p>
      )}

      <p className="mt-2 text-[11px] leading-snug text-clinic-muted">
        Comandos: diga <em>“resumo”</em>, <em>“o que me preocupa”</em>,{" "}
        <em>“o que mudou”</em>
        {disponiveis.some((c) => c.chave === "sintese") && (
          <>
            {" "}ou <em>“síntese”</em>
          </>
        )}{" "}
        antes de falar para direcionar ao campo certo. A digitação segue liberada.
      </p>
    </div>
  );
}
