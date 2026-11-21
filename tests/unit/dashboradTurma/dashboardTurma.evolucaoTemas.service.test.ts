import { TurmaDashboardService } from '../../../src/modules/dashboardTurma/dashboardTurma.service';
import { TurmaDashboardRepository } from '../../../src/modules/dashboardTurma/dashboardTurma.repository';

jest.mock('../../../src/modules/dashboardTurma/dashboardTurma.repository');

describe('TurmaDashboardService - evolucao por tema', () => {
  let service: TurmaDashboardService;
  let repoMock: jest.Mocked<TurmaDashboardRepository>;

  beforeEach(() => {
    repoMock = new TurmaDashboardRepository() as jest.Mocked<TurmaDashboardRepository>;
    service = new TurmaDashboardService(repoMock);
  });

  it('calcula somente as questoes do tema e ignora pendencias na variacao', async () => {
    repoMock.professorTemAcessoAoAluno.mockResolvedValue(true);
    repoMock.findListasParaEvolucaoTemas.mockResolvedValue([
      {
        id: 'lista-1',
        criadoEm: new Date('2026-03-12T10:00:00.000Z'),
        listaQuestao: {
          nome: 'Bases de anatomia',
          itens: [
            { questao: { id: 'q1', respostaCorreta: 'A', tema: { id: 'tema-osteo', nome: 'Osteologia' } } },
            { questao: { id: 'q2', respostaCorreta: 'B', tema: { id: 'tema-osteo', nome: 'Osteologia' } } },
            { questao: { id: 'q3', respostaCorreta: 'C', tema: { id: 'tema-neuro', nome: 'Neuroanatomia' } } },
          ],
        },
        resolucoes: [{
          status: 'SUBMETIDA',
          respostas: [
            { questaoId: 'q1', respostaMarcada: 'A' },
            { questaoId: 'q3', respostaMarcada: 'C' },
          ],
        }],
      },
      {
        id: 'lista-2',
        criadoEm: new Date('2026-03-19T10:00:00.000Z'),
        listaQuestao: {
          nome: 'Revisao de osteologia',
          itens: [
            { questao: { id: 'q4', respostaCorreta: 'A', tema: { id: 'tema-osteo', nome: 'Osteologia' } } },
          ],
        },
        resolucoes: [{ status: 'EM_ANDAMENTO', respostas: [] }],
      },
      {
        id: 'lista-3',
        criadoEm: new Date('2026-04-09T10:00:00.000Z'),
        listaQuestao: {
          nome: 'Osteologia aplicada',
          itens: [
            { questao: { id: 'q5', respostaCorreta: 'D', tema: { id: 'tema-osteo', nome: 'Osteologia' } } },
            { questao: { id: 'q6', respostaCorreta: 'E', tema: { id: 'tema-osteo', nome: 'Osteologia' } } },
          ],
        },
        resolucoes: [{
          status: 'SUBMETIDA',
          respostas: [
            { questaoId: 'q5', respostaMarcada: 'D' },
            { questaoId: 'q6', respostaMarcada: 'E' },
          ],
        }],
      },
    ] as unknown as Awaited<ReturnType<TurmaDashboardRepository['findListasParaEvolucaoTemas']>>);

    const inicio = new Date('2026-01-01T00:00:00.000Z');
    const fim = new Date('2026-06-30T23:59:59.999Z');
    const result = await service.getEvolucaoTemasAluno(
      'turma-1',
      'aluno-1',
      'professor-1',
      inicio,
      fim,
    );

    expect(repoMock.findListasParaEvolucaoTemas).toHaveBeenCalledWith(
      'turma-1',
      'aluno-1',
      'professor-1',
      inicio,
      fim,
    );
    const osteologia = result.temas.find((tema) => tema.temaId === 'tema-osteo');
    expect(osteologia?.totalResultadosValidos).toBe(2);
    expect(osteologia?.mensagem).toBeNull();
    expect(osteologia?.resultados).toEqual([
      expect.objectContaining({
        listaTurmaId: 'lista-1',
        acertos: 1,
        totalQuestoes: 2,
        taxaAcerto: 50,
        variacaoPp: null,
      }),
      expect.objectContaining({
        listaTurmaId: 'lista-2',
        status: 'EM_ANDAMENTO',
        acertos: null,
        taxaAcerto: null,
        variacaoPp: null,
      }),
      expect.objectContaining({
        listaTurmaId: 'lista-3',
        acertos: 2,
        totalQuestoes: 2,
        taxaAcerto: 100,
        variacaoPp: 50,
      }),
    ]);

    const neuroanatomia = result.temas.find((tema) => tema.temaId === 'tema-neuro');
    expect(neuroanatomia?.resultados[0]).toMatchObject({
      acertos: 1,
      totalQuestoes: 1,
      taxaAcerto: 100,
    });
    expect(neuroanatomia?.mensagem).toBe(
      'Uma entrega disponível. São necessárias duas para comparar.',
    );
  });

  it('identifica lista sem resolucao como pendente', async () => {
    repoMock.professorTemAcessoAoAluno.mockResolvedValue(true);
    repoMock.findListasParaEvolucaoTemas.mockResolvedValue([{
      id: 'lista-1',
      criadoEm: new Date('2026-03-12T10:00:00.000Z'),
      listaQuestao: {
        nome: 'Lista pendente',
        itens: [
          { questao: { id: 'q1', respostaCorreta: 'A', tema: { id: 'tema-1', nome: 'Osteologia' } } },
        ],
      },
      resolucoes: [],
    }] as unknown as Awaited<ReturnType<TurmaDashboardRepository['findListasParaEvolucaoTemas']>>);

    const result = await service.getEvolucaoTemasAluno('turma-1', 'aluno-1', 'professor-1');

    expect(result.temas[0]).toMatchObject({
      totalResultadosValidos: 0,
      mensagem: 'Nenhuma entrega concluída para comparação.',
    });
    expect(result.temas[0].resultados[0]).toMatchObject({
      status: 'NAO_RESPONDEU',
      acertos: null,
      taxaAcerto: null,
      variacaoPp: null,
    });
  });

  it('calcula a variacao de 40 para 80 por cento como mais 40 pontos percentuais', async () => {
    repoMock.professorTemAcessoAoAluno.mockResolvedValue(true);
    const criarItens = (prefixo: string) =>
      Array.from({ length: 5 }, (_, indice) => ({
        questao: {
          id: `${prefixo}-q${indice + 1}`,
          respostaCorreta: 'A' as const,
          tema: { id: 'tema-1', nome: 'Osteologia' },
        },
      }));
    const respostasCorretas = (prefixo: string, quantidade: number) =>
      Array.from({ length: quantidade }, (_, indice) => ({
        questaoId: `${prefixo}-q${indice + 1}`,
        respostaMarcada: 'A' as const,
      }));

    repoMock.findListasParaEvolucaoTemas.mockResolvedValue([
      {
        id: 'lista-40',
        criadoEm: new Date('2026-03-12T10:00:00.000Z'),
        listaQuestao: { nome: 'Primeira lista', itens: criarItens('primeira') },
        resolucoes: [{
          status: 'SUBMETIDA',
          respostas: respostasCorretas('primeira', 2),
        }],
      },
      {
        id: 'lista-80',
        criadoEm: new Date('2026-04-09T10:00:00.000Z'),
        listaQuestao: { nome: 'Segunda lista', itens: criarItens('segunda') },
        resolucoes: [{
          status: 'SUBMETIDA',
          respostas: respostasCorretas('segunda', 4),
        }],
      },
    ] as unknown as Awaited<ReturnType<TurmaDashboardRepository['findListasParaEvolucaoTemas']>>);

    const result = await service.getEvolucaoTemasAluno('turma-1', 'aluno-1', 'professor-1');

    expect(result.temas[0].resultados).toEqual([
      expect.objectContaining({
        acertos: 2,
        totalQuestoes: 5,
        taxaAcerto: 40,
        variacaoPp: null,
      }),
      expect.objectContaining({
        acertos: 4,
        totalQuestoes: 5,
        taxaAcerto: 80,
        variacaoPp: 40,
      }),
    ]);
  });

  it('calcula queda e estabilidade em listas de tamanhos diferentes', async () => {
    repoMock.professorTemAcessoAoAluno.mockResolvedValue(true);
    const criarLista = (
      id: string,
      publicadaEm: string,
      totalQuestoes: number,
      totalAcertos: number,
    ) => {
      const itens = Array.from({ length: totalQuestoes }, (_, indice) => ({
        questao: {
          id: `${id}-q${indice + 1}`,
          respostaCorreta: 'A' as const,
          tema: { id: 'tema-1', nome: 'Osteologia' },
        },
      }));
      const respostas = Array.from({ length: totalAcertos }, (_, indice) => ({
        questaoId: `${id}-q${indice + 1}`,
        respostaMarcada: 'A' as const,
      }));

      return {
        id,
        criadoEm: new Date(publicadaEm),
        listaQuestao: { nome: id, itens },
        resolucoes: [{ status: 'SUBMETIDA' as const, respostas }],
      };
    };

    repoMock.findListasParaEvolucaoTemas.mockResolvedValue([
      criarLista('lista-80', '2026-03-01T10:00:00.000Z', 5, 4),
      criarLista('lista-40', '2026-03-08T10:00:00.000Z', 5, 2),
      criarLista('lista-50-menor', '2026-03-15T10:00:00.000Z', 4, 2),
      criarLista('lista-50-maior', '2026-03-22T10:00:00.000Z', 6, 3),
    ] as unknown as Awaited<ReturnType<TurmaDashboardRepository['findListasParaEvolucaoTemas']>>);

    const result = await service.getEvolucaoTemasAluno('turma-1', 'aluno-1', 'professor-1');

    expect(result.temas[0].resultados.map((resultado) => ({
      taxaAcerto: resultado.taxaAcerto,
      variacaoPp: resultado.variacaoPp,
      totalQuestoes: resultado.totalQuestoes,
    }))).toEqual([
      { taxaAcerto: 80, variacaoPp: null, totalQuestoes: 5 },
      { taxaAcerto: 40, variacaoPp: -40, totalQuestoes: 5 },
      { taxaAcerto: 50, variacaoPp: 10, totalQuestoes: 4 },
      { taxaAcerto: 50, variacaoPp: 0, totalQuestoes: 6 },
    ]);
  });

  it('recusa professor sem vinculo com a turma e o aluno', async () => {
    repoMock.professorTemAcessoAoAluno.mockResolvedValue(false);

    await expect(
      service.getEvolucaoTemasAluno('turma-1', 'aluno-1', 'professor-sem-acesso'),
    ).rejects.toMatchObject({ codigoStatus: 404, codigo: 'NAO_ENCONTRADO' });
    expect(repoMock.findListasParaEvolucaoTemas).not.toHaveBeenCalled();
  });
});
