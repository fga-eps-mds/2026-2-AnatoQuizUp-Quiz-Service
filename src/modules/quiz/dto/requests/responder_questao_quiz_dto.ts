import type { TipoQuestaoApi } from "@/modules/questoes/dto/question.types.ts";
import type { AlternativaQuestao } from "@prisma/client";

// Body da resposta de uma questao do quiz (questao, tipo e alternativa marcada).
// tentativaId amarra a resposta a uma rodada de quiz; sem ele a resposta e avulsa.
export type ResponderQuestaoQuizDto = {
  questaoId: string;
  tipo: TipoQuestaoApi;
  respostaMarcada: AlternativaQuestao;
  tentativaId?: string;
};
