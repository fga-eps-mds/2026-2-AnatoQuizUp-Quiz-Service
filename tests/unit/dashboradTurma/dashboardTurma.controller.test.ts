import type { Request, Response } from 'express';
import { TurmaDashboardController } from '../../../src/modules/dashboardTurma/dashboardTurma.controller';
import { TurmaDashboardService } from '../../../src/modules/dashboardTurma/dashboardTurma.service';
import type { TurmaDashboardRepository } from '../../../src/modules/dashboardTurma/dashboardTurma.repository';
import { ErroAplicacao } from '../../../src/shared/errors/erro-aplicacao';

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
        usuario: { id: 'prof-123' },
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

      expect(serviceMock.getDesempenhoPorListas).toHaveBeenCalledWith('turma-123', 'prof-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockData);
    });

    it('deve retornar 401 se o professor nao estiver autenticado', async () => {
      const req = { params: { id: 'turma-123' } } as unknown as Request;
      const res = createMockResponse();

      await controller.listarPorListas(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'UsuÃ¡rio nÃ£o autenticado ou sessÃ£o expirada.' });
    });

    it('deve retornar 500 se o service lancar um erro', async () => {
      const req = {
        params: { id: 'turma-123' },
        usuario: { id: 'prof-123' },
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

  describe('detalharEntrega', () => {
    it('deve retornar o detalhe da entrega para o professor autenticado', async () => {
      const req = {
        params: {
          id: 'cmpsx9a2f00064hx26j7kukdo',
          listaId: 'cmq101jjt002w4hitmlzi7d3g',
          alunoId: 'cmq101jjt002w4hitmlzi7d3h',
        },
        usuario: { id: 'prof-123' },
      } as unknown as Request;
      const res = createMockResponse();
      const mockData = {
        lista: { id: 'cmq101jjt002w4hitmlzi7d3g', nome: 'Lista de neuro', publicadaEm: '2026-11-18T10:00:00.000Z' },
        alunoId: 'cmq101jjt002w4hitmlzi7d3h',
        resumo: { totalQuestoes: 1, acertos: 1, erros: 0, naoRespondidas: 0, taxaAcerto: 100 },
        questoes: [],
      };

      serviceMock.getDetalheEntrega.mockResolvedValue(mockData);

      await controller.detalharEntrega(req, res);

      expect(serviceMock.getDetalheEntrega).toHaveBeenCalledWith(
        'cmpsx9a2f00064hx26j7kukdo',
        'cmq101jjt002w4hitmlzi7d3g',
        'cmq101jjt002w4hitmlzi7d3h',
        'prof-123',
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockData);
    });

    it('deve retornar 401 sem professor autenticado', async () => {
      const req = {
        params: { id: 'turma-1', listaId: 'lista-1', alunoId: 'aluno-1' },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.detalharEntrega(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não autenticado ou sessão expirada.' });
    });

    it('deve retornar o erro de autorização ou entrega inexistente', async () => {
      const req = {
        params: { id: 'turma-1', listaId: 'lista-1', alunoId: 'aluno-1' },
        usuario: { id: 'prof-123' },
      } as unknown as Request;
      const res = createMockResponse();

      serviceMock.getDetalheEntrega.mockRejectedValue(new ErroAplicacao({
        mensagem: 'Entrega não encontrada ou sem permissão de acesso.',
        codigo: 'NAO_ENCONTRADO',
        codigoStatus: 404,
      }));

      await controller.detalharEntrega(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Entrega não encontrada ou sem permissão de acesso.' });
    });
  });
});
