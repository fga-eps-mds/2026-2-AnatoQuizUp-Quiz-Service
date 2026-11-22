import {
  schemaParamsDashboard,
  schemaParamsDetalheEntrega,
  schemaParamsEvolucaoTemas,
  schemaParamsListaDashboard,
} from '../../../src/modules/dashboardTurma/dashboardTruma.schemas';

describe('schemaParamsDashboard', () => {
  it('deve validar um ID cuid valido', () => {
    const result = schemaParamsDashboard.safeParse({ id: 'cmpsx9a2f00064hx26j7kukdo' });
    expect(result.success).toBe(true);
  });

  it('deve invalidar um ID com formato incorreto', () => {
    const result = schemaParamsDashboard.safeParse({ id: 'id-invalido' });
    expect(result.success).toBe(false);
  });

  it('deve falhar se o ID não for fornecido', () => {
    const result = schemaParamsDashboard.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('schemaParamsListaDashboard', () => {
  it('deve validar quando ambos os IDs cuid forem válidos', () => {
    const result = schemaParamsListaDashboard.safeParse({
      id: 'cmpsx9a2f00064hx26j7kukdo',
      listaId: 'cmq101jjt002w4hitmlzi7d3g',
    });
    expect(result.success).toBe(true);
  });

  it('deve invalidar se o ID da lista estiver incorreto', () => {
    const result = schemaParamsListaDashboard.safeParse({
      id: 'cmpsx9a2f00064hx26j7kukdo',
      listaId: 'id-invalido',
    });
    expect(result.success).toBe(false);
  });

  it('deve falhar se os parâmetros obrigatórios estiverem ausentes', () => {
    const result = schemaParamsListaDashboard.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('schemas de consulta individual do aluno', () => {
  const turmaId = 'cmpsx9a2f00064hx26j7kukdo';
  const listaId = 'cmq101jjt002w4hitmlzi7d3g';

  it('aceita identificador legado do aluno na evolução por tema', () => {
    const result = schemaParamsEvolucaoTemas.safeParse({
      id: turmaId,
      alunoId: 'aluno-joao',
    });

    expect(result.success).toBe(true);
  });

  it('aceita identificador legado do aluno no detalhe da entrega', () => {
    const result = schemaParamsDetalheEntrega.safeParse({
      id: turmaId,
      listaId,
      alunoId: 'aluno-joao',
    });

    expect(result.success).toBe(true);
  });

  it.each([schemaParamsEvolucaoTemas, schemaParamsDetalheEntrega])(
    'rejeita identificador vazio do aluno',
    (schema) => {
      const result = schema.safeParse({
        id: turmaId,
        listaId,
        alunoId: '   ',
      });

      expect(result.success).toBe(false);
    },
  );
});
