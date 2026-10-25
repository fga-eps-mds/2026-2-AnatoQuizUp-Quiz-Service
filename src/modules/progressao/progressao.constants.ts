import { EloXp, type Dificuldade } from "@prisma/client";

import type { FaixaEloDto } from "./progressao.types";

// Regra de XP da plataforma. Tudo que e "numero magico" da progressao fica aqui,
// para o time ajustar o balanceamento sem tocar na logica.

// Tamanho maximo de uma rodada de quiz. Se o tema/dificuldade tiver menos
// questoes disponiveis, a rodada usa todas as que existirem.
export const LIMITE_QUESTOES_POR_RODADA = 10;

// XP base: recompensa por concluir a rodada, proporcional ao tamanho dela.
export const XP_BASE_POR_QUESTAO = 5;

// Bonus de desempenho: XP extra por acerto, conforme a dificuldade da questao.
export const XP_BONUS_POR_ACERTO: Record<Dificuldade, number> = {
  FACIL: 5,
  MEDIA: 10,
  DIFICIL: 15,
};

// Curva de niveis: para sair do nivel N e preciso XP_POR_NIVEL * N de XP.
// Nivel 1 -> 2 custa 100, 2 -> 3 custa 200, 3 -> 4 custa 300 e assim por diante.
export const XP_POR_NIVEL = 100;

// Faixas configuraveis de elos em ordem crescente de progressao.
// Os nomes representam uma progressao gamificada dentro do AnatoQuizUp.
export const FAIXAS_ELO: readonly FaixaEloDto[] = [
  {
    codigo: EloXp.CURIOSO,
    nome: "Curioso",
    ordem: 1,
    xpMinimo: 0,
    xpMaximo: 499,
    objetivo: "Primeiros passos na plataforma.",
  },
  {
    codigo: EloXp.ACADEMICO,
    nome: "Acadêmico",
    ordem: 2,
    xpMinimo: 500,
    xpMaximo: 1499,
    objetivo: "Participação frequente em quizzes.",
  },
  {
    codigo: EloXp.INTERNO,
    nome: "Interno",
    ordem: 3,
    xpMinimo: 1500,
    xpMaximo: 2999,
    objetivo: "Consolidação do aprendizado.",
  },
  {
    codigo: EloXp.R1,
    nome: "R1",
    ordem: 4,
    xpMinimo: 3000,
    xpMaximo: 5999,
    objetivo: "Início da progressão avançada.",
  },
  {
    codigo: EloXp.R3,
    nome: "R3",
    ordem: 5,
    xpMinimo: 6000,
    xpMaximo: 9999,
    objetivo: "Domínio intermediário.",
  },
  {
    codigo: EloXp.R6,
    nome: "R6",
    ordem: 6,
    xpMinimo: 10000,
    xpMaximo: 14999,
    objetivo: "Alto nível de experiência.",
  },
  {
    codigo: EloXp.STAFF_DO_SERVICO,
    nome: "Staff do serviço",
    ordem: 7,
    xpMinimo: 15000,
    xpMaximo: null,
    objetivo: "Maior nível de progressão.",
  },
];
