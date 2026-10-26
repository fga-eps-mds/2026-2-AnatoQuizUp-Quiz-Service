import { EstadoElo, TipoEventoElo, TipoNotificacaoElo, type EloXp } from "@prisma/client";

import { FAIXAS_ELO } from "./progressao.constants";
import { calcularFaixaEloPorXp, obterFaixaEloPorCodigo } from "./progressao.regras";
import type {
  ConfiguracaoInatividade,
  EstadoProgressoElo,
  FaixaEloDto,
  JanelaIndisponibilidade,
  NotificacaoPlanejada,
  PlanoInatividade,
  RebaixamentoPlanejado,
} from "./progressao.types";

// Regras puras da perda e recuperacao de elo por inatividade (US #89). Sem banco:
// recebem o estado persistido e devolvem o que precisa ser gravado, para que cada
// cenario de aceitacao seja testavel sem subir Postgres.

const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

// Prazos padrao da US. A configuracao em banco sobrescreve estes valores.
export const CONFIGURACAO_INATIVIDADE_PADRAO: ConfiguracaoInatividade = {
  diasAviso: 7,
  diasRisco: 8,
  diasRebaixamento: 9,
  diasEntreRebaixamentos: 14,
  indisponibilidades: [],
};

/**
 * Tempo, em milissegundos, que as indisponibilidades reconhecidas da plataforma
 * ocuparam dentro de um intervalo.
 *
 * Janelas sobrepostas sao unidas antes da soma para que o mesmo periodo nao seja
 * descontado duas vezes.
 */
function tempoIndisponivelNoIntervalo(
  inicio: Date,
  fim: Date,
  janelas: readonly JanelaIndisponibilidade[],
): number {
  const intersecoes = janelas
    .map((janela) => ({
      inicio: Math.max(inicio.getTime(), new Date(janela.inicio).getTime()),
      fim: Math.min(fim.getTime(), new Date(janela.fim).getTime()),
    }))
    .filter((intervalo) => intervalo.fim > intervalo.inicio)
    .sort((a, b) => a.inicio - b.inicio);

  let total = 0;
  let fimDaUniaoAtual = Number.NEGATIVE_INFINITY;

  for (const intervalo of intersecoes) {
    const comecoEfetivo = Math.max(intervalo.inicio, fimDaUniaoAtual);

    if (intervalo.fim > comecoEfetivo) {
      total += intervalo.fim - comecoEfetivo;
      fimDaUniaoAtual = intervalo.fim;
    }
  }

  return total;
}

/**
 * Dias completos sem atividade valida, descontando as indisponibilidades
 * reconhecidas da plataforma (uma queda do servico nao penaliza o estudante).
 *
 * @param ultimaAtividadeEm Data da ultima atividade que concedeu XP.
 * @param agora Momento de referencia.
 * @param janelas Indisponibilidades reconhecidas.
 * @returns Dias de inatividade (0 se nunca houve atividade ou se a data e futura).
 */
export function calcularDiasInatividade(
  ultimaAtividadeEm: Date | null,
  agora: Date,
  janelas: readonly JanelaIndisponibilidade[] = [],
): number {
  if (!ultimaAtividadeEm) {
    return 0;
  }

  const decorrido = agora.getTime() - ultimaAtividadeEm.getTime();

  if (decorrido <= 0) {
    return 0;
  }

  const indisponivel = tempoIndisponivelNoIntervalo(ultimaAtividadeEm, agora, janelas);

  return Math.floor(Math.max(0, decorrido - indisponivel) / MILISSEGUNDOS_POR_DIA);
}

/**
 * Data prevista para o proximo rebaixamento.
 *
 * Antes do primeiro rebaixamento o prazo e `diasRebaixamento` apos a ultima atividade;
 * depois dele, a cada `diasEntreRebaixamentos` dias adicionais. As indisponibilidades
 * ja descontadas sao somadas de volta para que a data exibida seja real.
 *
 * @param ultimaAtividadeEm Data da ultima atividade que concedeu XP.
 * @param rebaixamentosAplicados Quantas quedas ja aconteceram neste ciclo.
 * @param config Prazos configurados.
 * @param agora Momento de referencia (para reaplicar o desconto de indisponibilidade).
 * @returns Data prevista, ou null se o estudante nunca pontuou.
 */
