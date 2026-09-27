import { TipoItemLoja } from "@prisma/client";

import { LojaService } from "@/modules/loja/loja.service";
import type {
  InventarioBanco,
  ItemLojaBanco,
  LojaRepository,
} from "@/modules/loja/loja.repository";
import type { UsoItemRepository } from "@/modules/loja/uso-item.repository";
import { ErroAplicacao } from "@/shared/errors/erro-aplicacao";

function criarItemLoja(overrides: Partial<ItemLojaBanco> = {}): ItemLojaBanco {
  const agora = new Date("2026-06-16T00:00:00.000Z");

  return {
    id: "item-loja-id",
    codigo: "icone-coruja-sabia",
    nome: "Coruja Sábia",
    descricao: "Ícone de perfil para os estudiosos de plantão.",
    tipo: TipoItemLoja.ICONE_PERFIL,
    precoMoedas: 1,
    valor: null,
    imagemUrl: null,
    previewImagemUrl: null,
    ativo: true,
    disponivelNaLoja: true,
    consumivel: false,
    efeito: null,
    criadoEm: agora,
    atualizadoEm: agora,
    excluidoEm: null,
    ...overrides,
  };
}

function criarInventario(overrides: Partial<InventarioBanco> = {}): InventarioBanco {
  const agora = new Date("2026-06-16T00:00:00.000Z");
  const itemLoja = criarItemLoja();

  return {
    id: "inventario-id",
    usuarioId: "usuario-id",
    itemLojaId: itemLoja.id,
    desbloqueioConquistaId: null,
    equipado: false,
    origem: "COMPRA",
    quantidade: 1,
    adquiridoEm: agora,
    criadoEm: agora,
    atualizadoEm: agora,
    excluidoEm: null,
    itemLoja,
    ...overrides,
  };
}

function criarRepositoryMock() {
  return {
    listarCatalogo: jest.fn<LojaRepository["listarCatalogo"]>(),
    listarInventario: jest.fn<LojaRepository["listarInventario"]>(),
    comprarItem: jest.fn<LojaRepository["comprarItem"]>(),
  } as unknown as jest.Mocked<LojaRepository>;
}

