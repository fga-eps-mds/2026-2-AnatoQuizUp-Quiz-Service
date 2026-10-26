import { EloXp, EstadoElo, TipoEventoElo, TipoNotificacaoElo } from "@prisma/client";

import {
  CONFIGURACAO_INATIVIDADE_PADRAO,
  calcularDiasInatividade,
  calcularEstadoElo,
  calcularPrazoRebaixamento,
  contarRebaixamentosDevidos,
  eloAbaixo,
  montarNotificacaoRecuperacao,
  planejarEloAposAtividade,
  planejarInatividade,
  xpEloAposRebaixamento,
} from "@/modules/progressao/inatividade.regras";
import { FAIXAS_ELO } from "@/modules/progressao/progressao.constants";
import { obterFaixaEloPorCodigo } from "@/modules/progressao/progressao.regras";
import type { EstadoProgressoElo } from "@/modules/progressao/progressao.types";

const DIA = 24 * 60 * 60 * 1000;
const AGORA = new Date("2026-10-26T12:00:00.000Z");

// Estudante no elo R3 (faixa 6.000 - 9.999), com o XP de elo no meio da faixa.
const progressoBase = (sobrescritas: Partial<EstadoProgressoElo> = {}): EstadoProgressoElo => ({
  xpElo: 7000,
  eloAtual: EloXp.R3,
  maiorElo: EloXp.R3,
  ultimaAtividadeEm: new Date(AGORA.getTime() - 1 * DIA),
  rebaixamentosAplicados: 0,
  ...sobrescritas,
});

const inativoHa = (dias: number, sobrescritas: Partial<EstadoProgressoElo> = {}) =>
  progressoBase({ ultimaAtividadeEm: new Date(AGORA.getTime() - dias * DIA), ...sobrescritas });

const tipos = (plano: ReturnType<typeof planejarInatividade>) =>
  plano.notificacoes.map((notificacao) => notificacao.tipo);

describe("calcularDiasInatividade", () => {
  it("conta dias completos desde a ultima atividade valida", () => {
    expect(calcularDiasInatividade(new Date(AGORA.getTime() - 8 * DIA), AGORA)).toBe(8);
    expect(calcularDiasInatividade(new Date(AGORA.getTime() - 8 * DIA + 1), AGORA)).toBe(7);
  });

  it("devolve 0 para quem nunca pontuou ou tem atividade no futuro", () => {
    expect(calcularDiasInatividade(null, AGORA)).toBe(0);
    expect(calcularDiasInatividade(new Date(AGORA.getTime() + DIA), AGORA)).toBe(0);
  });

  it("desconsidera indisponibilidades reconhecidas da plataforma", () => {
    const ultimaAtividade = new Date(AGORA.getTime() - 10 * DIA);

    const dias = calcularDiasInatividade(ultimaAtividade, AGORA, [
      { inicio: new Date(AGORA.getTime() - 6 * DIA), fim: new Date(AGORA.getTime() - 3 * DIA) },
    ]);

    expect(dias).toBe(7);
  });

  it("nao desconta o mesmo periodo duas vezes quando as janelas se sobrepoem", () => {
    const ultimaAtividade = new Date(AGORA.getTime() - 10 * DIA);

    const dias = calcularDiasInatividade(ultimaAtividade, AGORA, [
      { inicio: new Date(AGORA.getTime() - 6 * DIA), fim: new Date(AGORA.getTime() - 4 * DIA) },
      { inicio: new Date(AGORA.getTime() - 5 * DIA), fim: new Date(AGORA.getTime() - 3 * DIA) },
    ]);

    expect(dias).toBe(7);
  });

  it("limita a janela ao intervalo de inatividade", () => {
    const ultimaAtividade = new Date(AGORA.getTime() - 4 * DIA);

    const dias = calcularDiasInatividade(ultimaAtividade, AGORA, [
      { inicio: new Date(AGORA.getTime() - 30 * DIA), fim: new Date(AGORA.getTime() - 3 * DIA) },
    ]);

    expect(dias).toBe(3);
  });
});

