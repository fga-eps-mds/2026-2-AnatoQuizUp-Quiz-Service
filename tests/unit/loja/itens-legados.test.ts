import { FonteMoeda, OrigemItemInventario, TipoItemLoja, type PrismaClient } from "@prisma/client";

import {
  CODIGO_RECOMPENSA_PRIMEIROS_ACERTOS,
  CODIGOS_CABELOS_LEGADOS,
  removerItensLegados,
} from "@/modules/loja/itens-legados";

type Inventario = {
  id: string;
  usuarioId: string;
  itemLojaId: string;
  origem: OrigemItemInventario;
  desbloqueioConquistaId: string | null;
};

function criarTx({
  legados = [] as { id: string; excluidoEm: Date | null }[],
  inventarios = [] as Inventario[],
  gastos = [] as { usuarioId: string; itemLojaId: string | null; _sum: { quantidade: number | null } }[],
  recompensa = { id: "oculos-id" } as { id: string } | null,
  criadosPorConquista = 1,
} = {}) {
  const tx = {
    itemLoja: {
      findMany: jest.fn().mockResolvedValue(legados),
      findUnique: jest.fn().mockResolvedValue(recompensa),
      updateMany: jest.fn().mockResolvedValue({ count: legados.length }),
    },
    inventarioItem: {
      findMany: jest.fn().mockResolvedValue(inventarios),
      createMany: jest.fn().mockResolvedValue({ count: criadosPorConquista }),
      updateMany: jest.fn().mockResolvedValue({ count: inventarios.length }),
    },
    transacaoMoeda: {
      groupBy: jest.fn().mockResolvedValue(gastos),
      create: jest.fn().mockResolvedValue({}),
    },
    carteiraMoedas: {
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  } as unknown as PrismaClient;
  return { tx, prisma };
}

const inventario = (over: Partial<Inventario>): Inventario => ({
  id: "inv-1",
  usuarioId: "aluno-1",
  itemLojaId: "icone-1",
  origem: OrigemItemInventario.COMPRA,
  desbloqueioConquistaId: null,
  ...over,
});

describe("removerItensLegados", () => {
  test("busca icones, avatares, rostos e so os cabelos antigos", async () => {
    const { tx, prisma } = criarTx();

    await removerItensLegados(prisma);

    expect(tx.itemLoja.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { tipo: { in: [TipoItemLoja.ICONE_PERFIL, TipoItemLoja.AVATAR, TipoItemLoja.ROSTO] } },
          { tipo: TipoItemLoja.CABELO, codigo: { in: [...CODIGOS_CABELOS_LEGADOS] } },
        ],
      },
      select: { id: true, excluidoEm: true },
    });
  });

  test("sem itens legados, nao mexe em nada", async () => {
    const { tx, prisma } = criarTx();

    const resumo = await removerItensLegados(prisma);

    expect(resumo).toEqual({
      itensRemovidos: 0,
      inventariosRemovidos: 0,
      usuariosReembolsados: 0,
      moedasReembolsadas: 0,
      recompensasSubstituidas: 0,
    });
    expect(tx.inventarioItem.findMany).not.toHaveBeenCalled();
    expect(tx.carteiraMoedas.update).not.toHaveBeenCalled();
    expect(tx.itemLoja.updateMany).not.toHaveBeenCalled();
  });

  test("reembolsa o ATP gasto em cada item legado que o aluno ainda possui", async () => {
    const { tx, prisma } = criarTx({
      legados: [
        { id: "icone-1", excluidoEm: null },
        { id: "avatar-1", excluidoEm: null },
      ],
      inventarios: [
        inventario({ id: "inv-1", usuarioId: "aluno-1", itemLojaId: "icone-1" }),
        inventario({ id: "inv-2", usuarioId: "aluno-1", itemLojaId: "avatar-1" }),
        inventario({ id: "inv-3", usuarioId: "aluno-2", itemLojaId: "icone-1" }),
      ],
      gastos: [
        { usuarioId: "aluno-1", itemLojaId: "icone-1", _sum: { quantidade: -60 } },
        { usuarioId: "aluno-1", itemLojaId: "avatar-1", _sum: { quantidade: -100 } },
        { usuarioId: "aluno-2", itemLojaId: "icone-1", _sum: { quantidade: -60 } },
      ],
    });

    const resumo = await removerItensLegados(prisma);

    expect(tx.transacaoMoeda.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fonte: FonteMoeda.COMPRA_ITEM, itemLojaId: { in: ["icone-1", "avatar-1"] } },
      }),
    );
    expect(tx.transacaoMoeda.create).toHaveBeenCalledTimes(3);
    expect(tx.transacaoMoeda.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: "aluno-1",
        itemLojaId: "avatar-1",
        quantidade: 100,
        fonte: FonteMoeda.REEMBOLSO_ITEM,
      }),
    });
    expect(tx.carteiraMoedas.update).toHaveBeenCalledWith({
      where: { usuarioId: "aluno-1" },
      data: { saldo: { increment: 160 } },
    });
    expect(tx.carteiraMoedas.update).toHaveBeenCalledWith({
      where: { usuarioId: "aluno-2" },
      data: { saldo: { increment: 60 } },
    });
    expect(resumo).toEqual(
      expect.objectContaining({ usuariosReembolsados: 2, moedasReembolsadas: 220 }),
    );
  });

  test("nao reembolsa quem nao possui mais o item nem item gratuito", async () => {
    const { tx, prisma } = criarTx({
      legados: [
        { id: "icone-1", excluidoEm: null },
        { id: "rosto-padrao", excluidoEm: null },
      ],
      inventarios: [inventario({ usuarioId: "aluno-1", itemLojaId: "rosto-padrao" })],
      gastos: [
        // aluno-2 comprou, mas o registro de inventario ja nao existe: sem reembolso.
        { usuarioId: "aluno-2", itemLojaId: "icone-1", _sum: { quantidade: -60 } },
        // item gratuito: nada a devolver.
        { usuarioId: "aluno-1", itemLojaId: "rosto-padrao", _sum: { quantidade: 0 } },
      ],
    });

    const resumo = await removerItensLegados(prisma);

    expect(tx.transacaoMoeda.create).not.toHaveBeenCalled();
    expect(tx.carteiraMoedas.update).not.toHaveBeenCalled();
    expect(resumo.moedasReembolsadas).toBe(0);
  });

  test("da o oculos de sol a quem tinha o item legado por conquista", async () => {
    const { tx, prisma } = criarTx({
      legados: [{ id: "avatar-explorador", excluidoEm: null }],
      inventarios: [
        inventario({
          id: "inv-conquista",
          usuarioId: "aluno-1",
          itemLojaId: "avatar-explorador",
          origem: OrigemItemInventario.CONQUISTA,
          desbloqueioConquistaId: "desbloqueio-1",
        }),
      ],
    });

    const resumo = await removerItensLegados(prisma);

    expect(tx.itemLoja.findUnique).toHaveBeenCalledWith({
      where: { codigo: CODIGO_RECOMPENSA_PRIMEIROS_ACERTOS },
      select: { id: true },
    });
    expect(tx.inventarioItem.createMany).toHaveBeenCalledWith({
      data: {
        usuarioId: "aluno-1",
        itemLojaId: "oculos-id",
        desbloqueioConquistaId: "desbloqueio-1",
        origem: OrigemItemInventario.CONQUISTA,
      },
      skipDuplicates: true,
    });
    expect(resumo.recompensasSubstituidas).toBe(1);
  });

  test("nao duplica o oculos de sol de quem ja o tinha", async () => {
    const { prisma } = criarTx({
      legados: [{ id: "avatar-explorador", excluidoEm: null }],
      inventarios: [inventario({ itemLojaId: "avatar-explorador", origem: OrigemItemInventario.CONQUISTA })],
      criadosPorConquista: 0,
    });

    const resumo = await removerItensLegados(prisma);

    expect(resumo.recompensasSubstituidas).toBe(0);
  });

  test("desequipa e exclui o inventario e tira os itens da loja", async () => {
    const { tx, prisma } = criarTx({
      legados: [
        { id: "icone-1", excluidoEm: null },
        { id: "avatar-1", excluidoEm: new Date("2026-11-01") },
      ],
      inventarios: [inventario({ id: "inv-1", itemLojaId: "icone-1" })],
    });

    const resumo = await removerItensLegados(prisma);

    expect(tx.inventarioItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["inv-1"] } },
      data: { equipado: false, excluidoEm: expect.any(Date) },
    });
    // So o item ainda ativo e atualizado; o ja excluido fica como esta.
    expect(tx.itemLoja.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["icone-1"] } },
      data: { ativo: false, disponivelNaLoja: false, excluidoEm: expect.any(Date) },
    });
    expect(resumo).toEqual(expect.objectContaining({ itensRemovidos: 1, inventariosRemovidos: 1 }));
  });

  test("rodar de novo depois da remocao nao reembolsa nem remove outra vez", async () => {
    const { tx, prisma } = criarTx({
      legados: [{ id: "icone-1", excluidoEm: new Date("2026-11-27") }],
      inventarios: [],
      gastos: [{ usuarioId: "aluno-1", itemLojaId: "icone-1", _sum: { quantidade: -60 } }],
    });

    const resumo = await removerItensLegados(prisma);

    expect(tx.transacaoMoeda.create).not.toHaveBeenCalled();
    expect(tx.carteiraMoedas.update).not.toHaveBeenCalled();
    expect(tx.inventarioItem.updateMany).not.toHaveBeenCalled();
    expect(tx.itemLoja.updateMany).not.toHaveBeenCalled();
    expect(resumo).toEqual(expect.objectContaining({ itensRemovidos: 0, inventariosRemovidos: 0 }));
  });
});
