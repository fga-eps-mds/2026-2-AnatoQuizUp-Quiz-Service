import { Router } from "express";
import { PeriodicidadeMissao } from "@prisma/client";
import { PAPEIS } from "@/shared/constants/papeis";
import { middlewarePapeis } from "@/shared/middlewares/papeis.middleware";
import { listarMissoes } from "./missoes.repository";

export const missoesRouter = Router();
missoesRouter.get("/minhas", middlewarePapeis(PAPEIS.ALUNO), async (req, res, next) => {
  try {
    if (!req.usuario?.id) return res.sendStatus(401);
    return res.json(await listarMissoes(req.usuario.id));
  } catch (erro) {
    return next(erro);
  }
});

missoesRouter.get("/minhas/semanais", middlewarePapeis(PAPEIS.ALUNO), async (req, res, next) => {
  try {
    if (!req.usuario?.id) return res.sendStatus(401);
    return res.json(await listarMissoes(req.usuario.id, PeriodicidadeMissao.SEMANAL));
  } catch (erro) {
    return next(erro);
  }
});
