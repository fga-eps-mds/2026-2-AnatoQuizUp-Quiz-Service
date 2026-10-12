import { Router } from "express";

import { validarRequisicao } from "@/shared/middlewares/validacao.middleware";

import { ProgressaoController } from "./progressao.controller";
import { ProgressaoRepository } from "./progressao.repository";
import {
  schemaHistoricoXp,
  schemaIniciarTentativa,
  schemaParamsTentativa,
} from "./progressao.schemas";
import { ProgressaoService } from "./progressao.service";

// Rotas da progressao. Sao montadas dentro de /quiz (ver quiz.routes.ts), entao
// herdam a autenticacao e a checagem de papel do quiz e ja passam pelo proxy do BFF.
const progressaoRepository = new ProgressaoRepository();
const progressaoService = new ProgressaoService(progressaoRepository);
const progressaoController = new ProgressaoController(progressaoService);

const progressaoRouter = Router();

// POST inicia uma rodada de quiz (ate 10 questoes).
progressaoRouter.post(
  "/tentativas",
  validarRequisicao(schemaIniciarTentativa, "body"),
  progressaoController.iniciarTentativa,
);

// POST conclui a rodada e concede o XP.
progressaoRouter.post(
  "/tentativas/:id/concluir",
  validarRequisicao(schemaParamsTentativa, "params"),
  progressaoController.concluirTentativa,
);

// GET nivel e progresso do usuario.
progressaoRouter.get("/progresso", progressaoController.buscarProgresso);

// GET historico de XP recebido.
progressaoRouter.get(
  "/xp/historico",
  validarRequisicao(schemaHistoricoXp, "query"),
  progressaoController.buscarHistoricoXp,
);

export { progressaoRouter };
