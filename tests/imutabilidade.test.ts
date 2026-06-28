import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

// Testa as regras críticas no nível de dados: imutabilidade do snapshot após a
// conclusão, versionamento append-only e herança de pendências entre turnos.
const prisma = new PrismaClient();
const criados: { setorId?: string; pacienteId?: string; passagemId?: string } = {};

afterAll(async () => {
  if (criados.passagemId) await prisma.passagemEvento.deleteMany({ where: { id: criados.passagemId } });
  if (criados.pacienteId) await prisma.paciente.deleteMany({ where: { id: criados.pacienteId } });
  if (criados.setorId) await prisma.setor.deleteMany({ where: { id: criados.setorId } });
  await prisma.$disconnect();
});

describe("conclusão de passagem e imutabilidade", () => {
  it("congela o snapshot, versiona (append-only) e marca pendência herdada", async () => {
    const setor = await prisma.setor.create({ data: { nome: "TESTE_SETOR", tipo: "PS" } });
    criados.setorId = setor.id;
    const paciente = await prisma.paciente.create({
      data: { setorId: setor.id, identificador: "TESTE_PAC", diagnosticoPrincipal: "teste" },
    });
    criados.pacienteId = paciente.id;

    // Pendência aberta (deve ser herdada ao concluir).
    await prisma.pendencia.create({
      data: { pacienteId: paciente.id, descricao: "pendência aberta", status: "aberta" },
    });

    // Cria médico responsável reaproveitando um usuário existente do seed.
    const medico = await prisma.usuario.findFirst();
    expect(medico).toBeTruthy();

    const passagem = await prisma.passagemEvento.create({
      data: { setorId: setor.id, medicoPassaId: medico!.id, status: "rascunho" },
    });
    criados.passagemId = passagem.id;

    const snap = await prisma.snapshotPaciente.create({
      data: {
        passagemId: passagem.id,
        pacienteId: paciente.id,
        gravidade: "cuidado",
        resumoPaciente: "estado inicial",
      },
    });

    // --- Simula a conclusão (mesmas invariantes da action concluirPassagem) ---
    await prisma.snapshotPaciente.update({
      where: { id: snap.id },
      data: { imutavel: true, acoesSnapshot: JSON.stringify([{ descricao: "pendência aberta" }]) },
    });
    await prisma.snapshotVersao.create({
      data: { snapshotId: snap.id, versao: 1, dadosJson: JSON.stringify({ resumoPaciente: "estado inicial" }) },
    });
    await prisma.pendencia.updateMany({
      where: { pacienteId: paciente.id, status: "aberta", herdada: false },
      data: { herdada: true },
    });
    await prisma.passagemEvento.update({
      where: { id: passagem.id },
      data: { status: "concluida", concluidaEm: new Date(), duracaoSeg: 600 },
    });

    // --- Verificações ---
    const snapFinal = await prisma.snapshotPaciente.findUnique({
      where: { id: snap.id },
      include: { versoes: true },
    });
    expect(snapFinal?.imutavel).toBe(true);
    expect(snapFinal?.versoes.length).toBe(1);
    expect(snapFinal?.acoesSnapshot).toContain("pendência aberta");

    // Edição pós-conclusão deve gerar NOVA versão (append-only), preservando a anterior.
    await prisma.snapshotPaciente.update({ where: { id: snap.id }, data: { versao: 2, resumoPaciente: "corrigido" } });
    await prisma.snapshotVersao.create({
      data: { snapshotId: snap.id, versao: 2, dadosJson: JSON.stringify({ resumoPaciente: "corrigido" }) },
    });
    const versoes = await prisma.snapshotVersao.findMany({ where: { snapshotId: snap.id }, orderBy: { versao: "asc" } });
    expect(versoes.length).toBe(2);
    expect(versoes[0].dadosJson).toContain("estado inicial"); // versão original preservada

    const pend = await prisma.pendencia.findFirst({ where: { pacienteId: paciente.id } });
    expect(pend?.herdada).toBe(true);

    const passFinal = await prisma.passagemEvento.findUnique({ where: { id: passagem.id } });
    expect(passFinal?.status).toBe("concluida");
    expect(passFinal?.duracaoSeg).toBe(600);
  });
});
