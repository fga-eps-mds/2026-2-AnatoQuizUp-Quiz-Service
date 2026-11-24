import type { Request, Response } from 'express';
import { CodigoDeErro } from '../../../src/shared/errors/codigos-de-erro';
import { ErroAplicacao } from '../../../src/shared/errors/erro-aplicacao';
import { TurmaDashboardController } from '../../../src/modules/dashboardTurma/dashboardTurma.controller';
import { TurmaDashboardService } from '../../../src/modules/dashboardTurma/dashboardTurma.service';
import type { TurmaDashboardRepository } from '../../../src/modules/dashboardTurma/dashboardTurma.repository';

jest.mock('../../../src/modules/dashboardTurma/dashboardTurma.service');

describe('TurmaDashboardController', () => {
  let controller: TurmaDashboardController;
  let serviceMock: jest.Mocked<TurmaDashboardService>;

  beforeEach(() => {
    const repoMock = {} as TurmaDashboardRepository;
    serviceMock = new TurmaDashboardService(repoMock) as jest.Mocked<TurmaDashboardService>;
    controller = new TurmaDashboardController(serviceMock);
  });

  const createMockResponse = (): Response => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  describe('histórico individual', () => {
    const inicio = '2026-07-01T00:00:00Z';
    const fim = '2026-12-31T23:59:59Z';
    const requisicao = (query: Record<string, string> = { inicio, fim }) =>
      ({ params: { id: 'turma-1', alunoId: 'aluno-1' }, usuario: { id: 'prof-1' }, query }) as unknown as Request;

    it('retorna as listas do período consultado', async () => {
      const listas = [{ listaTurmaId: 'lista-1', nomeLista: 'Anatomia', publicadaEm: inicio, status: 'ENTREGUE' as const }];
      serviceMock.getHistoricoListasAluno.mockResolvedValue(listas);
      const res = createMockResponse();
      await controller.listarHistoricoAluno(requisicao(), res);
      expect(serviceMock.getHistoricoListasAluno).toHaveBeenCalledWith('turma-1', 'aluno-1', 'prof-1', new Date(inicio), new Date(fim));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ listas });
    });

    it('retorna 200 com lista vazia em um período sem publicações', async () => {
      serviceMock.getHistoricoListasAluno.mockResolvedValue([]);
      const res = createMockResponse();
      await controller.listarHistoricoAluno(requisicao(), res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ listas: [] });
    });

    it.each([{}, { inicio }, { fim }, { inicio: 'inválido', fim }, { inicio, fim: 'inválido' }, { inicio: fim, fim: inicio }])(
      'recusa período inválido %#',
      async (query) => {
        const res = createMockResponse();
        await controller.listarHistoricoAluno(requisicao(query as Record<string, string>), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(serviceMock.getHistoricoListasAluno).not.toHaveBeenCalled();
      },
    );

    it('recusa uma sessão ausente', async () => {
      const res = createMockResponse();
      await controller.listarHistoricoAluno({ query: { inicio, fim } } as unknown as Request, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(serviceMock.getHistoricoListasAluno).not.toHaveBeenCalled();
    });

    it('recusa uma consulta a outra turma sem expor listas', async () => {
      serviceMock.getHistoricoListasAluno.mockResolvedValue(null);
      const res = createMockResponse();
      await controller.listarHistoricoAluno(requisicao(), res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Aluno não encontrado na turma.' });
    });

    it('retorna um erro genérico se a consulta falhar', async () => {
      serviceMock.getHistoricoListasAluno.mockRejectedValue(new Error('falha interna'));
      const res = createMockResponse();
      await controller.listarHistoricoAluno(requisicao(), res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao buscar histórico do aluno.' });
    });
  });

  it('deve retornar 200 e os dados do dashboard com sucesso', async () => {
    const req = {
      params: { id: 'turma-123' },
      usuario: { id: 'prof-123' }
    } as unknown as Request;
    
    const res = createMockResponse();

    serviceMock.getMacroDashboard.mockResolvedValue({
      totalAlunos: 10,
      totalQuestoesRespondidas: 5,
      taxaMediaAcertos: 50,
      desempenhoPorTema: []
    });

    await controller.listarMacro(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      totalAlunos: 10,
      totalQuestoesRespondidas: 5,
      taxaMediaAcertos: 50,
      desempenhoPorTema: []
    });
  });

  it('deve retornar 401 se o professor não estiver autenticado', async () => {
    const req = {
      params: { id: 'turma-123' }
    } as unknown as Request;
    
    const res = createMockResponse();

    await controller.listarMacro(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não autenticado ou sessão expirada.' });
  });

  it('deve retornar 500 se o service lançar um erro', async () => {
    const req = {
      params: { id: 'turma-123' },
      usuario: { id: 'prof-123' }
    } as unknown as Request;

    const res = createMockResponse();

    serviceMock.getMacroDashboard.mockRejectedValue(new Error('Erro interno'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await controller.listarMacro(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao buscar dados do dashboard da turma.' });

    consoleSpy.mockRestore();
  });

  describe('listarIndividual', () => {
    it('deve retornar 200 e os dados de desempenho individual', async () => {
      const req = {
        params: { id: 'turma-123' },
        usuario: { id: 'prof-123' },
      } as unknown as Request;

      const res = createMockResponse();

      const mockData = {
        alunos: [
          {
            alunoId: 'aluno-1',
            totalRespondidas: 10,
            totalAcertos: 8,
            taxaAcerto: 80,
            ultimaAtividade: '2026-05-30T10:00:00.000Z',
            desempenhoPorTema: [],
          },
        ],
      };

      serviceMock.getDesempenhoIndividual.mockResolvedValue(mockData);

      await controller.listarIndividual(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockData);
    });

    it('deve retornar 401 se o professor não estiver autenticado', async () => {
      const req = { params: { id: 'turma-123' } } as unknown as Request;
      const res = createMockResponse();

      await controller.listarIndividual(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não autenticado ou sessão expirada.' });
    });

    it('deve retornar 500 se o service lançar um erro', async () => {
      const req = {
        params: { id: 'turma-123' },
        usuario: { id: 'prof-123' },
      } as unknown as Request;

      const res = createMockResponse();

      serviceMock.getDesempenhoIndividual.mockRejectedValue(new Error('Erro interno'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await controller.listarIndividual(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao buscar desempenho individual.' });

      consoleSpy.mockRestore();
    });
  });

  describe('listarPorListas', () => {
    it('deve retornar 200 e os dados de desempenho por listas', async () => {
      const req = {
        params: { id: 'turma-123' },
        usuario: { id: 'prof-123', papel: 'PROFESSOR' },
      } as unknown as Request;

      const res = createMockResponse();

      const mockData = [
        {
          listaTurmaId: 'lista-turma-1',
          nomeLista: 'Simulado de Anatomia',
          totalAlunos: 10,
          totalSubmeteram: 6,
          totalPendentes: 4,
          taxaMediaAcerto: 73.4,
          prazo: '2026-06-10T23:59:00.000Z',
        },
      ];

      serviceMock.getDesempenhoPorListas.mockResolvedValue(mockData);

      await controller.listarPorListas(req, res);

      expect(serviceMock.getDesempenhoPorListas).toHaveBeenCalledWith('turma-123', 'prof-123', 'PROFESSOR');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockData);
    });

    it('deve retornar 401 se o professor nao estiver autenticado', async () => {
      const req = { params: { id: 'turma-123' } } as unknown as Request;
      const res = createMockResponse();

      await controller.listarPorListas(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não autenticado ou sessão expirada.' });
    });

    it('deve retornar 403 se o professor nao tiver permissao para a turma', async () => {
      const req = {
        params: { id: 'turma-123' },
        usuario: { id: 'prof-intruso', papel: 'PROFESSOR' },
      } as unknown as Request;
      const res = createMockResponse();

      serviceMock.getDesempenhoPorListas.mockRejectedValue(
        new ErroAplicacao({
          codigo: CodigoDeErro.PROIBIDO,
          mensagem: 'Você não tem permissão para acessar esta turma.',
          codigoStatus: 403,
        }),
      );

      await controller.listarPorListas(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Você não tem permissão para acessar esta turma.',
      });
    });

    it('deve retornar 404 se a turma nao for encontrada', async () => {
      const req = {
        params: { id: 'turma-inexistente' },
        usuario: { id: 'prof-123', papel: 'PROFESSOR' },
      } as unknown as Request;
      const res = createMockResponse();

      serviceMock.getDesempenhoPorListas.mockRejectedValue(
        new ErroAplicacao({
          codigo: CodigoDeErro.NAO_ENCONTRADO,
          mensagem: 'Turma não encontrada.',
          codigoStatus: 404,
        }),
      );

      await controller.listarPorListas(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Turma não encontrada.' });
    });

    it('deve retornar 500 se o service lancar um erro', async () => {
      const req = {
        params: { id: 'turma-123' },
        usuario: { id: 'prof-123', papel: 'PROFESSOR' },
      } as unknown as Request;

      const res = createMockResponse();

      serviceMock.getDesempenhoPorListas.mockRejectedValue(new Error('Erro interno'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await controller.listarPorListas(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao buscar desempenho por lista.' });

      consoleSpy.mockRestore();
    });
  });

  describe('listarDesempenhoListaIndividual', () => {
    it('deve retornar 200 e os dados detalhados de desempenho dos alunos na lista', async () => {
      const req = {
        params: { id: 'cmpsx9a2f00064hx26j7kukdo', listaId: 'cmq101jjt002w4hitmlzi7d3g' },
        usuario: { id: 'prof-123' },
      } as unknown as Request;

      const res = createMockResponse();

      const mockData = {
        listaTurmaId: 'cmq101jjt002w4hitmlzi7d3g',
        nomeLista: 'Simulado de Neuroanatomia',
        totalQuestoes: 10,
        desempenhoAlunos: [],
      };

      serviceMock.getDesempenhoAlunosNaLista.mockResolvedValue(mockData);

      await controller.listarDesempenhoListaIndividual(req, res);

      expect(serviceMock.getDesempenhoAlunosNaLista).toHaveBeenCalledWith(
        'cmpsx9a2f00064hx26j7kukdo',
        'cmq101jjt002w4hitmlzi7d3g'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockData);
    });

    it('deve retornar 404 se o service lançar um erro de lista não encontrada', async () => {
      const req = {
        params: { id: 'cmpsx9a2f00064hx26j7kukdo', listaId: 'cmq101jjt002w4hitmlzi7d3g' },
        usuario: { id: 'prof-123' },
      } as unknown as Request;

      const res = createMockResponse();

      serviceMock.getDesempenhoAlunosNaLista.mockRejectedValue(
        new Error('Lista não encontrada ou não pertence a esta turma.')
      );

      await controller.listarDesempenhoListaIndividual(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Lista não encontrada ou não pertence a esta turma.',
      });
    });
  });
});
