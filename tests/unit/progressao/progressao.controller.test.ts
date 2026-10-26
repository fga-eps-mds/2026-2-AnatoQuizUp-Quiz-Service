import type { NextFunction, Request, Response } from "express";

import { ProgressaoController } from "@/modules/progressao/progressao.controller";
import type { ProgressaoService } from "@/modules/progressao/progressao.service";

function criarResponseMock() {
  const json = jest.fn();
  const send = jest.fn();
  const status = jest.fn(() => ({ json, send }));

  return { response: { status } as unknown as Response, status, json, send };
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
      buscarHistoricoElo: jest.fn(),
      buscarNotificacoes: jest.fn(),
      marcarNotificacaoLida: jest.fn(),
      verificarInatividade: jest.fn(),
      buscarConfiguracaoInatividade: jest.fn(),
      salvarConfiguracaoInatividade: jest.fn(),
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

  it("lista o historico de elo do usuario autenticado", async () => {
    const historico = { dados: [], metadados: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    service.buscarHistoricoElo.mockResolvedValue(historico as never);
    const { response, status, json } = criarResponseMock();
    const request = { query: { page: "2" }, usuario } as unknown as Request;

    await controller.buscarHistoricoElo(request, response, next);

    expect(service.buscarHistoricoElo).toHaveBeenCalledWith("aluno-1", { page: "2" });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(historico);
  });

  it("lista as notificacoes do usuario autenticado respeitando o filtro de nao lidas", async () => {
    service.buscarNotificacoes.mockResolvedValue([]);
    const { response, json } = criarResponseMock();

    await controller.buscarNotificacoes(
      { query: { apenasNaoLidas: true }, usuario } as unknown as Request,
      response,
      next,
    );

    expect(service.buscarNotificacoes).toHaveBeenCalledWith("aluno-1", true);
    expect(json).toHaveBeenCalledWith([]);

    await controller.buscarNotificacoes({ query: {}, usuario } as unknown as Request, response, next);

    expect(service.buscarNotificacoes).toHaveBeenLastCalledWith("aluno-1", false);
  });

  it("marca a notificacao como lida e responde 204", async () => {
    service.marcarNotificacaoLida.mockResolvedValue(undefined);
    const { response, status, send } = criarResponseMock();

    await controller.marcarNotificacaoLida(
      { params: { id: "aviso-1" }, usuario } as unknown as Request<{ id: string }>,
      response,
      next,
    );

    expect(service.marcarNotificacaoLida).toHaveBeenCalledWith("aviso-1", "aluno-1");
    expect(status).toHaveBeenCalledWith(204);
    expect(send).toHaveBeenCalled();
  });

  it("executa a rotina de inatividade sem repassar identificador de usuario", async () => {
    const resumo = { avaliados: 2, rebaixamentos: 1, notificacoes: 3 };
    service.verificarInatividade.mockResolvedValue(resumo);
    const { response, status, json } = criarResponseMock();

    await controller.verificarInatividade({ usuario } as unknown as Request, response, next);

    expect(service.verificarInatividade).toHaveBeenCalledWith();
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(resumo);
  });

  it("le e grava a configuracao de inatividade registrando o administrador", async () => {
    const configuracao = {
      diasAviso: 7,
      diasRisco: 8,
      diasRebaixamento: 9,
      diasEntreRebaixamentos: 14,
      indisponibilidades: [],
      atualizadoPorId: "admin-1",
      atualizadoEm: "2026-10-26T12:00:00.000Z",
    };
    service.buscarConfiguracaoInatividade.mockResolvedValue(configuracao);
    service.salvarConfiguracaoInatividade.mockResolvedValue(configuracao);
    const { response, json } = criarResponseMock();
    const admin = { id: "admin-1", papel: "ADMINISTRADOR" };

    await controller.buscarConfiguracao({ usuario: admin } as unknown as Request, response, next);
    expect(json).toHaveBeenCalledWith(configuracao);

    const body = {
      diasAviso: 7,
      diasRisco: 8,
      diasRebaixamento: 9,
      diasEntreRebaixamentos: 14,
      indisponibilidades: [],
    };

    await controller.salvarConfiguracao(
      { body, usuario: admin } as unknown as Request<unknown, unknown, typeof body>,
      response,
      next,
    );

    expect(service.salvarConfiguracaoInatividade).toHaveBeenCalledWith(body, "admin-1");
  });

  it("usa id vazio quando nao ha usuario autenticado nas rotas de elo", async () => {
    service.buscarHistoricoElo.mockResolvedValue({
      dados: [],
      metadados: { page: 1, limit: 10, total: 0, totalPages: 0 },
    } as never);
    service.buscarNotificacoes.mockResolvedValue([]);
    service.marcarNotificacaoLida.mockResolvedValue(undefined);
    service.salvarConfiguracaoInatividade.mockResolvedValue({} as never);
    const { response } = criarResponseMock();

    await controller.buscarHistoricoElo({ query: {} } as unknown as Request, response, next);
    await controller.buscarNotificacoes({ query: {} } as unknown as Request, response, next);
    await controller.marcarNotificacaoLida(
      { params: { id: "aviso-1" } } as unknown as Request<{ id: string }>,
      response,
      next,
    );
    await controller.salvarConfiguracao(
      { body: {} } as unknown as Request<unknown, unknown, never>,
      response,
      next,
    );

    expect(service.buscarHistoricoElo).toHaveBeenCalledWith("", {});
    expect(service.buscarNotificacoes).toHaveBeenCalledWith("", false);
    expect(service.marcarNotificacaoLida).toHaveBeenCalledWith("aviso-1", "");
    expect(service.salvarConfiguracaoInatividade).toHaveBeenCalledWith({}, "");
  });

  it("repassa erros das rotas de elo ao middleware central", async () => {
    const erro = new Error("falhou");
    service.buscarHistoricoElo.mockRejectedValue(erro);
    service.buscarNotificacoes.mockRejectedValue(erro);
    service.marcarNotificacaoLida.mockRejectedValue(erro);
    service.verificarInatividade.mockRejectedValue(erro);
    service.buscarConfiguracaoInatividade.mockRejectedValue(erro);
    service.salvarConfiguracaoInatividade.mockRejectedValue(erro);
    const { response } = criarResponseMock();
    const proximo = jest.fn();

    await controller.buscarHistoricoElo({ query: {}, usuario } as unknown as Request, response, proximo);
    await controller.buscarNotificacoes({ query: {}, usuario } as unknown as Request, response, proximo);
    await controller.marcarNotificacaoLida(
      { params: { id: "aviso-1" }, usuario } as unknown as Request<{ id: string }>,
      response,
      proximo,
    );
    await controller.verificarInatividade({ usuario } as unknown as Request, response, proximo);
    await controller.buscarConfiguracao({ usuario } as unknown as Request, response, proximo);
    await controller.salvarConfiguracao(
      { body: {}, usuario } as unknown as Request<unknown, unknown, never>,
      response,
      proximo,
    );

    expect(proximo).toHaveBeenCalledTimes(6);
    expect(proximo).toHaveBeenCalledWith(erro);
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
