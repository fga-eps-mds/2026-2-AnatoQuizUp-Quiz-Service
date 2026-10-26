import { EloXp, StatusTentativaQuiz } from "@prisma/client";

import { prisma } from "@/config/db";
import { creditarXp } from "@/modules/progressao/elo.repository";
import { ProgressaoRepository } from "@/modules/progressao/progressao.repository";

jest.mock("@/modules/missoes/missoes.repository", () => ({ bloquearMissoes: jest.fn(), contabilizarQuiz: jest.fn() }));

// O credito de XP (e o efeito dele sobre o elo) tem testes proprios em
// elo.repository.test.ts; aqui so interessa que a conclusao da rodada passe por ele.
jest.mock("@/modules/progressao/elo.repository", () => ({ creditarXp: jest.fn() }));

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
const transacaoCreate = prisma.transacaoXp.create as jest.Mock;
const transacaoFindMany = prisma.transacaoXp.findMany as jest.Mock;
const transacaoCount = prisma.transacaoXp.count as jest.Mock;
const creditarXpMock = creditarXp as jest.Mock;

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
      creditarXpMock.mockResolvedValue({
        xpTotal: 135,
        xpElo: 135,
        eloAtual: EloXp.CURIOSO,
        maiorElo: EloXp.CURIOSO,
        eventoElo: null,
        eloAnterior: EloXp.CURIOSO,
      });

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
      // Caminho unico de credito: soma nos dois saldos e registra a atividade valida.
      expect(creditarXpMock).toHaveBeenCalledWith(
        expect.anything(),
        "aluno-1",
        35,
        expect.any(Date),
      );
      expect(transacaoCreate).toHaveBeenCalledWith({
        data: {
          usuarioId: "aluno-1",
          tentativaId: "t1",
          xpBase: 20,
          bonusDesempenho: 15,
          bonusPowerUp: 0,
          quantidade: 35,
          xpTotalApos: 135,
          xpEloApos: 135,
        },
      });
    });

    it("grava a transacao com o XP total devolvido pelo credito", async () => {
      tentativaUpdateMany.mockResolvedValue({ count: 1 });
      creditarXpMock.mockResolvedValue({
        xpTotal: 520,
        xpElo: 520,
        eloAtual: EloXp.ACADEMICO,
        maiorElo: EloXp.ACADEMICO,
        eventoElo: "PROMOCAO",
        eloAnterior: EloXp.CURIOSO,
      });

      await repository.concluirTentativa({
        tentativaId: "t1",
        usuarioId: "aluno-1",
        totalAcertos: 3,
        recompensa,
      });

      expect(transacaoCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ xpTotalApos: 520 }) }),
      );
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

  it("devolve o estado completo de XP e elo ou valores padrao", async () => {
    const ultimaAtividade = new Date("2026-10-20T00:00:00.000Z");

    progressoFindUnique
      .mockResolvedValueOnce({
        xpTotal: 1500,
        xpElo: 1200,
        eloAtual: EloXp.ACADEMICO,
        maiorElo: EloXp.INTERNO,
        ultimaAtividadeEm: ultimaAtividade,
        rebaixamentosAplicados: 1,
      })
      .mockResolvedValueOnce(null);

    await expect(repository.buscarDadosProgresso("aluno-1")).resolves.toEqual({
      xpTotal: 1500,
      xpElo: 1200,
      eloAtual: EloXp.ACADEMICO,
      maiorElo: EloXp.INTERNO,
      ultimaAtividadeEm: ultimaAtividade,
      rebaixamentosAplicados: 1,
    });
    await expect(repository.buscarDadosProgresso("aluno-2")).resolves.toEqual({
      xpTotal: 0,
      xpElo: 0,
      eloAtual: EloXp.CURIOSO,
      maiorElo: EloXp.CURIOSO,
      ultimaAtividadeEm: null,
      rebaixamentosAplicados: 0,
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
