import { Router } from "express";

import { PAPEIS } from "@/shared/constants/papeis";
import { middlewarePapeis } from "@/shared/middlewares/papeis.middleware";
import { validarRequisicao } from "@/shared/middlewares/validacao.middleware";

import { LojaController } from "./loja.controller";
import { LojaRepository } from "./loja.repository";
import { UsoItemRepository } from "./uso-item.repository";
import { LojaService } from "./loja.service";
import {
  schemaComprarItem,
  schemaListarCatalogo,
  schemaListarInventario,
  schemaUsarItem,
} from "./loja.schemas";

// Montagem das dependencias do modulo de loja.
const lojaRepository = new LojaRepository();
const usoItemRepository = new UsoItemRepository();
const lojaService = new LojaService(lojaRepository, usoItemRepository);
const lojaController = new LojaController(lojaService);

const lojaRouter = Router();

// Loja de cosmeticos: somente alunos compram/consultam.
lojaRouter.use(middlewarePapeis(PAPEIS.ALUNO));

// GET catalogo de itens a venda.
lojaRouter.get(
  "/catalogo",
  validarRequisicao(schemaListarCatalogo, "query"),
  lojaController.listarCatalogo,
);

// GET itens que o aluno ja possui.
lojaRouter.get(
  "/meu-inventario",
  validarRequisicao(schemaListarInventario, "query"),
  lojaController.listarInventario,
);

// POST compra um item gastando moedas do aluno.
lojaRouter.post("/comprar", validarRequisicao(schemaComprarItem, "body"), lojaController.comprar);

// POST ativa uma unidade de potencializador do proprio inventario.
lojaRouter.post("/usar", validarRequisicao(schemaUsarItem, "body"), lojaController.usarItem);

// GET deixa o registro de uso pronto para a tela de historico da issue #40.
lojaRouter.get(
  "/meu-historico-usos",
  validarRequisicao(schemaListarInventario, "query"),
  lojaController.listarHistoricoUsos,
);

export { lojaRouter };
