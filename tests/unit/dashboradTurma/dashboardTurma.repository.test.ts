import { TurmaDashboardRepository } from '../../../src/modules/dashboardTurma/dashboardTurma.repository';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  const mPrisma = {
    turmaAluno: {
      findMany: jest.fn(),
    },
    resolucaoQuestao: {
      findMany: jest.fn(),
    },
    listaTurma: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mPrisma) };
});

describe('TurmaDashboardRepository', () => {
  let repository: TurmaDashboardRepository;
  let prismaMock: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    repository = new TurmaDashboardRepository();
    prismaMock = new PrismaClient() as jest.Mocked<PrismaClient>;
    jest.clearAllMocks();
  });

  it('deve buscar e retornar apenas os IDs dos alunos de uma turma', async () => {
    const mockMatriculas = [{ alunoId: 'aluno-1' }, { alunoId: 'aluno-2' }];
    (prismaMock.turmaAluno.findMany as jest.Mock).mockResolvedValue(mockMatriculas);

    const result = await repository.findAlunosByTurmaId('turma-123');

    expect(prismaMock.turmaAluno.findMany).toHaveBeenCalledWith({
      where: { turmaId: 'turma-123' },
      select: { alunoId: true },
    });
    expect(result).toEqual(['aluno-1', 'aluno-2']);
  });

  it('deve buscar as resolucoes dos alunos com os includes de questao e tema', async () => {
    const mockResolucoes = [{ id: 'res-1' }];
    (prismaMock.resolucaoQuestao.findMany as jest.Mock).mockResolvedValue(mockResolucoes);

    const result = await repository.findResolucoesByAlunos(['aluno-1', 'aluno-2']);

    expect(prismaMock.resolucaoQuestao.findMany).toHaveBeenCalledWith({
      where: { usuarioId: { in: ['aluno-1', 'aluno-2'] } },
      include: { questao: { include: { tema: true } } },
    });
    expect(result).toEqual(mockResolucoes);
  });

  it('deve buscar desempenho por listas da turma com submissoes e respostas', async () => {
    const mockListas = [{ id: 'lista-turma-1' }];
    (prismaMock.listaTurma.findMany as jest.Mock).mockResolvedValue(mockListas);

    const result = await repository.findDesempenhoPorListasDaTurma('turma-123');

    expect(prismaMock.listaTurma.findMany).toHaveBeenCalledWith({
      where: { turmaId: 'turma-123' },
      include: {
        listaQuestao: {
          select: {
            nome: true,
          },
        },
        resolucoes: {
          where: { status: 'SUBMETIDA' },
          include: {
            respostas: {
              include: {
                questao: {
                  select: {
                    respostaCorreta: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });
    expect(result).toEqual(mockListas);
  });

  it('deve buscar uma lista de turma combinando id da tabela de vinculo ou id original da questao', async () => {
    const mockLista = { id: 'lista-turma-1', turmaId: 'turma-123' };
    (prismaMock.listaTurma.findFirst as jest.Mock).mockResolvedValue(mockLista);

    const result = await repository.findListaTurmaById('turma-123', 'lista-123');

    expect(prismaMock.listaTurma.findFirst).toHaveBeenCalledWith({
      where: {
        turmaId: 'turma-123',
        OR: [{ id: 'lista-123' }, { listaQuestaoId: 'lista-123' }],
      },
      include: {
        listaQuestao: { include: { itens: true } },
        resolucoes: {
          include: {
            respostas: { include: { questao: { select: { respostaCorreta: true } } } },
          },
        },
      },
    });
    expect(result).toEqual(mockLista);
  });

  it('deve buscar a entrega somente quando professor, turma e aluno estiverem vinculados', async () => {
    const mockEntrega = { id: 'lista-turma-1' };
    (prismaMock.listaTurma.findFirst as jest.Mock).mockResolvedValue(mockEntrega);

    const result = await repository.findEntregaDoAluno(
      'turma-123',
      'lista-turma-1',
      'aluno-123',
      'professor-123',
    );

    expect(prismaMock.listaTurma.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'lista-turma-1',
        turmaId: 'turma-123',
        turma: {
          professorId: 'professor-123',
          alunos: { some: { alunoId: 'aluno-123' } },
        },
      },
      include: {
        listaQuestao: {
          include: {
            itens: {
              orderBy: { ordem: 'asc' },
              include: {
                questao: {
                  include: { alternativas: true },
                },
              },
            },
          },
        },
        resolucoes: {
          where: { alunoId: 'aluno-123', status: 'SUBMETIDA' },
          include: { respostas: true },
        },
      },
    });
    expect(result).toEqual(mockEntrega);
  });
});
