import { Router } from 'express';
import { PAPEIS } from '@/shared/constants/papeis';
import { middlewarePapeis } from '@/shared/middlewares/papeis.middleware';
import { validarRequisicao } from '@/shared/middlewares/validacao.middleware';
import { TurmaDashboardRepository } from './dashboardTurma.repository';
import { TurmaDashboardService } from './dashboardTurma.service';
import { TurmaDashboardController } from './dashboardTurma.controller';
import {
  schemaParamsDashboard,
  schemaParamsHistoricoAluno,
  schemaParamsEvolucaoTemas,
  schemaParamsListaDashboard,
  schemaQueryEvolucaoTemas,
} from './dashboardTruma.schemas';

const dashboardRouter = Router();

// Montagem das dependencias do dashboard da turma.
const turmaDashboardRepository = new TurmaDashboardRepository();
const turmaDashboardService = new TurmaDashboardService(turmaDashboardRepository);
const turmaDashboardController = new TurmaDashboardController(turmaDashboardService);

// Dashboards da turma sao de gestao: somente professor e administrador.
const apenasGestao = middlewarePapeis(PAPEIS.PROFESSOR, PAPEIS.ADMINISTRADOR);

// GET visao macro (indicadores gerais) da turma.
dashboardRouter.get(
  '/:id/macro',
  apenasGestao,
  validarRequisicao(schemaParamsDashboard, 'params'),
  turmaDashboardController.listarMacro
);

// GET desempenho individual de cada aluno.
dashboardRouter.get(
  '/:id/individual',
  apenasGestao,
  validarRequisicao(schemaParamsDashboard, 'params'),
  turmaDashboardController.listarIndividual
);

// GET desempenho agregado por lista.
dashboardRouter.get(
  '/:id/listas',
  apenasGestao,
  validarRequisicao(schemaParamsDashboard, 'params'),
  turmaDashboardController.listarPorListas
);

// GET desempenho dos alunos em uma lista especifica.
dashboardRouter.get(
  '/:id/listas/:listaId',
  apenasGestao,
  validarRequisicao(schemaParamsListaDashboard, 'params'),
  turmaDashboardController.listarDesempenhoListaIndividual
);

dashboardRouter.get(
  '/:id/alunos/:alunoId/historico-listas',
  middlewarePapeis(PAPEIS.PROFESSOR),
  validarRequisicao(schemaParamsHistoricoAluno, 'params'),
  turmaDashboardController.listarHistoricoAluno,
);

// GET top erros dos alunos em uma lista especifica.
dashboardRouter.get(
  '/:id/listas/:listaId/top-erros',
  apenasGestao,
  validarRequisicao(schemaParamsListaDashboard, 'params'),
  turmaDashboardController.getTopErros
);

dashboardRouter.get(
  '/:id/alunos/:alunoId/evolucao-temas',
  middlewarePapeis(PAPEIS.PROFESSOR),
  validarRequisicao(schemaParamsEvolucaoTemas, 'params'),
  validarRequisicao(schemaQueryEvolucaoTemas, 'query'),
  turmaDashboardController.listarEvolucaoTemas,
);

export { dashboardRouter };
