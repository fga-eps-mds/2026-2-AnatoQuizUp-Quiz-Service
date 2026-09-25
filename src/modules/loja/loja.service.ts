import type { RespostaPaginada } from "@/shared/types/api.types";
import {
  montarMetadadosPaginacao,
  resolverParametrosPaginacao,
} from "@/shared/utils/paginacao.util";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";
import { ErroAplicacao } from "@/shared/errors/erro-aplicacao";
import { MENSAGENS } from "@/shared/constants/mensagens";

import type { InventarioBanco, ItemLojaBanco, LojaRepository } from "./loja.repository";
import type { CompraItemDto, InventarioItemDto, ItemLojaDto } from "./dto/loja.dto";
import type { ListarCatalogoQueryDto, ListarInventarioQueryDto } from "./loja.schemas";

// Service da loja: orquestra catalogo, inventario e compra, convertendo os registros
// do banco para os DTOs de resposta. Exige usuario autenticado em todas as operacoes.
export class LojaService {
  constructor(private readonly lojaRepository: LojaRepository) {}

  /**
   * Lista paginada do catalogo, marcando cada item como adquirido ou nao pelo usuario.
   *
   * @param usuarioId Usuario autenticado (necessario para o flag "adquirido").
   * @param query Filtros e paginacao do catalogo.
   * @returns Pagina de itens do catalogo com metadados de paginacao.
   */
  async listarCatalogo(
    usuarioId: string | undefined,
    query: ListarCatalogoQueryDto,
  ): Promise<RespostaPaginada<ItemLojaDto>> {
    this.validarUsuarioAutenticado(usuarioId);

    const paginacao = resolverParametrosPaginacao(query);

    // quantidadesPossuidas mapeia itemLojaId -> unidades que o usuario ja tem.
    const { data, total, quantidadesPossuidas } = await this.lojaRepository.listarCatalogo(
      usuarioId,
      paginacao,
      query,
    );

    return {
      dados: data.map((item) => this.converterItemLoja(item, quantidadesPossuidas.get(item.id))),
      metadados: montarMetadadosPaginacao(paginacao, total),
    };
  }

  /**
   * Lista paginada do inventario (itens que o usuario ja possui).
   *
   * @param usuarioId Usuario autenticado dono do inventario.
   * @param query Paginacao da listagem.
   * @returns Pagina de itens do inventario com metadados de paginacao.
   */
  async listarInventario(
    usuarioId: string | undefined,
    query: ListarInventarioQueryDto,
  ): Promise<RespostaPaginada<InventarioItemDto>> {
    this.validarUsuarioAutenticado(usuarioId);

    const paginacao = resolverParametrosPaginacao(query);

    const { data, total } = await this.lojaRepository.listarInventario(usuarioId, paginacao);

    return {
      dados: data.map((item) => this.converterInventario(item)),
      metadados: montarMetadadosPaginacao(paginacao, total),
    };
  }

  /**
   * Compra um item (a logica atomica de saldo/duplicidade fica no repository).
   *
   * @param usuarioId Usuario autenticado que esta comprando.
   * @param itemLojaId Item desejado.
   * @param quantidade Unidades desejadas (padrao 1; so consumiveis aceitam mais).
   * @returns Mensagem, saldo atualizado, unidades compradas e o item ja no inventario.
   */
  async comprar(
    usuarioId: string | undefined,
    itemLojaId: string,
    quantidade = 1,
  ): Promise<CompraItemDto> {
    this.validarUsuarioAutenticado(usuarioId);

    const compra = await this.lojaRepository.comprarItem(usuarioId, itemLojaId, quantidade);

    return {
      mensagem: "Item comprado com sucesso.",
      saldoMoedas: compra.saldoMoedas,
      quantidadeComprada: quantidade,
      item: this.converterInventario(compra.inventarioItem),
    };
  }

  // Assercao de tipo: garante usuario autenticado (e estreita o tipo para string).
  private validarUsuarioAutenticado(usuarioId: string | undefined): asserts usuarioId is string {
    if (!usuarioId) {
      throw new ErroAplicacao({
        codigoStatus: 401,
        codigo: CodigoDeErro.NAO_AUTORIZADO,
        mensagem: MENSAGENS.usuarioAutenticadoEncontrado,
      });
    }
  }

  // Converte o item do banco no DTO do catalogo. "adquirido" so vale para cosmeticos
  // (consumiveis podem ser comprados de novo); "quantidadePossuida" vale para todos.
  private converterItemLoja(item: ItemLojaBanco, quantidadePossuida = 0): ItemLojaDto {
    return {
      id: item.id,
      codigo: item.codigo,
      nome: item.nome,
      descricao: item.descricao,
      tipo: item.tipo,
      precoMoedas: item.precoMoedas,
      valor: item.valor,
      imagemUrl: item.imagemUrl,
      previewImagemUrl: item.previewImagemUrl,
      ativo: item.ativo,
      disponivelNaLoja: item.disponivelNaLoja,
      consumivel: item.consumivel,
      efeito: item.efeito,
      adquirido: !item.consumivel && quantidadePossuida > 0,
      quantidadePossuida,
    };
  }

  // Converte o item de inventario do banco no DTO de resposta (com o item aninhado).
  private converterInventario(item: InventarioBanco): InventarioItemDto {
    return {
      id: item.id,
      equipado: item.equipado,
      origem: item.origem,
      quantidade: item.quantidade,
      adquiridoEm: item.adquiridoEm,
      item: {
        id: item.itemLoja.id,
        codigo: item.itemLoja.codigo,
        nome: item.itemLoja.nome,
        descricao: item.itemLoja.descricao,
        tipo: item.itemLoja.tipo,
        precoMoedas: item.itemLoja.precoMoedas,
        valor: item.itemLoja.valor,
        imagemUrl: item.itemLoja.imagemUrl,
        previewImagemUrl: item.itemLoja.previewImagemUrl,
        ativo: item.itemLoja.ativo,
        disponivelNaLoja: item.itemLoja.disponivelNaLoja,
        consumivel: item.itemLoja.consumivel,
        efeito: item.itemLoja.efeito,
      },
    };
  }
}
