import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Repository do dashboard da turma: consultas Prisma para o professor montar metricas.
export class TurmaDashboardRepository {
  /**
   * Busca metadados basicos da turma (dono) para validacao de acesso.
   *
   * @param turmaId Id da turma.
   * @returns Id e professorId da turma ativa (nao excluida), ou null.
   */
  async findTurmaById(turmaId: string) {
    return await prisma.turma.findFirst({
      where: {
        id: turmaId,
        excluidoEm: null,
      },
      select: {
        id: true,
        professorId: true,
      },
    });
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
   * Busca as respostas de uma lista específica para calcular o ranking de erros.
   *
   * @param turmaId Id da turma.
   * @param idDaLista Id da lista-turma ou da lista de questoes base.
   */
  async findRespostasParaRankingErros(turmaId: string, idDaLista: string) {
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
        turma: {
          select: {
            professorId: true,
          },
        },
        listaQuestao: {
          select: {
            nome: true,
            itens: {
              select: {
                questaoId: true,
                ordem: true, 
                questao: {
                  select: {
                    enunciado: true,
                    respostaCorreta: true,
                    tema: { select: { nome: true } }
                  }
                }
              }
            }
          }
        },
        resolucoes: {
          where: { status: 'SUBMETIDA' }, // Apenas entregas válidas
          select: {
            respostas: {
              select: {
                questaoId: true,
                respostaMarcada: true,
              }
            }
          }
        }
      }
    });
  }
}
