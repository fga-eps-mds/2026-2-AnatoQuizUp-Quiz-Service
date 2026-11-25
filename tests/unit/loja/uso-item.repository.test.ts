import { Prisma } from "@prisma/client";

import { prisma } from "@/config/db";
import { UsoItemRepository } from "@/modules/loja/uso-item.repository";
import { ErroAplicacao } from "@/shared/errors/erro-aplicacao";

jest.mock("@/config/db", () => ({
  prisma: {
    $transaction: jest.fn(),
    usoItem: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    inventarioItem: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    carteiraMoedas: {
      update: jest.fn(),
    },
    transacaoMoeda: {
      create: jest.fn(),
    },
  },
}));

describe("UsoItemRepository.listarHistorico", () => {
  const registros = [
    { id: "uso-a", usuarioId: "usuario-A" },
    { id: "uso-b", usuarioId: "usuario-B" },
  ];
  const transacao = prisma.$transaction as jest.Mock;
  const findMany = prisma.usoItem.findMany as jest.Mock;
  const count = prisma.usoItem.count as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    transacao.mockImplementation((operacoes: Promise<unknown>[]) => Promise.all(operacoes));
    findMany.mockImplementation(({ where }: { where: { usuarioId: string } }) =>
      Promise.resolve(registros.filter((registro) => registro.usuarioId === where.usuarioId)),
    );
    count.mockImplementation(({ where }: { where: { usuarioId: string } }) =>
      Promise.resolve(registros.filter((registro) => registro.usuarioId === where.usuarioId).length),
    );
  });

  it("retorna registros próprios e aplica o mesmo filtro no total para cada usuário", async () => {
    const repository = new UsoItemRepository();
    const paginacao = { skip: 0, limit: 10 };

    const historicoA = await repository.listarHistorico("usuario-A", paginacao);
    const historicoB = await repository.listarHistorico("usuario-B", paginacao);

    expect(historicoA.data).toEqual([registros[0]]);
    expect(historicoA.total).toBe(1);
    expect(historicoB.data).toEqual([registros[1]]);
    expect(historicoB.total).toBe(1);
    expect(findMany.mock.calls.map(([args]) => args.where)).toEqual([
      { usuarioId: "usuario-A" },
      { usuarioId: "usuario-B" },
    ]);
    expect(count.mock.calls.map(([args]) => args.where)).toEqual([
      { usuarioId: "usuario-A" },
      { usuarioId: "usuario-B" },
    ]);
  });

  it("busca todos os usos do proprio usuario para a cronologia unificada", async () => {
    const repository = new UsoItemRepository();
    await expect(repository.listarHistoricoCompleto("usuario-A")).resolves.toEqual([registros[0]]);
    expect(findMany).toHaveBeenLastCalledWith({
      where: { usuarioId: "usuario-A" },
      include: { itemLoja: true },
      orderBy: { ativadoEm: "desc" },
    });
  });
});

