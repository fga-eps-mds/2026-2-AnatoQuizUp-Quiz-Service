import { EloXp } from "@prisma/client";

import { FAIXAS_ELO } from "@/modules/progressao/progressao.constants";
import {
  calcularFaixaEloPorXp,
  calcularNivel,
  calcularRecompensaXp,
  montarProgressoNivel,
  obterFaixaEloPorCodigo,
  resolverFaixaElo,
  xpAcumuladoParaNivel,
} from "@/modules/progressao/progressao.regras";
import type { FaixaEloDto } from "@/modules/progressao/progressao.types";

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
    expect(montarProgressoNivel(150)).toMatchObject({
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
    const progresso = montarProgressoNivel(0);
    expect(progresso).toMatchObject({
      xpTotal: 0,
      nivel: 1,
      proximoNivel: 2,
      xpNoNivel: 0,
      xpNecessarioNoNivel: 100,
      xpFaltante: 100,
      percentual: 0,
      xpNoElo: 0,
      xpNecessarioNoElo: 500,
      xpFaltanteProximoElo: 500,
      percentualElo: 0,
    });
    expect(progresso.eloAtual.nome).toBe("Curioso");
    expect(progresso.proximoElo?.nome).toBe("Acadêmico");
  });
});

describe("Regras de progressao - elos e faixas de XP", () => {
  it.each([
    [0, EloXp.CURIOSO, "Curioso"],
    [499, EloXp.CURIOSO, "Curioso"],
    [500, EloXp.ACADEMICO, "Acadêmico"],
    [1499, EloXp.ACADEMICO, "Acadêmico"],
    [1500, EloXp.INTERNO, "Interno"],
    [2999, EloXp.INTERNO, "Interno"],
    [3000, EloXp.R1, "R1"],
    [5999, EloXp.R1, "R1"],
    [6000, EloXp.R3, "R3"],
    [9999, EloXp.R3, "R3"],
    [10000, EloXp.R6, "R6"],
    [14999, EloXp.R6, "R6"],
    [15000, EloXp.STAFF_DO_SERVICO, "Staff do serviço"],
    [25000, EloXp.STAFF_DO_SERVICO, "Staff do serviço"],
  ])("calcula o elo correto nos limites inferiores e superiores (%i XP -> %s)", (xp, codigo, nome) => {
    const faixa = calcularFaixaEloPorXp(xp);
    expect(faixa.codigo).toBe(codigo);
    expect(faixa.nome).toBe(nome);
  });

  it("calcula evolucao automatica e mantem XP excedente (490 + 20 = 510 XP -> Academico)", () => {
    const antes = montarProgressoNivel(490);
    expect(antes.eloAtual.nome).toBe("Curioso");
    expect(antes.xpFaltanteProximoElo).toBe(10);

    const depois = montarProgressoNivel(510);
    expect(depois.xpTotal).toBe(510);
    expect(depois.eloAtual.nome).toBe("Acadêmico");
    expect(depois.proximoElo?.nome).toBe("Interno");
    expect(depois.xpNoElo).toBe(10);
    expect(depois.xpFaltanteProximoElo).toBe(990);
  });

  it("informa que faltam 300 XP para Interno quando o estudante possui 1200 XP", () => {
    const progresso = montarProgressoNivel(1200);

    expect(progresso.eloAtual.nome).toBe("Acadêmico");
    expect(progresso.proximoElo?.nome).toBe("Interno");
    expect(progresso.xpFaltanteProximoElo).toBe(300);
    expect(progresso.percentualElo).toBe(70);
  });

  it("exibe Staff do servico sem proximo elo quando possui 15000 XP ou mais", () => {
    const progresso = montarProgressoNivel(15000);

    expect(progresso.eloAtual.nome).toBe("Staff do serviço");
    expect(progresso.proximoElo).toBeNull();
    expect(progresso.xpNecessarioNoElo).toBeNull();
    expect(progresso.xpFaltanteProximoElo).toBe(0);
    expect(progresso.percentualElo).toBe(100);
    expect(progresso.todosOsElos[6].status).toBe("ELO_ATUAL");
  });

  it("preserva o elo ja conquistado quando as faixas de XP sao alteradas", () => {
    const faixasReajustadas: FaixaEloDto[] = FAIXAS_ELO.map((faixa) =>
      faixa.codigo === EloXp.R3 ? { ...faixa, xpMinimo: 8000 } : faixa,
    );

    // Estudante tinha 6500 XP e ja havia conquistado R3 antes da mudanca de faixa
    const faixaResolvida = resolverFaixaElo(6500, EloXp.R3, faixasReajustadas);
    expect(faixaResolvida.codigo).toBe(EloXp.R3);
    expect(faixaResolvida.nome).toBe("R3");

    const progresso = montarProgressoNivel(6500, EloXp.R3, faixasReajustadas);
    expect(progresso.eloAtual.nome).toBe("R3");
    expect(progresso.maiorElo.nome).toBe("R3");
    expect(progresso.proximoElo?.nome).toBe("R6");
  });

  it("monta a jornada completa com status CONQUISTADO, ELO_ATUAL, PROXIMO_ELO, BLOQUEADO e ELO_MAXIMO", () => {
    const progresso = montarProgressoNivel(2420);

    expect(progresso.todosOsElos.map((item) => [item.nome, item.status])).toEqual([
      ["Curioso", "CONQUISTADO"],
      ["Acadêmico", "CONQUISTADO"],
      ["Interno", "ELO_ATUAL"],
      ["R1", "PROXIMO_ELO"],
      ["R3", "BLOQUEADO"],
      ["R6", "BLOQUEADO"],
      ["Staff do serviço", "ELO_MAXIMO"],
    ]);
    expect(progresso.todosOsElos[2].percentual).toBe(61);
    expect(progresso.todosOsElos[3].xpFaltante).toBe(580);
  });

  it("faz fallback para a primeira faixa quando codigo desconhecido e informado", () => {
    const faixa = obterFaixaEloPorCodigo("DESCONHECIDO" as EloXp);
    expect(faixa.codigo).toBe(EloXp.CURIOSO);
  });
});
