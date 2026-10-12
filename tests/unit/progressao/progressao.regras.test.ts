import {
  calcularNivel,
  calcularRecompensaXp,
  montarProgressoNivel,
  xpAcumuladoParaNivel,
} from "@/modules/progressao/progressao.regras";

describe("Regras de progressao - calcularRecompensaXp", () => {
  it("soma XP base por questao e bonus por acerto conforme a dificuldade", () => {
    const recompensa = calcularRecompensaXp(10, ["FACIL", "MEDIA", "DIFICIL"]);

    expect(recompensa).toEqual({
      xpBase: 50,
      bonusDesempenho: 30,
      bonusPowerUp: 0,
      xpTotalRecebido: 80,
    });
  });

  it("escala o XP base pelo tamanho da rodada (rodada de 4 questoes)", () => {
    expect(calcularRecompensaXp(4, []).xpBase).toBe(20);
    expect(calcularRecompensaXp(4, []).xpTotalRecebido).toBe(20);
  });

  it("inclui o bonus de power-up quando informado e ignora valores negativos", () => {
    expect(calcularRecompensaXp(2, ["FACIL"], 7)).toEqual({
      xpBase: 10,
      bonusDesempenho: 5,
      bonusPowerUp: 7,
      xpTotalRecebido: 22,
    });
    expect(calcularRecompensaXp(2, [], -5).bonusPowerUp).toBe(0);
    expect(calcularRecompensaXp(-3, []).xpBase).toBe(0);
  });
});

describe("Regras de progressao - niveis", () => {
  it("calcula o XP acumulado necessario para cada nivel", () => {
    expect(xpAcumuladoParaNivel(1)).toBe(0);
    expect(xpAcumuladoParaNivel(2)).toBe(100);
    expect(xpAcumuladoParaNivel(3)).toBe(300);
    expect(xpAcumuladoParaNivel(4)).toBe(600);
    expect(xpAcumuladoParaNivel(0)).toBe(0);
  });

  it("converte XP em nivel respeitando as fronteiras", () => {
    expect(calcularNivel(0)).toBe(1);
    expect(calcularNivel(99)).toBe(1);
    expect(calcularNivel(100)).toBe(2);
    expect(calcularNivel(299)).toBe(2);
    expect(calcularNivel(300)).toBe(3);
    expect(calcularNivel(-10)).toBe(1);
  });

  it("monta o progresso dentro do nivel com XP faltante e percentual", () => {
    expect(montarProgressoNivel(150)).toEqual({
      xpTotal: 150,
      nivel: 2,
      proximoNivel: 3,
      xpNoNivel: 50,
      xpNecessarioNoNivel: 200,
      xpFaltante: 150,
      percentual: 25,
    });
  });

  it("comeca do zero para quem ainda nao tem XP", () => {
    expect(montarProgressoNivel(0)).toEqual({
      xpTotal: 0,
      nivel: 1,
      proximoNivel: 2,
      xpNoNivel: 0,
      xpNecessarioNoNivel: 100,
      xpFaltante: 100,
      percentual: 0,
    });
  });
});
