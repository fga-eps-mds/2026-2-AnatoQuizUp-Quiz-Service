import { TurmaDashboardService } from '../../../src/modules/dashboardTurma/dashboardTurma.service';
import { TurmaDashboardRepository } from '../../../src/modules/dashboardTurma/dashboardTurma.repository';

jest.mock('../../../src/modules/dashboardTurma/dashboardTurma.repository');

describe('TurmaDashboardService', () => {
  let service: TurmaDashboardService;
  let repoMock: jest.Mocked<TurmaDashboardRepository>;

  beforeEach(() => {
    repoMock = new TurmaDashboardRepository() as jest.Mocked<TurmaDashboardRepository>;
    service = new TurmaDashboardService(repoMock);
  });

  it('deve retornar totais zerados quando a turma não tiver alunos', async () => {
    repoMock.findAlunosByTurmaId.mockResolvedValue([]);

    const result = await service.getMacroDashboard('turma-123', 'prof-123');

    expect(result).toEqual({
      totalAlunos: 0,
      totalQuestoesRespondidas: 0,
      taxaMediaAcertos: 0,
      desempenhoPorTema: []
    });
  });

  it('deve retornar totais de questoes zerados quando alunos nao tiverem resolucoes', async () => {
    repoMock.findAlunosByTurmaId.mockResolvedValue(['aluno-1', 'aluno-2']);
    repoMock.findResolucoesByAlunos.mockResolvedValue([]);

    const result = await service.getMacroDashboard('turma-123', 'prof-123');

    expect(result).toEqual({
      totalAlunos: 2,
      totalQuestoesRespondidas: 0,
      taxaMediaAcertos: 0,
      desempenhoPorTema: []
    });
  });

  describe('getDesempenhoIndividual', () => {
    it('deve retornar lista vazia quando a turma não tiver alunos', async () => {
      repoMock.findAlunosByTurmaId.mockResolvedValue([]);

      const result = await service.getDesempenhoIndividual('turma-123');

      expect(result).toEqual({ alunos: [] });
    });

    it('deve retornar alunos com stats zeradas quando não há resoluções', async () => {
      repoMock.findAlunosByTurmaId.mockResolvedValue(['aluno-1', 'aluno-2']);
      repoMock.findResolucoesByAlunos.mockResolvedValue([]);

      const result = await service.getDesempenhoIndividual('turma-123');

      expect(result.alunos).toHaveLength(2);
      expect(result.alunos[0].totalRespondidas).toBe(0);
      expect(result.alunos[0].taxaAcerto).toBe(0);
      expect(result.alunos[0].ultimaAtividade).toBeNull();
      expect(result.alunos[0].desempenhoPorTema).toEqual([]);
    });

    it('deve calcular corretamente stats por aluno, ordenar por taxa de acerto e incluir desempenho por tema', async () => {
      repoMock.findAlunosByTurmaId.mockResolvedValue(['aluno-1', 'aluno-2']);

      const resolucoesMock = [
        {
          usuarioId: 'aluno-1',
          respostaMarcada: 'A',
          questao: { respostaCorreta: 'A', tema: { nome: 'Tórax' } },
          criadoEm: new Date('2026-05-30T10:00:00.000Z'),
        },
        {
          usuarioId: 'aluno-1',
          respostaMarcada: 'B',
          questao: { respostaCorreta: 'A', tema: { nome: 'Tórax' } },
          criadoEm: new Date('2026-05-28T10:00:00.000Z'),
        },
        {
          usuarioId: 'aluno-2',
          respostaMarcada: 'C',
          questao: { respostaCorreta: 'C', tema: { nome: 'Abdome' } },
          criadoEm: new Date('2026-05-25T10:00:00.000Z'),
        },
      ] as unknown as Awaited<ReturnType<TurmaDashboardRepository['findResolucoesByAlunos']>>;

      repoMock.findResolucoesByAlunos.mockResolvedValue(resolucoesMock);

      const result = await service.getDesempenhoIndividual('turma-123');

      expect(result.alunos).toHaveLength(2);

      const [primeiro, segundo] = result.alunos;

      expect(primeiro.alunoId).toBe('aluno-2');
      expect(primeiro.totalRespondidas).toBe(1);
      expect(primeiro.totalAcertos).toBe(1);
      expect(primeiro.taxaAcerto).toBe(100);
      expect(primeiro.ultimaAtividade).toBe('2026-05-25T10:00:00.000Z');
      expect(primeiro.desempenhoPorTema).toEqual([
        { nome: 'Abdome', totalRespondidas: 1, taxaAcerto: 100, status: 'Tranquilo' },
      ]);

      expect(segundo.alunoId).toBe('aluno-1');
      expect(segundo.totalRespondidas).toBe(2);
      expect(segundo.totalAcertos).toBe(1);
      expect(segundo.taxaAcerto).toBe(50);
      expect(segundo.ultimaAtividade).toBe('2026-05-30T10:00:00.000Z');
      expect(segundo.desempenhoPorTema).toEqual([
        { nome: 'Tórax', totalRespondidas: 2, taxaAcerto: 50, status: 'Atenção' },
      ]);
    });

    it('deve usar a data mais recente como ultimaAtividade do aluno', async () => {
      repoMock.findAlunosByTurmaId.mockResolvedValue(['aluno-1']);

      const resolucoesMock = [
        {
          usuarioId: 'aluno-1',
          respostaMarcada: 'A',
          questao: { respostaCorreta: 'A', tema: { nome: 'Tórax' } },
          criadoEm: new Date('2026-05-20T08:00:00.000Z'),
        },
        {
          usuarioId: 'aluno-1',
          respostaMarcada: 'B',
          questao: { respostaCorreta: 'B', tema: { nome: 'Tórax' } },
          criadoEm: new Date('2026-05-31T14:00:00.000Z'),
        },
      ] as unknown as Awaited<ReturnType<TurmaDashboardRepository['findResolucoesByAlunos']>>;

      repoMock.findResolucoesByAlunos.mockResolvedValue(resolucoesMock);

      const result = await service.getDesempenhoIndividual('turma-123');

      expect(result.alunos[0].ultimaAtividade).toBe('2026-05-31T14:00:00.000Z');
    });
  });

  it('deve calcular corretamente os totais e as taxas de acerto por tema e ordenar decrescente', async () => {
    repoMock.findAlunosByTurmaId.mockResolvedValue(['aluno-1', 'aluno-2']);
    
    const resolucoesMock = [
      { respostaMarcada: 'A', questao: { respostaCorreta: 'A', tema: { nome: 'Osso' } } },
      { respostaMarcada: 'B', questao: { respostaCorreta: 'A', tema: { nome: 'Osso' } } },
      { respostaMarcada: 'C', questao: { respostaCorreta: 'C', tema: { nome: 'Músculo' } } },
      { respostaMarcada: 'D', questao: { respostaCorreta: 'E', tema: { nome: 'Nervo' } } }
    ] as unknown as Awaited<ReturnType<TurmaDashboardRepository['findResolucoesByAlunos']>>;

    repoMock.findResolucoesByAlunos.mockResolvedValue(resolucoesMock);

    const result = await service.getMacroDashboard('turma-123', 'prof-123');

    expect(result.totalAlunos).toBe(2);
    expect(result.totalQuestoesRespondidas).toBe(4);
    expect(result.taxaMediaAcertos).toBe(50); 
    
    expect(result.desempenhoPorTema).toEqual([
      { nome: 'Músculo', totalRespondidas: 1, taxaAcerto: 100, status: 'Tranquilo' },
      { nome: 'Osso', totalRespondidas: 2, taxaAcerto: 50, status: 'Atenção' },
      { nome: 'Nervo', totalRespondidas: 1, taxaAcerto: 0, status: 'Crítico' }
    ]);
  });

  describe('getDesempenhoPorListas', () => {
    it('deve retornar lista vazia quando a turma nao tiver listas publicadas', async () => {
      repoMock.findAlunosByTurmaId.mockResolvedValue(['aluno-1', 'aluno-2']);
      repoMock.findDesempenhoPorListasDaTurma.mockResolvedValue([]);

      const result = await service.getDesempenhoPorListas('turma-123', 'prof-123');

      expect(repoMock.findAlunosByTurmaId).toHaveBeenCalledWith('turma-123');
      expect(repoMock.findDesempenhoPorListasDaTurma).toHaveBeenCalledWith('turma-123');
      expect(result).toEqual([]);
    });

    it('deve calcular submissoes, pendentes e taxa media por lista', async () => {
      repoMock.findAlunosByTurmaId.mockResolvedValue(['aluno-1', 'aluno-2', 'aluno-3']);
      repoMock.findDesempenhoPorListasDaTurma.mockResolvedValue([
        {
          id: 'lista-turma-1',
          prazo: new Date('2026-06-10T23:59:00.000Z'),
          listaQuestao: { nome: 'Simulado de Anatomia' },
          resolucoes: [
            {
              respostas: [
                { respostaMarcada: 'A', questao: { respostaCorreta: 'A' } },
                { respostaMarcada: 'B', questao: { respostaCorreta: 'A' } },
              ],
            },
            {
              respostas: [
                { respostaMarcada: 'C', questao: { respostaCorreta: 'C' } },
              ],
            },
          ],
        },
        {
          id: 'lista-turma-2',
          prazo: null,
          listaQuestao: { nome: 'Lista sem respostas' },
          resolucoes: [],
        },
      ] as unknown as Awaited<
        ReturnType<TurmaDashboardRepository['findDesempenhoPorListasDaTurma']>
      >);

      const result = await service.getDesempenhoPorListas('turma-123', 'prof-123');

      expect(result).toEqual([
        {
          listaTurmaId: 'lista-turma-1',
          nomeLista: 'Simulado de Anatomia',
          totalAlunos: 3,
          totalSubmeteram: 2,
          totalPendentes: 1,
          taxaMediaAcerto: 66.7,
          prazo: '2026-06-10T23:59:00.000Z',
        },
        {
          listaTurmaId: 'lista-turma-2',
          nomeLista: 'Lista sem respostas',
          totalAlunos: 3,
          totalSubmeteram: 0,
          totalPendentes: 3,
          taxaMediaAcerto: 0,
          prazo: null,
        },
      ]);
    });

    it('deve evitar pendentes negativos se houver submissoes acima do total de alunos', async () => {
      repoMock.findAlunosByTurmaId.mockResolvedValue(['aluno-1']);
      repoMock.findDesempenhoPorListasDaTurma.mockResolvedValue([
        {
          id: 'lista-turma-1',
          prazo: null,
          listaQuestao: { nome: 'Lista inconsistente' },
          resolucoes: [
            { respostas: [] },
            { respostas: [] },
          ],
        },
      ] as unknown as Awaited<
        ReturnType<TurmaDashboardRepository['findDesempenhoPorListasDaTurma']>
      >);

      const result = await service.getDesempenhoPorListas('turma-123', 'prof-123');

      expect(result[0].totalSubmeteram).toBe(2);
      expect(result[0].totalPendentes).toBe(0);
    });
  });

  describe('getDesempenhoAlunosNaLista', () => {
    it('deve mapear corretamente os alunos que responderam e os que estão pendentes sem usar any', async () => {
      repoMock.findAlunosByTurmaId.mockResolvedValue(['aluno-1', 'aluno-2']);

      const mockListaComResolucoes = {
        id: 'lista-turma-1',
        turmaId: 'turma-123',
        listaQuestao: {
          nome: 'Simulado de Neuro',
          itens: [{}, {}], // Duas questões no total
        },
        resolucoes: [
          {
            alunoId: 'aluno-1',
            status: 'SUBMETIDA' as const,
            submissaoEm: new Date('2026-06-14T12:00:00.000Z'),
            respostas: [
              { respostaMarcada: 'A', questao: { respostaCorreta: 'A' } }, // Acertou
              { respostaMarcada: 'B', questao: { respostaCorreta: 'C' } }, // Errou
            ],
          },
        ],
      } as unknown as Awaited<ReturnType<TurmaDashboardRepository['findListaTurmaById']>>;

      repoMock.findListaTurmaById.mockResolvedValue(mockListaComResolucoes);

      const result = await service.getDesempenhoAlunosNaLista('turma-123', 'lista-turma-1');

      expect(result.nomeLista).toBe('Simulado de Neuro');
      expect(result.totalQuestoes).toBe(2);
      expect(result.desempenhoAlunos).toHaveLength(2);

      // Verificação do Aluno 1 (Submeteu com 50% de acertos)
      const aluno1 = result.desempenhoAlunos.find((a) => a.alunoId === 'aluno-1');
      expect(aluno1).toBeDefined();
      expect(aluno1?.status).toBe('SUBMETIDA');
      expect(aluno1?.totalAcertos).toBe(1);
      expect(aluno1?.taxaAcerto).toBe(50);

      // Verificação do Aluno 2 (Não respondeu nada)
      const aluno2 = result.desempenhoAlunos.find((a) => a.alunoId === 'aluno-2');
      expect(aluno2).toBeDefined();
      expect(aluno2?.status).toBe('NAO_RESPONDEU');
      expect(aluno2?.totalAcertos).toBe(0);
      expect(aluno2?.taxaAcerto).toBe(0);
    });

    it('deve disparar uma exceção de erro caso a lista não pertença à turma consultada', async () => {
      repoMock.findAlunosByTurmaId.mockResolvedValue(['aluno-1']);
      repoMock.findListaTurmaById.mockResolvedValue(null);

      await expect(
        service.getDesempenhoAlunosNaLista('turma-123', 'lista-errada')
      ).rejects.toThrow('Lista não encontrada ou não pertence a esta turma.');
    });
  });

  describe('getTopQuestoesComMaisErros', () => {
    it('retorna no máximo 3 questões, ordenadas por erros e desempate por número', async () => {
      const mockLista = {
        id: 'lista-turma-1',
        turma: { professorId: 'prof-123' },
        listaQuestao: {
          nome: 'Lista de Anatomia',
          itens: [
            {
              questaoId: 'q1',
              ordem: 3,
              questao: { enunciado: 'Questão 3', respostaCorreta: 'A', tema: { nome: 'Tórax' } },
            },
            {
              questaoId: 'q2',
              ordem: 1,
              questao: { enunciado: 'Questão 1', respostaCorreta: 'B', tema: { nome: 'Cabeça' } },
            },
            {
              questaoId: 'q3',
              ordem: 2,
              questao: { enunciado: 'Questão 2', respostaCorreta: 'C', tema: { nome: 'Abdome' } },
            },
            {
              questaoId: 'q4',
              ordem: 4,
              questao: { enunciado: 'Questão 4', respostaCorreta: 'D', tema: { nome: 'Pelve' } },
            },
            {
              questaoId: 'q5',
              ordem: 5,
              questao: { enunciado: 'Questão 5', respostaCorreta: 'E', tema: { nome: 'Costas' } },
            },
          ],
        },
        resolucoes: [
          {
            respostas: [
              { questaoId: 'q1', respostaMarcada: 'B' },
              { questaoId: 'q2', respostaMarcada: 'A' },
              { questaoId: 'q3', respostaMarcada: 'C' },
              { questaoId: 'q4', respostaMarcada: 'D' },
              { questaoId: 'q5', respostaMarcada: 'D' },
            ],
          },
          {
            respostas: [
              { questaoId: 'q1', respostaMarcada: 'A' },
              { questaoId: 'q2', respostaMarcada: 'A' },
              { questaoId: 'q3', respostaMarcada: 'C' },
              { questaoId: 'q4', respostaMarcada: 'D' },
              { questaoId: 'q5', respostaMarcada: 'D' },
              { questaoId: 'fora-da-lista', respostaMarcada: 'A' },
            ],
          },
        ],
      } as unknown as Awaited<ReturnType<TurmaDashboardRepository['findRespostasParaRankingErros']>>;

      repoMock.findRespostasParaRankingErros.mockResolvedValue(mockLista);

      const result = await service.getTopQuestoesComMaisErros('turma-123', 'lista-turma-1', 'prof-123');

      expect(result.questoes).toHaveLength(3);
      expect(result.questoes.map((questao) => questao.questaoId)).toEqual(['q2', 'q5', 'q1']);
      expect(result.questoes[0]).toMatchObject({
        questaoId: 'q2',
        numeroQuestao: 1,
        totalErros: 2,
        totalRespostas: 2,
        percentualErro: 100,
      });
      expect(result.questoes[1]).toMatchObject({
        questaoId: 'q5',
        numeroQuestao: 5,
        totalErros: 2,
        totalRespostas: 2,
        percentualErro: 100,
      });
      expect(result.questoes[2]).toMatchObject({
        questaoId: 'q1',
        numeroQuestao: 3,
        totalErros: 1,
        totalRespostas: 2,
        percentualErro: 50,
      });
    });

    it('retorna lista vazia quando não há erros e ignora questões sem resposta', async () => {
      const mockLista = {
        id: 'lista-turma-1',
        turma: { professorId: 'prof-123' },
        listaQuestao: {
          nome: 'Lista sem erros',
          itens: [
            {
              questaoId: 'q1',
              ordem: 1,
              questao: { enunciado: 'Questão 1', respostaCorreta: 'A', tema: { nome: 'Tórax' } },
            },
            {
              questaoId: 'q2',
              ordem: 2,
              questao: { enunciado: 'Questão 2', respostaCorreta: 'B', tema: { nome: 'Abdome' } },
            },
          ],
        },
        resolucoes: [
          {
            respostas: [
              { questaoId: 'q1', respostaMarcada: 'A' },
            ],
          },
        ],
      } as unknown as Awaited<ReturnType<TurmaDashboardRepository['findRespostasParaRankingErros']>>;

      repoMock.findRespostasParaRankingErros.mockResolvedValue(mockLista);

      const result = await service.getTopQuestoesComMaisErros('turma-123', 'lista-turma-1', 'prof-123');

      expect(result.questoes).toEqual([]);
    });

    it('retorna erro quando a lista não pertence à turma', async () => {
      repoMock.findRespostasParaRankingErros.mockResolvedValue(null);

      await expect(
        service.getTopQuestoesComMaisErros('turma-123', 'lista-errada', 'prof-123')
      ).rejects.toThrow('Lista não encontrada ou não pertence a esta turma.');
    });

    it('retorna erro quando o professor não pertence à turma', async () => {
      repoMock.findRespostasParaRankingErros.mockResolvedValue({
        id: 'lista-turma-1',
        turma: { professorId: 'prof-outro' },
        listaQuestao: { nome: 'Lista privada', itens: [] },
        resolucoes: [],
      } as unknown as Awaited<ReturnType<TurmaDashboardRepository['findRespostasParaRankingErros']>>);

      await expect(
        service.getTopQuestoesComMaisErros('turma-123', 'lista-turma-1', 'prof-123')
      ).rejects.toThrow('Lista não encontrada ou não pertence a esta turma.');
    });
  });
});
