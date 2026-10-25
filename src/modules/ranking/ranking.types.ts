export interface PontuacaoUsuario {
  usuarioId: string;
  xpTotal: number;
  nivel: number;
  elo: string;
  totalAcertos: number;
  totalRespondidas: number;
  ultimaAtividade: string | null;
}
