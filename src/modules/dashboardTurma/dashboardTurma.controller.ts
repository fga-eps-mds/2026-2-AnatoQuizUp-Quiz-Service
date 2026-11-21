import type { Request, Response } from 'express';
import { ErroAplicacao } from '@/shared/errors/erro-aplicacao';
import type { TurmaDashboardService } from './dashboardTurma.service';

// Controller HTTP do dashboard da turma (visao do professor): metricas macro e por aluno/lista.
// Aqui os erros sao tratados localmente (status 401/500) em vez de delegar ao middleware.
export class TurmaDashboardController {
  constructor(private readonly service: TurmaDashboardService) {}

  listarHistoricoAluno = async (req: Request, res: Response) => {
    const professorId = req.usuario?.id;
    if (!professorId) return res.status(401).json({ error: 'Sessão inválida.' });

    const { inicio, fim } = req.query;
    if (typeof inicio !== 'string' || typeof fim !== 'string') {
      return res.status(400).json({ error: 'Informe o início e o fim do período.' });
    }

    const dataInicio = new Date(inicio);
    const dataFim = new Date(fim);
    if (!Number.isFinite(dataInicio.getTime()) || !Number.isFinite(dataFim.getTime()) || dataInicio > dataFim) {
      return res.status(400).json({ error: 'Período inválido.' });
    }

    try {
      const listas = await this.service.getHistoricoListasAluno(
        req.params.id as string,
        req.params.alunoId as string,
        professorId,
        dataInicio,
        dataFim,
      );
      if (!listas) return res.status(404).json({ error: 'Aluno não encontrado na turma.' });
      return res.status(200).json({ listas });
    } catch (error) {
      console.error('Erro ao consultar histórico do aluno:', error);
      return res.status(500).json({ error: 'Erro ao buscar histórico do aluno.' });
    }
  };

  /**
   * GET visao macro da turma: indicadores gerais de desempenho.
   *
   * @param req Requisicao com o id da turma na rota (professor vem do token).
   * @param res Resposta HTTP (200 com os dados macro; 401/500 em erro).
   */
  listarMacro = async (req: Request, res: Response) => {
    try {
      const turmaId = req.params.id as string;

      const professorId = req.usuario?.id;

      // Exige professor autenticado para acessar dados da turma.
      if (!professorId) {
        return res.status(401).json({ error: 'Usuário não autenticado ou sessão expirada.' });
      }

      const dashboardData = await this.service.getMacroDashboard(turmaId, professorId);

      return res.status(200).json(dashboardData);
    } catch (error) {
      console.error('Erro no TurmaDashboardController:', error);
      return res.status(500).json({ error: 'Erro ao buscar dados do dashboard da turma.' });
    }
  };

  /**
   * GET desempenho individual de cada aluno da turma.
   *
   * @param req Requisicao com o id da turma na rota.
   * @param res Resposta HTTP (200 com o desempenho individual; 401/500 em erro).
   */
  listarIndividual = async (req: Request, res: Response) => {
    try {
      const turmaId = req.params.id as string;

      if (!req.usuario?.id) {
        return res.status(401).json({ error: 'Usuário não autenticado ou sessão expirada.' });
      }

      const data = await this.service.getDesempenhoIndividual(turmaId);

      return res.status(200).json(data);
    } catch (error) {
      console.error('Erro no TurmaDashboardController [individual]:', error);
      return res.status(500).json({ error: 'Erro ao buscar desempenho individual.' });
    }
  };

  /**
   * GET desempenho da turma agregado por lista de questoes.
   *
   * @param req Requisicao com o id da turma na rota (professor vem do token).
   * @param res Resposta HTTP (200 com o desempenho por lista; 401/403/404/500 em erro).
   */
  listarPorListas = async (req: Request, res: Response) => {
    try {
      const turmaId = req.params.id as string;
      const professorId = req.usuario?.id;
      const papel = req.usuario?.papel;

      if (!professorId) {
        return res.status(401).json({ error: 'Usuário não autenticado ou sessão expirada.' });
      }

      const data = await this.service.getDesempenhoPorListas(turmaId, professorId, papel);

      return res.status(200).json(data);
    } catch (error: unknown) {
      if (error instanceof ErroAplicacao) {
        return res.status(error.codigoStatus).json({ error: error.message });
      }

      console.error('Erro no TurmaDashboardController [listas]:', error);
      return res.status(500).json({ error: 'Erro ao buscar desempenho por lista.' });
    }
  };

  /**
   * GET desempenho de cada aluno em uma lista especifica da turma.
   *
   * @param req Requisicao com o id da turma e o listaId na rota.
   * @param res Resposta HTTP (200 com o desempenho; 404 se a lista nao pertence a turma).
   */
  listarDesempenhoListaIndividual = async (req: Request, res: Response) => {
    try {
      const turmaId = req.params.id as string;
      const listaTurmaId = req.params.listaId as string;
      const professorId = req.usuario?.id;

      if (!professorId) {
        return res.status(401).json({ error: 'Usuário não autenticado ou sessão expirada.' });
      }

      const data = await this.service.getDesempenhoAlunosNaLista(turmaId, listaTurmaId);

      return res.status(200).json(data);
    } catch (error: unknown) {
      console.error('Erro no TurmaDashboardController [lista individual]:', error);

      // Verificamos se é uma instância de Error antes de acessar a propriedade .message
      if (error instanceof Error && error.message === 'Lista não encontrada ou não pertence a esta turma.') {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro ao buscar desempenho dos alunos na lista.' });
    }
  };


  /**
   * GET top erros dos alunos em uma lista especifica.
   *
   * @param req Requisicao com o id da turma e o listaId na rota.
   * @param res Resposta HTTP (200 com o ranking de erros; 404 se a lista nao pertence a turma).
   */
  getTopErros = async (req: Request, res: Response) => {
    try {
      const turmaId = req.params.id as string;
      const listaTurmaId = req.params.listaId as string;
      const professorId = req.usuario?.id;

      // Validação de segurança: exige professor autenticado.
      if (!professorId) {
        return res.status(401).json({ error: 'Usuário não autenticado ou sessão expirada.' });
      }

      const resultado = await this.service.getTopQuestoesComMaisErros(turmaId, listaTurmaId, professorId);

      return res.status(200).json(resultado);
    } catch (error: unknown) {
      console.error('Erro no TurmaDashboardController [top-erros]:', error);

      // Tratamento de erro específico conforme definido no Service
      if (error instanceof Error && error.message === 'Lista não encontrada ou não pertence a esta turma.') {
        return res.status(404).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Erro interno ao buscar as questões com mais erros.' });
    }
  };

  /** GET evolucao do aluno por tema entre as listas publicadas da turma. */
  listarEvolucaoTemas = async (req: Request, res: Response) => {
    try {
      const professorId = req.usuario?.id;
      if (!professorId) {
        return res.status(401).json({ error: 'Usuário não autenticado ou sessão expirada.' });
      }

      const inicio = typeof req.query.inicio === 'string' ? new Date(req.query.inicio) : undefined;
      const fim = typeof req.query.fim === 'string' ? new Date(req.query.fim) : undefined;
      const data = await this.service.getEvolucaoTemasAluno(
        req.params.id as string,
        req.params.alunoId as string,
        professorId,
        inicio,
        fim,
      );

      return res.status(200).json(data);
    } catch (error) {
      if (error instanceof ErroAplicacao) {
        return res.status(error.codigoStatus).json({ error: error.message });
      }

      console.error('Erro no TurmaDashboardController [evolucao por tema]:', error);
      return res.status(500).json({ error: 'Erro ao buscar evolução por tema.' });
    }
  };
}

