import { FonteMoeda, Prisma, StatusUsoItem, TipoEfeitoItem } from "@prisma/client";

import { prisma } from "@/config/db";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";
import { ErroAplicacao } from "@/shared/errors/erro-aplicacao";

const EFEITO_CAFE_DO_FOCO = TipoEfeitoItem.DOBRAR_MOEDAS_PROXIMO_ACERTO;

const chavePendente = (usuarioId: string, efeito: TipoEfeitoItem) => `${usuarioId}:${efeito}`;

/**
 * Persistencia do ciclo de vida de itens utilizaveis. Ela e compartilhada pela
 * loja (ativacao) e pelo quiz (aplicacao), para que o consumo e o bonus nao
 * dependam do estado temporario do navegador.
 */
export class UsoItemRepository {
  async ativarPotencializador(usuarioId: string, itemLojaId: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const inventario = await tx.inventarioItem.findFirst({
          where: {
            usuarioId,
            itemLojaId,
            excluidoEm: null,
            quantidade: { gt: 0 },
            itemLoja: { ativo: true, excluidoEm: null },
          },
          include: { itemLoja: true },
        });

        if (!inventario) {
          throw new ErroAplicacao({
            codigoStatus: 404,
            codigo: CodigoDeErro.NAO_ENCONTRADO,
            mensagem: "Item nao encontrado no inventario ou sem unidades disponiveis.",
          });
        }

        const { itemLoja } = inventario;
        if (!itemLoja.consumivel || itemLoja.tipoEfeito !== EFEITO_CAFE_DO_FOCO) {
          throw new ErroAplicacao({
            codigoStatus: 422,
            codigo: CodigoDeErro.REQUISICAO_INVALIDA,
            mensagem: "Este item nao pode ser utilizado como potencializador.",
          });
        }

        const chaveUsoPendente = chavePendente(usuarioId, itemLoja.tipoEfeito);

        // A chave unica e a garantia de concorrencia: se ja houver um cafe ativo,
        // a criacao falha e o decremento feito nesta transacao e revertido.
        const usoAtivo = await tx.usoItem.findUnique({ where: { chaveUsoPendente } });
        if (usoAtivo) {
          throw new ErroAplicacao({
            codigoStatus: 409,
            codigo: CodigoDeErro.CONFLITO,
            mensagem: "Ja existe um Cafe do Foco ativo. Acerte uma questao antes de usar outro.",
          });
        }

        const unidadeConsumida = await tx.inventarioItem.updateMany({
          where: { id: inventario.id, quantidade: { gt: 0 } },
          data: { quantidade: { decrement: 1 } },
        });

        if (unidadeConsumida.count === 0) {
          throw new ErroAplicacao({
            codigoStatus: 409,
            codigo: CodigoDeErro.CONFLITO,
            mensagem: "O item nao possui mais unidades disponiveis.",
          });
        }

        const uso = await tx.usoItem.create({
          data: {
            usuarioId,
            itemLojaId,
            tipoEfeito: itemLoja.tipoEfeito,
            chaveUsoPendente,
          },
          include: { itemLoja: true },
        });

        const inventarioAtualizado = await tx.inventarioItem.findUniqueOrThrow({
          where: {
            usuarioId_itemLojaId: { usuarioId, itemLojaId },
          },
          select: { quantidade: true },
        });

        return { uso, quantidadeRestante: inventarioAtualizado.quantidade };
      });
    } catch (error) {
      // Duas requisicoes simultaneas podem passar pela leitura inicial. A chave
      // unica impede o segundo consumo; aqui transformamos o P2002 em conflito.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ErroAplicacao({
          codigoStatus: 409,
          codigo: CodigoDeErro.CONFLITO,
          mensagem: "Ja existe um Cafe do Foco ativo. Acerte uma questao antes de usar outro.",
        });
      }
      throw error;
    }
  }

  /**
   * Aplica o cafe ao primeiro acerto que ainda gera ATP. O update condicional
   * consome a ativacao uma unica vez, inclusive diante de duas respostas
   * concorrentes. O credito extra e o registro de uso ficam na mesma transacao.
   */
  async aplicarCafeNoAcerto(usuarioId: string, questaoId: string, bonus: number) {
    if (bonus <= 0) return { bonusMoedas: 0, saldoMoedas: null as number | null, uso: null };

    return prisma.$transaction(async (tx) => {
      const chaveUsoPendente = chavePendente(usuarioId, EFEITO_CAFE_DO_FOCO);
      const usoAtualizado = await tx.usoItem.updateMany({
        where: {
          chaveUsoPendente,
          status: StatusUsoItem.ATIVO,
        },
        data: {
          chaveUsoPendente: null,
          status: StatusUsoItem.APLICADO,
          questaoId,
          aplicadoEm: new Date(),
        },
      });

      if (usoAtualizado.count === 0) {
        return { bonusMoedas: 0, saldoMoedas: null as number | null, uso: null };
      }

      const carteira = await tx.carteiraMoedas.update({
        where: { usuarioId },
        data: { saldo: { increment: bonus } },
        select: { saldo: true },
      });

      await tx.transacaoMoeda.create({
        data: {
          usuarioId,
          questaoId,
          quantidade: bonus,
          fonte: FonteMoeda.USO_POTENCIALIZADOR,
          descricao: "Bonus do potencializador Cafe do Foco.",
        },
      });

      const uso = await tx.usoItem.findFirst({
        where: { usuarioId, questaoId, status: StatusUsoItem.APLICADO },
        include: { itemLoja: true },
        orderBy: { aplicadoEm: "desc" },
      });

      return { bonusMoedas: bonus, saldoMoedas: carteira.saldo, uso };
    });
  }

  async listarHistorico(usuarioId: string, paginacao: { skip: number; limit: number }) {
    const where: Prisma.UsoItemWhereInput = { usuarioId };
    const [data, total] = await prisma.$transaction([
      prisma.usoItem.findMany({
        where,
        include: { itemLoja: true },
        orderBy: { ativadoEm: "desc" },
        skip: paginacao.skip,
        take: paginacao.limit,
      }),
      prisma.usoItem.count({ where }),
    ]);

    return { data, total };
  }
}
