const FUSO = "America/Sao_Paulo";
const dataLocal = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function chaveLocal(instante: Date): string {
  const partes = Object.fromEntries(
    dataLocal.formatToParts(instante).map(({ type, value }) => [type, value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
}

// Encontra o primeiro instante da data civil, inclusive quando uma mudança de
// horário de verão elimina a meia-noite ou altera a duração do dia.
function inicioDaData(ano: number, mes: number, dia: number): Date {
  const civil = new Date(Date.UTC(ano, mes - 1, dia));
  const chave = civil.toISOString().slice(0, 10);
  let menor = civil.getTime() - 36 * 60 * 60 * 1000;
  let maior = civil.getTime() + 36 * 60 * 60 * 1000;
  while (menor < maior) {
    const meio = Math.floor((menor + maior) / 2);
    if (chaveLocal(new Date(meio)) < chave) menor = meio + 1;
    else maior = meio;
  }
  return new Date(menor);
}

export function periodoDiario(instante: Date) {
  const [ano, mes, dia] = chaveLocal(instante).split("-").map(Number);
  return {
    inicio: inicioDaData(ano, mes, dia),
    fim: inicioDaData(ano, mes, dia + 1),
    fusoHorario: FUSO,
  };
}

// Semana civil de segunda-feira a segunda-feira no fuso de Brasília.
export function periodoSemanal(instante: Date) {
  const [ano, mes, dia] = chaveLocal(instante).split("-").map(Number);
  const dataCivil = new Date(Date.UTC(ano, mes - 1, dia));
  const diasDesdeSegunda = (dataCivil.getUTCDay() + 6) % 7;
  const segunda = new Date(Date.UTC(ano, mes - 1, dia - diasDesdeSegunda));
  return {
    inicio: inicioDaData(segunda.getUTCFullYear(), segunda.getUTCMonth() + 1, segunda.getUTCDate()),
    fim: inicioDaData(segunda.getUTCFullYear(), segunda.getUTCMonth() + 1, segunda.getUTCDate() + 7),
    fusoHorario: FUSO,
  };
}
