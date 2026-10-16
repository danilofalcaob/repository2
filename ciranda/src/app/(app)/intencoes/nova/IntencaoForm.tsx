"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { criarIntencao, type EstadoIntencao } from "../actions";
import {
  CAMBIOS,
  CAMBIO_LABEL,
  CATALOGO,
  COMBUSTIVEIS,
  CORES,
  MAX_DESEJOS,
  TIPO_INTENCAO_LABEL,
  TIPOS_INTENCAO,
  type TipoIntencao,
} from "@/lib/constants";
import { capitalizar } from "@/lib/format";
import { normalizar } from "@/lib/normalizar";

const MARCAS = Object.keys(CATALOGO);
const anoAtual = new Date().getFullYear();

const DESCRICAO_TIPO: Record<TipoIntencao, string> = {
  troca: "Entrego o meu e recebo outro, pagando ou recebendo a diferença.",
  venda: "Entrego o meu e recebo o valor em dinheiro.",
  compra: "Não tenho carro para entregar; pago o valor do carro.",
};

function modelosDa(marca: string): string[] {
  const m = MARCAS.find((x) => normalizar(x) === normalizar(marca));
  return m ? CATALOGO[m] : [];
}

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pending}>
      {pending ? "Procurando cirandas…" : "Cadastrar e procurar ciranda"}
    </button>
  );
}

