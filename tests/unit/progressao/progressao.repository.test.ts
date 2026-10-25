import { EloXp, StatusTentativaQuiz } from "@prisma/client";

import { prisma } from "@/config/db";
import { ProgressaoRepository } from "@/modules/progressao/progressao.repository";

jest.mock("@/modules/missoes/missoes.repository", () => ({ bloquearMissoes: jest.fn(), contabilizarQuiz: jest.fn() }));

jest.mock("@/config/db", () => ({
  prisma: {
    $transaction: jest.fn(),
    questao: { findMany: jest.fn() },
    tentativaQuiz: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ tema: null, dificuldade: null }),
    },
    progressoXp: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    transacaoXp: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  },
}));

const transactionMock = prisma.$transaction as jest.Mock;
const questaoFindMany = prisma.questao.findMany as jest.Mock;
const tentativaCreate = prisma.tentativaQuiz.create as jest.Mock;
const tentativaFindFirst = prisma.tentativaQuiz.findFirst as jest.Mock;
const tentativaUpdateMany = prisma.tentativaQuiz.updateMany as jest.Mock;
const progressoFindUnique = prisma.progressoXp.findUnique as jest.Mock;
const progressoUpsert = prisma.progressoXp.upsert as jest.Mock;
const progressoUpdate = prisma.progressoXp.update as jest.Mock;
const transacaoCreate = prisma.transacaoXp.create as jest.Mock;
const transacaoFindMany = prisma.transacaoXp.findMany as jest.Mock;
const transacaoCount = prisma.transacaoXp.count as jest.Mock;

