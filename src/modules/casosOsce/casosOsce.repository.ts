import { prisma } from "@/config/db";
import type { ParametrosPaginacao } from "@/shared/utils/paginacao.util";

import type { RegistroCasoOsceCompleto, SalvarCasoOsceDto, ConfiguracaoAvaliacaoDto, ItemChecklistDto } from "./dto/casoOsce.types";

const includeCompleto = {
  exames: true,
  itensChecklist: { orderBy: { ordem: "asc" } },
  configuracaoAvaliacao: true,
} as const;

export class CasoOsceRepository {
  /**
   * Lista paginada dos casos nao excluidos (banco compartilhado entre professores,
   * mesmo padrao do banco de questoes), mais recentes primeiro.
   *
   * @param paginacao Parametros de paginacao (skip/take).
   * @returns Pagina de casos completos e o total.
   */
  async listar(paginacao: ParametrosPaginacao) {
    const where = { excluidoEm: null };

    const [data, total] = await prisma.$transaction([
      prisma.casoOsce.findMany({
        where,
        include: includeCompleto,
        skip: paginacao.skip,
        take: paginacao.limit,
        orderBy: { criadoEm: "desc" },
      }),
      prisma.casoOsce.count({ where }),
    ]);

    return { data: data as RegistroCasoOsceCompleto[], total };
  }

  /**
   * Busca um caso nao excluido por id, com os exames.
   *
   * @param id Id do caso.
   * @returns O caso completo ou null.
   */
  async buscarPorId(id: string) {
    return prisma.casoOsce.findFirst({
      where: { id, excluidoEm: null },
      include: includeCompleto,
    }) as Promise<RegistroCasoOsceCompleto | null>;
  }

  /**
   * Cria um caso (rascunho), com os exames informados.
   *
   * @param data Campos iniciais (todos opcionais).
   * @param criadoPorId Professor autor.
   * @returns O caso criado.
   */
  async criar(data: SalvarCasoOsceDto, criadoPorId: string) {
    const { exames, ...campos } = data;

    return prisma.casoOsce.create({
      data: {
        ...campos,
        criadoPorId,
        exames: exames ? { create: exames } : undefined,
      },
      include: includeCompleto,
    }) as Promise<RegistroCasoOsceCompleto>;
  }

  /**
   * Atualiza um caso (merge parcial). Quando `exames` e enviado, substitui a lista
   * inteira (mais simples que diffar item a item, e e assim que o editor reenvia).
   *
   * @param id Caso a atualizar.
   * @param data Campos a alterar (parciais).
   * @returns O caso atualizado.
   */
  async atualizar(id: string, data: SalvarCasoOsceDto) {
    const { exames, ...campos } = data;

    return prisma.casoOsce.update({
      where: { id },
      data: {
        ...campos,
        exames: exames
          ? {
              deleteMany: {},
              create: exames,
            }
          : undefined,
      },
      include: includeCompleto,
    }) as Promise<RegistroCasoOsceCompleto>;
  }

  /**
   * Soft delete do caso: marca excluidoEm. Nao apaga tentativas associadas (US27/US46).
   *
   * @param id Id do caso.
   */
  async excluir(id: string): Promise<void> {
    await prisma.casoOsce.update({
      where: { id },
      data: { excluidoEm: new Date() },
    });
  }

  // Substitui o checklist inteiro; a posicao na lista vira a ordem.
  async salvarChecklist(id: string, itens: ItemChecklistDto[]) {
    return prisma.casoOsce.update({
      where: { id },
      data: {
        itensChecklist: {
          deleteMany: {},
          create: itens.map((item, ordem) => ({ ...item, ordem })),
        },
      },
      include: includeCompleto,
    }) as Promise<RegistroCasoOsceCompleto>;
  }

  // Cria ou atualiza as regras de nota do caso.
  async salvarConfiguracao(id: string, configuracao: ConfiguracaoAvaliacaoDto) {
    return prisma.casoOsce.update({
      where: { id },
      data: {
        configuracaoAvaliacao: {
          upsert: { create: configuracao, update: configuracao },
        },
      },
      include: includeCompleto,
    }) as Promise<RegistroCasoOsceCompleto>;
  }
}
