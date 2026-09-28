import type { NextFunction, Request, Response } from "express";

import { LojaController } from "@/modules/loja/loja.controller";
import type { LojaService } from "@/modules/loja/loja.service";

function criarResponseMock<T>() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));

  return {
    response: { status } as unknown as Response<T>,
    status,
    json,
  };
}

describe("Testa Loja Controller", () => {
  let controller: LojaController;
  let lojaService: jest.Mocked<LojaService>;
  const next = jest.fn() as NextFunction;

  beforeEach(() => {
    lojaService = {
      listarCatalogo: jest.fn(),
      listarInventario: jest.fn(),
      comprar: jest.fn(),
      listarHistorico: jest.fn(),
    } as unknown as jest.Mocked<LojaService>;

    controller = new LojaController(lojaService);
    jest.clearAllMocks();
  });

  test("deve listar catalogo com sucesso", async () => {
    const respostaMock = {
      dados: [
        {
          id: "item-id",
          codigo: "icone-coruja-sabia",
          nome: "Coruja Sábia",
          descricao: null,
          tipo: "ICONE_PERFIL" as const,
          precoMoedas: 1,
          valor: null,
          imagemUrl: null,
          previewImagemUrl: null,
          ativo: true,
          adquirido: false,
        },
      ],
      metadados: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    };

    lojaService.listarCatalogo.mockResolvedValue(respostaMock);

    const request = {
      usuario: {
        id: "usuario-id",
      },
      query: {
        page: 1,
        limit: 10,
      },
    } as unknown as Request;

    const { response, status, json } = criarResponseMock();

    await controller.listarCatalogo(request, response, next);

    expect(lojaService.listarCatalogo).toHaveBeenCalledWith("usuario-id", request.query);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(respostaMock);
  });

  test("deve chamar next quando service lançar erro ao listar catalogo", async () => {
    const erro = new Error("Erro ao listar catalogo");

    lojaService.listarCatalogo.mockRejectedValue(erro);

    const request = {
      usuario: {
        id: "usuario-id",
      },
      query: {},
    } as unknown as Request;

    const { response } = criarResponseMock();
    const nextMock = jest.fn();

    await controller.listarCatalogo(request, response, nextMock);

    expect(nextMock).toHaveBeenCalledWith(erro);
  });

  test("deve listar a cronologia unificada do usuario autenticado", async () => {
    const respostaMock = { dados: [], metadados: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    lojaService.listarHistorico.mockResolvedValue(respostaMock);
    const request = { usuario: { id: "usuario-id" }, query: { page: 1, limit: 10 } } as unknown as Request;
    const { response, status, json } = criarResponseMock();

    await controller.listarHistorico(request, response, next);

    expect(lojaService.listarHistorico).toHaveBeenCalledWith("usuario-id", request.query);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(respostaMock);
  });

  test("deve listar inventario com sucesso", async () => {
    const respostaMock = {
      dados: [
        {
          id: "inventario-id",
          equipado: false,
          adquiridoEm: new Date("2026-06-16T00:00:00.000Z"),
          item: {
            id: "item-id",
            codigo: "icone-coruja-sabia",
            nome: "Coruja Sábia",
            descricao: null,
            tipo: "ICONE_PERFIL" as const,
            precoMoedas: 1,
            valor: null,
            imagemUrl: null,
            previewImagemUrl: null,
            ativo: true,
          },
        },
      ],
      metadados: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    };

    lojaService.listarInventario.mockResolvedValue(respostaMock);

    const request = {
      usuario: {
        id: "usuario-id",
      },
      query: {},
    } as unknown as Request;

    const { response, status, json } = criarResponseMock();

    await controller.listarInventario(request, response, next);

    expect(lojaService.listarInventario).toHaveBeenCalledWith("usuario-id", request.query);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(respostaMock);
  });

  test("deve comprar item com sucesso", async () => {
    const respostaMock = {
      mensagem: "Item comprado com sucesso.",
      saldoMoedas: 4900,
      item: {
        id: "inventario-id",
        equipado: false,
        adquiridoEm: new Date("2026-06-16T00:00:00.000Z"),
        item: {
          id: "item-id",
          codigo: "icone-coruja-sabia",
          nome: "Coruja Sábia",
          descricao: null,
          tipo: "ICONE_PERFIL" as const,
          precoMoedas: 1,
          valor: null,
          imagemUrl: null,
          previewImagemUrl: null,
          ativo: true,
        },
      },
    };

    lojaService.comprar.mockResolvedValue(respostaMock);

    const request = {
      usuario: {
        id: "usuario-id",
      },
      body: {
        itemLojaId: "item-id",
        quantidade: 2,
      },
    } as unknown as Request;

    const { response, status, json } = criarResponseMock();

    await controller.comprar(request, response, next);

    expect(lojaService.comprar).toHaveBeenCalledWith("usuario-id", "item-id", 2);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(respostaMock);
  });

  test("deve chamar next quando service lançar erro ao comprar item", async () => {
    const erro = new Error("Erro ao comprar item");

    lojaService.comprar.mockRejectedValue(erro);

    const request = {
      usuario: {
        id: "usuario-id",
      },
      body: {
        itemLojaId: "item-id",
      },
    } as unknown as Request;

    const { response } = criarResponseMock();
    const nextMock = jest.fn();

    await controller.comprar(request, response, nextMock);

    expect(nextMock).toHaveBeenCalledWith(erro);
  });
});
