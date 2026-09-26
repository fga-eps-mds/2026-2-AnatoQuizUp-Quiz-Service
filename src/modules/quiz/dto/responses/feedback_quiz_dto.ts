import type { AlternativaQuestao } from "@prisma/client";
import type { ConquistaDesbloqueadaDto } from "@/modules/conquistas/conquistas.dto";

// Feedback retornado ao responder: correcao, gabarito, moedas e conquistas obtidas.
// moedasJaConcedidas evita pagar de novo por uma questao ja respondida antes.
export type FeedbackQuizDto = {
  correcao: boolean;
  saibaMais: string | null;
  respostaCorreta: AlternativaQuestao;
  saldoMoedas: number;
  moedasConcedidas: number;
  moedasJaConcedidas: boolean;
  conquistasDesbloqueadas: ConquistaDesbloqueadaDto[];
  potencializadorAplicado: {
    nome: string;
    bonusMoedas: number;
  } | null;
};

// Resposta do endpoint de saldo de moedas.
export type SaldoMoedasDto = {
  saldoMoedas: number;
};
