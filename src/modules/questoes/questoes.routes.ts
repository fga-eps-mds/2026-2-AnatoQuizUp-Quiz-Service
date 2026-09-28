import { Router } from "express";
import multer from "multer";

import { env } from "@/config/env";
import { PAPEIS } from "@/shared/constants/papeis";
import { middlewarePapeis } from "@/shared/middlewares/papeis.middleware";
import { validarRequisicao } from "@/shared/middlewares/validacao.middleware";

import { QuestionController } from "./questoes.controller";
import { QuestionRepository } from "./questoes.repository";
import { QuestionService } from "./questoes.service";
import { MinioService } from "./minio.service";

import {
  schemaAtualizarQuestao,
  schemaBuscarQuestaoPorId,
  schemaCriarQuestao,
  schemaFiltrarQuestoes,
  schemaListarQuestoes,
} from "./questoes.schemas";

// -----------------------------------------------------------------------------
// Dependencies
// -----------------------------------------------------------------------------

const questionRepository = new QuestionRepository();

const minioService = env.STORAGE_ENABLED ? new MinioService() : undefined;

const questionService = new QuestionService(questionRepository, minioService);

const questionController = new QuestionController(questionService);

// -----------------------------------------------------------------------------
// Router
// -----------------------------------------------------------------------------

const questionRouter = Router();

// -----------------------------------------------------------------------------
// Multer
// -----------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (request, file, callback) => {
    const formatosAceitos = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

    if (formatosAceitos.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error("Formato de arquivo inválido. Use JPEG, PNG ou WEBP."));
    }
  },
});

// -----------------------------------------------------------------------------
// Middlewares
// -----------------------------------------------------------------------------

questionRouter.use(middlewarePapeis(PAPEIS.PROFESSOR, PAPEIS.ADMINISTRADOR));

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

questionRouter.post(
  "/",
  upload.single("imagem"),
  validarRequisicao(schemaCriarQuestao),
  questionController.criar,
);

questionRouter.get(
  "/busca",
  validarRequisicao(schemaFiltrarQuestoes, "query"),
  questionController.filtrar,
);

questionRouter.get(
  "/",
  validarRequisicao(schemaListarQuestoes, "query"),
  questionController.listar,
);

questionRouter.get(
  "/:id",
  validarRequisicao(schemaBuscarQuestaoPorId, "params"),
  questionController.buscarPorId,
);

questionRouter.put(
  "/:id",
  upload.single("imagem"),
  validarRequisicao(schemaBuscarQuestaoPorId, "params"),
  validarRequisicao(schemaAtualizarQuestao),
  questionController.atualizar,
);

questionRouter.delete(
  "/:id",
  validarRequisicao(schemaBuscarQuestaoPorId, "params"),
  questionController.remover,
);

export { questionRouter };
