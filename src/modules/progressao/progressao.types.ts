import type {
  Dificuldade,
  EloXp,
  EstadoElo,
  OrigemXp,
  TipoEventoElo,
  TipoNotificacaoElo,
} from "@prisma/client";

import type { RespostaQuestaoQuizDto } from "@/modules/quiz/dto/responses/resposta_questao_quiz_dto";

// Contratos do modulo de progressao (rodadas de quiz, XP, nivel e elo).

// Body de POST /quiz/tentativas: filtros da rodada (iguais aos da tela de escolha).
export type IniciarTentativaDto = {
  tema?: string;
  dificuldade?: Dificuldade;
};

// Rodada recem-criada: id para amarrar as respostas e as questoes ja sorteadas.
export type TentativaIniciadaDto = {
  tentativaId: string;
  totalQuestoes: number;
  questoes: RespostaQuestaoQuizDto[];
};

// Detalhamento do XP recebido em uma rodada.
export type RecompensaXpDto = {
  xpBase: number;
  bonusDesempenho: number;
  bonusPowerUp: number;
  xpTotalRecebido: number;
};

// Definicao de uma faixa de elo da plataforma.
export type FaixaEloDto = {
  codigo: EloXp;
  nome: string;
  ordem: number;
  xpMinimo: number;
  xpMaximo: number | null;
  objetivo: string;
};

// Estado de um elo na jornada do estudante (Tela "Todos os elos").
export type StatusFaixaElo =
  | "CONQUISTADO"
  | "ELO_ATUAL"
  | "PROXIMO_ELO"
  | "BLOQUEADO"
  | "ELO_MAXIMO";

// Item da lista completa de elos com o progresso do estudante na faixa.
export type EloJornadaDto = FaixaEloDto & {
  status: StatusFaixaElo;
  conquistado: boolean;
  ehAtual: boolean;
  percentual: number;
  xpFaltante: number;
  eloAnteriorNome: string | null;
};

// Saldos e elos persistidos do estudante, entrada de montarProgressoNivel.
export type DadosProgressoElo = {
  xpTotal: number;
  xpElo: number;
  eloAtual: EloXp;
  maiorElo: EloXp;
};

// Retrato da inatividade usado na montagem do progresso.
export type RetratoInatividade = {
  estado: EstadoElo;
  diasInatividade: number;
  diasParaAviso: number;
  ultimaAtividadeEm: Date | null;
  prazoRebaixamentoEm: Date | null;
};

// Nivel/elo atual e progresso ate o proximo (alimenta a barra de progresso e telas de elo).
export type ProgressoNivelDto = {
  xpTotal: number;
  // Pontuacao que determina o elo: cresce com o XP total, mas e reduzida no rebaixamento.
  xpElo: number;
  nivel: number;
  proximoNivel: number;
  xpNoNivel: number;
  xpNecessarioNoNivel: number;
  xpFaltante: number;
  percentual: number;
  eloAtual: FaixaEloDto;
  maiorElo: FaixaEloDto;
  proximoElo: FaixaEloDto | null;
  xpNoElo: number;
  xpNecessarioNoElo: number | null;
  xpFaltanteProximoElo: number;
  percentualElo: number;
  todosOsElos: EloJornadaDto[];
  // Inatividade (US #89): estado do elo, contagem e prazo para o proximo rebaixamento.
  estadoElo: EstadoElo;
  diasInatividade: number;
  // Limiar configurado do aviso preventivo, para o front saber quando exibir o alerta
  // em vez de assumir um numero de dias que o administrador pode ter mudado.
  diasParaAviso: number;
  ultimaAtividadeEm: string | null;
  prazoRebaixamentoEm: string | null;
};

// Janela de indisponibilidade reconhecida da plataforma, descontada da inatividade.
export type JanelaIndisponibilidade = {
  inicio: string | Date;
  fim: string | Date;
};

// Prazos da regra de inatividade (vindos da linha unica de configuracao).
export type ConfiguracaoInatividade = {
  diasAviso: number;
  diasRisco: number;
  diasRebaixamento: number;
  diasEntreRebaixamentos: number;
  indisponibilidades: readonly JanelaIndisponibilidade[];
};

