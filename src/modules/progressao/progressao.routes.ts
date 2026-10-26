import { Router } from "express";

import { PAPEIS } from "@/shared/constants/papeis";
import { middlewarePapeis } from "@/shared/middlewares/papeis.middleware";
import { validarRequisicao } from "@/shared/middlewares/validacao.middleware";

import { ProgressaoController } from "./progressao.controller";
import { ProgressaoRepository } from "./progressao.repository";
import {
  schemaConfiguracaoInatividade,
  schemaHistoricoXp,
  schemaIniciarTentativa,
  schemaListarNotificacoes,
  schemaParamsNotificacao,
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

// GET historico de progressao de elo (rebaixamentos e recuperacoes do proprio aluno).
progressaoRouter.get(
  "/progressao/elo/historico",
  validarRequisicao(schemaHistoricoXp, "query"),
  progressaoController.buscarHistoricoElo,
);

// GET avisos de elo do proprio aluno. O destinatario sai do token, nunca da requisicao.
progressaoRouter.get(
  "/progressao/notificacoes",
  validarRequisicao(schemaListarNotificacoes, "query"),
  progressaoController.buscarNotificacoes,
);

// POST marca um aviso do proprio aluno como lido.
progressaoRouter.post(
  "/progressao/notificacoes/:id/lida",
  validarRequisicao(schemaParamsNotificacao, "params"),
  progressaoController.marcarNotificacaoLida,
);

// POST rotina autorizada de verificacao de inatividade (varredura em lote).
// Sem parametro de usuario: cada conta e avaliada pelos proprios dados de atividade.
// Pensada para ser chamada por um agendador externo autenticado como administrador.
progressaoRouter.post(
  "/progressao/inatividade/verificar",
  middlewarePapeis(PAPEIS.ADMINISTRADOR),
  progressaoController.verificarInatividade,
);

// GET/PUT prazos da regra de inatividade: restritos ao papel administrativo.
progressaoRouter.get(
  "/progressao/configuracao",
  middlewarePapeis(PAPEIS.ADMINISTRADOR),
  progressaoController.buscarConfiguracao,
);

progressaoRouter.put(
  "/progressao/configuracao",
  middlewarePapeis(PAPEIS.ADMINISTRADOR),
  validarRequisicao(schemaConfiguracaoInatividade, "body"),
  progressaoController.salvarConfiguracao,
);

export { progressaoRouter };
