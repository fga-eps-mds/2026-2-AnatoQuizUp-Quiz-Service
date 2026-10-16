export interface PontuacaoUsuario {
  usuarioId: string;
  xpTotal: number;
  nivel: number;
  totalAcertos: number;
  totalRespondidas: number;
  ultimaAtividade: string | null;
}
