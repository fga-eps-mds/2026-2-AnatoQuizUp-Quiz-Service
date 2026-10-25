import type { Dificuldade, EloXp, OrigemXp } from "@prisma/client";

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

// Nivel/elo atual e progresso ate o proximo (alimenta a barra de progresso e telas de elo).
export type ProgressoNivelDto = {
  xpTotal: number;
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
