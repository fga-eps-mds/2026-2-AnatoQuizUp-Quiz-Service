import { prisma } from "@/config/db";
import { UsoItemRepository } from "@/modules/loja/uso-item.repository";

jest.mock("@/config/db", () => ({
  prisma: {
    $transaction: jest.fn(),
    usoItem: {
      findMany: jest.fn(),
      count: jest.fn(),
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