describe("Testa Loja Service", () => {
  let repository: jest.Mocked<LojaRepository>;
  let service: LojaService;

  beforeEach(() => {
    repository = criarRepositoryMock();
    service = new LojaService(repository);
    jest.clearAllMocks();
  });

  test("deve listar catalogo marcando item adquirido", async () => {
    const item = criarItemLoja();

    repository.listarCatalogo.mockResolvedValue({
      data: [item],
      total: 1,
      quantidadesPossuidas: new Map([[item.id, 1]]),
    });

    const resultado = await service.listarCatalogo("usuario-id", {
      page: 1,
      limit: 10,
    });

    expect(repository.listarCatalogo).toHaveBeenCalledWith(
      "usuario-id",
      expect.objectContaining({
        page: 1,
        limit: 10,
        skip: 0,
      }),
      expect.objectContaining({
        page: 1,
        limit: 10,
      }),
    );

    expect(resultado).toEqual({
      dados: [
        expect.objectContaining({
          id: item.id,
          codigo: item.codigo,
          nome: item.nome,
          adquirido: true,
          quantidadePossuida: 1,
        }),
      ],
      metadados: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
  });

  test("deve listar catalogo marcando item nao adquirido", async () => {
    const item = criarItemLoja();

    repository.listarCatalogo.mockResolvedValue({
      data: [item],
      total: 1,
      quantidadesPossuidas: new Map(),
    });

    const resultado = await service.listarCatalogo("usuario-id", {});

    expect(resultado.dados[0]).toMatchObject({
      id: item.id,
      adquirido: false,
      quantidadePossuida: 0,
    });
  });

  test("deve listar consumivel como nao adquirido mesmo quando o usuario ja possui unidades", async () => {
    const item = criarItemLoja({
      id: "dica-id",
      tipo: TipoItemLoja.DICA,
      consumivel: true,
      efeito: "Revela uma dica para a questão.",
    });

    repository.listarCatalogo.mockResolvedValue({
      data: [item],
      total: 1,
      quantidadesPossuidas: new Map([[item.id, 3]]),
    });

    const resultado = await service.listarCatalogo("usuario-id", {});

    expect(resultado.dados[0]).toMatchObject({
      id: item.id,
      consumivel: true,
      efeito: "Revela uma dica para a questão.",
      adquirido: false,
      quantidadePossuida: 3,
    });
  });

  test("deve listar inventario do usuario", async () => {
    const inventario = criarInventario();

    repository.listarInventario.mockResolvedValue({
      data: [inventario],
      total: 1,
    });

    const resultado = await service.listarInventario("usuario-id", {
      page: 1,
      limit: 10,
    });

    expect(repository.listarInventario).toHaveBeenCalledWith(
      "usuario-id",
      expect.objectContaining({
        page: 1,
        limit: 10,
        skip: 0,
      }),
    );

    expect(resultado.dados).toHaveLength(1);
    expect(resultado.dados[0]).toMatchObject({
      id: inventario.id,
      equipado: false,
      item: {
        id: inventario.itemLoja.id,
        codigo: inventario.itemLoja.codigo,
      },
    });
  });

  test("deve comprar item com sucesso", async () => {
    const inventario = criarInventario();

    repository.comprarItem.mockResolvedValue({
      saldoMoedas: 4900,
      inventarioItem: inventario,
    });

    const resultado = await service.comprar("usuario-id", "item-loja-id");

    expect(repository.comprarItem).toHaveBeenCalledWith("usuario-id", "item-loja-id", 1);

    expect(resultado).toEqual({
      mensagem: "Item comprado com sucesso.",
      saldoMoedas: 4900,
      quantidadeComprada: 1,
      item: expect.objectContaining({
        id: inventario.id,
        item: expect.objectContaining({
          id: inventario.itemLoja.id,
        }),
      }),
    });
  });

  test("deve repassar a quantidade ao comprar consumivel", async () => {
    const itemLoja = criarItemLoja({ tipo: TipoItemLoja.POTENCIALIZADOR, consumivel: true });
    const inventario = criarInventario({ itemLoja, quantidade: 5 });

    repository.comprarItem.mockResolvedValue({
      saldoMoedas: 100,
      inventarioItem: inventario,
    });

    const resultado = await service.comprar("usuario-id", "item-loja-id", 3);

    expect(repository.comprarItem).toHaveBeenCalledWith("usuario-id", "item-loja-id", 3);
    expect(resultado).toMatchObject({
      saldoMoedas: 100,
      quantidadeComprada: 3,
      item: {
        quantidade: 5,
        item: { consumivel: true },
      },
    });
  });

  test("deve retornar o registro de uso conforme o contrato HTTP existente", async () => {
    const ativadoEm = new Date("2026-06-16T10:00:00.000Z");
    const usoItemRepository = {
      ativarPotencializador: jest.fn().mockResolvedValue({
        uso: {
          id: "uso-id",
          itemLojaId: "cafe-id",
          status: "ATIVO",
          ativadoEm,
          aplicadoEm: null,
          questaoId: null,
          itemLoja: { nome: "Cafe do Foco", efeito: "Dobra o proximo acerto." },
        },
        quantidadeRestante: 2,
      }),
    } as unknown as jest.Mocked<UsoItemRepository>;
    const serviceComUso = new LojaService(repository, usoItemRepository);

    const resultado = await serviceComUso.usarItem("usuario-id", "cafe-id");

    expect(usoItemRepository.ativarPotencializador).toHaveBeenCalledWith("usuario-id", "cafe-id");
    expect(resultado).toEqual({
      mensagem: "Cafe do Foco ativado. Seu proximo acerto valera ATP em dobro.",
      quantidadeRestante: 2,
      uso: {
        id: "uso-id",
        itemLojaId: "cafe-id",
        itemNome: "Cafe do Foco",
        efeito: "Dobra o proximo acerto.",
        status: "ATIVO",
        ativadoEm,
        aplicadoEm: null,
        questaoId: null,
      },
    });
  });

  test("deve consultar historico somente pelo usuario autenticado e rejeitar usuario ausente", async () => {
    const usoItemRepository = {
      listarHistorico: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    } as unknown as jest.Mocked<UsoItemRepository>;
    const serviceComHistorico = new LojaService(repository, usoItemRepository);
    const queryManipulada = { page: 1, limit: 10, usuarioId: "usuario-B" } as never;

    await serviceComHistorico.listarHistoricoUsos("usuario-A", queryManipulada);
    await serviceComHistorico.listarHistoricoUsos("usuario-B", { page: 1, limit: 10 });

    expect(usoItemRepository.listarHistorico).toHaveBeenNthCalledWith(
      1,
      "usuario-A",
      expect.objectContaining({ page: 1, limit: 10, skip: 0 }),
    );
    expect(usoItemRepository.listarHistorico).toHaveBeenNthCalledWith(
      2,
      "usuario-B",
      expect.objectContaining({ page: 1, limit: 10, skip: 0 }),
    );
    await expect(serviceComHistorico.listarHistoricoUsos(undefined, {})).rejects.toMatchObject({
      codigoStatus: 401,
    });
    expect(usoItemRepository.listarHistorico).toHaveBeenCalledTimes(2);
  });

  test("deve lançar erro ao listar catalogo sem usuario autenticado", async () => {
    await expect(service.listarCatalogo(undefined, {})).rejects.toBeInstanceOf(ErroAplicacao);

    expect(repository.listarCatalogo).not.toHaveBeenCalled();
  });

  test("deve lançar erro ao listar inventario sem usuario autenticado", async () => {
    await expect(service.listarInventario(undefined, {})).rejects.toBeInstanceOf(ErroAplicacao);

    expect(repository.listarInventario).not.toHaveBeenCalled();
  });

  test("deve lançar erro ao comprar sem usuario autenticado", async () => {
    await expect(service.comprar(undefined, "item-loja-id")).rejects.toBeInstanceOf(ErroAplicacao);

    expect(repository.comprarItem).not.toHaveBeenCalled();
  });
});
