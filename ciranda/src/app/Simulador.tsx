"use client";
import { useState } from "react";
import { compararComLojaTradicional } from "@/lib/liquidacao";
import { TAXA_LOJA_PADRAO, TAXA_PLATAFORMA } from "@/lib/constants";
import { lerReais, percentual, reais } from "@/lib/format";

// Simulador da landing: quanto o dono perde vendendo para a loja com deságio
// versus o custo de entrar numa ciranda. O deságio é informado pelo próprio
// usuário (cada loja/carro é diferente), começando num valor ilustrativo.
export default function Simulador() {
  const [valor, setValor] = useState("120.000");
  const [desagio, setDesagio] = useState(15);
  const v = lerReais(valor) ?? 0;
  const r = compararComLojaTradicional({
    valorCarro: v,
    desagioLoja: desagio / 100,
    taxaPlataforma: TAXA_PLATAFORMA,
    taxaLoja: TAXA_LOJA_PADRAO,
  });

  return (
    <div className="card p-5">
      <h3 className="text-lg font-bold">Quanto você deixa na mesa?</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="sim-valor">
            Valor de mercado do seu carro
          </label>
          <input
            id="sim-valor"
            className="input tabular-nums"
            inputMode="numeric"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="sim-desagio">
            Quanto abaixo disso a loja ofereceu: <strong>{desagio}%</strong>
          </label>
          <input
            id="sim-desagio"
            type="range"
            min={0}
            max={35}
            value={desagio}
            onChange={(e) => setDesagio(Number(e.target.value))}
            className="mt-3 w-full accent-[rgb(var(--app-primary))]"
          />
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-erro/10 p-3">
          <p className="text-xs text-app-muted">Vendendo para a loja</p>
          <p className="text-xl font-bold tabular-nums text-erro">− {reais(r.perdaTradicional)}</p>
        </div>
        <div className="rounded-lg bg-app-primary/10 p-3">
          <p className="text-xs text-app-muted">
            Na Ciranda ({percentual(TAXA_PLATAFORMA)} + loja ~{percentual(TAXA_LOJA_PADRAO)})
          </p>
          <p className="text-xl font-bold tabular-nums text-app-primary">− {reais(r.custoCiranda)}</p>
        </div>
        <div className={`rounded-lg p-3 ${r.economia >= 0 ? "bg-ok/10" : "bg-app-bg"}`}>
          <p className="text-xs text-app-muted">{r.economia >= 0 ? "Você economiza" : "Diferença"}</p>
          <p className={`text-xl font-bold tabular-nums ${r.economia >= 0 ? "text-ok" : ""}`}>{reais(r.economia)}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-app-muted">
        Simulação ilustrativa sobre o carro que você entrega. A taxa de cada loja parceira aparece antes de você aceitar
        qualquer ciranda.
      </p>
    </div>
  );
}