export function calcularPrazoRebaixamento(
  ultimaAtividadeEm: Date | null,
  rebaixamentosAplicados: number,
  config: ConfiguracaoInatividade,
  agora: Date,
): Date | null {
  if (!ultimaAtividadeEm) {
    return null;
  }

  const diasAteOPrazo =
    config.diasRebaixamento + Math.max(0, rebaixamentosAplicados) * config.diasEntreRebaixamentos;

  const indisponivel = tempoIndisponivelNoIntervalo(
    ultimaAtividadeEm,
    agora,
    config.indisponibilidades,
  );

  return new Date(
    ultimaAtividadeEm.getTime() + diasAteOPrazo * MILISSEGUNDOS_POR_DIA + indisponivel,
  );
}

/**
 * Estado do elo conforme os dias de inatividade.
 *
 * @param dias Dias de inatividade.
 * @param config Prazos configurados.
 * @returns ATIVO, EM_RISCO ou REBAIXADO.
 */
export function calcularEstadoElo(dias: number, config: ConfiguracaoInatividade): EstadoElo {
  if (dias >= config.diasRebaixamento) {
    return EstadoElo.REBAIXADO;
  }

  if (dias >= config.diasRisco) {
    return EstadoElo.EM_RISCO;
  }

  return EstadoElo.ATIVO;
}

/**
 * Quantos rebaixamentos a inatividade acumulada ja justifica.
 *
 * O primeiro acontece em `diasRebaixamento`; depois dele, um a cada
 * `diasEntreRebaixamentos` dias adicionais.
 *
 * @param dias Dias de inatividade.
 * @param config Prazos configurados.
 * @returns Total devido (0 enquanto o prazo nao vence).
 */
export function contarRebaixamentosDevidos(dias: number, config: ConfiguracaoInatividade): number {
  if (dias < config.diasRebaixamento) {
    return 0;
  }

  const diasExtras = dias - config.diasRebaixamento;

  return 1 + Math.floor(diasExtras / Math.max(1, config.diasEntreRebaixamentos));
}

/**
 * Faixa imediatamente inferior a informada.
 *
 * @param codigo Elo de partida.
 * @param faixas Faixas configuradas.
 * @returns A faixa de baixo, ou null em Curioso (piso da progressao).
 */
export function eloAbaixo(
  codigo: EloXp,
  faixas: readonly FaixaEloDto[] = FAIXAS_ELO,
): FaixaEloDto | null {
  const atual = obterFaixaEloPorCodigo(codigo, faixas);

  return faixas.find((faixa) => faixa.ordem === atual.ordem - 1) ?? null;
}

/**
 * XP de elo apos um rebaixamento: o limite superior da faixa de destino, ou seja,
 * um ponto abaixo do minimo da faixa perdida.
 *
 * Exemplo da US: perder o R3 (minimo 6.000) para o R1 deixa o XP de elo em 5.999.
 *
 * @param faixaPerdida Faixa da qual o estudante foi rebaixado.
 * @returns Novo XP de elo (nunca negativo).
 */
export function xpEloAposRebaixamento(faixaPerdida: FaixaEloDto): number {
  return Math.max(0, faixaPerdida.xpMinimo - 1);
}

// Monta uma notificacao amarrada ao ciclo de inatividade corrente. A chave combina a
// data da ultima atividade com um sufixo opcional, garantindo que a rotina possa rodar
// varias vezes sem repetir o mesmo aviso (unique [usuarioId, tipo, chave] no banco).
function montarNotificacao(
  tipo: TipoNotificacaoElo,
  cicloEm: Date,
  titulo: string,
  mensagem: string,
  extras: {
    eloRelacionado?: EloXp | null;
    prazoRebaixamentoEm?: Date | null;
    sufixoChave?: string;
  } = {},
): NotificacaoPlanejada {
  const base = cicloEm.toISOString();

  return {
    tipo,
    chave: extras.sufixoChave ? `${base}:${extras.sufixoChave}` : base,
    titulo,
    mensagem,
    eloRelacionado: extras.eloRelacionado ?? null,
    prazoRebaixamentoEm: extras.prazoRebaixamentoEm ?? null,
  };
}

