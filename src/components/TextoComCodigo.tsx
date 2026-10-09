// Mostra trechos entre crases (`npm run setup`) como código, para que comandos
// citados em mensagens de diagnóstico fiquem legíveis e fáceis de copiar.
export default function TextoComCodigo({ texto }: { texto: string }) {
  const partes = texto.split(/(`[^`]+`)/g);
  return (
    <>
      {partes.map((parte, i) =>
        parte.startsWith("`") && parte.endsWith("`") ? (
          <code key={i} className="whitespace-nowrap rounded bg-clinic-surface px-1 py-0.5 font-mono text-[0.85em]">
            {parte.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{parte}</span>
        ),
      )}
    </>
  );
}
