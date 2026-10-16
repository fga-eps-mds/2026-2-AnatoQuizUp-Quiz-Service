import type { Dificuldade, OrigemXp } from "@prisma/client";

import type { RespostaQuestaoQuizDto } from "@/modules/quiz/dto/responses/resposta_questao_quiz_dto";

// Contratos do modulo de progressao (rodadas de quiz, XP e nivel).

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

// Nivel atual e progresso ate o proximo (alimenta a barra de progresso).
export type ProgressoNivelDto = {
  xpTotal: number;
  nivel: number;
  proximoNivel: number;
  xpNoNivel: number;
  xpNecessarioNoNivel: number;
  xpFaltante: number;
  percentual: number;
};

// Resposta de POST /quiz/tentativas/:id/concluir.
// jaConcluida = true indica repeticao da chamada (nenhum XP novo foi creditado).
export type ResultadoTentativaDto = {
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
};

// Linha do historico de XP: data, origem, quiz relacionado e valor.
export type HistoricoXpItemDto = {
  id: string;
  data: string;
  origem: OrigemXp;
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
