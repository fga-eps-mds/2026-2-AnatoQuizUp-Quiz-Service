import type { NextFunction, Request, Response } from "express";

import { MENSAGENS } from "@/shared/constants/mensagens";
import type { RespostaApiSucesso, RespostaPaginada } from "@/shared/types/api.types";

import type { ListarCasosOsceQueryDto, RespostaCasoOsceDto } from "./dto/casoOsce.types";
import type { CasoOsceService } from "./casosOsce.service";

// Controller HTTP de casos OSCE: delega ao service e padroniza respostas/erros.
export class CasoOsceController {
  constructor(private readonly casoOsceService: CasoOsceService) {}

  listar = async (
    request: Request<unknown, unknown, unknown, ListarCasosOsceQueryDto>,
    response: Response<RespostaPaginada<RespostaCasoOsceDto>>,
    next: NextFunction,
  ) => {
    try {
      const casos = await this.casoOsceService.listar(request.query);
      return response.status(200).json(casos);
    } catch (error) {
      return next(error);
    }
  };

  buscarPorId = async (
    request: Request<{ id: string }>,
    response: Response<RespostaApiSucesso<RespostaCasoOsceDto>>,
    next: NextFunction,
  ) => {
    try {
      const caso = await this.casoOsceService.buscarPorId(request.params.id);
      return response.status(200).json({ mensagem: MENSAGENS.casoOsceEncontrado, dados: caso });
    } catch (error) {
      return next(error);
    }
  };

  criar = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const criadoPorId = request.usuario?.id ?? "";
      const caso = await this.casoOsceService.criar(request.body, criadoPorId);
      return response.status(201).json({ mensagem: MENSAGENS.casoOsceCriado, dados: caso });
    } catch (error) {
      return next(error);
    }
  };

  atualizar = async (request: Request<{ id: string }>, response: Response, next: NextFunction) => {
    try {
      const caso = await this.casoOsceService.atualizar(request.params.id, request.body);
      return response.status(200).json({ mensagem: MENSAGENS.casoOsceAtualizado, dados: caso });
    } catch (error) {
      return next(error);
    }
  };

  excluir = async (request: Request<{ id: string }>, response: Response, next: NextFunction) => {
    try {
      const professorId = request.usuario?.id ?? "";
      await this.casoOsceService.excluir(request.params.id, professorId);
      return response.status(204).send();
    } catch (error) {
      return next(error);
    }
  };

    salvarChecklist = async (request: Request<{ id: string }>, response: Response, next: NextFunction) => {
    try {
      const caso = await this.casoOsceService.salvarChecklist(request.params.id, request.body);
      return response.status(200).json({ mensagem: MENSAGENS.casoOsceAtualizado, dados: caso });
    } catch (error) {
      return next(error);
    }
  };

  salvarConfiguracao = async (request: Request<{ id: string }>, response: Response, next: NextFunction) => {
    try {
      const caso = await this.casoOsceService.salvarConfiguracao(request.params.id, request.body);
      return response.status(200).json({ mensagem: MENSAGENS.casoOsceAtualizado, dados: caso });
    } catch (error) {
      return next(error);
    }
  };
}
