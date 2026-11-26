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

  test("deve lançar erro interno ao usar item sem o repository de uso configurado", async () => {
    await expect(service.usarItem("usuario-id", "cafe-id")).rejects.toMatchObject({
      codigoStatus: 500,
    });
  });

  test("deve lançar erro interno ao listar historico de usos sem o repository configurado", async () => {
    await expect(service.listarHistoricoUsos("usuario-id", {})).rejects.toMatchObject({
      codigoStatus: 500,
    });
  });

  describe("listarHistorico", () => {
    test("deve lançar erro interno sem o repository de uso configurado", async () => {
      await expect(service.listarHistorico("usuario-id", {})).rejects.toMatchObject({
        codigoStatus: 500,
      });
    });

    test("deve lançar erro ao consultar historico sem usuario autenticado", async () => {
      await expect(service.listarHistorico(undefined, {})).rejects.toBeInstanceOf(ErroAplicacao);
    });

    test("deve combinar compras e usos, ordenados do mais recente ao mais antigo", async () => {
      const itemLoja = criarItemLoja({ id: "item-1", nome: "Coruja", efeito: null });
      const usoItemRepository = {
        listarHistoricoCompleto: jest.fn().mockResolvedValue([
          {
            id: "uso-1",
            itemLojaId: "item-1",
            status: "ATIVO",
            ativadoEm: new Date("2026-06-16T08:00:00.000Z"),
            aplicadoEm: null,
            questaoId: null,
            itemLoja: { id: "item-1", nome: "Coruja", efeito: null },
          },
        ]),
      } as unknown as jest.Mocked<UsoItemRepository>;
      const repositoryComCompras = {
        ...repository,
        listarHistoricoCompras: jest.fn().mockResolvedValue([
          {
            id: "compra-sem-item",
            criadoEm: new Date("2026-06-16T09:00:00.000Z"),
            quantidade: -5,
            quantidadeItem: null,
            itemLoja: null,
          },
          {
            id: "compra-sem-quantidade",
            criadoEm: new Date("2026-06-16T09:30:00.000Z"),
            quantidade: -3,
            quantidadeItem: null,
            itemLoja,
          },
          {
            id: "compra-1",
            criadoEm: new Date("2026-06-16T10:00:00.000Z"),
            quantidade: -10,
            quantidadeItem: 2,
            itemLoja,
          },
        ]),
      } as unknown as jest.Mocked<LojaRepository>;
      const serviceComHistorico = new LojaService(repositoryComCompras, usoItemRepository);

      const resultado = await serviceComHistorico.listarHistorico("usuario-id", {
        page: 1,
        limit: 10,
      });

      // A compra sem itemLoja (excluido) e descartada; sobram as outras tres, mais recente primeiro.
      expect(resultado.dados).toEqual([
        expect.objectContaining({ id: "compra-1", acao: "COMPRA", quantidade: 2, custoCompra: 10 }),
        expect.objectContaining({
          id: "compra-sem-quantidade",
          acao: "COMPRA",
          quantidade: 1,
          custoCompra: 3,
        }),
        expect.objectContaining({
          id: "uso-1",
          acao: "USO",
          efeitoUso: "Potencializador ativado.",
          statusUso: "ATIVO",
        }),
      ]);
      expect(resultado.metadados).toMatchObject({ total: 3 });
    });
  });

  test("usa a descricao padrao quando o item usado nao tem efeito cadastrado", async () => {
    const usoItemRepository = {
      ativarPotencializador: jest.fn().mockResolvedValue({
        uso: {
          id: "uso-id",
          itemLojaId: "cafe-id",
          status: "ATIVO",
          ativadoEm: new Date("2026-06-16T10:00:00.000Z"),
          aplicadoEm: null,
          questaoId: null,
          itemLoja: { nome: "Cafe do Foco", efeito: null },
        },
        quantidadeRestante: 1,
      }),
    } as unknown as jest.Mocked<UsoItemRepository>;
    const serviceComUso = new LojaService(repository, usoItemRepository);

    const resultado = await serviceComUso.usarItem("usuario-id", "cafe-id");

    expect(resultado.uso.efeito).toBe("Potencializador ativo.");
  });

  describe("itens novos do avatar", () => {
    const itensNovos = [
      criarItemLoja({ id: "cabelo-id", codigo: "trancas", nome: "Tranças", tipo: TipoItemLoja.CABELO, precoMoedas: 150 }),
      criarItemLoja({ id: "acessorio-id", codigo: "chapeu-cowboy", nome: "Chapéu de Cowboy", tipo: TipoItemLoja.ACESSORIO, precoMoedas: 160 }),
      criarItemLoja({ id: "luva-id", codigo: "luva-goleiro", nome: "Luva de Goleiro", tipo: TipoItemLoja.LUVA, precoMoedas: 120 }),
      criarItemLoja({ id: "calcado-id", codigo: "bota-coturno", nome: "Bota Coturno", tipo: TipoItemLoja.CALCADO, precoMoedas: 140 }),
    ];

    test("lista os quatro tipos novos no catalogo com codigo, tipo e preco", async () => {
      repository.listarCatalogo.mockResolvedValue({
        data: itensNovos,
        total: itensNovos.length,
        quantidadesPossuidas: new Map(),
      });

      const resultado = await service.listarCatalogo("usuario-id", { page: 1, limit: 10 });

      expect(resultado.dados).toEqual(
        itensNovos.map((item) =>
          expect.objectContaining({
            codigo: item.codigo,
            tipo: item.tipo,
            precoMoedas: item.precoMoedas,
            adquirido: false,
          }),
        ),
      );
    });

    test.each([TipoItemLoja.CABELO, TipoItemLoja.ACESSORIO, TipoItemLoja.LUVA, TipoItemLoja.CALCADO])(
      "repassa o filtro por tipo %s ao repository",
      async (tipo) => {
        repository.listarCatalogo.mockResolvedValue({ data: [], total: 0, quantidadesPossuidas: new Map() });

        await service.listarCatalogo("usuario-id", { tipo, page: 1, limit: 10 });

        expect(repository.listarCatalogo).toHaveBeenCalledWith(
          "usuario-id",
          expect.anything(),
          expect.objectContaining({ tipo }),
        );
      },
    );

    test.each(itensNovos.map((item) => [item.tipo, item] as const))(
      "compra um item do tipo %s uma unica vez",
      async (_tipo, item) => {
        repository.comprarItem.mockResolvedValue({
          saldoMoedas: 1000 - item.precoMoedas,
          inventarioItem: criarInventario({ itemLojaId: item.id, itemLoja: item }),
        });

        const resultado = await service.comprar("usuario-id", item.id);

        expect(repository.comprarItem).toHaveBeenCalledTimes(1);
        expect(repository.comprarItem).toHaveBeenCalledWith("usuario-id", item.id, 1);
        expect(resultado).toEqual(
          expect.objectContaining({
            saldoMoedas: 1000 - item.precoMoedas,
            quantidadeComprada: 1,
            item: expect.objectContaining({ item: expect.objectContaining({ codigo: item.codigo, tipo: item.tipo }) }),
          }),
        );
      },
    );
  });
});
