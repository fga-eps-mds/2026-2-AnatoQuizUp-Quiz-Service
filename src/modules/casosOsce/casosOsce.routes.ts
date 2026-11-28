import { Router } from "express";

import { PAPEIS } from "@/shared/constants/papeis";
import { middlewarePapeis } from "@/shared/middlewares/papeis.middleware";
import { validarRequisicao } from "@/shared/middlewares/validacao.middleware";

import { CasoOsceController } from "./casosOsce.controller";
import { CasoOsceRepository } from "./casosOsce.repository";
import { CasoOsceService } from "./casosOsce.service";
import {
  schemaBuscarCasoOscePorId, 
  schemaListarCasosOsce,
  schemaSalvarCasoOsce,
  schemaSalvarChecklist,
  schemaSalvarConfiguracaoAvaliacao,
} from "./casosOsce.schemas";

const casoOsceRepository = new CasoOsceRepository();
const casoOsceService = new CasoOsceService(casoOsceRepository);
const casoOsceController = new CasoOsceController(casoOsceService);

const casoOsceRouter = Router();

// Cadastro dos casos OSCE: so o papel PROFESSOR acessa (US26).
casoOsceRouter.use(middlewarePapeis(PAPEIS.PROFESSOR));

casoOsceRouter.post("/", validarRequisicao(schemaSalvarCasoOsce), casoOsceController.criar);

casoOsceRouter.get(
  "/",
  validarRequisicao(schemaListarCasosOsce, "query"),
  casoOsceController.listar,
);

casoOsceRouter.get(
  "/:id",
  validarRequisicao(schemaBuscarCasoOscePorId, "params"),
  casoOsceController.buscarPorId,
);

casoOsceRouter.patch(
  "/:id",
  validarRequisicao(schemaBuscarCasoOscePorId, "params"),
  validarRequisicao(schemaSalvarCasoOsce),
  casoOsceController.atualizar,
);

casoOsceRouter.put(
  "/:id/checklist",
  validarRequisicao(schemaBuscarCasoOscePorId, "params"),
  validarRequisicao(schemaSalvarChecklist),
  casoOsceController.salvarChecklist,
);

casoOsceRouter.put(
  "/:id/avaliacao",
  validarRequisicao(schemaBuscarCasoOscePorId, "params"),
  validarRequisicao(schemaSalvarConfiguracaoAvaliacao),
  casoOsceController.salvarConfiguracao,
);

casoOsceRouter.delete(
  "/:id",
  validarRequisicao(schemaBuscarCasoOscePorId, "params"),
  casoOsceController.excluir,
);

export { casoOsceRouter };