function CampoMarcaModelo({ prefixo, obrigatorio, rotuloModelo }: { prefixo: string; obrigatorio: boolean; rotuloModelo: string }) {
  const [marca, setMarca] = useState("");
  const listaModelos = `${prefixo}modelos`;
  return (
    <>
      <div>
        <label className="label" htmlFor={`${prefixo}marca`}>Marca</label>
        <input id={`${prefixo}marca`} name={`${prefixo}marca`} className="input" list="marcas" required={obrigatorio} value={marca} onChange={(e) => setMarca(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor={`${prefixo}modelo`}>{rotuloModelo}</label>
        <input id={`${prefixo}modelo`} name={`${prefixo}modelo`} className="input" list={listaModelos} required={obrigatorio && prefixo === "carro_"} />
        <datalist id={listaModelos}>
          {modelosDa(marca).map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
    </>
  );
}

function Desejo({ i, onRemover }: { i: number; onRemover?: () => void }) {
  const p = `desejo_${i}_`;
  return (
    <fieldset className="rounded-lg border border-app-border p-4">
      <legend className="px-1 text-sm font-semibold">
        {i === 0 ? "1ª opção (a que você mais quer)" : `${i + 1}ª opção`}
        {onRemover && (
          <button type="button" onClick={onRemover} className="ml-2 text-xs font-normal text-erro underline">
            remover
          </button>
        )}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoMarcaModelo prefixo={p} obrigatorio={i === 0} rotuloModelo="Modelo (em branco = qualquer um da marca)" />
      </div>
      <p className="label mt-3">Cores aceitas (nenhuma marcada = qualquer cor)</p>
      <div className="flex flex-wrap gap-2">
        {CORES.map((c) => (
          <label key={c} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-app-border px-3 py-1 text-xs has-[:checked]:border-app-primary has-[:checked]:bg-app-primary/10 has-[:checked]:text-app-primary">
            <input type="checkbox" name={`${p}cores`} value={c} className="sr-only" />
            {capitalizar(c)}
          </label>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`${p}anoMin`}>Ano mínimo</label>
          <input id={`${p}anoMin`} name={`${p}anoMin`} className="input" inputMode="numeric" placeholder="ex.: 2021" />
        </div>
        <div>
          <label className="label" htmlFor={`${p}kmMax`}>Km máximo</label>
          <input id={`${p}kmMax`} name={`${p}kmMax`} className="input" inputMode="numeric" placeholder="ex.: 60000" />
        </div>
        <div>
          <label className="label" htmlFor={`${p}cambio`}>Câmbio</label>
          <select id={`${p}cambio`} name={`${p}cambio`} className="input" defaultValue="">
            <option value="">Indiferente</option>
            {CAMBIOS.map((c) => (
              <option key={c} value={c}>{CAMBIO_LABEL[c]}</option>
            ))}
          </select>
        </div>
      </div>
    </fieldset>
  );
}

export default function IntencaoForm({ cidade }: { cidade: string }) {
  const [estado, acao] = useFormState<EstadoIntencao, FormData>(criarIntencao, {});
  const [tipo, setTipo] = useState<TipoIntencao>("troca");
  const [desejos, setDesejos] = useState<number[]>([0]);
  const temCarro = tipo !== "compra";
  const querCarro = tipo !== "venda";

  return (
    <form action={acao} className="space-y-6">
      <datalist id="marcas">
        {MARCAS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <section className="card p-5">
        <h2 className="titulo-secao">O que você quer fazer?</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {TIPOS_INTENCAO.map((t) => (
            <label key={t} className={`card cursor-pointer p-4 transition ${tipo === t ? "border-app-primary ring-2 ring-app-primary/30" : ""}`}>
              <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
              <p className="font-semibold">{TIPO_INTENCAO_LABEL[t]}</p>
              <p className="mt-1 text-xs text-app-muted">{DESCRICAO_TIPO[t]}</p>
            </label>
          ))}
        </div>
        <div className="mt-4 max-w-xs">
          <label className="label" htmlFor="cidade">Cidade da negociação</label>
          <input id="cidade" name="cidade" className="input" defaultValue={cidade} required />
        </div>
      </section>

      {temCarro && (
        <section className="card p-5">
          <h2 className="titulo-secao">Seu carro</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CampoMarcaModelo prefixo="carro_" obrigatorio rotuloModelo="Modelo" />
            <div>
              <label className="label" htmlFor="carro_versao">Versão</label>
              <input id="carro_versao" name="carro_versao" className="input" placeholder="ex.: Longitude 1.3 Turbo" />
            </div>
            <div>
              <label className="label" htmlFor="carro_anoModelo">Ano-modelo</label>
              <input id="carro_anoModelo" name="carro_anoModelo" type="number" min={1980} max={anoAtual + 1} className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="carro_cor">Cor</label>
              <select id="carro_cor" name="carro_cor" className="input" required defaultValue="">
                <option value="" disabled>Escolha</option>
                {CORES.map((c) => (
                  <option key={c} value={c}>{capitalizar(c)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="carro_km">Quilometragem</label>
              <input id="carro_km" name="carro_km" className="input" inputMode="numeric" required />
            </div>
            <div>
              <label className="label" htmlFor="carro_cambio">Câmbio</label>
              <select id="carro_cambio" name="carro_cambio" className="input" required defaultValue="automatico">
                {CAMBIOS.map((c) => (
                  <option key={c} value={c}>{CAMBIO_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="carro_combustivel">Combustível</label>
              <select id="carro_combustivel" name="carro_combustivel" className="input" defaultValue="Flex">
                {COMBUSTIVEIS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="carro_placa">Placa</label>
              <input id="carro_placa" name="carro_placa" className="input uppercase" placeholder="só a loja vê" />
            </div>
            <div>
              <label className="label" htmlFor="carro_valorPretendido">Quanto quer por ele (R$)</label>
              <input id="carro_valorPretendido" name="carro_valorPretendido" className="input" inputMode="numeric" placeholder="ex.: 139.000" required />
            </div>
            <div>
              <label className="label" htmlFor="carro_valorFipe">Valor FIPE (R$, opcional)</label>
              <input id="carro_valorFipe" name="carro_valorFipe" className="input" inputMode="numeric" />
            </div>
          </div>
          <p className="mt-3 text-xs text-app-muted">
            O valor vale para encontrar a ciranda; a loja parceira valida o valor final na vistoria e todos confirmam antes de
            fechar.
          </p>
        </section>
      )}

      {querCarro && (
        <section className="card space-y-4 p-5">
          <div>
            <h2 className="titulo-secao !mb-1">O carro que você quer</h2>
            <p className="text-sm text-app-muted">
              Até {MAX_DESEJOS} opções, em ordem de preferência. Quanto mais flexível, mais rápido a roda fecha.
            </p>
          </div>
          {desejos.map((id, i) => (
            <Desejo key={id} i={i} onRemover={i > 0 ? () => setDesejos((d) => d.filter((x) => x !== id)) : undefined} />
          ))}
          {desejos.length < MAX_DESEJOS && (
            <button type="button" className="btn-secondary" onClick={() => setDesejos((d) => [...d, Math.max(...d) + 1])}>
              + Adicionar outra opção
            </button>
          )}
          <div className="max-w-sm">
            <label className="label" htmlFor="maxPagar">
              {tipo === "compra" ? "Seu orçamento máximo (R$)" : "Até quanto aceita pagar de diferença (R$)"}
            </label>
            <input id="maxPagar" name="maxPagar" className="input" inputMode="numeric" placeholder={tipo === "compra" ? "ex.: 130.000" : "ex.: 20.000 (0 = só troca por igual ou menor)"} required={tipo === "compra"} />
          </div>
        </section>
      )}

      {estado.erro && (
        <p className="rounded-lg bg-erro/10 px-3 py-2 text-sm text-erro" role="alert">{estado.erro}</p>
      )}
      <Enviar />
    </form>
  );
}