// Configuracao exposta pela API administrativa.
export type ConfiguracaoInatividadeDto = {
  diasAviso: number;
  diasRisco: number;
  diasRebaixamento: number;
  diasEntreRebaixamentos: number;
  indisponibilidades: { inicio: string; fim: string }[];
  atualizadoPorId: string | null;
  // null enquanto nenhum administrador tiver alterado os prazos.
  atualizadoEm: string | null;
};

// Estado persistido do estudante que as regras de inatividade consomem.
export type EstadoProgressoElo = {
  xpElo: number;
  eloAtual: EloXp;
  maiorElo: EloXp;
  ultimaAtividadeEm: Date | null;
  rebaixamentosAplicados: number;
};

// Uma queda de elo decidida pelas regras, pronta para virar linha de historico.
export type RebaixamentoPlanejado = {
  eloAnterior: EloXp;
  eloNovo: EloXp;
  xpEloAntes: number;
  xpEloDepois: number;
  diasInatividade: number;
};

// Notificacao decidida pelas regras. `chave` deduplica o aviso dentro do ciclo.
export type NotificacaoPlanejada = {
  tipo: TipoNotificacaoElo;
  chave: string;
  titulo: string;
  mensagem: string;
  eloRelacionado: EloXp | null;
  prazoRebaixamentoEm: Date | null;
};

// Resultado completo da avaliacao de inatividade de um estudante.
export type PlanoInatividade = {
  diasInatividade: number;
  estado: EstadoElo;
  prazoRebaixamentoEm: Date | null;
  eloFinal: FaixaEloDto;
  xpEloFinal: number;
  rebaixamentosAplicados: number;
  rebaixamentos: RebaixamentoPlanejado[];
  notificacoes: NotificacaoPlanejada[];
  houveMudanca: boolean;
};

// Linha do historico de progressao de elo (promocao, rebaixamento ou recuperacao).
export type EventoEloDto = {
  id: string;
  data: string;
  tipo: TipoEventoElo;
  eloAnterior: FaixaEloDto;
  eloNovo: FaixaEloDto;
  xpEloAntes: number;
  xpEloDepois: number;
  diasInatividade: number | null;
};

// Aviso destinado ao estudante (banner/modal no front).
export type NotificacaoEloDto = {
  id: string;
  data: string;
  tipo: TipoNotificacaoElo;
  titulo: string;
  mensagem: string;
  eloRelacionado: EloXp | null;
  prazoRebaixamentoEm: string | null;
  lida: boolean;
};

// Resumo da varredura em lote de inatividade.
export type ResultadoVerificacaoInatividadeDto = {
  avaliados: number;
  rebaixamentos: number;
  notificacoes: number;
  // true quando o lote encheu: o agendador deve chamar a rotina de novo.
  pendentes: boolean;
};

// Resposta de POST /quiz/tentativas/:id/concluir.
// jaConcluida = true indica repeticao da chamada (nenhum XP novo foi creditado).
export type ResultadoTentativaDto = {
  missoesConcluidas?: { nome: string; recompensaXp: number }[];
  tentativaId: string;
  tema: string | null;
  dificuldade: Dificuldade | null;
  totalQuestoes: number;
  totalAcertos: number;
  jaConcluida: boolean;
  recompensa: RecompensaXpDto;
  progresso: ProgressoNivelDto;
  subiuDeNivel: boolean;
  nivelAnterior: number;
  subiuDeElo: boolean;
  eloAnterior: FaixaEloDto;
  novoElo: FaixaEloDto;
  xpExcedenteElo: number;
};

// Linha do historico de XP: data, origem, quiz relacionado e valor.
export type HistoricoXpItemDto = {
  id: string;
  data: string;
  origem: OrigemXp;
  missao: { codigo: string; nome: string } | null;
  quiz: {
    tentativaId: string;
    tema: string | null;
    dificuldade: Dificuldade | null;
    totalQuestoes: number;
    totalAcertos: number;
  } | null;
  xpBase: number;
  bonusDesempenho: number;
  bonusPowerUp: number;
  valor: number;
};

// Query do historico de XP.
export type HistoricoXpQueryDto = {
  page?: number;
  limit?: number;
};
