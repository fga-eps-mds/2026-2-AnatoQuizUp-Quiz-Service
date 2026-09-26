import { InventarioService } from "../../../src/modules/inventario/inventario.service";
import { InventarioRepository } from "../../../src/modules/inventario/inventario.repository";
import { ErroAplicacao } from "../../../src/shared/errors/erro-aplicacao";
import type { ItemLoja } from "@prisma/client";
import { TipoItemLoja } from "@prisma/client";

jest.mock("../../../src/modules/inventario/inventario.repository");

describe("InventarioService", () => {
  let service: InventarioService;
  let repositoryMock: jest.Mocked<InventarioRepository>;

  beforeEach(() => {
    repositoryMock = new InventarioRepository() as jest.Mocked<InventarioRepository>;
    service = new InventarioService(repositoryMock);
  });

  describe("equiparItem", () => {
    it("deve lançar ErroAplicacao 404 se o item não for encontrado no inventário", async () => {
      repositoryMock.buscarItemNoInventario.mockResolvedValue(null);

      await expect(service.equiparItem("user-1", "item-nao-existe")).rejects.toThrow(ErroAplicacao);
      await expect(service.equiparItem("user-1", "item-nao-existe")).rejects.toMatchObject({
        codigoStatus: 404,
      });
    });

    it("deve lançar ErroAplicacao 400 se o item já estiver equipado", async () => {
      repositoryMock.buscarItemNoInventario.mockResolvedValue({
        id: "inv-1",
        usuarioId: "user-1",
        itemLojaId: "item-1",
        equipado: true,
        adquiridoEm: new Date(),
        criadoEm: new Date(),
        atualizadoEm: new Date(),
        excluidoEm: null,
        itemLoja: {} as ItemLoja,
      });

      await expect(service.equiparItem("user-1", "item-1")).rejects.toThrow(ErroAplicacao);
      await expect(service.equiparItem("user-1", "item-1")).rejects.toMatchObject({
        codigoStatus: 400,
      });
    });

    it("deve recusar equipar item consumível sem alterar o inventário", async () => {
      repositoryMock.buscarItemNoInventario.mockResolvedValue({
        id: "inv-dica",
        usuarioId: "user-1",
        itemLojaId: "dica-1",
        equipado: false,
        adquiridoEm: new Date(),
        criadoEm: new Date(),
        atualizadoEm: new Date(),
        excluidoEm: null,
        itemLoja: { nome: "Vacina da Dica", tipo: TipoItemLoja.DICA, consumivel: true } as ItemLoja,
      } as never);

      await expect(service.equiparItem("user-1", "dica-1")).rejects.toMatchObject({
        codigoStatus: 400,
        message: "Itens consumíveis não podem ser equipados.",
      });
      expect(repositoryMock.equiparItemTransacao).not.toHaveBeenCalled();
    });

    it("deve equipar o item com sucesso se as validações passarem", async () => {
      const mockItemInventario = {
        id: "inv-1",
        usuarioId: "user-1",
        itemLojaId: "item-1",
        equipado: false,
        adquiridoEm: new Date(),
        criadoEm: new Date(),
        atualizadoEm: new Date(),
        excluidoEm: null,
        itemLoja: {
          nome: "Coruja",
          tipo: TipoItemLoja.ICONE_PERFIL,
        } as ItemLoja,
      };

      repositoryMock.buscarItemNoInventario.mockResolvedValue(mockItemInventario);
      repositoryMock.equiparItemTransacao.mockResolvedValue([
        { count: 1 }, 
        { ...mockItemInventario, equipado: true }
      ]);

      const resultado = await service.equiparItem("user-1", "item-1");

      expect(repositoryMock.equiparItemTransacao).toHaveBeenCalledWith("user-1", "inv-1", TipoItemLoja.ICONE_PERFIL);
      expect(resultado).toEqual({
        mensagem: "Item equipado com sucesso.",
        dados: {
          itemNome: "Coruja",
          categoria: TipoItemLoja.ICONE_PERFIL,
        },
      });
    });
  });

  describe("desequiparItem", () => {
    const itemEquipado = {
      id: "inv-1",
      usuarioId: "user-1",
      itemLojaId: "item-1",
      equipado: true,
      adquiridoEm: new Date(),
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      excluidoEm: null,
      itemLoja: { nome: "Coruja", tipo: TipoItemLoja.ICONE_PERFIL } as ItemLoja,
    };

    it("deve lançar ErroAplicacao 404 se o item não estiver no inventário", async () => {
      repositoryMock.buscarItemNoInventario.mockResolvedValue(null);

      await expect(service.desequiparItem("user-1", "item-x")).rejects.toThrow(ErroAplicacao);
      await expect(service.desequiparItem("user-1", "item-x")).rejects.toMatchObject({
        codigoStatus: 404,
      });
    });

    it("deve desequipar o item equipado com sucesso", async () => {
      repositoryMock.buscarItemNoInventario.mockResolvedValue(itemEquipado);
      repositoryMock.desequiparItem.mockResolvedValue({ ...itemEquipado, equipado: false });

      const resultado = await service.desequiparItem("user-1", "item-1");

      expect(repositoryMock.desequiparItem).toHaveBeenCalledWith("inv-1");
      expect(resultado).toEqual({
        mensagem: "Item desequipado com sucesso.",
        dados: {
          itemNome: "Coruja",
          categoria: TipoItemLoja.ICONE_PERFIL,
        },
      });
    });

    it("deve ser idempotente: não chama o repositório se o item já estiver desequipado", async () => {
      repositoryMock.buscarItemNoInventario.mockResolvedValue({
        ...itemEquipado,
        equipado: false,
      });

      const resultado = await service.desequiparItem("user-1", "item-1");

      expect(repositoryMock.desequiparItem).not.toHaveBeenCalled();
      expect(resultado.mensagem).toBe("Item desequipado com sucesso.");
    });
  });

  describe("obterPerfilEquipado", () => {
    it("deve retornar apenas os itens da loja que estão equipados", async () => {
      const mockItensLoja = [
        { nome: "Coruja", tipo: TipoItemLoja.ICONE_PERFIL } as ItemLoja,
        { nome: "Bronze", tipo: TipoItemLoja.MOLDURA } as ItemLoja,
      ];

      repositoryMock.listarItensEquipados.mockResolvedValue([
        { 
          id: "inv-1", usuarioId: "user-1", itemLojaId: "item-1", equipado: true, adquiridoEm: new Date(), criadoEm: new Date(), atualizadoEm: new Date(), excluidoEm: null,
          itemLoja: mockItensLoja[0] 
        },
        { 
          id: "inv-2", usuarioId: "user-1", itemLojaId: "item-2", equipado: true, adquiridoEm: new Date(), criadoEm: new Date(), atualizadoEm: new Date(), excluidoEm: null,
          itemLoja: mockItensLoja[1] 
        },
      ]);

      const resultado = await service.obterPerfilEquipado("user-1");

      expect(resultado).toEqual({
        mensagem: "Perfil personalizado recuperado com sucesso.",
        dados: mockItensLoja,
      });
    });
  });
});