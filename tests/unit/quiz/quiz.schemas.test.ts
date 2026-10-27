import {
  schemaBuscarQuestaoQuiz,
  schemaHistoricoQuizQuestoesUsuario,
} from "@/modules/quiz/quiz.schemas";

describe("schemaBuscarQuestaoQuiz", () => {
  test("valida busca com todos os filtros", () => {
    const resultado = schemaBuscarQuestaoQuiz.safeParse({
      tema: "Anatomia",
      dificuldade: "DIFICIL",
      tipo: "MULTIPLA_ESCOLHA",
      page: 1,
      limit: 20,
    });

    expect(resultado.success).toBe(true);
  });

  test("valida busca sem filtros", () => {
    const resultado = schemaBuscarQuestaoQuiz.safeParse({});

    expect(resultado.success).toBe(true);
  });

  test("valida coercao de page e limit string para number", () => {
    const resultado = schemaBuscarQuestaoQuiz.safeParse({
      page: "2",
      limit: "10",
    });

    expect(resultado.success).toBe(true);

    if (resultado.success) {
      expect(resultado.data.page).toBe(2);
      expect(resultado.data.limit).toBe(10);
    }
  });

  test("rejeita page menor que 1", () => {
    const resultado = schemaBuscarQuestaoQuiz.safeParse({
      page: 0,
    });

    expect(resultado.success).toBe(false);
  });

  test("rejeita limit maior que 100", () => {
    const resultado = schemaBuscarQuestaoQuiz.safeParse({
      limit: 101,
    });

    expect(resultado.success).toBe(false);
  });

  test("rejeita dificuldade invalida", () => {
    const resultado = schemaBuscarQuestaoQuiz.safeParse({
      dificuldade: "IMPOSSIVEL",
    });

    expect(resultado.success).toBe(false);
  });

  test("rejeita tipo invalido", () => {
    const resultado = schemaBuscarQuestaoQuiz.safeParse({
      tipo: "DISSERTATIVA",
    });

    expect(resultado.success).toBe(false);
  });

  test("rejeita page decimal", () => {
    const resultado = schemaBuscarQuestaoQuiz.safeParse({
      page: 1.5,
    });

    expect(resultado.success).toBe(false);
  });

  test("rejeita limit decimal", () => {
    const resultado = schemaBuscarQuestaoQuiz.safeParse({
      limit: 10.7,
    });

    expect(resultado.success).toBe(false);
  });
});

describe("schemaHistoricoQuizQuestoesUsuario", () => {
  test.each([
    ["true", true],
    ["false", false],
  ])("converte somenteErros=%s para booleano", (valor, esperado) => {
    const resultado = schemaHistoricoQuizQuestoesUsuario.parse({ somenteErros: valor });

    expect(resultado.somenteErros).toBe(esperado);
  });

  test("rejeita valores inválidos para somenteErros", () => {
    const resultado = schemaHistoricoQuizQuestoesUsuario.safeParse({ somenteErros: "1" });

    expect(resultado.success).toBe(false);
  });
});
