jest.mock("puppeteer", () => ({}));
import { PeriodicidadeMissao } from "@prisma/client";
import { prisma } from "@/config/db";
import { bloquearMissoes, contabilizarResposta, listarMissoes } from "@/modules/missoes/missoes.repository";
import { periodoSemanal } from "@/modules/missoes/periodo";

const suite = process.env.MISSOES_DATABASE_TEST_URL ? describe : describe.skip;
suite("missões semanais no PostgreSQL", () => {
  const usuario = `teste-semanal-${Date.now()}`;

  afterAll(async () => {
    await prisma.transacaoXp.deleteMany({ where: { usuarioId: usuario } });
    await prisma.progressoXp.deleteMany({ where: { usuarioId: usuario } });
    await prisma.eventoMissao.deleteMany({ where: { periodo: { usuarioId: usuario } } });
    await prisma.missaoUsuario.deleteMany({ where: { periodo: { usuarioId: usuario } } });
    await prisma.periodoMissoes.deleteMany({ where: { usuarioId: usuario } });
    await prisma.$disconnect();
  });

  it("renova por semana, deduplica respostas e credita XP uma vez", async () => {
    const [primeira, segunda] = await Promise.all([
      listarMissoes(usuario, PeriodicidadeMissao.SEMANAL),
      listarMissoes(usuario, PeriodicidadeMissao.SEMANAL),
    ]);
    expect(primeira.periodo).toEqual(periodoSemanal(new Date()));
    expect(primeira.missoes).toHaveLength(3);
    expect(primeira.missoes.map((m) => m.id)).toEqual(segunda.missoes.map((m) => m.id));

    const periodo = await prisma.periodoMissoes.findFirstOrThrow({
      where: { usuarioId: usuario, periodicidade: PeriodicidadeMissao.SEMANAL },
    });
    await prisma.missaoUsuario.deleteMany({ where: { periodoId: periodo.id } });
    const catalogo = await prisma.missaoCatalogo.findUniqueOrThrow({
      where: { codigo: "CONSTANCIA_SEMANAL" },
    });
    await prisma.missaoUsuario.create({ data: { periodoId: periodo.id, missaoId: catalogo.id } });

    for (let indice = 0; indice < 20; indice++) {
      await prisma.$transaction(async (tx) => {
        await bloquearMissoes(tx, usuario);
        await contabilizarResposta(tx, usuario, `questao-${indice}`, false, new Date());
      });
    }
    await prisma.$transaction(async (tx) => {
      await bloquearMissoes(tx, usuario);
      await contabilizarResposta(tx, usuario, "questao-0", false, new Date());
    });

    const missao = await prisma.missaoUsuario.findFirstOrThrow({
      where: { periodoId: periodo.id }, include: { transacaoXp: true },
    });
    expect(missao.progresso).toBe(20);
    expect(missao.transacaoXp?.quantidade).toBe(100);
    expect(await prisma.transacaoXp.count({ where: { missaoUsuarioId: missao.id } })).toBe(1);
  });
});
