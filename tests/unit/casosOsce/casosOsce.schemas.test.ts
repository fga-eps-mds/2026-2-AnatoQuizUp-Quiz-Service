import {
  schemaSalvarChecklist,
  schemaSalvarConfiguracaoAvaliacao,
} from "../../../src/modules/casosOsce/casosOsce.schemas";

const item = { dominio: "Encerramento", nome: "Explica a conduta", criterioCompleto: "Explica.", peso: 2 };

const configuracao = {
  faixaExcelente: 90,
  faixaBom: 75,
  faixaSuficiente: 60,
  faixaLimitrofe: 50,
  corteAprovacao: 60,
  itemCriticoReprova: true,
  escalaGlobal: ["Reprovação clara", "Limítrofe", "Aprovação", "Boa aprovação", "Aprovação excelente"],
};

describe("Schemas de avaliacao do caso OSCE", () => {
  it("aceita item sem criterio parcial", () => {
    expect(schemaSalvarChecklist.safeParse({ itens: [item] }).success).toBe(true);
  });

  it("recusa peso diferente de 1 ou 2", () => {
    expect(schemaSalvarChecklist.safeParse({ itens: [{ ...item, peso: 3 }] }).success).toBe(false);
  });

  it("libera o resultado por padrao", () => {
    expect(schemaSalvarConfiguracaoAvaliacao.parse(configuracao).liberarResultado).toBe(true);
  });

  it("recusa faixas fora de ordem", () => {
    const resultado = schemaSalvarConfiguracaoAvaliacao.safeParse({ ...configuracao, faixaBom: 95 });
    expect(resultado.success).toBe(false);
  });

  it("recusa escala sem os 5 rotulos", () => {
    const resultado = schemaSalvarConfiguracaoAvaliacao.safeParse({ ...configuracao, escalaGlobal: ["A"] });
    expect(resultado.success).toBe(false);
  });
});