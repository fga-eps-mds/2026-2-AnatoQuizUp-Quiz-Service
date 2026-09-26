import type { InventarioRepository } from "./inventario.repository";
import { ErroAplicacao } from "../../shared/errors/erro-aplicacao";

// Service de inventario: equipar/desequipar cosmeticos e consultar o perfil
// personalizado (itens equipados) do usuario ou de varios usuarios.
export class InventarioService {
  constructor(private inventarioRepository: InventarioRepository) {}

  /**
   * Equipa um item do inventario do usuario.
   *
   * Recusa se o item nao esta no inventario (404), e consumivel ou ja esta equipado (400). Ao
   * equipar, o repository desequipa outros do mesmo tipo (so um por categoria).
   *
   * @param usuarioId Dono do inventario.
   * @param itemLojaId Item a equipar.
   * @returns Mensagem + item/categoria equipados.
   * @throws ErroAplicacao 404/400 conforme o caso.
   */
  async equiparItem(usuarioId: string, itemLojaId: string) {
    const itemInventario = await this.inventarioRepository.buscarItemNoInventario(
      usuarioId,
      itemLojaId,
    );

    if (!itemInventario) {
      throw new ErroAplicacao({
        codigo: "NAO_ENCONTRADO",
        codigoStatus: 404,
        mensagem: "Item não encontrado no seu inventário.",
      });
    }

    // Consumiveis (dicas/potencializadores) sao usados no quiz, nao equipados no perfil.
    if (itemInventario.itemLoja.consumivel) {
      throw new ErroAplicacao({
        codigo: "REQUISICAO_INVALIDA",
        codigoStatus: 400,
        mensagem: "Itens consumíveis não podem ser equipados.",
      });
    }

    if (itemInventario.equipado) {
      throw new ErroAplicacao({
        codigo: "REQUISICAO_INVALIDA",
        codigoStatus: 400,
        mensagem: "Este item já está equipado.",
      });
    }

    const tipoItem = itemInventario.itemLoja.tipo;

    // O repository troca de forma atomica: desequipa o atual do tipo e equipa este.
    await this.inventarioRepository.equiparItemTransacao(usuarioId, itemInventario.id, tipoItem);

    return {
      mensagem: "Item equipado com sucesso.",
      dados: {
        itemNome: itemInventario.itemLoja.nome,
        categoria: tipoItem,
      },
    };
  }

  /**
   * Desequipa um item do inventario do usuario (operacao idempotente).
   *
   * @param usuarioId Dono do inventario.
   * @param itemLojaId Item a desequipar.
   * @returns Mensagem + item/categoria.
   * @throws ErroAplicacao 404 se o item nao esta no inventario.
   */
  async desequiparItem(usuarioId: string, itemLojaId: string) {
    const itemInventario = await this.inventarioRepository.buscarItemNoInventario(
      usuarioId,
      itemLojaId,
    );

    if (!itemInventario) {
      throw new ErroAplicacao({
        codigo: "NAO_ENCONTRADO",
        codigoStatus: 404,
        mensagem: "Item não encontrado no seu inventário.",
      });
    }

    const tipoItem = itemInventario.itemLoja.tipo;

    // Idempotente: se já não estiver equipado, apenas confirma (sem erro).
    if (itemInventario.equipado) {
      await this.inventarioRepository.desequiparItem(itemInventario.id);
    }

    return {
      mensagem: "Item desequipado com sucesso.",
      dados: {
        itemNome: itemInventario.itemLoja.nome,
        categoria: tipoItem,
      },
    };
  }

  // Retorna os itens atualmente equipados pelo usuario (seu "perfil personalizado").
  async obterPerfilEquipado(usuarioId: string) {
    const itensEquipados = await this.inventarioRepository.listarItensEquipados(usuarioId);

    const itensFormatados = itensEquipados.map((inv) => inv.itemLoja);

    return {
      mensagem: "Perfil personalizado recuperado com sucesso.",
      dados: itensFormatados,
    };
  }

  // Itens equipados de varios usuarios de uma vez (usado pelo ranking/perfil social).
  async obterPerfisEquipados(usuarioIds: string[]) {
    const itensEquipados = await this.inventarioRepository.listarItensEquipadosUsuarios(usuarioIds);

    // Garante uma entrada (vazia) por usuario pedido, mesmo sem itens equipados.
    const dados = Object.fromEntries(usuarioIds.map((usuarioId) => [usuarioId, [] as unknown[]]));

    for (const item of itensEquipados) {
      dados[item.usuarioId].push(item.itemLoja);
    }

    return {
      mensagem: "Perfis personalizados recuperados com sucesso.",
      dados,
    };
  }

  // Retorna o inventario completo do usuario (equipados e nao equipados), achatado.
  async obterInventarioCompleto(usuarioId: string) {
    const itensInventario = await this.inventarioRepository.listarInventarioCompleto(usuarioId);

    const itensFormatados = itensInventario.map((inv) => ({
      inventarioId: inv.id,
      equipado: inv.equipado,
      origem: inv.origem,
      quantidade: inv.quantidade,
      ...inv.itemLoja,
    }));

    return {
      mensagem: "Inventário recuperado com sucesso.",
      dados: itensFormatados,
    };
  }
}
