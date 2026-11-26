import { FonteMoeda, OrigemItemInventario, TipoItemLoja, type PrismaClient } from "@prisma/client";

// Itens do avatar antigo (US39, #199): icones de perfil, avatares ilustrados e a
// "aparencia" antiga (rosto e os dois cabelos que nao sao do avatar-cerebro). O avatar
// passou a ser montado so com cabelo, acessorio, luva e calcado; esses itens saem da
// loja, do inventario e do historico.
export const TIPOS_ITENS_LEGADOS = [
  TipoItemLoja.ICONE_PERFIL,
  TipoItemLoja.AVATAR,
  TipoItemLoja.ROSTO,
] as const;

// Os cabelos novos (US36) tambem sao do tipo CABELO; so estes dois sao legados.
export const CODIGOS_CABELOS_LEGADOS = ["cabelo-padrao", "cabelo-moicano"] as const;

// Item que substitui o avatar exclusivo como recompensa da conquista "Primeiros 5 Acertos".
export const CODIGO_RECOMPENSA_PRIMEIROS_ACERTOS = "oculos-sol";

export type ResumoRemocaoItensLegados = {
  itensRemovidos: number;
  inventariosRemovidos: number;
  usuariosReembolsados: number;
  moedasReembolsadas: number;
  recompensasSubstituidas: number;
};

const RESUMO_VAZIO: ResumoRemocaoItensLegados = {
  itensRemovidos: 0,
  inventariosRemovidos: 0,
  usuariosReembolsados: 0,
  moedasReembolsadas: 0,
  recompensasSubstituidas: 0,
};

/**
 * Remove os itens legados do catalogo, do inventario e do historico, numa unica
 * transacao e de forma idempotente (rodar de novo nao reembolsa nem remove duas vezes):
 *
 * 1. Quem ainda possui um item legado comprado recebe de volta o ATP gasto nele,
 *    registrado como transacao REEMBOLSO_ITEM.
 * 2. Quem ganhou o avatar exclusivo pela conquista recebe o item que agora e a
 *    recompensa dela (oculos de sol), se ainda nao o tiver.
 * 3. Os registros de inventario dos itens legados sao desequipados e marcados como
 *    excluidos; o avatar de quem os usava volta ao padrao.
 * 4. Os itens legados saem da loja (inativos e excluidos). As compras deles somem do
 *    historico, que so lista itens nao excluidos.
 *
 * Usa exclusao logica: transacoes antigas continuam apontando para os itens.
 */
export async function removerItensLegados(prisma: PrismaClient): Promise<ResumoRemocaoItensLegados> {
  return prisma.$transaction(async (tx) => {
    const legados = await tx.itemLoja.findMany({
      where: {
        OR: [
          { tipo: { in: [...TIPOS_ITENS_LEGADOS] } },
          { tipo: TipoItemLoja.CABELO, codigo: { in: [...CODIGOS_CABELOS_LEGADOS] } },
        ],
      },
      select: { id: true, excluidoEm: true },
    });
    if (legados.length === 0) return RESUMO_VAZIO;

    const idsLegados = legados.map((item) => item.id);
    const agora = new Date();

    const inventarios = await tx.inventarioItem.findMany({
      where: { itemLojaId: { in: idsLegados }, excluidoEm: null },
      select: {
        id: true,
        usuarioId: true,
        itemLojaId: true,
        origem: true,
        desbloqueioConquistaId: true,
      },
    });

    // 1. Reembolso: soma o que cada usuario gastou em cada item legado que ainda possui.
    const possuidos = new Set(inventarios.map((inv) => `${inv.usuarioId}|${inv.itemLojaId}`));
    const gastos = await tx.transacaoMoeda.groupBy({
      by: ["usuarioId", "itemLojaId"],
      where: { fonte: FonteMoeda.COMPRA_ITEM, itemLojaId: { in: idsLegados } },
      _sum: { quantidade: true },
    });

    const reembolsoPorUsuario = new Map<string, number>();
    for (const gasto of gastos) {
      if (!gasto.itemLojaId || !possuidos.has(`${gasto.usuarioId}|${gasto.itemLojaId}`)) continue;
      // Compras sao registradas com valor negativo.
      const valor = -(gasto._sum.quantidade ?? 0);
      if (valor <= 0) continue;

      await tx.transacaoMoeda.create({
        data: {
          usuarioId: gasto.usuarioId,
          itemLojaId: gasto.itemLojaId,
          quantidade: valor,
          fonte: FonteMoeda.REEMBOLSO_ITEM,
          descricao: "Reembolso de item removido da loja.",
        },
      });
      reembolsoPorUsuario.set(gasto.usuarioId, (reembolsoPorUsuario.get(gasto.usuarioId) ?? 0) + valor);
    }

    for (const [usuarioId, valor] of reembolsoPorUsuario) {
      await tx.carteiraMoedas.update({
        where: { usuarioId },
        data: { saldo: { increment: valor } },
      });
    }

    // 2. Quem ganhou um item legado por conquista recebe a recompensa atual da conquista.
    const recompensaAtual = await tx.itemLoja.findUnique({
      where: { codigo: CODIGO_RECOMPENSA_PRIMEIROS_ACERTOS },
      select: { id: true },
    });
    let recompensasSubstituidas = 0;
    if (recompensaAtual) {
      for (const inv of inventarios) {
        if (inv.origem !== OrigemItemInventario.CONQUISTA) continue;
        const criado = await tx.inventarioItem.createMany({
          data: {
            usuarioId: inv.usuarioId,
            itemLojaId: recompensaAtual.id,
            desbloqueioConquistaId: inv.desbloqueioConquistaId,
            origem: OrigemItemInventario.CONQUISTA,
          },
          skipDuplicates: true,
        });
        recompensasSubstituidas += criado.count;
      }
    }

    // 3. Inventario: desequipa e exclui os itens legados.
    if (inventarios.length > 0) {
      await tx.inventarioItem.updateMany({
        where: { id: { in: inventarios.map((inv) => inv.id) } },
        data: { equipado: false, excluidoEm: agora },
      });
    }

    // 4. Catalogo: tira os itens legados da loja.
    const itensAtivos = legados.filter((item) => item.excluidoEm === null).map((item) => item.id);
    if (itensAtivos.length > 0) {
      await tx.itemLoja.updateMany({
        where: { id: { in: itensAtivos } },
        data: { ativo: false, disponivelNaLoja: false, excluidoEm: agora },
      });
    }

    return {
      itensRemovidos: itensAtivos.length,
      inventariosRemovidos: inventarios.length,
      usuariosReembolsados: reembolsoPorUsuario.size,
      moedasReembolsadas: [...reembolsoPorUsuario.values()].reduce((total, valor) => total + valor, 0),
      recompensasSubstituidas,
    };
  });
}
