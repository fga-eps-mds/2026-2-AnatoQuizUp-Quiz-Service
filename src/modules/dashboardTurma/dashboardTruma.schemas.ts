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
  }).trim().min(1, {
    message: 'O ID do aluno é obrigatório.',
  }),
});

export const schemaParamsEvolucaoTemas = schemaParamsDashboard.extend({
  alunoId: z.string({
    message: 'O ID do aluno é obrigatório.',
  }).trim().min(1, {
    message: 'O ID do aluno é obrigatório.',
  }),
});

export const schemaQueryEvolucaoTemas = z
  .object({
    inicio: z.iso.datetime({ offset: true }).optional(),
    fim: z.iso.datetime({ offset: true }).optional(),
  })
  .refine(({ inicio, fim }) => Boolean(inicio) === Boolean(fim), {
    message: 'As datas de início e fim devem ser informadas juntas.',
  })
  .refine(({ inicio, fim }) => !inicio || !fim || new Date(inicio) <= new Date(fim), {
    message: 'A data de início deve ser anterior ou igual à data de fim.',
  });
