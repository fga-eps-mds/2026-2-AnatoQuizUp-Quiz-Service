// Mensagens de resposta centralizadas (texto unico em toda a API).
export const MENSAGENS = {
  // Mensagens gerais de infraestrutura e erros transversais.
  apiEmExecucao: "API do AnatoQuizUp em execucao.",

  erroInterno: "Ocorreu um erro interno inesperado.",

  erroValidacao: "Falha na validacao da requisicao.",

  rotaNaoEncontrada: "A rota solicitada nao foi encontrada.",

  exemploCriado: "Exemplo criado com sucesso.",

  exemploNaoEncontrado: "Exemplo nao encontrado.",

  exemploEncontrado: "Exemplo encontrado com sucesso.",

  // Mensagens do dominio de questoes.
  questaoCriada: "Questao criada com sucesso.",

  questaoEncontrada: "Questao encontrada com sucesso.",

  questaoAtualizada: "Questao atualizada com sucesso.",

  questaoRemovida: "Questao removida com sucesso.",

  questaoNaoEncontrada: "Questao nao encontrada.",

  questaoAlternativasObrigatorias: "A questao deve possuir alternativas validas.",

  questaoGabaritoObrigatorio: "A questao deve possuir gabarito definido.",

  uploadImagemIndisponivel:
    "O envio de imagens esta temporariamente indisponivel neste ambiente.",

  // Mensagens de usuario, cadastro e administracao.
  usuarioNaoEncontrado: "Usuario nao encontrado.",

  usuarioEncontrado: "Usuario encontrado com sucesso.",

  usuarioStatusAlterado: "Status do usuario alterado com sucesso.",

  usuarioStatusInvalido: "A transicao de status solicitada nao e permitida.",

  usuarioAutoDesativacaoNaoPermitida: "Nao e permitido desativar o proprio usuario.",

  usuarioAdminNaoPodeSerAlterado: "Nao e permitido alterar o status de outro administrador.",

  contextoAdminObrigatorio:
    "Os cabecalhos x-user-id e x-user-papel sao obrigatorios para esta operacao.",
  usuarioCadastrado: "Usuario cadastrado com sucesso.",

  emailJaCadastrado: "Email ja cadastrado.",

  siapeJaCadastrado: "SIAPE ja cadastrado.",

  professorCadastradoPendente: "Cadastro realizado. Aguarde aprovacao do administrador.",

  nicknameJaCadastrado: "Ja existe um usuario cadastrado com este nickname.",

  nacionalidadesListadas: "Nacionalidades listadas com sucesso.",

  opcoesAcademicasListadas: "Opcoes academicas listadas com sucesso.",

  emailDisponivel: "Email disponivel para uso.",

  nicknameDisponivel: "Nickname disponivel para uso.",

  instrucoesRecuperacaoSenhaEnviadas: "Se o email existir no sistema, enviamos instrucoes.",

  senhaRedefinida: "Senha redefinida com sucesso.",

  linkRedefinicaoSenhaInvalido: "Link expirado ou invalido.",

  estadosListados: "Estados listados com sucesso.",

  cidadesListadas: "Cidades listadas com sucesso.",

  origemCorsNaoPermitida: "Origem nao permitida pelo CORS.",

  // Mensagens de autenticacao e sessao.
  loginRealizado: "Login realizado com sucesso.",

  sessaoRenovada: "Sessao renovada com sucesso.",

  usuarioAutenticadoEncontrado: "Usuario autenticado retornado com sucesso.",

  credenciaisInvalidas: "Email ou senha invalidos.",

  tokenInvalido: "Token invalido.",

  cadastroEmAnalise: "Seu cadastro esta em analise pelo administrador.",

  contaDesativada: "Conta desativada. Entre em contato com o administrador.",

  cadastroRecusado: "Cadastro recusado. Entre em contato com o administrador.",

  autenticacaoNaoImplementada: "O middleware de autenticacao ainda nao foi implementado.",

  permissaoPorPapelNaoImplementada:
    "O middleware de permissao por papel ainda nao foi implementado.",

  // Mensagens de quiz, temas e conquistas.
  erroTentativa: "Erro ao registrar tentativa de resposta",

  erroFeedback: "Erro no feedback da questão",

  temasNaoEncontrados: "Temas das questões não foram encontrados",

  operacaoRealizadaComSucesso: "Destaques alterados com sucesso",

  erroListarConquistas: "Erro ao listar conquistas",

  conquistaNaoEncontrada: "Conquista nao encontrada.",

  limiteConquistasDestacadas: "Apenas tres conquistas podem ser destacadas.",
} as const;
