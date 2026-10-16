// Desenho da ciranda: participantes em roda e, em cada seta, o carro que passa
// de um para o outro. nos[i] recebe de nos[i+1]; as setas correm no sentido
// horário. Rótulo null = quem só vende recebe pagamento em dinheiro.

export type NoRoda = { nome: string; destaque?: boolean };
export type RotuloRoda = { titulo: string; sub?: string } | null;

const W = 640;
const R = 118; // raio da roda
const RN = 28; // raio do nó
const CX = W / 2;
const CY = R + RN + 42;
const H = CY * 2;

const rad = (graus: number) => (graus * Math.PI) / 180;
const ponto = (graus: number, raio: number) => ({
  x: CX + raio * Math.cos(rad(graus)),
  y: CY + raio * Math.sin(rad(graus)),
});

function ancoraTexto(graus: number): "start" | "middle" | "end" {
  const c = Math.cos(rad(graus));
  return c > 0.3 ? "start" : c < -0.3 ? "end" : "middle";
}

export default function RodaCiranda({
  nos,
  recebe,
  idBase = "roda",
}: {
  nos: NoRoda[];
  recebe: RotuloRoda[];
  idBase?: string;
}) {
  const k = nos.length;
  const passo = 360 / k;
  const angulo = (i: number) => -90 - i * passo;
  const folga = ((RN + 7) / R) * (180 / Math.PI);
  const descricao = nos
    .map((n, i) => `${nos[(i + 1) % k].nome} entrega ${recebe[i]?.titulo ?? "pagamento"} para ${n.nome}`)
    .join("; ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={descricao}>
        <title>{descricao}</title>
        <defs>
          <marker
            id={`${idBase}-seta`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" className="fill-app-primary" />
          </marker>
          <marker
            id={`${idBase}-seta-din`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" className="fill-app-accent" />
          </marker>
        </defs>

        <circle cx={CX} cy={CY} r={R} className="fill-none stroke-app-border" strokeWidth={1} strokeDasharray="2 6" />

        {nos.map((_, i) => {
          // Arco do nó i+1 até o nó i, pelo próprio círculo, no sentido horário.
          const de = ponto(angulo(i) - passo + folga, R);
          const ate = ponto(angulo(i) - folga, R);
          const grande = passo - 2 * folga > 180 ? 1 : 0;
          const dinheiro = recebe[i] === null;
          const meio = angulo(i) - passo / 2;
          const pos = ponto(meio, R + 16);
          const ancora = ancoraTexto(meio);
          const dy = Math.sin(rad(meio)) > 0.3 ? 14 : Math.sin(rad(meio)) < -0.3 ? -14 : 4;
          const rotulo = recebe[i] ?? { titulo: "💵 pagamento" };
          return (
            <g key={`a${i}`}>
              <path
                d={`M ${de.x} ${de.y} A ${R} ${R} 0 ${grande} 1 ${ate.x} ${ate.y}`}
                className={dinheiro ? "fill-none stroke-app-accent" : "fill-none stroke-app-primary"}
                strokeWidth={2.5}
                strokeDasharray={dinheiro ? "6 5" : undefined}
                markerEnd={`url(#${idBase}-${dinheiro ? "seta-din" : "seta"})`}
              />
              <text
                x={pos.x}
                y={pos.y + dy}
                textAnchor={ancora}
                className="hidden fill-app-text text-[14px] font-semibold sm:inline"
              >
                {rotulo.titulo}
                {rotulo.sub && (
                  <tspan x={pos.x} dy={16} className="fill-app-muted text-[12px] font-normal">
                    {rotulo.sub}
                  </tspan>
                )}
              </text>
            </g>
          );
        })}

        {nos.map((n, i) => {
          const c = ponto(angulo(i), R);
          const nome = ponto(angulo(i), R + RN + 12);
          const ancora = ancoraTexto(angulo(i));
          const s = Math.sin(rad(angulo(i)));
          const dy = s > 0.3 ? 12 : s < -0.3 ? -2 : 5;
          return (
            <g key={`n${i}`}>
              <circle
                cx={c.x}
                cy={c.y}
                r={RN}
                className={n.destaque ? "fill-app-primary stroke-app-primary" : "fill-app-surface stroke-app-primary"}
                strokeWidth={2.5}
              />
              <text
                x={c.x}
                y={c.y + 7}
                textAnchor="middle"
                className={`text-[26px] font-bold sm:text-[17px] ${n.destaque ? "fill-app-primaryfg" : "fill-app-primary"}`}
              >
                {n.nome.slice(0, 2).toUpperCase()}
              </text>
              {/* Nomes ficam fora da roda, entre os rótulos das setas. */}
              <text
                x={nome.x}
                y={nome.y + dy}
                textAnchor={ancora}
                className="hidden fill-app-muted text-[13px] font-medium sm:inline"
              >
                {n.destaque ? `${n.nome} (você)` : n.nome}
              </text>
            </g>
          );
        })}
      </svg>
      {/* No celular a roda encolhe demais para rótulos: a legenda vai em texto. */}
      <ol className="space-y-1 px-2 pb-2 text-sm sm:hidden">
        {nos.map((n, i) => {
          const doador = nos[(i + 1) % k];
          return (
            <li key={i}>
              <span className="font-semibold">
                {doador.nome} → {n.destaque ? `${n.nome} (você)` : n.nome}:
              </span>{" "}
              {recebe[i] ? recebe[i]!.titulo : "💵 pagamento"}
              {recebe[i]?.sub && <span className="text-app-muted"> · {recebe[i]!.sub}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
