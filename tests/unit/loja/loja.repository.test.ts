import { prisma } from "@/config/db";
import { LojaRepository } from "@/modules/loja/loja.repository";
import { FonteMoeda, TipoItemLoja } from "@prisma/client";
import { ErroAplicacao } from "@/shared/errors/erro-aplicacao";

jest.mock("@/config/db", () => ({
  prisma: {
    $transaction: jest.fn(),

    itemLoja: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },

    inventarioItem: {
      findMany: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
      upsert: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },

    carteiraMoedas: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },

    transacaoMoeda: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const transactionMock = prisma.$transaction as jest.Mock;

function criarItemLoja(overrides = {}) {
  const agora = new Date("2026-06-16T00:00:00.000Z");

  return {
    id: "item-loja-id",
    codigo: "icone-coruja-sabia",
    nome: "Coruja Sábia",
    descricao: "Ícone de perfil para os estudiosos de plantão.",
    tipo: TipoItemLoja.ICONE_PERFIL,
    precoMoedas: 1,
    valor: null,
    imagemUrl: null,
    previewImagemUrl: null,
    disponivelNaLoja: true,
    consumivel: false,
    efeito: null,
    ativo: true,
    criadoEm: agora,
    atualizadoEm: agora,
    excluidoEm: null,
    ...overrides,
  };
}

function criarInventario(itemLoja = criarItemLoja()) {
  const agora = new Date("2026-06-16T00:00:00.000Z");

  return {
    id: "inventario-id",
    usuarioId: "usuario-id",
    itemLojaId: itemLoja.id,
    equipado: false,
    quantidade: 1,
    adquiridoEm: agora,
    criadoEm: agora,
    atualizadoEm: agora,
    excluidoEm: null,
    itemLoja,
  };
}

describe("Testa Loja Repository", () => {
  let repository: LojaRepository;

  beforeEach(() => {
    repository = new LojaRepository();
    jest.clearAllMocks();
  });

  test("deve listar catalogo com filtros e itens adquiridos", async () => {
    const item = criarItemLoja();
    const registros = [item];
    const totalRegistros = 1;

    transactionMock.mockResolvedValue([registros, totalRegistros]);

    (prisma.inventarioItem.findMany as jest.Mock).mockResolvedValue([
      {
        itemLojaId: item.id,
        quantidade: 1,
      },
    ]);

    const resultado = await repository.listarCatalogo(
      "usuario-id",
      {
        page: 1,
        limit: 10,
        skip: 0,
      },
      {
        tipo: TipoItemLoja.ICONE_PERFIL,
      },
    );

    expect(prisma.itemLoja.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ativo: true,
          excluidoEm: null,
          tipo: TipoItemLoja.ICONE_PERFIL,
        }),
        skip: 0,
        take: 10,
        orderBy: [{ tipo: "asc" }, { precoMoedas: "asc" }, { nome: "asc" }],
      }),
    );

    expect(prisma.itemLoja.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ativo: true,
          excluidoEm: null,
          tipo: TipoItemLoja.ICONE_PERFIL,
        }),
      }),
    );

    expect(prisma.inventarioItem.findMany).toHaveBeenCalledWith({
      where: {
        usuarioId: "usuario-id",
        itemLojaId: {
          in: [item.id],
        },
      },
      select: {
        itemLojaId: true,
        quantidade: true,
      },
    });

    expect(resultado).toEqual({
      data: registros,
      total: totalRegistros,
      quantidadesPossuidas: new Map([[item.id, 1]]),
    });
  });

  test("lista apenas compras do usuario para compor o historico da loja", async () => {
    const compras = [{ id: "compra-1" }];
    (prisma.transacaoMoeda.findMany as jest.Mock).mockResolvedValue(compras);

    await expect(repository.listarHistoricoCompras("usuario-id")).resolves.toBe(compras);
    expect(prisma.transacaoMoeda.findMany).toHaveBeenCalledWith({
      where: {
        usuarioId: "usuario-id",
        fonte: FonteMoeda.COMPRA_ITEM,
        itemLojaId: { not: null },
      },
      include: { itemLoja: true },
      orderBy: { criadoEm: "desc" },
    });
  });

  test("deve listar inventario do usuario", async () => {
    const inventario = criarInventario();

    transactionMock.mockResolvedValue([[inventario], 1]);

    const resultado = await repository.listarInventario("usuario-id", {
      page: 1,
      limit: 10,
      skip: 0,
    });

    const where = {
      usuarioId: "usuario-id",
      excluidoEm: null,
      itemLoja: {
        excluidoEm: null,
      },
    };

    expect(prisma.inventarioItem.findMany).toHaveBeenCalledWith({
      where,
      include: {
        itemLoja: true,
      },
      skip: 0,
      take: 10,
      orderBy: {
        adquiridoEm: "desc",
      },
    });

    expect(prisma.inventarioItem.count).toHaveBeenCalledWith({ where });

    expect(resultado).toEqual({
      data: [inventario],
      total: 1,
    });
  });

  test("deve comprar item com sucesso", async () => {
    const item = criarItemLoja();
    const inventario = criarInventario(item);

    const tx = {
      itemLoja: {
        findUnique: jest.fn().mockResolvedValue(item),
      },
      inventarioItem: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(inventario),
      },
      carteiraMoedas: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ saldo: 4900 }),
      },
      transacaoMoeda: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    transactionMock.mockImplementation(async (callback) => callback(tx));

    const resultado = await repository.comprarItem("usuario-id", item.id);

    expect(tx.itemLoja.findUnique).toHaveBeenCalledWith({
      where: {
        id: item.id,
      },
    });

    expect(tx.inventarioItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          usuarioId: "usuario-id",
          itemLojaId: item.id,
          origem: "COMPRA",
        },
      ],
      skipDuplicates: true,
    });

    expect(tx.carteiraMoedas.upsert).toHaveBeenCalledWith({
      where: {
        usuarioId: "usuario-id",
      },
      create: {
        usuarioId: "usuario-id",
        saldo: 0,
      },
      update: {},
    });

    expect(tx.carteiraMoedas.updateMany).toHaveBeenCalledWith({
      where: {
        usuarioId: "usuario-id",
        saldo: {
          gte: item.precoMoedas,
        },
      },
      data: {
        saldo: {
          decrement: item.precoMoedas,
        },
      },
    });

    expect(tx.transacaoMoeda.create).toHaveBeenCalledWith({
      data: {
        usuarioId: "usuario-id",
        itemLojaId: item.id,
        quantidade: -item.precoMoedas,
        quantidadeItem: 1,
        fonte: FonteMoeda.COMPRA_ITEM,
        descricao: `Compra do item: ${item.nome}`,
      },
    });

    expect(tx.carteiraMoedas.findUnique).toHaveBeenCalledWith({
      where: {
        usuarioId: "usuario-id",
      },
      select: {
        saldo: true,
      },
    });

    expect(tx.inventarioItem.findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        usuarioId_itemLojaId: {
          usuarioId: "usuario-id",
          itemLojaId: item.id,
        },
      },
      include: {
        itemLoja: true,
      },
    });

    expect(resultado).toEqual({
      saldoMoedas: 4900,
      inventarioItem: inventario,
    });
  });

  test("deve lançar erro quando item nao existir", async () => {
    const tx = {
      itemLoja: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    transactionMock.mockImplementation(async (callback) => callback(tx));

    await expect(repository.comprarItem("usuario-id", "item-inexistente")).rejects.toBeInstanceOf(
      ErroAplicacao,
    );
  });

  test("deve lançar erro quando item estiver inativo", async () => {
    const item = criarItemLoja({
      ativo: false,
    });

    const tx = {
      itemLoja: {
        findUnique: jest.fn().mockResolvedValue(item),
      },
    };

    transactionMock.mockImplementation(async (callback) => callback(tx));

    await expect(repository.comprarItem("usuario-id", item.id)).rejects.toBeInstanceOf(
      ErroAplicacao,
    );
  });

  test("deve lançar erro quando item ja tiver sido adquirido", async () => {
    const item = criarItemLoja();

    const tx = {
      itemLoja: {
        findUnique: jest.fn().mockResolvedValue(item),
      },
      inventarioItem: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      carteiraMoedas: {
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      transacaoMoeda: {
        create: jest.fn(),
      },
    };

    transactionMock.mockImplementation(async (callback) => callback(tx));

    await expect(repository.comprarItem("usuario-id", item.id)).rejects.toBeInstanceOf(
      ErroAplicacao,
    );

    expect(tx.carteiraMoedas.updateMany).not.toHaveBeenCalled();
    expect(tx.transacaoMoeda.create).not.toHaveBeenCalled();
  });

  test("deve lançar erro quando saldo for insuficiente", async () => {
    const item = criarItemLoja();

    const tx = {
      itemLoja: {
        findUnique: jest.fn().mockResolvedValue(item),
      },
      inventarioItem: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      carteiraMoedas: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      transacaoMoeda: {
        create: jest.fn(),
      },
    };

    transactionMock.mockImplementation(async (callback) => callback(tx));

    await expect(repository.comprarItem("usuario-id", item.id)).rejects.toBeInstanceOf(
      ErroAplicacao,
    );

    expect(tx.transacaoMoeda.create).not.toHaveBeenCalled();
  });

  test("deve comprar varias unidades de um consumivel somando no inventario", async () => {
    const item = criarItemLoja({
      id: "tempo-extra-id",
      nome: "Tempo Extra",
      tipo: TipoItemLoja.POTENCIALIZADOR,
      consumivel: true,
      precoMoedas: 60,
    });
    const inventario = { ...criarInventario(item), quantidade: 5 };

    const tx = {
      itemLoja: {
        findUnique: jest.fn().mockResolvedValue(item),
      },
      inventarioItem: {
        upsert: jest.fn().mockResolvedValue(inventario),
        createMany: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(inventario),
      },
      carteiraMoedas: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ saldo: 20 }),
      },
      transacaoMoeda: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    transactionMock.mockImplementation(async (callback) => callback(tx));

    const resultado = await repository.comprarItem("usuario-id", item.id, 3);

    expect(tx.inventarioItem.createMany).not.toHaveBeenCalled();
    expect(tx.inventarioItem.upsert).toHaveBeenCalledWith({
      where: {
        usuarioId_itemLojaId: {
          usuarioId: "usuario-id",
          itemLojaId: item.id,
        },
      },
      create: {
        usuarioId: "usuario-id",
        itemLojaId: item.id,
        origem: "COMPRA",
        quantidade: 3,
      },
      update: {
        quantidade: {
          increment: 3,
        },
      },
    });

    // Preco total = 60 x 3 = 180.
    expect(tx.carteiraMoedas.updateMany).toHaveBeenCalledWith({
      where: {
        usuarioId: "usuario-id",
        saldo: {
          gte: 180,
        },
      },
      data: {
        saldo: {
          decrement: 180,
        },
      },
    });

    expect(tx.transacaoMoeda.create).toHaveBeenCalledWith({
      data: {
        usuarioId: "usuario-id",
        itemLojaId: item.id,
        quantidade: -180,
        quantidadeItem: 3,
        fonte: FonteMoeda.COMPRA_ITEM,
        descricao: "Compra do item: Tempo Extra (x3)",
      },
    });

    expect(resultado).toEqual({
      saldoMoedas: 20,
      inventarioItem: inventario,
    });
  });

  test("deve recusar mais de uma unidade de um cosmetico sem alterar nada", async () => {
    const item = criarItemLoja();

    const tx = {
      itemLoja: {
        findUnique: jest.fn().mockResolvedValue(item),
      },
      inventarioItem: {
        createMany: jest.fn(),
        upsert: jest.fn(),
      },
      carteiraMoedas: {
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      transacaoMoeda: {
        create: jest.fn(),
      },
    };

    transactionMock.mockImplementation(async (callback) => callback(tx));

    await expect(repository.comprarItem("usuario-id", item.id, 2)).rejects.toMatchObject({
      codigoStatus: 422,
    });

    expect(tx.inventarioItem.createMany).not.toHaveBeenCalled();
    expect(tx.inventarioItem.upsert).not.toHaveBeenCalled();
    expect(tx.carteiraMoedas.updateMany).not.toHaveBeenCalled();
    expect(tx.transacaoMoeda.create).not.toHaveBeenCalled();
  });

  test("deve recusar compra de item exclusivo de conquista", async () => {
    const item = criarItemLoja({ disponivelNaLoja: false });

    const tx = {
      itemLoja: {
        findUnique: jest.fn().mockResolvedValue(item),
      },
    };

    transactionMock.mockImplementation(async (callback) => callback(tx));

    await expect(repository.comprarItem("usuario-id", item.id)).rejects.toMatchObject({
      codigoStatus: 422,
    });
  });

  test("deve lançar erro de saldo insuficiente ao comprar consumivel sem registrar a compra", async () => {
    const item = criarItemLoja({
      tipo: TipoItemLoja.DICA,
      consumivel: true,
      precoMoedas: 50,
    });

    const tx = {
      itemLoja: {
        findUnique: jest.fn().mockResolvedValue(item),
      },
      inventarioItem: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      carteiraMoedas: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      transacaoMoeda: {
        create: jest.fn(),
      },
    };

    transactionMock.mockImplementation(async (callback) => callback(tx));

    await expect(repository.comprarItem("usuario-id", item.id, 2)).rejects.toMatchObject({
      codigoStatus: 422,
      message: "Saldo de moedas insuficiente para comprar este item.",
    });

    expect(tx.transacaoMoeda.create).not.toHaveBeenCalled();
  });
});
