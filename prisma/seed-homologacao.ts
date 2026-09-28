import {
  desconectarSeedE2E,
  executarSeedE2E,
} from "./seed.e2e";
import {
  desconectarCatalogo,
  sincronizarCatalogo,
} from "./seed-catalogo";

const RESET_CONFIRMADO = "true";

const obterVariavelObrigatoria = (nome: string): string => {
  const valor = process.env[nome]?.trim();

  if (!valor) {
    throw new Error(`A variavel ${nome} e obrigatoria para executar o seed de homologacao.`);
  }

  return valor;
};

/**
 * Reconstroi um cenario demonstravel na homologacao, usando as identidades
 * reais das contas do Usuario-Service. Nunca e chamado no startup do servico.
 */
async function main() {
  if (process.env.HOMOLOG_SEED_RESET !== RESET_CONFIRMADO) {
    throw new Error(
      "Reset bloqueado. Defina HOMOLOG_SEED_RESET=true somente para confirmar a limpeza do Quiz DB de homologacao.",
    );
  }

  await executarSeedE2E({
    professorId: obterVariavelObrigatoria("HOMOLOG_PROFESSOR_ID"),
    alunoPrincipalId: obterVariavelObrigatoria("HOMOLOG_ALUNO_ID"),
    // IDs extras sao apenas usados para compor dados de dashboard do cenario.
    // Podem ser substituidos por contas reais quando elas estiverem disponiveis.
    alunoSecundarioId:
      process.env.HOMOLOG_ALUNO_SECUNDARIO_ID?.trim() || "aluno-demo-secundario",
    alunoTerciarioId:
      process.env.HOMOLOG_ALUNO_TERCIARIO_ID?.trim() || "aluno-demo-terciario",
  });

  // O cenario e2e contem um catalogo historico. Reaplicar o catalogo
  // idempotente preserva esse cenario e inclui os itens mais recentes.
  await sincronizarCatalogo();
}

main()
  .then(async () => {
    await desconectarSeedE2E();
    await desconectarCatalogo();
  })
  .catch(async (erro: unknown) => {
    console.error(erro);
    await desconectarSeedE2E();
    await desconectarCatalogo();
    process.exit(1);
  });
