import type { NextFunction, Request, Response } from "express";

import { ProgressaoController } from "@/modules/progressao/progressao.controller";
import type { ProgressaoService } from "@/modules/progressao/progressao.service";

function criarResponseMock() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));

  return { response: { status } as unknown as Response, status, json };
}

describe("ProgressaoController", () => {
  const next = jest.fn() as NextFunction;
  const usuario = { id: "aluno-1", papel: "ALUNO" };
  let service: jest.Mocked<ProgressaoService>;
  let controller: ProgressaoController;

  beforeEach(() => {
    service = {
      iniciarTentativa: jest.fn(),
      concluirTentativa: jest.fn(),
      buscarProgresso: jest.fn(),
      buscarHistoricoXp: jest.fn(),
    } as unknown as jest.Mocked<ProgressaoService>;
    controller = new ProgressaoController(service);
  });

  it("inicia a rodada e responde 201", async () => {
    const tentativa = { tentativaId: "t1", totalQuestoes: 4, questoes: [] };
    service.iniciarTentativa.mockResolvedValue(tentativa);
    const { response, status, json } = criarResponseMock();
    const request = { body: { tema: "Cardio" }, usuario } as unknown as Request;

    await controller.iniciarTentativa(request, response, next);

    expect(service.iniciarTentativa).toHaveBeenCalledWith({ tema: "Cardio" }, "aluno-1");
    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(tentativa);
  });

  it("conclui a rodada repassando id, usuario e papel", async () => {
    const resultado = { tentativaId: "t1" };
    service.concluirTentativa.mockResolvedValue(resultado as never);
    const { response, status, json } = criarResponseMock();
    const request = { params: { id: "t1" }, usuario } as unknown as Request<{ id: string }>;

    await controller.concluirTentativa(request, response, next);

    expect(service.concluirTentativa).toHaveBeenCalledWith("t1", "aluno-1", "ALUNO");
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(resultado);
  });

  it("busca o progresso do usuario", async () => {
    const progresso = { xpTotal: 150, nivel: 2 };
    service.buscarProgresso.mockResolvedValue(progresso as never);
    const { response, status, json } = criarResponseMock();

    await controller.buscarProgresso({ usuario } as unknown as Request, response, next);

    expect(service.buscarProgresso).toHaveBeenCalledWith("aluno-1");
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(progresso);
  });

  it("busca o historico de XP com a paginacao da query", async () => {
    const historico = { dados: [], metadados: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    service.buscarHistoricoXp.mockResolvedValue(historico);
    const { response, status, json } = criarResponseMock();
    const request = { query: { page: 2 }, usuario } as unknown as Request;

    await controller.buscarHistoricoXp(request, response, next);

    expect(service.buscarHistoricoXp).toHaveBeenCalledWith("aluno-1", { page: 2 });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(historico);
  });

  it("usa id vazio quando nao ha usuario autenticado", async () => {
    service.iniciarTentativa.mockResolvedValue({ tentativaId: "t", totalQuestoes: 0, questoes: [] });
    service.concluirTentativa.mockResolvedValue({} as never);
    service.buscarProgresso.mockResolvedValue({} as never);
    service.buscarHistoricoXp.mockResolvedValue({} as never);
    const { response } = criarResponseMock();

    await controller.iniciarTentativa({ body: {} } as unknown as Request, response, next);
    await controller.concluirTentativa(
      { params: { id: "t1" } } as unknown as Request<{ id: string }>,
      response,
      next,
    );
    await controller.buscarProgresso({} as unknown as Request, response, next);
    await controller.buscarHistoricoXp({ query: {} } as unknown as Request, response, next);

    expect(service.iniciarTentativa).toHaveBeenCalledWith({}, "");
    expect(service.concluirTentativa).toHaveBeenCalledWith("t1", "", undefined);
    expect(service.buscarProgresso).toHaveBeenCalledWith("");
    expect(service.buscarHistoricoXp).toHaveBeenCalledWith("", {});
  });

  it("repassa erros do service ao middleware central", async () => {
    const erro = new Error("falhou");
    service.iniciarTentativa.mockRejectedValue(erro);
    service.concluirTentativa.mockRejectedValue(erro);
    service.buscarProgresso.mockRejectedValue(erro);
    service.buscarHistoricoXp.mockRejectedValue(erro);
    const { response } = criarResponseMock();
    const proximo = jest.fn();

    await controller.iniciarTentativa({ body: {}, usuario } as unknown as Request, response, proximo);
    await controller.concluirTentativa(
      { params: { id: "t1" }, usuario } as unknown as Request<{ id: string }>,
      response,
      proximo,
    );
    await controller.buscarProgresso({ usuario } as unknown as Request, response, proximo);
    await controller.buscarHistoricoXp({ query: {}, usuario } as unknown as Request, response, proximo);

    expect(proximo).toHaveBeenCalledTimes(4);
    expect(proximo).toHaveBeenCalledWith(erro);
  });
});
