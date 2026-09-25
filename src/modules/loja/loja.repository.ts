import { FonteMoeda, OrigemItemInventario, type Prisma } from "@prisma/client";

import { prisma } from "@/config/db";
import type { ParametrosPaginacao } from "@/shared/utils/paginacao.util";
import type { ListarCatalogoQueryDto } from "./loja.schemas";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";
import { ErroAplicacao } from "@/shared/errors/erro-aplicacao";

type ItemLojaBanco = Prisma.ItemLojaGetPayload<object>;

type InventarioBanco = Prisma.InventarioItemGetPayload<{
  include: {
    itemLoja: true;
  };
}>;

// Repository da loja de cosmeticos (Prisma): catalogo, inventario e compra de itens.
export class LojaRepository {
  /**
   * Lista o catalogo de itens a venda, marcando quais o usuario ja possui.
   *
   * @param usuarioId Usuario (para cruzar com o inventario).
   * @param paginacao Skip/take.
   * @param filtros Filtro opcional por tipo de item.
   * @returns Pagina de itens, total e as quantidades que o usuario ja possui de cada item.
   */
  async listarCatalogo(
    usuarioId: string,
    paginacao: ParametrosPaginacao,
    filtros: ListarCatalogoQueryDto,
  ) {
    // So itens ativos, disponiveis na loja e nao excluidos (filtro opcional por tipo).
    const where: Prisma.ItemLojaWhereInput = {
      ativo: true,
      disponivelNaLoja: true,
      excluidoEm: null,
      ...(filtros.tipo && { tipo: filtros.tipo }),
    };

    const [itens, total] = await prisma.$transaction([
      prisma.itemLoja.findMany({
        where,
        skip: paginacao.skip,
        take: paginacao.limit,
        orderBy: [{ tipo: "asc" }, { precoMoedas: "asc" }, { nome: "asc" }],
      }),
      prisma.itemLoja.count({ where }),
    ]);

    const inventario = await prisma.inventarioItem.findMany({
      where: {
        usuarioId,
        itemLojaId: {
          in: itens.map((item) => item.id),
        },
      },
      select: {
        itemLojaId: true,
        quantidade: true,
      },
    });

    // Mapa itemLojaId -> unidades possuidas, para o service marcar "adquirido" e
    // informar quantas unidades de cada consumivel o usuario ja tem.
    const quantidadesPossuidas = new Map(
      inventario.map((item) => [item.itemLojaId, item.quantidade]),
    );

    return {
      data: itens,
      total,
      quantidadesPossuidas,
    };
  }

