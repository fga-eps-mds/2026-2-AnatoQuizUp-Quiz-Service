import { Router } from "express";

import { PAPEIS } from "@/shared/constants/papeis";
import { middlewarePapeis } from "@/shared/middlewares/papeis.middleware";
import { QuizController } from "./quiz.controller";
import { QuizService } from "./quiz.service";
import { QuizRepository } from "./quiz.repository";
import { validarRequisicao } from "@/shared/middlewares/validacao.middleware";
import {
  schemaBuscarQuestaoQuiz,
  schemaResponderQuestaoQuiz,
  schemaHistoricoQuizQuestoesUsuario,
} from "./quiz.schemas";
import { ConquistaService } from "../conquistas/conquistas.service";
import { ConquistaRepository } from "../conquistas/conquistas.repository";
import { UsoItemRepository } from "../loja/uso-item.repository";

// Montagem das dependencias; o quiz depende do service de conquistas para premiar acertos.
const quizRepository = new QuizRepository();
const conquistaRepository = new ConquistaRepository();
const conquistaService = new ConquistaService(conquistaRepository);
const usoItemRepository = new UsoItemRepository();
const quizService = new QuizService(quizRepository, conquistaService, usoItemRepository);
const quizController = new QuizController(quizService);

const quizRouter = Router();

// Quiz livre disponivel para aluno, professor e administrador.
quizRouter.use(middlewarePapeis(PAPEIS.ALUNO, PAPEIS.ADMINISTRADOR, PAPEIS.PROFESSOR));

// GET questoes do quiz (paginadas/filtradas pela query).
quizRouter.get(
  "/",
  validarRequisicao(schemaBuscarQuestaoQuiz, "query"),
  quizController.buscarQuestoesQuiz,
);

// POST registra a resposta de uma questao.
quizRouter.post(
  "/responder",
  validarRequisicao(schemaResponderQuestaoQuiz, "body"),
  quizController.responderQuestaoQuiz,
);

// GET saldo de moedas do usuario.
quizRouter.get("/moedas", quizController.buscarSaldoMoedas);

// GET quantidade de questoes por tema.
quizRouter.get("/quantidade_por_tema", quizController.buscarQuantidadeDeQuestoesPorTema);

// GET historico de questoes respondidas.
quizRouter.get(
  "/historico",
  validarRequisicao(schemaHistoricoQuizQuestoesUsuario, "query"),
  quizController.buscarHistorico,
);

export { quizRouter };