describe("calcularEstadoElo", () => {
  it("mantem ATIVO ate o prazo de risco", () => {
    expect(calcularEstadoElo(0, CONFIGURACAO_INATIVIDADE_PADRAO)).toBe(EstadoElo.ATIVO);
    expect(calcularEstadoElo(7, CONFIGURACAO_INATIVIDADE_PADRAO)).toBe(EstadoElo.ATIVO);
  });

  it("passa para EM_RISCO com 8 dias e REBAIXADO com 9", () => {
    expect(calcularEstadoElo(8, CONFIGURACAO_INATIVIDADE_PADRAO)).toBe(EstadoElo.EM_RISCO);
    expect(calcularEstadoElo(9, CONFIGURACAO_INATIVIDADE_PADRAO)).toBe(EstadoElo.REBAIXADO);
  });

  it("respeita prazos configurados diferentes do padrao", () => {
    const config = { ...CONFIGURACAO_INATIVIDADE_PADRAO, diasRisco: 20, diasRebaixamento: 30 };

    expect(calcularEstadoElo(19, config)).toBe(EstadoElo.ATIVO);
    expect(calcularEstadoElo(20, config)).toBe(EstadoElo.EM_RISCO);
    expect(calcularEstadoElo(30, config)).toBe(EstadoElo.REBAIXADO);
  });
});

describe("contarRebaixamentosDevidos", () => {
  it("nao deve nada antes do prazo de rebaixamento", () => {
    expect(contarRebaixamentosDevidos(8, CONFIGURACAO_INATIVIDADE_PADRAO)).toBe(0);
  });

  it("deve um rebaixamento no prazo e outro a cada 14 dias adicionais", () => {
    expect(contarRebaixamentosDevidos(9, CONFIGURACAO_INATIVIDADE_PADRAO)).toBe(1);
    expect(contarRebaixamentosDevidos(22, CONFIGURACAO_INATIVIDADE_PADRAO)).toBe(1);
    expect(contarRebaixamentosDevidos(23, CONFIGURACAO_INATIVIDADE_PADRAO)).toBe(2);
    expect(contarRebaixamentosDevidos(37, CONFIGURACAO_INATIVIDADE_PADRAO)).toBe(3);
  });
});

describe("eloAbaixo e xpEloAposRebaixamento", () => {
  it("segue a ordem inversa dos elos", () => {
    expect(eloAbaixo(EloXp.STAFF_DO_SERVICO)?.codigo).toBe(EloXp.R6);
    expect(eloAbaixo(EloXp.R6)?.codigo).toBe(EloXp.R3);
    expect(eloAbaixo(EloXp.R3)?.codigo).toBe(EloXp.R1);
    expect(eloAbaixo(EloXp.R1)?.codigo).toBe(EloXp.INTERNO);
    expect(eloAbaixo(EloXp.INTERNO)?.codigo).toBe(EloXp.ACADEMICO);
    expect(eloAbaixo(EloXp.ACADEMICO)?.codigo).toBe(EloXp.CURIOSO);
  });

  it("nao rebaixa abaixo de Curioso", () => {
    expect(eloAbaixo(EloXp.CURIOSO)).toBeNull();
  });

  it("posiciona o XP de elo um ponto abaixo do minimo da faixa perdida", () => {
    // Exemplo da US: perder o R3 (minimo 6.000) deixa o XP de elo em 5.999.
    expect(xpEloAposRebaixamento(obterFaixaEloPorCodigo(EloXp.R3))).toBe(5999);
    expect(xpEloAposRebaixamento(obterFaixaEloPorCodigo(EloXp.CURIOSO))).toBe(0);
  });
});

