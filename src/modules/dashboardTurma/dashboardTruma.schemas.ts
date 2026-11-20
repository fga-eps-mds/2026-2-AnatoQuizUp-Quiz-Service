import { z } from 'zod';

// Schemas Zod dos params dos dashboards de turma.

// Params do dashboard da turma: apenas o id da turma.
export const schemaParamsDashboard = z.object({
  id: z.string({
    message: 'O ID da turma é obrigatório e deve ser um texto válido.',
  }).cuid({
    message: 'Formato de ID inválido.',
  }),
});

// Params do desempenho por lista: turma + lista.
export const schemaParamsListaDashboard = z.object({
  id: z.string({
    message: 'O ID da turma é obrigatório.',
  }).cuid({
    message: 'Formato de ID da turma inválido.',
  }),
  listaId: z.string({
    message: 'O ID da lista é obrigatório.',
  }).cuid({
    message: 'Formato de ID da lista inválido.',
  }),
});

// Params do detalhamento de uma entrega: turma, publicacao e aluno consultados.
export const schemaParamsDetalheEntrega = schemaParamsListaDashboard.extend({
  alunoId: z.string({
    message: 'O ID do aluno é obrigatório.',
  }).cuid({
    message: 'Formato de ID do aluno inválido.',
  }),
});
