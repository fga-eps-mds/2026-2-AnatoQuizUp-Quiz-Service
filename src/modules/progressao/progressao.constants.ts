import type { Dificuldade } from "@prisma/client";

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