describe("UsoItemRepository.ativarPotencializador", () => {
  const transacao = prisma.$transaction as jest.Mock;
  // Transacao fake: o callback recebe o proprio client mockado.
  const tx = {
    inventarioItem: prisma.inventarioItem,
    usoItem: prisma.usoItem,
  };

  const itemConsumivel = {
    id: "inventario-1",
    quantidade: 2,
    itemLoja: { tipoEfeito: "DOBRAR_MOEDAS_PROXIMO_ACERTO", consumivel: true },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    transacao.mockImplementation(async (arg) => arg(tx));
  });

  it("lanca 404 quando o item nao esta no inventario ou sem unidades", async () => {
    (prisma.inventarioItem.findFirst as jest.Mock).mockResolvedValue(null);
    const repository = new UsoItemRepository();

    await expect(
      repository.ativarPotencializador("usuario-1", "item-1"),
    ).rejects.toMatchObject({ codigoStatus: 404 });
  });

  it("lanca 422 quando o item nao e um potencializador de cafe do foco", async () => {
    (prisma.inventarioItem.findFirst as jest.Mock).mockResolvedValue({
      ...itemConsumivel,
      itemLoja: { tipoEfeito: "OUTRO_EFEITO", consumivel: true },
    });
    const repository = new UsoItemRepository();

    await expect(
      repository.ativarPotencializador("usuario-1", "item-1"),
    ).rejects.toMatchObject({ codigoStatus: 422 });
  });

  it("lanca 409 quando ja existe um cafe do foco ativo", async () => {
    (prisma.inventarioItem.findFirst as jest.Mock).mockResolvedValue(itemConsumivel);
    (prisma.usoItem.findUnique as jest.Mock).mockResolvedValue({ id: "uso-ativo" });
    const repository = new UsoItemRepository();

    await expect(
      repository.ativarPotencializador("usuario-1", "item-1"),
    ).rejects.toMatchObject({ codigoStatus: 409 });
  });

  it("lanca 409 quando a unidade nao pode ser consumida (concorrencia)", async () => {
    (prisma.inventarioItem.findFirst as jest.Mock).mockResolvedValue(itemConsumivel);
    (prisma.usoItem.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.inventarioItem.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    const repository = new UsoItemRepository();

    await expect(
      repository.ativarPotencializador("usuario-1", "item-1"),
    ).rejects.toMatchObject({ codigoStatus: 409 });
  });

  it("ativa o potencializador e devolve a quantidade restante", async () => {
    (prisma.inventarioItem.findFirst as jest.Mock).mockResolvedValue(itemConsumivel);
    (prisma.usoItem.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.inventarioItem.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.usoItem.create as jest.Mock).mockResolvedValue({ id: "uso-1" });
    (prisma.inventarioItem.findUniqueOrThrow as jest.Mock).mockResolvedValue({ quantidade: 1 });
    const repository = new UsoItemRepository();

    const resultado = await repository.ativarPotencializador("usuario-1", "item-1");

    expect(resultado).toEqual({ uso: { id: "uso-1" }, quantidadeRestante: 1 });
  });

  it("converte violacao de unicidade (P2002) em 409", async () => {
    transacao.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicado", {
        code: "P2002",
        clientVersion: "teste",
      }),
    );
    const repository = new UsoItemRepository();

    await expect(
      repository.ativarPotencializador("usuario-1", "item-1"),
    ).rejects.toMatchObject({ codigoStatus: 409 });
  });

  it("propaga erros que nao sao de unicidade nem ErroAplicacao conhecido", async () => {
    const erro = new Error("banco fora do ar");
    transacao.mockRejectedValue(erro);
    const repository = new UsoItemRepository();

    await expect(repository.ativarPotencializador("usuario-1", "item-1")).rejects.toBe(erro);
  });

  it("propaga o ErroAplicacao lancado dentro da transacao", async () => {
    (prisma.inventarioItem.findFirst as jest.Mock).mockResolvedValue(null);
    const repository = new UsoItemRepository();

    await expect(
      repository.ativarPotencializador("usuario-1", "item-1"),
    ).rejects.toBeInstanceOf(ErroAplicacao);
  });
});

describe("UsoItemRepository.aplicarCafeNoAcerto", () => {
  const transacao = prisma.$transaction as jest.Mock;
  const tx = {
    usoItem: prisma.usoItem,
    carteiraMoedas: prisma.carteiraMoedas,
    transacaoMoeda: prisma.transacaoMoeda,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    transacao.mockImplementation(async (arg) => arg(tx));
  });

  it("nao credita nada quando o bonus e zero ou negativo", async () => {
    const repository = new UsoItemRepository();

    await expect(repository.aplicarCafeNoAcerto("usuario-1", "questao-1", 0)).resolves.toEqual({
      bonusMoedas: 0,
      saldoMoedas: null,
      uso: null,
    });
    expect(transacao).not.toHaveBeenCalled();
  });

  it("nao credita nada quando nao ha cafe do foco pendente para consumir", async () => {
    (prisma.usoItem.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    const repository = new UsoItemRepository();

    await expect(repository.aplicarCafeNoAcerto("usuario-1", "questao-1", 10)).resolves.toEqual({
      bonusMoedas: 0,
      saldoMoedas: null,
      uso: null,
    });
    expect(prisma.carteiraMoedas.update).not.toHaveBeenCalled();
  });

  it("credita o bonus dobrado e marca o uso como aplicado", async () => {
    (prisma.usoItem.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.carteiraMoedas.update as jest.Mock).mockResolvedValue({ saldo: 150 });
    (prisma.usoItem.findFirst as jest.Mock).mockResolvedValue({ id: "uso-1", status: "APLICADO" });
    const repository = new UsoItemRepository();

    const resultado = await repository.aplicarCafeNoAcerto("usuario-1", "questao-1", 10);

    expect(resultado).toEqual({ bonusMoedas: 10, saldoMoedas: 150, uso: { id: "uso-1", status: "APLICADO" } });
    expect(prisma.transacaoMoeda.create).toHaveBeenCalledWith({
      data: {
        usuarioId: "usuario-1",
        questaoId: "questao-1",
        quantidade: 10,
        fonte: "USO_POTENCIALIZADOR",
        descricao: "Bonus do potencializador Cafe do Foco.",
      },
    });
  });
});