describe("calcularPrazoRebaixamento", () => {
  it("marca o prazo em diasRebaixamento apos a ultima atividade", () => {
    const ultimaAtividade = new Date("2026-10-01T00:00:00.000Z");

    const prazo = calcularPrazoRebaixamento(
      ultimaAtividade,
      0,
      CONFIGURACAO_INATIVIDADE_PADRAO,
      AGORA,
    );

    expect(prazo?.toISOString()).toBe("2026-10-10T00:00:00.000Z");
  });

  it("empurra o prazo em 14 dias por rebaixamento ja aplicado", () => {
    const ultimaAtividade = new Date("2026-10-01T00:00:00.000Z");

    const prazo = calcularPrazoRebaixamento(
      ultimaAtividade,
      1,
      CONFIGURACAO_INATIVIDADE_PADRAO,
      AGORA,
    );

    expect(prazo?.toISOString()).toBe("2026-10-24T00:00:00.000Z");
  });

  it("nao existe prazo para quem nunca pontuou", () => {
    expect(calcularPrazoRebaixamento(null, 0, CONFIGURACAO_INATIVIDADE_PADRAO, AGORA)).toBeNull();
  });
});

describe("planejarInatividade - cenarios de aceitacao da US #89", () => {
  it("Elo permanece ativo: menos de 7 dias sem quiz valido, sem penalidade", () => {
    const plano = planejarInatividade(inativoHa(1), AGORA);

    expect(plano.estado).toBe(EstadoElo.ATIVO);
    expect(plano.rebaixamentos).toHaveLength(0);
    expect(plano.notificacoes).toHaveLength(0);
    expect(plano.eloFinal.codigo).toBe(EloXp.R3);
    expect(plano.xpEloFinal).toBe(7000);
    expect(plano.houveMudanca).toBe(false);
  });

  it("Aviso preventivo: 7 dias sem quiz valido gera aviso de como manter o elo", () => {
    const plano = planejarInatividade(inativoHa(7), AGORA);

    expect(plano.estado).toBe(EstadoElo.ATIVO);
    expect(tipos(plano)).toEqual([TipoNotificacaoElo.AVISO_PREVENTIVO]);
    expect(plano.notificacoes[0].mensagem).toContain("Conclua um quiz");
    expect(plano.rebaixamentos).toHaveLength(0);
  });

  it("Elo entra em risco: 8 dias sem quiz valido, com a data prevista do rebaixamento", () => {
    const plano = planejarInatividade(inativoHa(8), AGORA);

    expect(plano.estado).toBe(EstadoElo.EM_RISCO);
    expect(tipos(plano)).toContain(TipoNotificacaoElo.ELO_EM_RISCO);
    expect(tipos(plano)).toContain(TipoNotificacaoElo.VESPERA_REBAIXAMENTO);
    expect(plano.prazoRebaixamentoEm?.toISOString()).toBe(
      new Date(AGORA.getTime() + 1 * DIA).toISOString(),
    );
    expect(plano.rebaixamentos).toHaveLength(0);
  });

  it("Rebaixamento por inatividade: R3 cai para R1 com o XP de elo ajustado para 5.999", () => {
    const plano = planejarInatividade(inativoHa(9), AGORA);

    expect(plano.estado).toBe(EstadoElo.REBAIXADO);
    expect(plano.eloFinal.codigo).toBe(EloXp.R1);
    expect(plano.xpEloFinal).toBe(5999);
    expect(plano.rebaixamentosAplicados).toBe(1);
    expect(plano.rebaixamentos).toEqual([
      {
        eloAnterior: EloXp.R3,
        eloNovo: EloXp.R1,
        xpEloAntes: 7000,
        xpEloDepois: 5999,
        diasInatividade: 9,
      },
    ]);
    expect(tipos(plano)).toContain(TipoNotificacaoElo.ELO_REBAIXADO);
    expect(plano.houveMudanca).toBe(true);
  });

  it("Inatividade prolongada: perde outro elo a cada 14 dias adicionais", () => {
    const plano = planejarInatividade(inativoHa(23), AGORA);

    expect(plano.rebaixamentos).toHaveLength(2);
    expect(plano.eloFinal.codigo).toBe(EloXp.INTERNO);
    // R3 -> R1 deixa 5.999; R1 (minimo 3.000) -> Interno deixa 2.999.
    expect(plano.xpEloFinal).toBe(2999);
    expect(plano.rebaixamentosAplicados).toBe(2);
  });

  it("no piso do elo Curioso nao ha risco, prazo nem aviso de perda", () => {
    const plano = planejarInatividade(
      inativoHa(200, { eloAtual: EloXp.CURIOSO, xpElo: 120, maiorElo: EloXp.R6 }),
      AGORA,
    );

    expect(plano.eloFinal.codigo).toBe(EloXp.CURIOSO);
    expect(plano.xpEloFinal).toBe(120);
    expect(plano.rebaixamentos).toHaveLength(0);
    // Nada a perder: o estado nao vira REBAIXADO e nenhum aviso de perda e gerado.
    expect(plano.estado).toBe(EstadoElo.ATIVO);
    expect(plano.notificacoes).toHaveLength(0);
    expect(plano.prazoRebaixamentoEm).toBeNull();
    expect(plano.houveMudanca).toBe(false);
  });

  it("para a cascata no piso quando o estudante passa de Academico para Curioso", () => {
    const plano = planejarInatividade(
      inativoHa(100, { eloAtual: EloXp.ACADEMICO, xpElo: 900, maiorElo: EloXp.R3 }),
      AGORA,
    );

    expect(plano.eloFinal.codigo).toBe(EloXp.CURIOSO);
    expect(plano.xpEloFinal).toBe(499);
    expect(plano.rebaixamentos).toHaveLength(1);
  });

  it("e idempotente: reexecutar no mesmo periodo nao rebaixa de novo", () => {
    const depoisDoPrimeiro = inativoHa(9, {
      eloAtual: EloXp.R1,
      xpElo: 5999,
      rebaixamentosAplicados: 1,
    });

    const plano = planejarInatividade(depoisDoPrimeiro, AGORA);

    expect(plano.rebaixamentos).toHaveLength(0);
    expect(plano.eloFinal.codigo).toBe(EloXp.R1);
    expect(plano.xpEloFinal).toBe(5999);
    expect(plano.houveMudanca).toBe(false);
  });

  it("nao penaliza quem nunca concluiu um quiz valido", () => {
    const plano = planejarInatividade(
      progressoBase({ ultimaAtividadeEm: null, xpElo: 0, eloAtual: EloXp.CURIOSO }),
      AGORA,
    );

    expect(plano.estado).toBe(EstadoElo.ATIVO);
    expect(plano.rebaixamentos).toHaveLength(0);
    expect(plano.notificacoes).toHaveLength(0);
    expect(plano.prazoRebaixamentoEm).toBeNull();
  });

  it("nao conta a indisponibilidade reconhecida da plataforma para rebaixar", () => {
    const config = {
      ...CONFIGURACAO_INATIVIDADE_PADRAO,
      indisponibilidades: [
        { inicio: new Date(AGORA.getTime() - 6 * DIA), fim: new Date(AGORA.getTime() - 3 * DIA) },
      ],
    };

    const plano = planejarInatividade(inativoHa(10), AGORA, config);

    expect(plano.diasInatividade).toBe(7);
    expect(plano.estado).toBe(EstadoElo.ATIVO);
    expect(plano.rebaixamentos).toHaveLength(0);
  });

  it("usa os prazos configurados em vez dos padroes", () => {
    const config = {
      ...CONFIGURACAO_INATIVIDADE_PADRAO,
      diasAviso: 20,
      diasRisco: 25,
      diasRebaixamento: 30,
    };

    expect(planejarInatividade(inativoHa(9), AGORA, config).estado).toBe(EstadoElo.ATIVO);
    expect(planejarInatividade(inativoHa(9), AGORA, config).notificacoes).toHaveLength(0);
    expect(planejarInatividade(inativoHa(30), AGORA, config).rebaixamentos).toHaveLength(1);
  });

  it("deduplica avisos pela chave do ciclo de inatividade", () => {
    const emRisco = inativoHa(8);
    const chaveRisco = emRisco.ultimaAtividadeEm?.toISOString();

    const aviso = planejarInatividade(emRisco, AGORA).notificacoes.find(
      (notificacao) => notificacao.tipo === TipoNotificacaoElo.AVISO_PREVENTIVO,
    );
    expect(aviso?.chave).toBe(chaveRisco);

    const rebaixado = inativoHa(9);
    const chaveRebaixado = rebaixado.ultimaAtividadeEm?.toISOString();
    const notificacao = planejarInatividade(rebaixado, AGORA).notificacoes.find(
      (item) => item.tipo === TipoNotificacaoElo.ELO_REBAIXADO,
    );

    expect(notificacao?.chave).toBe(`${chaveRebaixado}:${EloXp.R1}`);
  });

  it("nao avisa sobre um rebaixamento futuro depois que ele ja aconteceu", () => {
    // Primeira avaliacao de quem esta inativo ha 30 dias: anunciar "falta um dia para o
    // rebaixamento" junto com o rebaixamento em si seria falso.
    const plano = planejarInatividade(inativoHa(30), AGORA);

    expect(tipos(plano)).not.toContain(TipoNotificacaoElo.AVISO_PREVENTIVO);
    expect(tipos(plano)).not.toContain(TipoNotificacaoElo.ELO_EM_RISCO);
    expect(tipos(plano)).not.toContain(TipoNotificacaoElo.VESPERA_REBAIXAMENTO);
    expect(tipos(plano)).toEqual([
      TipoNotificacaoElo.ELO_REBAIXADO,
      TipoNotificacaoElo.ELO_REBAIXADO,
    ]);
  });
});

