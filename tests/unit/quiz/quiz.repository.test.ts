import { prisma } from "@/config/db";
import type { FiltroListarQuestoesQueryDto } from "@/modules/questoes/dto/question.types";
import { DIFICULDADE_API, TIPO_QUESTAO_API } from "@/modules/questoes/dto/question.types";
import { QuizRepository } from "@/modules/quiz/quiz.repository";
import { AlternativaQuestao, FonteMoeda } from "@prisma/client";

jest.mock("@/config/db", () => ({
  prisma: {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),

    questao: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    resolucaoQuestao: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    carteiraMoedas: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    transacaoMoeda: {
      createMany: jest.fn(),
    },
    tema: {
      findMany: jest.fn(),
    },
  },
}));

const transactionMock = prisma.$transaction as jest.Mock;

describe("Testa QuizRepository", () => {
  let repository: QuizRepository;

  beforeEach(() => {
    repository = new QuizRepository();
    jest.clearAllMocks();
  });

  test("deve filtrar questoes por tema, dificuldade e tipo com paginacao", async () => {
    const registros = [{ id: "questao-filtrada-1" }];
    const totalRegistros = 1;

    transactionMock.mockResolvedValue([registros, totalRegistros]);

    const filtros: FiltroListarQuestoesQueryDto = {
      tema: "Sistema Cardiovascular",
      dificuldade: DIFICULDADE_API.MEDIA,
      tipo: TIPO_QUESTAO_API.MULTIPLA_ESCOLHA,
    };

    const paginacao = { skip: 0, limit: 5, page: 1 };

    const resposta = await repository.filtrarQuestoesQuiz(paginacao, filtros);

    expect(prisma.questao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ATIVO",
          excluidoEm: null,
          dificuldade: "MEDIA",
          tipoQuestao: "MULTIPLA_ESCOLHA",
          tema: {
            nome: {
              equals: "Sistema Cardiovascular",
              mode: "insensitive",
            },
          },
        }),
        include: {
          tema: true,
          alternativas: true,
        },
        skip: 0,
        take: 5,
      }),
    );

    expect(prisma.questao.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ATIVO",
          excluidoEm: null,
          dificuldade: "MEDIA",
          tipoQuestao: "MULTIPLA_ESCOLHA",
          tema: {
            nome: {
              equals: "Sistema Cardiovascular",
              mode: "insensitive",
            },
          },
        }),
      }),
    );

    expect(resposta).toEqual({ data: registros, total: totalRegistros });
  });

  test("Deve criar novo registro de resposta à questão de quiz", async () => {
    const usuarioId = "usuario_id";
    const tentativa = {
      questaoId: "questao-id",
      tipo: TIPO_QUESTAO_API.CERTO_ERRADO,
      respostaMarcada: AlternativaQuestao.E,
    };

    await repository.registrarTentativa(tentativa, usuarioId);

    expect(prisma.resolucaoQuestao.create).toHaveBeenCalledWith({
      data: {
        questaoId: "questao-id",
        respostaMarcada: AlternativaQuestao.E,
        usuarioId,
      },
    });
  });

  test("Deve buscar um registro de tentativa de resposta", async () => {
    const id = "id-tentativa";

    await repository.buscarResposta(id);

    expect(prisma.questao.findUnique).toHaveBeenCalledWith({
      where: { id, excluidoEm: null },
      select: {
        respostaCorreta: true,
        saibaMais: true,
        dificuldade: true,
        temaId: true,
        tema: true,
      },
    });
  });

  test("deve retornar saldo de moedas quando carteira existir", async () => {
    (prisma.carteiraMoedas.findUnique as jest.Mock).mockResolvedValue({ saldo: 35 });

    const saldo = await repository.buscarSaldoMoedas("usuario-id");

    expect(prisma.carteiraMoedas.findUnique).toHaveBeenCalledWith({
      where: { usuarioId: "usuario-id" },
      select: { saldo: true },
    });
    expect(saldo).toBe(35);
  });

  test("deve retornar saldo zero quando carteira nao existir", async () => {
    (prisma.carteiraMoedas.findUnique as jest.Mock).mockResolvedValue(null);

    const saldo = await repository.buscarSaldoMoedas("usuario-id");

    expect(saldo).toBe(0);
  });

  test("deve criar transacao e incrementar saldo ao conceder moedas", async () => {
    const tx = {
      carteiraMoedas: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ saldo: 25 }),
      },
      transacaoMoeda: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    transactionMock.mockImplementation(async (callback) => callback(tx));

    const resultado = await repository.concederMoedasPorAcerto("usuario-id", "questao-id", 25);

    expect(tx.carteiraMoedas.upsert).toHaveBeenCalledWith({
      where: { usuarioId: "usuario-id" },
      create: { usuarioId: "usuario-id", saldo: 0 },
      update: {},
    });
    expect(tx.transacaoMoeda.createMany).toHaveBeenCalledWith({
      data: [
        {
          usuarioId: "usuario-id",
          questaoId: "questao-id",
          quantidade: 25,
          fonte: FonteMoeda.ACERTO_QUESTAO,
        },
      ],
      skipDuplicates: true,
    });
    expect(tx.carteiraMoedas.update).toHaveBeenCalledWith({
      where: { usuarioId: "usuario-id" },
      data: { saldo: { increment: 25 } },
      select: { saldo: true },
    });
    expect(resultado).toEqual({
      moedasConcedidas: 25,
      saldoMoedas: 25,
      moedasJaConcedidas: false,
    });
  });

  test("deve manter saldo quando transacao de moeda ja existir", async () => {
    const tx = {
      carteiraMoedas: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({ saldo: 50 }),
        update: jest.fn(),
      },
      transacaoMoeda: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    transactionMock.mockImplementation(async (callback) => callback(tx));

    const resultado = await repository.concederMoedasPorAcerto("usuario-id", "questao-id", 50);

    expect(tx.carteiraMoedas.update).not.toHaveBeenCalled();
    expect(tx.carteiraMoedas.findUnique).toHaveBeenCalledWith({
      where: { usuarioId: "usuario-id" },
      select: { saldo: true },
    });
    expect(resultado).toEqual({
      moedasConcedidas: 0,
      saldoMoedas: 50,
      moedasJaConcedidas: true,
    });
  });

  test("deve contar questões filtradas por tema, dificuldade e tipo", async () => {
    const filtros: FiltroListarQuestoesQueryDto = {
      tema: "Sistema Cardiovascular",
      dificuldade: DIFICULDADE_API.MEDIA,
      tipo: TIPO_QUESTAO_API.MULTIPLA_ESCOLHA,
    };

    await repository.contarQuestoesQuiz(filtros);

    expect(prisma.questao.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ATIVO",
          excluidoEm: null,
          dificuldade: "MEDIA",
          tipoQuestao: "MULTIPLA_ESCOLHA",
          tema: {
            nome: {
              equals: "Sistema Cardiovascular",
              mode: "insensitive",
            },
          },
        }),
      }),
    );
  });

  test("Deve contar a quantidade de questões por tema e dificuldade", async () => {
    await repository.buscarQuantidadeDeQuestoesPorTema();

    expect(prisma.tema.findMany).toHaveBeenCalledWith({
      where: {
        questoes: {
          some: {
            status: "ATIVO",
            excluidoEm: null,
          },
        },
      },
      select: {
        nome: true,
        questoes: {
          where: {
            status: "ATIVO",
            excluidoEm: null,
          },
          select: {
            dificuldade: true,
          },
        },
        _count: {
          select: {
            questoes: {
              where: {
                status: "ATIVO",
                excluidoEm: null,
              },
            },
          },
        },
      },
    });

    expect(prisma.tema.findMany).toHaveBeenCalledTimes(1);
  });

  test("deve listar questões respondidas com filtros e paginação", async () => {
    const filtros: FiltroListarQuestoesQueryDto = {
      tema: "Sistema Cardiovascular",
      dificuldade: DIFICULDADE_API.MEDIA,
      tipo: TIPO_QUESTAO_API.MULTIPLA_ESCOLHA,
    };

    const paginacao = {
      skip: 0,
      limit: 5,
      page: 1,
    };

    const registros = [{ id: "resolucao-1" }];
    const totalRegistros = 1;

    transactionMock.mockResolvedValue([registros, totalRegistros]);

    const resposta = await repository.listarQuestoesRespondidas("usuario-1", paginacao, filtros);

    const where = {
      usuarioId: "usuario-1",
      excluidoEm: null,
      questao: {
        excluidoEm: null,
        status: "ATIVO",
        tema: {
          nome: {
            equals: "Sistema Cardiovascular",
            mode: "insensitive",
          },
        },
        dificuldade: "MEDIA",
        tipoQuestao: "MULTIPLA_ESCOLHA",
      },
    };

    const select = {
      id: true,
      questaoId: true,
      respostaMarcada: true,
      criadoEm: true,
      questao: {
        select: {
          enunciado: true,
          tipoQuestao: true,
          respostaCorreta: true,
          saibaMais: true,
          status: true,
          origemQuestao: true,
          urlImagem: true,
          dificuldade: true,
          tema: {
            select: {
              id: true,
              nome: true,
            },
          },
          alternativas: {
            select: {
              alternativaA: true,
              alternativaB: true,
              alternativaC: true,
              alternativaD: true,
              alternativaE: true,
            },
          },
        },
      },
    };

    expect(prisma.resolucaoQuestao.findMany).toHaveBeenCalledWith({
      where,
      select,
      skip: 0,
      take: 5,
      orderBy: {
        criadoEm: "desc",
      },
    });

    expect(prisma.resolucaoQuestao.count).toHaveBeenCalledWith({ where });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(resposta).toEqual({ data: registros, total: totalRegistros });
  });

  test("deve paginar apenas respostas erradas do próprio aluno", async () => {
    const queryRaw = prisma.$queryRaw as jest.Mock;
    queryRaw.mockResolvedValueOnce([{ id: "erro-2" }, { id: "erro-1" }]);
    queryRaw.mockResolvedValueOnce([{ total: 2 }]);
    (prisma.resolucaoQuestao.findMany as jest.Mock).mockResolvedValue([
      { id: "erro-1" },
      { id: "erro-2" },
    ]);

    const resposta = await repository.listarQuestoesRespondidas(
      "aluno-autenticado",
      { skip: 0, limit: 2, page: 1 },
      { somenteErros: true, tema: "Neuroanatomia" },
    );

    expect(resposta).toEqual({ data: [{ id: "erro-2" }, { id: "erro-1" }], total: 2 });
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.resolucaoQuestao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["erro-2", "erro-1"] } } }),
    );
    const parametros = queryRaw.mock.calls[0][0].values;
    expect(parametros).toContain("aluno-autenticado");
    expect(parametros).toContain("Neuroanatomia");
  });

  test("deve aplicar todos os filtros e preservar o total quando a página de erros estiver vazia", async () => {
    const queryRaw = prisma.$queryRaw as jest.Mock;
    queryRaw.mockResolvedValueOnce([]);
    queryRaw.mockResolvedValueOnce([{ total: 7 }]);

    const resposta = await repository.listarQuestoesRespondidas(
      "aluno-autenticado",
      { skip: 10, limit: 10, page: 2 },
      {
        somenteErros: true,
        tema: "Neuroanatomia",
        dificuldade: DIFICULDADE_API.DIFICIL,
        tipo: TIPO_QUESTAO_API.CERTO_ERRADO,
      },
    );

    expect(resposta).toEqual({ data: [], total: 7 });
    expect(prisma.resolucaoQuestao.findMany).not.toHaveBeenCalled();

    const parametros = queryRaw.mock.calls[0][0].values;
    expect(parametros).toEqual(
      expect.arrayContaining([
        "aluno-autenticado",
        "Neuroanatomia",
        DIFICULDADE_API.DIFICIL,
        TIPO_QUESTAO_API.CERTO_ERRADO,
        10,
      ]),
    );
  });

  test("deve ignorar ids que deixaram de existir durante a hidratação do histórico de erros", async () => {
    const queryRaw = prisma.$queryRaw as jest.Mock;
    queryRaw.mockResolvedValueOnce([{ id: "erro-existente" }, { id: "erro-removido" }]);
    queryRaw.mockResolvedValueOnce([]);
    (prisma.resolucaoQuestao.findMany as jest.Mock).mockResolvedValue([
      { id: "erro-existente" },
    ]);

    const resposta = await repository.listarQuestoesRespondidas(
      "aluno-autenticado",
      { skip: 0, limit: 2, page: 1 },
      { somenteErros: true },
    );

    expect(resposta).toEqual({ data: [{ id: "erro-existente" }], total: 0 });
  });
});