  // Lista paginada do inventario do usuario (itens nao excluidos), recentes primeiro.
  async listarInventario(usuarioId: string, paginacao: ParametrosPaginacao) {
    const where: Prisma.InventarioItemWhereInput = {
      usuarioId,
      excluidoEm: null,
      itemLoja: {
        excluidoEm: null,
      },
    };

    const [data, total] = await prisma.$transaction([
      prisma.inventarioItem.findMany({
        where,
        include: {
          itemLoja: true,
        },
        skip: paginacao.skip,
        take: paginacao.limit,
        orderBy: {
          adquiridoEm: "desc",
        },
      }),
      prisma.inventarioItem.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Compra um item da loja de forma atomica e segura contra concorrencia.
   *
   * Valida o item (existe, ativo, compravel) e a quantidade, debita o preco total
   * so se o saldo for suficiente (updateMany condicional) e registra a transacao.
   * - Cosmetico: uma unica unidade; comprar de novo gera conflito (409).
   * - Consumivel: pode ser comprado varias vezes; a quantidade e somada no inventario.
   * Qualquer falha aborta toda a compra, sem alterar saldo nem inventario.
   *
   * @param usuarioId Comprador.
   * @param itemLojaId Item desejado.
   * @param quantidade Unidades desejadas (so consumiveis aceitam mais de 1).
   * @returns Saldo atualizado e o registro do item no inventario.
   * @throws ErroAplicacao 404/422/409 conforme item invalido, saldo ou duplicidade.
   */
  async comprarItem(usuarioId: string, itemLojaId: string, quantidade = 1) {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.itemLoja.findUnique({
        where: { id: itemLojaId },
      });

      // Item precisa existir e nao estar excluido.
      if (!item || item.excluidoEm !== null) {
        throw new ErroAplicacao({
          codigoStatus: 404,
          codigo: CodigoDeErro.NAO_ENCONTRADO,
          mensagem: "Item nao encontrado.",
        });
      }

      if (!item.ativo) {
        throw new ErroAplicacao({
          codigoStatus: 422,
          codigo: CodigoDeErro.REQUISICAO_INVALIDA,
          mensagem: "Este item nao esta disponivel para compra.",
        });
      }

      if (!item.disponivelNaLoja) {
        throw new ErroAplicacao({
          codigoStatus: 422,
          codigo: CodigoDeErro.REQUISICAO_INVALIDA,
          mensagem: "Este item e exclusivo de conquista e nao pode ser comprado.",
        });
      }

      // Cosmeticos sao unicos: nao faz sentido comprar mais de uma unidade.
      if (!item.consumivel && quantidade !== 1) {
        throw new ErroAplicacao({
          codigoStatus: 422,
          codigo: CodigoDeErro.REQUISICAO_INVALIDA,
          mensagem: "Este item so pode ser comprado uma unidade por vez.",
        });
      }

      if (item.consumivel) {
        // Consumivel: cria o registro ou soma as unidades ao que o aluno ja tem.
        await tx.inventarioItem.upsert({
          where: {
            usuarioId_itemLojaId: {
              usuarioId,
              itemLojaId,
            },
          },
          create: {
            usuarioId,
            itemLojaId,
            origem: OrigemItemInventario.COMPRA,
            quantidade,
          },
          update: {
            quantidade: {
              increment: quantidade,
            },
          },
        });
      } else {
        // Cosmetico: adiciona ao inventario; skipDuplicates impede comprar duas vezes.
        const inventarioCriado = await tx.inventarioItem.createMany({
          data: [
            {
              usuarioId,
              itemLojaId,
              origem: OrigemItemInventario.COMPRA,
            },
          ],
          skipDuplicates: true,
        });

        // Nada criado = ja possui o item: conflito.
        if (inventarioCriado.count === 0) {
          throw new ErroAplicacao({
            codigoStatus: 409,
            codigo: CodigoDeErro.CONFLITO,
            mensagem: "Este item ja foi adquirido pelo aluno.",
          });
        }
      }

      // Garante a carteira antes de tentar debitar.
      await tx.carteiraMoedas.upsert({
        where: { usuarioId },
        create: {
          usuarioId,
          saldo: 0,
        },
        update: {},
      });

      const precoTotal = item.precoMoedas * quantidade;

      // Debita o preco total somente se o saldo for suficiente (condicao no proprio
      // where), o que evita corrida de saldo negativo sem precisar de lock explicito.
      const carteiraAtualizada = await tx.carteiraMoedas.updateMany({
        where: {
          usuarioId,
          saldo: {
            gte: precoTotal,
          },
        },
        data: {
          saldo: {
            decrement: precoTotal,
          },
        },
      });

      // Nenhuma linha atualizada = saldo insuficiente. O erro desfaz a transacao,
      // entao o inventario tambem volta ao estado anterior.
      if (carteiraAtualizada.count === 0) {
        throw new ErroAplicacao({
          codigoStatus: 422,
          codigo: CodigoDeErro.REQUISICAO_INVALIDA,
          mensagem: "Saldo de moedas insuficiente para comprar este item.",
        });
      }

      // Registra a compra (valor negativo, pois e um gasto) para consulta no historico.
      await tx.transacaoMoeda.create({
        data: {
          usuarioId,
          itemLojaId,
          quantidade: -precoTotal,
          quantidadeItem: quantidade,
          fonte: FonteMoeda.COMPRA_ITEM,
          descricao:
            quantidade > 1
              ? `Compra do item: ${item.nome} (x${quantidade})`
              : `Compra do item: ${item.nome}`,
        },
      });

      const carteira = await tx.carteiraMoedas.findUnique({
        where: { usuarioId },
        select: { saldo: true },
      });

      const inventarioItem = await tx.inventarioItem.findUniqueOrThrow({
        where: {
          usuarioId_itemLojaId: {
            usuarioId,
            itemLojaId,
          },
        },
        include: {
          itemLoja: true,
        },
      });

      return {
        saldoMoedas: carteira?.saldo ?? 0,
        inventarioItem,
      };
    });
  }
}

export type { ItemLojaBanco, InventarioBanco };
