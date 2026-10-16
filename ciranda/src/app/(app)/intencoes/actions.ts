"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth";
import { rodarCasamento } from "@/lib/motor";
import { lerReais } from "@/lib/format";
import { corCanonica } from "@/lib/normalizar";
import { MAX_DESEJOS, TIPOS_INTENCAO } from "@/lib/constants";

const anoAtual = new Date().getFullYear();
const reais = (msg: string) =>
  z.preprocess((v) => lerReais(typeof v === "string" ? v : null), z.number({ invalid_type_error: msg }).int().min(1000, msg).max(20_000_000, msg));
const inteiroOpcional = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? Number(v.replace(/\D/g, "")) : null),
  z.number().int().nonnegative().nullable(),
);

const schemaCarro = z.object({
  marca: z.string().trim().min(2, "Informe a marca do seu carro."),
  modelo: z.string().trim().min(1, "Informe o modelo do seu carro."),
  versao: z.string().trim().optional(),
  anoModelo: z.coerce.number().int().min(1980, "Ano inválido.").max(anoAtual + 1, "Ano inválido."),
  cor: z.string().trim().min(3, "Informe a cor do seu carro."),
  km: z.preprocess((v) => Number(String(v ?? "").replace(/\D/g, "")), z.number().int().min(0).max(2_000_000)),
  cambio: z.enum(["manual", "automatico"]),
  combustivel: z.string().trim().optional(),
  placa: z.string().trim().toUpperCase().optional(),
  valorPretendido: reais("Informe quanto você quer pelo seu carro."),
  valorFipe: z.preprocess((v) => lerReais(typeof v === "string" ? v : null), z.number().int().positive().nullable()),
});

const schemaDesejo = z.object({
  marca: z.string().trim().min(2, "Informe a marca do carro desejado."),
  modelo: z.string().trim().optional(),
  cores: z.array(z.string()).default([]),
  anoMin: inteiroOpcional,
  kmMax: inteiroOpcional,
  cambio: z.enum(["", "manual", "automatico"]).default(""),
});

export type EstadoIntencao = { erro?: string };

function campos(fd: FormData, prefixo: string) {
  const r: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith(prefixo)) r[k.slice(prefixo.length)] = v;
  }
  return r;
}

export async function criarIntencao(_: EstadoIntencao, fd: FormData): Promise<EstadoIntencao> {
  const u = await exigirUsuario(["cliente"]);
  const tipo = z.enum(TIPOS_INTENCAO).safeParse(fd.get("tipo"));
  if (!tipo.success) return { erro: "Escolha se quer trocar, vender ou comprar." };
  const cidade = String(fd.get("cidade") ?? "").trim() || u.cidade;

  let carro: z.infer<typeof schemaCarro> | null = null;
  if (tipo.data !== "compra") {
    const p = schemaCarro.safeParse(campos(fd, "carro_"));
    if (!p.success) return { erro: p.error.issues[0].message };
    carro = p.data;
  }

  const desejos: z.infer<typeof schemaDesejo>[] = [];
  if (tipo.data !== "venda") {
    for (let i = 0; i < MAX_DESEJOS; i++) {
      const bruto = campos(fd, `desejo_${i}_`);
      if (!bruto.marca || String(bruto.marca).trim() === "") continue;
      const p = schemaDesejo.safeParse({ ...bruto, cores: fd.getAll(`desejo_${i}_cores`) });
      if (!p.success) return { erro: `Opção ${i + 1}: ${p.error.issues[0].message}` };
      desejos.push(p.data);
    }
    if (desejos.length === 0) return { erro: "Informe pelo menos um carro que você quer." };
  }

  const maxPagar = lerReais(String(fd.get("maxPagar") ?? "")) ?? 0;
  if (tipo.data === "compra" && maxPagar < 1000) return { erro: "Informe o seu orçamento para a compra." };

  const intencao = await prisma.$transaction(async (tx) => {
    const veiculo = carro
      ? await tx.veiculo.create({
          data: {
            donoId: u.id,
            marca: carro.marca,
            modelo: carro.modelo,
            versao: carro.versao || null,
            anoModelo: carro.anoModelo,
            cor: corCanonica(carro.cor),
            km: carro.km,
            cambio: carro.cambio,
            combustivel: carro.combustivel || null,
            placa: carro.placa || null,
            valorPretendido: carro.valorPretendido,
            valorFipe: carro.valorFipe,
          },
        })
      : null;
    return tx.intencao.create({
      data: {
        usuarioId: u.id,
        tipo: tipo.data,
        cidade,
        veiculoId: veiculo?.id,
        maxPagar: tipo.data === "venda" ? 0 : maxPagar,
        desejos: {
          create: desejos.map((d, i) => ({
            ordem: i + 1,
            marca: d.marca,
            modelo: d.modelo || null,
            cores: d.cores.map(corCanonica).join(","),
            anoMin: d.anoMin,
            kmMax: d.kmMax,
            cambio: d.cambio || null,
          })),
        },
      },
    });
  });

  await rodarCasamento();
  const elo = await prisma.elo.findFirst({
    where: { intencaoId: intencao.id, ciranda: { status: "proposta" } },
    select: { cirandaId: true },
  });
  revalidatePath("/painel");
  redirect(elo ? `/cirandas/${elo.cirandaId}?nova=1` : "/painel?cadastro=ok");
}

async function minhaIntencao(id: string) {
  const u = await exigirUsuario(["cliente"]);
  const i = await prisma.intencao.findUnique({ where: { id } });
  if (!i || i.usuarioId !== u.id) throw new Error("Cadastro não encontrado.");
  return i;
}

export async function pausarIntencao(id: string) {
  const i = await minhaIntencao(id);
  if (i.status !== "ativa") throw new Error("Só é possível pausar um cadastro que está na fila.");
  await prisma.intencao.update({ where: { id }, data: { status: "pausada", motivoStatus: "Pausado por você." } });
  revalidatePath("/painel");
}

export async function reativarIntencao(id: string) {
  const i = await minhaIntencao(id);
  if (i.status !== "pausada") throw new Error("Este cadastro não está pausado.");
  await prisma.intencao.update({ where: { id }, data: { status: "ativa", motivoStatus: null } });
  await rodarCasamento();
  revalidatePath("/painel");
}

export async function cancelarIntencao(id: string) {
  const i = await minhaIntencao(id);
  if (i.status === "em_ciranda") throw new Error("Este cadastro está numa ciranda em andamento — responda por lá.");
  if (i.status === "concluida" || i.status === "cancelada") return;
  await prisma.intencao.update({ where: { id }, data: { status: "cancelada", motivoStatus: "Cancelado por você." } });
  revalidatePath("/painel");
}

// Ajustar o preço pedido ou o troco aceito costuma destravar novas cirandas.
export async function ajustarValores(id: string, fd: FormData) {
  const i = await minhaIntencao(id);
  if (i.status !== "ativa" && i.status !== "pausada") throw new Error("Só é possível ajustar cadastros fora de negociação.");
  const valor = lerReais(String(fd.get("valorPretendido") ?? ""));
  const maxPagar = lerReais(String(fd.get("maxPagar") ?? ""));
  if (i.veiculoId && valor && valor >= 1000) {
    await prisma.veiculo.update({ where: { id: i.veiculoId }, data: { valorPretendido: valor } });
  }
  await prisma.intencao.update({
    where: { id },
    data: {
      maxPagar: i.tipo === "venda" ? 0 : maxPagar ?? i.maxPagar,
      status: "ativa",
      motivoStatus: null,
    },
  });
  await rodarCasamento();
  revalidatePath("/painel");
}