describe("planejarEloAposAtividade - recuperacao e promocao", () => {
  it("nao muda nada enquanto o XP de elo nao alcanca a faixa seguinte", () => {
    const plano = planejarEloAposAtividade(5999, EloXp.R1, EloXp.R3);

    expect(plano.evento).toBeNull();
    expect(plano.elo.codigo).toBe(EloXp.R1);
    expect(plano.maiorElo.codigo).toBe(EloXp.R3);
  });

  it("recupera o elo perdido ao voltar ao minimo da faixa, preservando o maior elo", () => {
    const plano = planejarEloAposAtividade(6000, EloXp.R1, EloXp.R3);

    expect(plano.evento).toBe(TipoEventoElo.RECUPERACAO);
    expect(plano.elo.codigo).toBe(EloXp.R3);
    expect(plano.maiorElo.codigo).toBe(EloXp.R3);
  });

  it("registra promocao inedita quando o XP de elo supera o maior elo conquistado", () => {
    const plano = planejarEloAposAtividade(10000, EloXp.R3, EloXp.R3);

    expect(plano.evento).toBe(TipoEventoElo.PROMOCAO);
    expect(plano.elo.codigo).toBe(EloXp.R6);
    expect(plano.maiorElo.codigo).toBe(EloXp.R6);
  });

  it("aceita faixas injetadas", () => {
    const plano = planejarEloAposAtividade(6000, EloXp.R1, EloXp.R3, FAIXAS_ELO);

    expect(plano.elo.codigo).toBe(EloXp.R3);
  });
});

describe("montarNotificacaoRecuperacao", () => {
  it("avisa o estudante nomeando o elo recuperado", () => {
    const notificacao = montarNotificacaoRecuperacao(obterFaixaEloPorCodigo(EloXp.R3), "evento-1");

    expect(notificacao.tipo).toBe(TipoNotificacaoElo.ELO_RECUPERADO);
    expect(notificacao.chave).toBe(`${EloXp.R3}:evento-1`);
    expect(notificacao.mensagem).toContain("R3");
    expect(notificacao.prazoRebaixamentoEm).toBeNull();
  });
});