describe("ProgressaoRepository", () => {
  let repository: ProgressaoRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ProgressaoRepository();
    // A transacao interativa recebe o proprio prisma mockado como "tx".
    transactionMock.mockImplementation(async (entrada: unknown) =>
      typeof entrada === "function" ? await entrada(prisma) : await Promise.all(entrada as unknown[]),
    );
  });

  it("lista ids de questoes ativas aplicando tema e dificuldade", async () => {
    questaoFindMany.mockResolvedValue([{ id: "q1" }, { id: "q2" }]);

    const ids = await repository.listarIdsQuestoesDisponiveis({
      tema: "Neuroanatomia",
      dificuldade: "MEDIA",
    });

    expect(ids).toEqual(["q1", "q2"]);
    expect(questaoFindMany).toHaveBeenCalledWith({
      where: {
        status: "ATIVO",
        excluidoEm: null,
        tema: { nome: { equals: "Neuroanatomia", mode: "insensitive" } },
        dificuldade: "MEDIA",
      },
      select: { id: true },
    });
  });

  it("lista ids sem filtros quando tema e dificuldade nao sao informados", async () => {
    questaoFindMany.mockResolvedValue([]);

    await repository.listarIdsQuestoesDisponiveis({});

    expect(questaoFindMany).toHaveBeenCalledWith({
      where: { status: "ATIVO", excluidoEm: null },
      select: { id: true },
    });
  });

  it("busca as questoes completas pelos ids", async () => {
    questaoFindMany.mockResolvedValue([{ id: "q1" }]);

    const questoes = await repository.buscarQuestoesPorIds(["q1"]);

    expect(questoes).toEqual([{ id: "q1" }]);
    expect(questaoFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["q1"] } },
      include: { tema: true, alternativas: true },
    });
  });

  it("cria a rodada gravando o total de questoes", async () => {
    tentativaCreate.mockResolvedValue({ id: "t1" });

    await repository.criarTentativa("aluno-1", { tema: "Cardio", dificuldade: "FACIL" }, ["q1", "q2"]);

    expect(tentativaCreate).toHaveBeenCalledWith({
      data: {
        usuarioId: "aluno-1",
        tema: "Cardio",
        dificuldade: "FACIL",
        questaoIds: ["q1", "q2"],
        totalQuestoes: 2,
      },
    });
  });

  it("busca a rodada restrita ao dono", async () => {
    tentativaFindFirst.mockResolvedValue(null);

    await repository.buscarTentativaParaConclusao("t1", "aluno-1");

    expect(tentativaFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1", usuarioId: "aluno-1" } }),
    );
  });

  describe("concluirTentativa", () => {
    const recompensa = { xpBase: 20, bonusDesempenho: 15, bonusPowerUp: 0, xpTotalRecebido: 35 };

    it("fecha a rodada, soma o XP e registra a transacao com o acumulado", async () => {
      tentativaUpdateMany.mockResolvedValue({ count: 1 });
      progressoUpsert.mockResolvedValue({ xpTotal: 135, maiorElo: EloXp.CURIOSO });

      const resultado = await repository.concluirTentativa({
        tentativaId: "t1",
        usuarioId: "aluno-1",
        totalAcertos: 3,
        recompensa,
      });

      expect(resultado).toMatchObject({ concluidaAgora: true });
      expect(tentativaUpdateMany).toHaveBeenCalledWith({
        where: { id: "t1", usuarioId: "aluno-1", status: StatusTentativaQuiz.EM_ANDAMENTO },
        data: {
          status: StatusTentativaQuiz.CONCLUIDA,
          concluidaEm: expect.any(Date),
          totalAcertos: 3,
        },
      });
      expect(progressoUpsert).toHaveBeenCalledWith({
        where: { usuarioId: "aluno-1" },
        create: { usuarioId: "aluno-1", xpTotal: 35, maiorElo: EloXp.CURIOSO },
        update: { xpTotal: { increment: 35 } },
        select: { xpTotal: true, maiorElo: true },
      });
      expect(progressoUpdate).not.toHaveBeenCalled();
      expect(transacaoCreate).toHaveBeenCalledWith({
        data: {
          usuarioId: "aluno-1",
          tentativaId: "t1",
          xpBase: 20,
          bonusDesempenho: 15,
          bonusPowerUp: 0,
          quantidade: 35,
          xpTotalApos: 135,
        },
      });
    });

    it("atualiza maiorElo quando o XP acumulado atinge uma nova faixa de elo", async () => {
      tentativaUpdateMany.mockResolvedValue({ count: 1 });
      progressoUpsert.mockResolvedValue({ xpTotal: 520, maiorElo: EloXp.CURIOSO });

      await repository.concluirTentativa({
        tentativaId: "t1",
        usuarioId: "aluno-1",
        totalAcertos: 3,
        recompensa,
      });

      expect(progressoUpdate).toHaveBeenCalledWith({
        where: { usuarioId: "aluno-1" },
        data: { maiorElo: EloXp.ACADEMICO },
      });
    });

    it("nao credita XP quando a rodada ja tinha sido concluida", async () => {
      tentativaUpdateMany.mockResolvedValue({ count: 0 });

      const resultado = await repository.concluirTentativa({
        tentativaId: "t1",
        usuarioId: "aluno-1",
        totalAcertos: 3,
        recompensa,
      });

      expect(resultado).toEqual({ concluidaAgora: false });
      expect(progressoUpsert).not.toHaveBeenCalled();
      expect(transacaoCreate).not.toHaveBeenCalled();
    });

    it("fecha a rodada sem XP quando nao ha recompensa", async () => {
      tentativaUpdateMany.mockResolvedValue({ count: 1 });

      const resultado = await repository.concluirTentativa({
        tentativaId: "t1",
        usuarioId: "prof-1",
        totalAcertos: 2,
        recompensa: null,
      });

      expect(resultado).toMatchObject({ concluidaAgora: true });
      expect(progressoUpsert).not.toHaveBeenCalled();
      expect(transacaoCreate).not.toHaveBeenCalled();
    });
  });

  it("devolve o XP total ou zero quando o usuario ainda nao tem progresso", async () => {
    progressoFindUnique.mockResolvedValueOnce({ xpTotal: 240 }).mockResolvedValueOnce(null);

    await expect(repository.buscarXpTotal("aluno-1")).resolves.toBe(240);
    await expect(repository.buscarXpTotal("aluno-2")).resolves.toBe(0);
  });

  it("devolve os dados de progresso (xpTotal e maiorElo) ou valores padrao", async () => {
    progressoFindUnique
      .mockResolvedValueOnce({ xpTotal: 1500, maiorElo: EloXp.INTERNO })
      .mockResolvedValueOnce(null);

    await expect(repository.buscarDadosProgresso("aluno-1")).resolves.toEqual({
      xpTotal: 1500,
      maiorElo: EloXp.INTERNO,
    });
    await expect(repository.buscarDadosProgresso("aluno-2")).resolves.toEqual({
      xpTotal: 0,
      maiorElo: EloXp.CURIOSO,
    });
  });

  it("lista o historico de XP paginado, mais recente primeiro", async () => {
    transacaoFindMany.mockResolvedValue([{ id: "xp-1" }]);
    transacaoCount.mockResolvedValue(1);

    const resultado = await repository.listarHistoricoXp("aluno-1", { page: 2, limit: 5, skip: 5 });

    expect(resultado).toEqual({ data: [{ id: "xp-1" }], total: 1 });
    expect(transacaoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuarioId: "aluno-1" },
        orderBy: { criadoEm: "desc" },
        skip: 5,
        take: 5,
      }),
    );
    expect(transacaoCount).toHaveBeenCalledWith({ where: { usuarioId: "aluno-1" } });
  });
});