function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// Avisos que antecedem a perda do elo: preventivo, "em risco" e vespera.
//
// Valem apenas enquanto o rebaixamento nao aconteceu. Na primeira avaliacao de quem ja
// esta inativo ha muito tempo, anunciar "falta um dia para o rebaixamento" junto com o
// rebaixamento em si seria falso, entao esses avisos sao suprimidos.
function planejarAvisos(
  dias: number,
  config: ConfiguracaoInatividade,
  cicloEm: Date,
  prazo: Date | null,
  eloAtual: FaixaEloDto,
): NotificacaoPlanejada[] {
  const avisos: NotificacaoPlanejada[] = [];
  const prazoTexto = prazo ? ` Prazo: ${formatarData(prazo)}.` : "";

  if (dias >= config.diasRebaixamento) {
    return avisos;
  }

  if (dias >= config.diasAviso) {
    avisos.push(
      montarNotificacao(
        TipoNotificacaoElo.AVISO_PREVENTIVO,
        cicloEm,
        "Seu elo precisa de atenção",
        `Você está há ${dias} dias sem concluir um quiz. Conclua um quiz que conceda XP para manter o elo ${eloAtual.nome} ativo.`,
        { eloRelacionado: eloAtual.codigo, prazoRebaixamentoEm: prazo },
      ),
    );
  }

  if (dias >= config.diasRisco) {
    avisos.push(
      montarNotificacao(
        TipoNotificacaoElo.ELO_EM_RISCO,
        cicloEm,
        "Seu elo está em risco",
        `O elo ${eloAtual.nome} será rebaixado se você continuar sem concluir quizzes.${prazoTexto}`,
        { eloRelacionado: eloAtual.codigo, prazoRebaixamentoEm: prazo },
      ),
    );
  }

  if (dias >= config.diasRebaixamento - 1) {
    avisos.push(
      montarNotificacao(
        TipoNotificacaoElo.VESPERA_REBAIXAMENTO,
        cicloEm,
        "Último dia para manter seu elo",
        `Falta um dia para o rebaixamento do elo ${eloAtual.nome}. Conclua um quiz hoje para zerar a contagem.${prazoTexto}`,
        { eloRelacionado: eloAtual.codigo, prazoRebaixamentoEm: prazo },
      ),
    );
  }

  return avisos;
}

/**
 * Decide tudo o que a inatividade de um estudante implica, sem tocar no banco.
 *
 * Aplica em cascata os rebaixamentos ainda nao aplicados neste ciclo (devidos menos
 * aplicados), ajusta o XP de elo a cada queda, respeita o piso do elo Curioso e monta
 * os avisos correspondentes. O XP total e o maior elo nunca sao alterados aqui.
 *
 * @param progresso Estado persistido do estudante.
 * @param agora Momento de referencia.
 * @param config Prazos configurados.
 * @param faixas Faixas de elo configuradas.
 * @returns Plano com o estado final, os eventos de historico e as notificacoes.
 */
export function planejarInatividade(
  progresso: EstadoProgressoElo,
  agora: Date,
  config: ConfiguracaoInatividade = CONFIGURACAO_INATIVIDADE_PADRAO,
  faixas: readonly FaixaEloDto[] = FAIXAS_ELO,
): PlanoInatividade {
  const diasInatividade = calcularDiasInatividade(
    progresso.ultimaAtividadeEm,
    agora,
    config.indisponibilidades,
  );

  // No piso da progressao (Curioso) nao ha o que perder: a US diz que o elo Curioso nao
  // sofre novo rebaixamento, entao o estado nao entra em risco nem em rebaixado e nenhum
  // aviso de perda e gerado.
  const noPiso = eloAbaixo(progresso.eloAtual, faixas) === null;
  const estado = noPiso ? EstadoElo.ATIVO : calcularEstadoElo(diasInatividade, config);

  const rebaixamentos: RebaixamentoPlanejado[] = [];
  let eloFinal = obterFaixaEloPorCodigo(progresso.eloAtual, faixas);
  let xpEloFinal = Math.max(0, progresso.xpElo);
  let rebaixamentosAplicados = Math.max(0, progresso.rebaixamentosAplicados);

  // Sem atividade registrada, ou ja no piso da progressao, nao ha queda a aplicar.
  const devidos =
    progresso.ultimaAtividadeEm && !noPiso
      ? contarRebaixamentosDevidos(diasInatividade, config)
      : 0;

  for (let i = rebaixamentosAplicados; i < devidos; i++) {
    const destino = eloAbaixo(eloFinal.codigo, faixas);

    // Piso: o elo Curioso nao sofre novo rebaixamento. Mesmo assim contamos a queda
    // como aplicada, para a rotina nao reavaliar o mesmo periodo indefinidamente.
    if (!destino) {
      rebaixamentosAplicados = devidos;
      break;
    }

    const xpEloAntes = xpEloFinal;
    xpEloFinal = Math.min(xpEloFinal, xpEloAposRebaixamento(eloFinal));

    rebaixamentos.push({
      eloAnterior: eloFinal.codigo,
      eloNovo: destino.codigo,
      xpEloAntes,
      xpEloDepois: xpEloFinal,
      diasInatividade,
    });

    eloFinal = destino;
    rebaixamentosAplicados = i + 1;
  }

  // Sem rebaixamento possivel nao existe prazo a exibir.
  const prazoRebaixamentoEm = noPiso
    ? null
    : calcularPrazoRebaixamento(progresso.ultimaAtividadeEm, rebaixamentosAplicados, config, agora);

  const cicloEm = progresso.ultimaAtividadeEm;
  const notificacoes: NotificacaoPlanejada[] = [];

  if (cicloEm && !noPiso) {
    notificacoes.push(
      ...planejarAvisos(
        diasInatividade,
        config,
        cicloEm,
        prazoRebaixamentoEm,
        obterFaixaEloPorCodigo(progresso.eloAtual, faixas),
      ),
    );

    for (const rebaixamento of rebaixamentos) {
      const perdido = obterFaixaEloPorCodigo(rebaixamento.eloAnterior, faixas);
      const novo = obterFaixaEloPorCodigo(rebaixamento.eloNovo, faixas);

      notificacoes.push(
        montarNotificacao(
          TipoNotificacaoElo.ELO_REBAIXADO,
          cicloEm,
          "Seu elo foi rebaixado",
          `Após ${rebaixamento.diasInatividade} dias sem quizzes válidos, seu elo passou de ${perdido.nome} para ${novo.nome}. Seu XP total e o maior elo conquistado foram preservados.`,
          {
            eloRelacionado: novo.codigo,
            prazoRebaixamentoEm,
            sufixoChave: novo.codigo,
          },
        ),
      );
    }
  }

  return {
    diasInatividade,
    estado,
    prazoRebaixamentoEm,
    eloFinal,
    xpEloFinal,
    rebaixamentosAplicados,
    rebaixamentos,
    notificacoes,
    houveMudanca:
      rebaixamentos.length > 0 || rebaixamentosAplicados !== progresso.rebaixamentosAplicados,
  };
}

