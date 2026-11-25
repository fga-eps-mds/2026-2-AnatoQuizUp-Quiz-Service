import { TurmaDashboardRepository } from '../../../src/modules/dashboardTurma/dashboardTurma.repository';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
  const mPrisma = {
    turma: {
      findFirst: jest.fn(),
    },
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

  it('deve buscar metadados basicos de uma turma ativa por id', async () => {
    const mockTurma = { id: 'turma-123', professorId: 'prof-123' };
    (prismaMock.turma.findFirst as jest.Mock).mockResolvedValue(mockTurma);

    const result = await repository.findTurmaById('turma-123');

    expect(prismaMock.turma.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'turma-123',
        excluidoEm: null,
      },
      select: {
        id: true,
        professorId: true,
      },
    });
    expect(result).toEqual(mockTurma);
  });

  it('restringe o histórico à turma do professor, ao aluno matriculado e ao período', async () => {
    const inicio = new Date('2026-01-01T00:00:00Z');
    const fim = new Date('2026-06-30T23:59:59Z');
    (prismaMock.turma.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(repository.findHistoricoListasAluno('turma-2', 'aluno-1', 'professor-1', inicio, fim))
      .resolves.toBeNull();

    expect(prismaMock.turma.findFirst).toHaveBeenCalledWith({
      where: { id: 'turma-2', professorId: 'professor-1', excluidoEm: null, alunos: { some: { alunoId: 'aluno-1', excluidoEm: null } } },
      select: {
        listas: expect.objectContaining({
          where: { criadoEm: { gte: inicio, lte: fim }, listaQuestao: { excluidoEm: null } },
          orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
          select: expect.objectContaining({
            resolucoes: expect.objectContaining({ where: { alunoId: 'aluno-1', status: 'SUBMETIDA' } }),
          }),
        }),
      },
    });
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
});
