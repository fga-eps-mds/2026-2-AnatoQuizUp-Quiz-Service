import { prisma } from "@/config/db";
import { ConquistaRepository } from "@/modules/conquistas/conquistas.repository";
import { TipoConquista } from "@prisma/client";

jest.mock("@/config/db", () => ({
  prisma: {
    $transaction: jest.fn(),

    conquista: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    conquistaUsuario: {
      upsert: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    desbloqueioConquista: {
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    carteiraMoedas: {
      upsert: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    transacaoMoeda: {
      createMany: jest.fn(),
    },
    recompensaItemConquista: {
      findUnique: jest.fn(),
    },
    inventarioItem: {
      createMany: jest.fn(),
    },
  },
}));

const transactionMock = prisma.$transaction as jest.Mock;

describe("Testa Conquista Repository", () => {
  let repository: ConquistaRepository;

  beforeEach(() => {
    repository = new ConquistaRepository();
    jest.clearAllMocks();
  });

  test("Deve criar conquista de total de acertos em tema", async () => {
    const temaId = "tema-id";
    const nomeTema = "nome-id";

    await repository.criarConquistaTema(temaId, nomeTema);

    expect(prisma.conquista.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          nome: `Especialista em ${nomeTema}`,
          descricao: `Conquista obtida ao demonstrar domínio no tema ${nomeTema}.`,
          tipoConquista: "TOTAL_ACERTOS_TEMA",
          temaId,
        },
      }),
    );
  });

  test("Deve checar se conquista de total de acertos em tema existe", async () => {
    const temaId = "tema-id";

    await repository.existeConquistaTema(temaId);

    expect(prisma.conquista.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          temaId,
          tipoConquista: "TOTAL_ACERTOS_TEMA",
        },
        include: {
          tema: true,
        },
      }),
    );
  });

  test("Deve buscar conquista de total de acertos totais", async () => {
    await repository.buscarConquistaTotalAcertos();

    expect(prisma.conquista.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tipoConquista: TipoConquista.TOTAL_ACERTOS,
          ativo: true,
        },
      }),
    );
  });

  test("Deve buscar conquista de streak de acertos totais", async () => {
    await repository.buscarConquistaStreak();

    expect(prisma.conquista.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tipoConquista: TipoConquista.STREAK_ACERTOS,
          ativo: true,
        },
      }),
    );
  });

  test("Deve buscar conquista de total de acertos em tema", async () => {
    const temaId = "tema-id";

    await repository.buscarConquistaTema(temaId);

    expect(prisma.conquista.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tipoConquista: TipoConquista.TOTAL_ACERTOS_TEMA,
          temaId,
          ativo: true,
        },
      }),
    );
  });

  test("Deve buscar ou criar progresso de usuario em conquista", async () => {
    const usuarioId = "usuario-id";
    const conquistaId = "conquista-id";

    await repository.buscarOuCriarProgresso(usuarioId, conquistaId);

    expect(prisma.conquistaUsuario.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuarioId_conquistaId: {
            usuarioId,
            conquistaId,
          },
        },

        create: {
          usuarioId,
          conquistaId,
          valorProgresso: 0,
        },

        update: {},
      }),
    );
  });

  test("Deve atualizar progresso de usuario em conquista", async () => {
    const usuarioId = "usuario-id";
    const conquistaId = "conquista-id";
    const valor = 5;

    await repository.atualizarProgresso(usuarioId, conquistaId, valor);

    expect(prisma.conquistaUsuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuarioId_conquistaId: {
            usuarioId,
            conquistaId,
          },
        },

        data: {
          valorProgresso: valor,
        },
      }),
    );
  });

  test("Deve checar se usuario desbloqueou um tier em conquista", async () => {
    const usuarioId = "usuario-id";
    const conquistaId = "conquista-id";
    const tier = "BRONZE";

    await repository.possuiTier(usuarioId, conquistaId, tier);

    expect(prisma.desbloqueioConquista.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuarioId_conquistaId_tier: {
            usuarioId,
            conquistaId,
            tier,
          },
        },
      }),
    );
  });

  test("Deve criar desbloqueio e conceder ATP atomicamente", async () => {
    const usuarioId = "usuario-id";
    const conquistaId = "conquista-id";
    const tier = "BRONZE";
    const tx = {
      desbloqueioConquista: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "desbloqueio-id" }),
      },
      carteiraMoedas: {
        upsert: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ saldo: 30 }),
      },
      transacaoMoeda: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      recompensaItemConquista: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      inventarioItem: {
        createMany: jest.fn(),
      },
    };
    transactionMock.mockImplementation(async (callback) => callback(tx));

    const resultado = await repository.criarDesbloqueioComRecompensas(
      usuarioId,
      conquistaId,
      tier,
      30,
    );

    expect(tx.desbloqueioConquista.createMany).toHaveBeenCalledWith({
      data: {
        usuarioId,
        conquistaId,
        tier,
      },
      skipDuplicates: true,
    });
    expect(tx.transacaoMoeda.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          desbloqueioId: "desbloqueio-id",
          quantidade: 30,
        }),
      }),
    );
    expect(resultado).toMatchObject({
      moedasConcedidas: 30,
      saldoMoedas: 30,
      itemConcedido: null,
    });
  });

  test("Deve conceder o item de recompensa quando o tier tiver um associado", async () => {
    const itemLoja = { id: "item-1", nome: "Item exclusivo" };
    const tx = {
      desbloqueioConquista: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "desbloqueio-id" }),
      },
      carteiraMoedas: {
        upsert: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ saldo: 30 }),
      },
      transacaoMoeda: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      recompensaItemConquista: {
        findUnique: jest.fn().mockResolvedValue({ itemLojaId: "item-1", itemLoja }),
      },
      inventarioItem: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    transactionMock.mockImplementation(async (callback) => callback(tx));

    const resultado = await repository.criarDesbloqueioComRecompensas(
      "usuario-id",
      "conquista-id",
      "BRONZE",
      30,
    );

    expect(tx.inventarioItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ itemLojaId: "item-1", desbloqueioConquistaId: "desbloqueio-id" }),
      }),
    );
    expect(resultado).toMatchObject({ itemConcedido: itemLoja });
  });

  test("Nao concede o item de recompensa quando o inventario ja possui (skipDuplicates)", async () => {
    const tx = {
      desbloqueioConquista: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "desbloqueio-id" }),
      },
      carteiraMoedas: {
        upsert: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ saldo: 30 }),
      },
      transacaoMoeda: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      recompensaItemConquista: {
        findUnique: jest.fn().mockResolvedValue({ itemLojaId: "item-1", itemLoja: { id: "item-1" } }),
      },
      inventarioItem: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    transactionMock.mockImplementation(async (callback) => callback(tx));

    const resultado = await repository.criarDesbloqueioComRecompensas(
      "usuario-id",
      "conquista-id",
      "BRONZE",
      30,
    );

    // transacaoMoeda.createMany nao criou nada (ja existia): nao credita de novo.
    expect(tx.carteiraMoedas.update).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({ moedasConcedidas: 0, itemConcedido: null });
  });

  test("Nao duplica recompensas quando o tier ja foi desbloqueado", async () => {
    const tx = {
      desbloqueioConquista: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    transactionMock.mockImplementation(async (callback) => callback(tx));

    const resultado = await repository.criarDesbloqueioComRecompensas(
      "usuario-id",
      "conquista-id",
      "BRONZE",
      30,
    );

    expect(resultado).toBeNull();
  });

  test("Deve alterar destaques de um usuario", async () => {
    const usuarioId = "usuario-id";
    const desbloqueioId = "desbloqueio-id";
    const destaque = true;

    await repository.alterarDestaque(usuarioId, desbloqueioId, destaque);

    expect(prisma.desbloqueioConquista.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: desbloqueioId,
          usuarioId,
        },

        data: {
          destaque,
        },
      }),
    );
  });

  test("Deve contar conquistas destacadas destaques de um usuario", async () => {
    const usuarioId = "usuario-id";

    await repository.contarConquistasDestacadas(usuarioId);

    expect(prisma.desbloqueioConquista.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuarioId,
          destaque: true,
        },
      }),
    );
  });

  test("Deve buscar o desbloqueio de um tier de conquista de um usuario", async () => {
    const usuarioId = "usuario-id";
    const desbloqueioId = "desbloqueio-id";

    await repository.buscarDesbloqueioPorId(usuarioId, desbloqueioId);

    expect(prisma.desbloqueioConquista.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: desbloqueioId,
          usuarioId,
        },
      }),
    );
  });

  test("Deve buscar conquistas de usuário destacadas de um usuario", async () => {
    const usuarioId = "usuario-id";

    await repository.buscarConquistasDestacadas(usuarioId);

    expect(prisma.desbloqueioConquista.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuarioId,
          destaque: true,
        },

        include: {
          conquista: {
            include: {
              tema: true,
            },
          },
        },

        orderBy: {
          conquistadoEm: "desc",
        },
      }),
    );
  });

  test("Deve listar destaques de varios usuarios de uma vez", async () => {
    const usuarioIds = ["usuario-1", "usuario-2"];

    await repository.listarDestaquesUsuarios(usuarioIds);

    expect(prisma.desbloqueioConquista.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuarioId: { in: usuarioIds },
          destaque: true,
          conquista: { ativo: true },
        },
      }),
    );
  });

  test("Deve listar progresso de um usuario", async () => {
    const registros = [{ id: "progresso-1" }];
    const totalRegistros = 1;

    const usuarioId = "usuario-id";
    const paginacao = {
      page: 1,
      limit: 10,
      skip: 0,
    };

    transactionMock.mockResolvedValue([registros, totalRegistros]);

    await repository.listarProgressoUsuario(usuarioId, paginacao);

    expect(prisma.conquista.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ativo: true,
        },

        select: {
          id: true,
          nome: true,
          descricao: true,
          tipoConquista: true,
          tema: {
            select: {
              id: true,
              nome: true,
            },
          },
          usuarios: {
            where: {
              usuarioId,
            },
            select: {
              valorProgresso: true,
            },
            take: 1,
          },
          desbloqueios: {
            where: {
              usuarioId,
            },
            select: {
              id: true,
              tier: true,
              destaque: true,
              conquistadoEm: true,
            },
          },
          recompensasItens: {
            select: {
              tier: true,
              itemLoja: {
                select: {
                  id: true,
                  codigo: true,
                  nome: true,
                  descricao: true,
                  tipo: true,
                  valor: true,
                  imagemUrl: true,
                  previewImagemUrl: true,
                },
              },
            },
          },
        },

        skip: paginacao.skip,
        take: paginacao.limit,

        orderBy: {
          nome: "asc",
        },
      }),
    );

    expect(prisma.conquista.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ativo: true,
        },
      }),
    );
  });

  test("Deve buscar progresso do usuario em uma conquistas", async () => {
    const usuarioId = "usuario-id";
    const minhaConquistaId = "minhaConquista-id";

    await repository.listarMeuProgressoEmConquista(usuarioId, minhaConquistaId);

    expect(prisma.conquistaUsuario.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuarioId_conquistaId: {
            usuarioId,
            conquistaId: minhaConquistaId,
          },
        },
        select: {
          id: true,
          valorProgresso: true,
          conquista: {
            select: {
              id: true,
              nome: true,
              descricao: true,
              tipoConquista: true,
              desbloqueios: {
                where: {
                  usuarioId,
                },
                select: {
                  tier: true,
                  conquistadoEm: true,
                },
              },
            },
          },
        },
      }),
    );
  });

  test("Deve listar conquistas desbloqueadas de um usuario", async () => {
    const registros = [{ id: "desbloqueio-1" }];
    const totalRegistros = 1;

    const usuarioId = "usuario-id";
    const paginacao = {
      page: 1,
      limit: 10,
      skip: 0,
    };

    transactionMock.mockResolvedValue([registros, totalRegistros]);

    await repository.listarDesbloqueadasUsuario(usuarioId, paginacao);

    expect(prisma.desbloqueioConquista.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuarioId,
        },

        include: {
          conquista: true,
        },

        skip: paginacao.skip,
        take: paginacao.limit,

        orderBy: {
          conquistadoEm: "desc",
        },
      }),
    );

    expect(prisma.desbloqueioConquista.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuarioId,
        },
      }),
    );
  });

  test("Deve listar conquistas da plataforma", async () => {
    const registros = [{ id: "desbloqueio-1" }];
    const totalRegistros = 1;

    const paginacao = {
      page: 1,
      limit: 10,
      skip: 0,
    };

    transactionMock.mockResolvedValue([registros, totalRegistros]);

    await repository.listarConquistas(paginacao);

    expect(prisma.conquista.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ativo: true,
        },

        include: {
          tema: true,
        },

        skip: paginacao.skip,
        take: paginacao.limit,

        orderBy: {
          nome: "asc",
        },
      }),
    );

    expect(prisma.conquista.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ativo: true,
        },
      }),
    );
  });
});
