import type { NextFunction, Request, Response } from "express";

import type { ProgressaoService } from "./progressao.service";
import type { HistoricoXpQueryDto, IniciarTentativaDto } from "./progressao.types";

// Controller HTTP da progressao: rodadas de quiz, nivel e historico de XP.
// Delega ao service; erros seguem para o middleware central via next.
export class ProgressaoController {
  constructor(private readonly service: ProgressaoService) {}

  /** POST /quiz/tentativas — inicia uma rodada e devolve as questoes sorteadas. */
  iniciarTentativa = async (
    request: Request<unknown, unknown, IniciarTentativaDto>,
    response: Response,
    next: NextFunction,
  ) => {
    try {
      const tentativa = await this.service.iniciarTentativa(
        request.body,
        request.usuario?.id ?? "",
      );
      return response.status(201).json(tentativa);
    } catch (error) {
      return next(error);
    }
  };

  /** POST /quiz/tentativas/:id/concluir — fecha a rodada e concede o XP (idempotente). */
  concluirTentativa = async (
    request: Request<{ id: string }>,
    response: Response,
    next: NextFunction,
  ) => {
    try {
      const resultado = await this.service.concluirTentativa(
        request.params.id,
        request.usuario?.id ?? "",
        request.usuario?.papel,
      );
      return response.status(200).json(resultado);
    } catch (error) {
      return next(error);
    }
  };

  /** GET /quiz/progresso — XP acumulado, nivel e quanto falta para o proximo. */
  buscarProgresso = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const progresso = await this.service.buscarProgresso(request.usuario?.id ?? "");
      return response.status(200).json(progresso);
    } catch (error) {
      return next(error);
    }
  };

  /** GET /quiz/xp/historico — historico paginado de XP recebido. */
  buscarHistoricoXp = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const historico = await this.service.buscarHistoricoXp(
        request.usuario?.id ?? "",
        request.query as HistoricoXpQueryDto,
      );
      return response.status(200).json(historico);
    } catch (error) {
      return next(error);
    }
  };
}
