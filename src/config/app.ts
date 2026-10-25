import cors from "cors";
import express, { Router } from "express";
import helmet from "helmet";

import { criarOpcoesCors } from "@/config/cors";
import { env } from "@/config/env";
import { loggerHttp } from "@/config/logger";
import { questionRouter } from "@/modules/questoes";
import { turmaRouter } from "@/modules/turma";
import { MENSAGENS } from "@/shared/constants/mensagens";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";
import { ErroAplicacao } from "@/shared/errors/erro-aplicacao";
import { middlewareAutenticacao } from "@/shared/middlewares/autenticacao.middleware";
import { middlewareTokenInterno } from "@/shared/middlewares/token-interno.middleware";
import { middlewareTratamentoErros } from "@/shared/middlewares/tratamento-erros.middleware";
import { missoesRouter } from "@/modules/missoes/missoes.routes";
import { quizRouter } from "@/modules/quiz/quiz.routes";
import { listaQuestaoRouter } from "@/modules/lista";
import { dashboardRouter } from "@/modules/dashboardTurma/dashboardTurma.routes";
import { dashboardAlunoRouter } from "@/modules/dashboardAluno";
import { resolucaoListaRouter } from "@/modules/resolucaoLista/resolucaoLista.routes";
import { conquistaRouter } from "@/modules/conquistas/conquistas.routes";
import "@/modules/conquistas/listeners/tema-criado.listener";
import { lojaRouter } from "@/modules/loja";
import { inventarioRoutes } from "@/modules/inventario";
import { rankingRouter } from "@/modules/ranking/ranking.routes";

// Montagem da aplicacao Express: middlewares globais, rotas e tratamento de erros.
const aplicacao = express();
const roteadorApi = Router();

// Middlewares globais: log HTTP, headers de seguranca, CORS e parse de JSON.
aplicacao.use(loggerHttp);
aplicacao.use(helmet());
aplicacao.use(cors(criarOpcoesCors(env.CORS_ORIGINS)));
aplicacao.use(express.json());

// Health check publico (sem token interno) para readiness/liveness.
aplicacao.get("/health", (_request, response) => {
  return response.status(200).json({
    mensagem: MENSAGENS.apiEmExecucao,
    dados: {
      status: "ok",
      servico: "quiz-service",
      timestamp: new Date().toISOString(),
    },
  });
});

// Tudo sob /api exige o token interno (servico so e chamado pelo BFF).
aplicacao.use("/api", middlewareTokenInterno);

// Roteador da API v1: autenticacao do usuario + montagem de cada modulo.
roteadorApi.use(middlewareAutenticacao);
roteadorApi.use("/quiz", quizRouter);
roteadorApi.use("/missoes", missoesRouter);
roteadorApi.use("/questoes", questionRouter);
roteadorApi.use("/turmas", turmaRouter);
roteadorApi.use("/lista", listaQuestaoRouter);
roteadorApi.use("/turmasDashboard", dashboardRouter);
roteadorApi.use("/dashboardAluno", dashboardAlunoRouter);
roteadorApi.use("/listasAluno", resolucaoListaRouter);
roteadorApi.use("/conquistas", conquistaRouter);
roteadorApi.use("/loja", lojaRouter);
roteadorApi.use("/inventario", inventarioRoutes);
roteadorApi.use("/ranking", rankingRouter);

aplicacao.use("/api/v1", roteadorApi);

// Captura qualquer rota nao mapeada e gera um erro 404 padronizado.
aplicacao.use((_request, _response, next) => {
  next(
    new ErroAplicacao({
      codigoStatus: 404,
      codigo: CodigoDeErro.NAO_ENCONTRADO,
      mensagem: MENSAGENS.rotaNaoEncontrada,
    }),
  );
});

// Middleware central de tratamento de erros (sempre por ultimo).
aplicacao.use(middlewareTratamentoErros);

export { aplicacao };