/**
 * Decide o efeito de uma atividade valida sobre o elo: recuperacao de um elo perdido
 * ou promocao inedita. A faixa e sempre a mesma usada na evolucao normal.
 *
 * @param xpElo XP de elo apos o credito.
 * @param eloAtual Elo persistido antes do credito.
 * @param maiorElo Maior elo ja conquistado.
 * @param faixas Faixas configuradas.
 * @returns Elo resultante, maior elo e o tipo de evento (null se nada mudou).
 */
export function planejarEloAposAtividade(
  xpElo: number,
  eloAtual: EloXp,
  maiorElo: EloXp,
  faixas: readonly FaixaEloDto[] = FAIXAS_ELO,
): {
  elo: FaixaEloDto;
  maiorElo: FaixaEloDto;
  evento: TipoEventoElo | null;
} {
  const faixaAtual = obterFaixaEloPorCodigo(eloAtual, faixas);
  const faixaRecorde = obterFaixaEloPorCodigo(maiorElo, faixas);

  const alcancada = calcularFaixaEloPorXp(xpElo, faixas);

  // Mantem o elo atual quando o XP de elo ainda nao chegou na proxima faixa.
  if (alcancada.ordem <= faixaAtual.ordem) {
    return { elo: faixaAtual, maiorElo: faixaRecorde, evento: null };
  }

  const recuperacao = alcancada.ordem <= faixaRecorde.ordem;

  return {
    elo: alcancada,
    maiorElo: recuperacao ? faixaRecorde : alcancada,
    evento: recuperacao ? TipoEventoElo.RECUPERACAO : TipoEventoElo.PROMOCAO,
  };
}

/**
 * Notificacao de elo recuperado (a US exige aviso apenas na recuperacao, nao na
 * promocao inedita, que ja e celebrada na tela de resultado do quiz).
 *
 * @param elo Elo recuperado.
 * @param eventoId Id do evento de historico, usado como chave de deduplicacao.
 * @returns Notificacao pronta para gravacao.
 */
export function montarNotificacaoRecuperacao(
  elo: FaixaEloDto,
  eventoId: string,
): NotificacaoPlanejada {
  return {
    tipo: TipoNotificacaoElo.ELO_RECUPERADO,
    chave: `${elo.codigo}:${eventoId}`,
    titulo: "Elo recuperado",
    mensagem: `Você voltou a acumular XP de elo e recuperou o elo ${elo.nome}.`,
    eloRelacionado: elo.codigo,
    prazoRebaixamentoEm: null,
  };
}
