import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Repository do dashboard da turma: consultas Prisma para o professor montar metricas.
export class TurmaDashboardRepository {
  /** Confirma se o professor pode consultar o aluno dentro da turma informada. */
  async professorTemAcessoAoAluno(turmaId: string, alunoId: string, professorId: string) {
    const turma = await prisma.turma.findFirst({
      where: {
        id: turmaId,
        professorId,
        alunos: { some: { alunoId } },
      },
      select: { id: true },
    });

    return turma !== null;
  }

  /**
   * Retorna apenas os ids dos alunos matriculados na turma.
   *
   * @param turmaId Id da turma.
   * @returns Lista de ids de alunos.
   */
  async findAlunosByTurmaId(turmaId: string) {
    const matriculas = await prisma.turmaAluno.findMany({
      where: { turmaId },
      select: { alunoId: true },
    });
    // Achata o resultado para uma lista simples de ids.
    return matriculas.map((m) => m.alunoId);
  }

  /**
   * Busca as resolucoes desses alunos, com a questao e o tema para agrupar desempenho.
   *
   * @param alunosIds Ids dos alunos.
   * @returns Resolucoes com questao e tema embutidos.
   */
  async findResolucoesByAlunos(alunosIds: string[]) {
    return await prisma.resolucaoQuestao.findMany({
      where: {
        usuarioId: { in: alunosIds },
      },
      include: {
        questao: {
          include: {
            tema: true,
          },
        },
      },
    });
  }

  /**
   * Busca cada lista da turma com suas resolucoes submetidas (base do desempenho por lista).
   *
   * @param turmaId Id da turma.
   * @returns Listas da turma com as resolucoes submetidas.
   */
  async findDesempenhoPorListasDaTurma(turmaId: string) {
    return await prisma.listaTurma.findMany({
      where: { turmaId },
      include: {
        listaQuestao: {
          select: {
            nome: true,
          },
        },
        resolucoes: {
          // Apenas listas efetivamente entregues contam para o desempenho.
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
  }

  /**
   * Localiza uma lista da turma com as resolucoes e itens (detalhe por lista).
   *
   * @param turmaId Id da turma.
   * @param idDaLista Id da lista-turma ou da lista de questoes base.
   * @returns A lista-turma com resolucoes e itens, ou null.
   */
  async findListaTurmaById(turmaId: string, idDaLista: string) {
    return await prisma.listaTurma.findFirst({
      where: {
        turmaId: turmaId,
        // Aceita tanto o id da lista-turma quanto o id da lista de questoes base.
        OR: [
          { id: idDaLista },
          { listaQuestaoId: idDaLista }
        ]
      },
      include: {
        listaQuestao: {
          include: {
            itens: true,
          },
        },
        resolucoes: {
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
    });
  }

  /**
   * Busca uma entrega submetida para consulta do professor responsavel pela turma.
   * O filtro unico impede a consulta de alunos, listas ou turmas sem vinculo.
   */
  async findEntregaDoAluno(
    turmaId: string,
    listaTurmaId: string,
    alunoId: string,
    professorId: string,
  ) {
    return prisma.listaTurma.findFirst({
      where: {
        id: listaTurmaId,
        turmaId,
        turma: {
          professorId,
          alunos: { some: { alunoId } },
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
          where: { alunoId, status: 'SUBMETIDA' },
          include: { respostas: true },
        },
      },
    });
  }

  /**
   * Busca as publicacoes da turma que podem compor a evolucao por tema de um aluno.
   * O filtro da turma, do professor e da matricula e aplicado na propria consulta.
   */
  async findListasParaEvolucaoTemas(
    turmaId: string,
    alunoId: string,
    professorId: string,
    inicio?: Date,
    fim?: Date,
  ) {
    return prisma.listaTurma.findMany({
      where: {
        turmaId,
        turma: {
          professorId,
          alunos: { some: { alunoId } },
        },
        ...(inicio && fim
          ? {
              criadoEm: {
                gte: inicio,
                lte: fim,
              },
            }
          : {}),
      },
      orderBy: { criadoEm: 'asc' },
      include: {
        listaQuestao: {
          select: {
            nome: true,
            itens: {
              orderBy: { ordem: 'asc' },
              select: {
                questao: {
                  select: {
                    id: true,
                    respostaCorreta: true,
                    tema: {
                      select: {
                        id: true,
                        nome: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        resolucoes: {
          where: { alunoId },
          select: {
            status: true,
            respostas: {
              select: {
                questaoId: true,
                respostaMarcada: true,
              },
            },
          },
        },
      },
    });
  }
}
