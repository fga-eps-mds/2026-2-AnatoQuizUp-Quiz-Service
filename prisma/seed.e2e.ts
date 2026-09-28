import {
  AlternativaQuestao,
  Dificuldade,
  PrismaClient,
  StatusQuestao,
  StatusTurma,
  TierConquista,
  TipoConquista,
  TipoItemLoja,
  TipoQuestao,
} from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Identidades externas usadas para relacionar o cenario do Quiz-Service ao
 * Usuario-Service. O Quiz DB nao possui uma tabela de usuarios propria.
 */
export type IdentidadesSeedE2E = {
  professorId: string;
  alunoPrincipalId: string;
  alunoSecundarioId: string;
  alunoTerciarioId: string;
};

const IDENTIDADES_PADRAO: IdentidadesSeedE2E = {
  professorId: "professor-seed",
  alunoPrincipalId: "aluno-joao",
  alunoSecundarioId: "cmp7fx99d00044hyqq4msqsyt",
  alunoTerciarioId: "cmp7fx99d00044hyqq4mswgsr",
};

/**
 * Recria o cenario completo usado pelos testes de integracao. Esta funcao e
 * destrutiva para o banco do Quiz-Service e, por isso, a protecao especifica
 * da homologacao fica no executor seed-homologacao.ts.
 */
export async function executarSeedE2E(
  identidades: IdentidadesSeedE2E = IDENTIDADES_PADRAO,
) {
  console.log("Iniciando o seed do Quiz-Service...");

  // 1. Limpando as tabelas na ordem correta logo no início para evitar erros de FK
  // UsoItem referencia tanto itens quanto questoes; deve ser removido antes dos
  // dois para permitir reconstruir o cenario apos ativacoes de consumiveis.
  await prisma.usoItem.deleteMany({});
  await prisma.transacaoMoeda.deleteMany({});
  await prisma.inventarioItem.deleteMany({});
  await prisma.recompensaItemConquista.deleteMany({});
  await prisma.desbloqueioConquista.deleteMany({});
  await prisma.conquistaUsuario.deleteMany({});
  await prisma.itemLoja.deleteMany({});
  await prisma.conquista.deleteMany({});
  await prisma.carteiraMoedas.deleteMany({});

  await prisma.listaTurma.deleteMany({});
  await prisma.turmaAluno.deleteMany({});
  await prisma.listaQuestaoItem.deleteMany({});
  await prisma.listaQuestao.deleteMany({});
  await prisma.resolucaoQuestao.deleteMany({});
  await prisma.questaoAlternativa.deleteMany({});
  await prisma.questao.deleteMany({});
  await prisma.tema.deleteMany({});
  await prisma.turma.deleteMany({});

  const PROFESSOR_ID = identidades.professorId;
  const ALUNO_1_ID = identidades.alunoSecundarioId;
  const ALUNO_2_ID = identidades.alunoTerciarioId;
  const MEU_USUARIO_ID = identidades.alunoPrincipalId;

  await prisma.conquista.upsert({
    where: {
      id: "total-acertos",
    },
    update: {
      nome: "Primeiros 5 Acertos",
      descricao: "Acerte cinco questões para desbloquear um avatar exclusivo.",
      tipoConquista: TipoConquista.TOTAL_ACERTOS,
      ativo: true,
    },
    create: {
      id: "total-acertos",
      nome: "Primeiros 5 Acertos",
      descricao: "Acerte cinco questões para desbloquear um avatar exclusivo.",
      tipoConquista: TipoConquista.TOTAL_ACERTOS,
    },
  });

  await prisma.conquista.upsert({
    where: {
      id: "streak-acertos",
    },
    update: {},
    create: {
      id: "streak-acertos",
      nome: "Inabalável",
      descricao: "Mantenha uma sequência de acertos.",
      tipoConquista: TipoConquista.STREAK_ACERTOS,
    },
  });

  // 2. Criando carteira de moedas para testar a loja
  await prisma.carteiraMoedas.create({
    data: {
      usuarioId: MEU_USUARIO_ID,
      saldo: 5000,
    },
  });

  console.log("Carteira de moedas criada para o usuário de teste.");

  // 3. Criando itens da Loja Virtual (cosméticos)
  // Categorias: ICONE_PERFIL, MOLDURA, AVATAR, TITULO, PLANO_FUNDO.
  // Preços diversificados (recompensa por acerto: FACIL 10 / MEDIA 25 / DIFICIL 50).
  // `valor` guarda a cor/gradiente decorativo (círculo do ícone, anel da moldura, fundo);
  // ícones de anatomia vêm do Iconify (silhueta branca); títulos são texto;
  // o ícone premium (logo dourada do AnatoQuiz) é renderizado no front a partir do `codigo`.
  const iconeAnatomia = (nome: string) =>
    `https://api.iconify.design/game-icons/${nome}.svg?color=%23ffffff`;
  const avatar = (seed: string, skinColor: string) =>
    `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&skinColor=${skinColor}`;

  const GRADIENTE_OURO = "linear-gradient(135deg, #FCD34D 0%, #D4AF37 100%)";

  await prisma.itemLoja.createMany({
    data: [
      // --- Ícones de perfil (4) ---
      {
        codigo: "icone-coruja",
        nome: "Coruja",
        descricao: "Para os estudiosos de plantão.",
        tipo: TipoItemLoja.ICONE_PERFIL,
        precoMoedas: 60,
        valor: "linear-gradient(135deg, #71edc8 0%, #00A88F 100%)",
        imagemUrl: iconeAnatomia("owl"),
        previewImagemUrl: iconeAnatomia("owl"),
      },
      {
        codigo: "icone-coracao",
        nome: "Coração",
        descricao: "O órgão que move tudo.",
        tipo: TipoItemLoja.ICONE_PERFIL,
        precoMoedas: 120,
        valor: "linear-gradient(135deg, #fb7185 0%, #e11d48 100%)",
        imagemUrl: iconeAnatomia("heart-organ"),
        previewImagemUrl: iconeAnatomia("heart-organ"),
      },
      {
        codigo: "icone-cerebro",
        nome: "Cérebro",
        descricao: "Para as mentes brilhantes.",
        tipo: TipoItemLoja.ICONE_PERFIL,
        precoMoedas: 200,
        valor: "linear-gradient(135deg, #c4b5fd 0%, #7c3aed 100%)",
        imagemUrl: iconeAnatomia("brain"),
        previewImagemUrl: iconeAnatomia("brain"),
      },
      {
        codigo: "icone-anatoquiz-dourado",
        nome: "AnatoQuiz Dourado",
        descricao: "Ícone premium com a logo do AnatoQuiz em dourado.",
        tipo: TipoItemLoja.ICONE_PERFIL,
        precoMoedas: 500,
        valor: GRADIENTE_OURO,
        // logo renderizada no front a partir do codigo (asset local)
      },

      // --- Molduras de ícone de perfil (4) - anel em `valor` ---
      {
        codigo: "moldura-bronze",
        nome: "Bronze",
        descricao: "Moldura de bronze para o ícone de perfil.",
        tipo: TipoItemLoja.MOLDURA,
        precoMoedas: 90,
        valor: "linear-gradient(135deg, #d97706 0%, #92400e 100%)",
      },
      {
        codigo: "moldura-prateada",
        nome: "Prateada",
        descricao: "Moldura prateada para o ícone de perfil.",
        tipo: TipoItemLoja.MOLDURA,
        precoMoedas: 140,
        valor: "linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%)",
      },
      {
        codigo: "moldura-dourada",
        nome: "Dourada",
        descricao: "Moldura dourada para o ícone de perfil.",
        tipo: TipoItemLoja.MOLDURA,
        precoMoedas: 220,
        valor: GRADIENTE_OURO,
      },
      {
        codigo: "moldura-neon",
        nome: "Neon",
        descricao: "Moldura neon vibrante para o ícone de perfil.",
        tipo: TipoItemLoja.MOLDURA,
        precoMoedas: 380,
        valor: "linear-gradient(135deg, #22d3ee 0%, #a855f7 100%)",
      },

      // --- Avatares (4) - modelos prontos, sem customização. Mesmo preço (100). ---
      {
        codigo: "avatar-estudioso",
        nome: "O Estudioso",
        descricao: "Avatar pronto de estudante.",
        tipo: TipoItemLoja.AVATAR,
        precoMoedas: 100,
        imagemUrl: avatar("Estudioso7", "ae5d29"),
        previewImagemUrl: avatar("Estudioso7", "ae5d29"),
      },
      {
        codigo: "avatar-mundo-da-lua",
        nome: "Mundo da Lua",
        descricao: "Avatar pronto de estudante.",
        tipo: TipoItemLoja.AVATAR,
        precoMoedas: 100,
        imagemUrl: avatar("MundoDaLua3", "d08b5b"),
        previewImagemUrl: avatar("MundoDaLua3", "d08b5b"),
      },
      {
        codigo: "avatar-nerd",
        nome: "Nerd de Plantão",
        descricao: "Avatar pronto de estudante.",
        tipo: TipoItemLoja.AVATAR,
        precoMoedas: 100,
        imagemUrl: avatar("NerdDePlantao", "edb98a"),
        previewImagemUrl: avatar("NerdDePlantao", "edb98a"),
      },
      {
        codigo: "avatar-modo-tedio",
        nome: "Modo Tédio",
        descricao: "Avatar pronto de estudante.",
        tipo: TipoItemLoja.AVATAR,
        precoMoedas: 100,
        imagemUrl: avatar("ModoTedio9", "ffdbb4"),
        previewImagemUrl: avatar("ModoTedio9", "ffdbb4"),
      },

      // --- Títulos (4) - renderizados como texto ---
      {
        codigo: "titulo-calouro-curioso",
        nome: "Calouro Curioso",
        descricao: "Título de destaque para quem está começando a jornada.",
        tipo: TipoItemLoja.TITULO,
        precoMoedas: 50,
      },
      {
        codigo: "titulo-veterano-dos-ossos",
        nome: "Veterano dos Ossos",
        descricao: "Título de destaque para os experientes em osteologia.",
        tipo: TipoItemLoja.TITULO,
        precoMoedas: 150,
      },
      {
        codigo: "titulo-mestre-anatomia",
        nome: "Mestre da Anatomia",
        descricao: "Título de destaque para quem domina o corpo humano.",
        tipo: TipoItemLoja.TITULO,
        precoMoedas: 250,
      },
      {
        codigo: "titulo-doutor-em-formacao",
        nome: "Doutor em Formação",
        descricao: "Título de destaque para os futuros doutores.",
        tipo: TipoItemLoja.TITULO,
        precoMoedas: 400,
      },

      // --- Planos de fundo (4) - cor/gradiente em `valor` ---
      {
        codigo: "fundo-azul-noturno",
        nome: "Azul Noturno",
        descricao: "Plano de fundo em azul escuro, padrão da plataforma.",
        tipo: TipoItemLoja.PLANO_FUNDO,
        precoMoedas: 80,
        valor: "#0A1128",
      },
      {
        codigo: "fundo-verde-menta",
        nome: "Verde Menta",
        descricao: "Plano de fundo em verde menta suave.",
        tipo: TipoItemLoja.PLANO_FUNDO,
        precoMoedas: 130,
        valor: "linear-gradient(135deg, #71edc8 0%, #34d399 100%)",
      },
      {
        codigo: "fundo-laranja-vibrante",
        nome: "Laranja Vibrante",
        descricao: "Plano de fundo em laranja energético.",
        tipo: TipoItemLoja.PLANO_FUNDO,
        precoMoedas: 180,
        valor: "linear-gradient(135deg, #fb923c 0%, #F97316 100%)",
      },
      {
        codigo: "fundo-textura-anatomica",
        nome: "Textura Anatômica",
        descricao: "Plano de fundo com gradiente inspirado na identidade do AnatoQuizUp.",
        tipo: TipoItemLoja.PLANO_FUNDO,
        precoMoedas: 350,
        valor: "linear-gradient(135deg, #0A1128 0%, #00214d 100%)",
      },
    ],
  });

  const avatarExclusivo = await prisma.itemLoja.upsert({
    where: {
      codigo: "avatar-explorador-anatomia",
    },
    update: {
      nome: "Explorador da Anatomia",
      descricao: "Avatar exclusivo para quem conquistou seus primeiros cinco acertos.",
      tipo: TipoItemLoja.AVATAR,
      precoMoedas: 0,
      imagemUrl: avatar("ExploradorAnatomia", "edb98a"),
      previewImagemUrl: avatar("ExploradorAnatomia", "edb98a"),
      ativo: true,
      disponivelNaLoja: false,
      excluidoEm: null,
    },
    create: {
      codigo: "avatar-explorador-anatomia",
      nome: "Explorador da Anatomia",
      descricao: "Avatar exclusivo para quem conquistou seus primeiros cinco acertos.",
      tipo: TipoItemLoja.AVATAR,
      precoMoedas: 0,
      imagemUrl: avatar("ExploradorAnatomia", "edb98a"),
      previewImagemUrl: avatar("ExploradorAnatomia", "edb98a"),
      ativo: true,
      disponivelNaLoja: false,
    },
  });

  await prisma.recompensaItemConquista.upsert({
    where: {
      conquistaId_tier: {
        conquistaId: "total-acertos",
        tier: TierConquista.BRONZE,
      },
    },
    update: {
      itemLojaId: avatarExclusivo.id,
    },
    create: {
      conquistaId: "total-acertos",
      tier: TierConquista.BRONZE,
      itemLojaId: avatarExclusivo.id,
    },
  });

  console.log("Itens da loja virtual (cosméticos) criados com sucesso.");
  console.log("Avatar exclusivo associado a conquista Primeiros 5 Acertos.");

  // 2. Criando Temas
  const temas = {
    neuro: await prisma.tema.create({ data: { id: "tema-seed-neuro", nome: "Neuroanatomia" } }),
    abdome: await prisma.tema.create({ data: { id: "tema-seed-abdome", nome: "Abdome Agudo" } }),
    esqueleto: await prisma.tema.create({ data: { nome: "Sistema Esquelético" } }),
  };
  console.log("Temas criados com sucesso.");

  // 3. Criando todas as Turmas (Com o seu utilizador em todas)
  await prisma.turma.create({
    data: {
      codigo: "ANAT-01-2026",
      nome: "Turma A - Anatomia Sistêmica",
      semestre: "1",
      ano: 2026,
      descricao: "Turma matutina de Anatomia Sistêmica",
      status: StatusTurma.ATIVA,
      professorId: PROFESSOR_ID,
      alunos: { create: [{ alunoId: ALUNO_1_ID }, { alunoId: ALUNO_2_ID }, { alunoId: MEU_USUARIO_ID }] }
    }
  });

  const turma2 = await prisma.turma.create({
    data: {
      codigo: "NEURO-02-2026",
      nome: "Turma B - Neuroanatomia",
      semestre: "1",
      ano: 2026,
      descricao: "Turma vespertina de Neuroanatomia",
      status: StatusTurma.ATIVA,
      professorId: PROFESSOR_ID,
      alunos: { create: [{ alunoId: ALUNO_1_ID }, { alunoId: MEU_USUARIO_ID }] }
    }
  });

  const turma3 = await prisma.turma.create({
    data: {
      codigo: "ANATO-101",
      nome: "Anatomia Humana I",
      semestre: "1",
      ano: 2026,
      descricao: "Turma de calouros",
      professorId: PROFESSOR_ID,
      alunos: {
        create: [
          { alunoId: "aluno-teste-1" },
          { alunoId: "aluno-teste-2" },
          { alunoId: "aluno-teste-3" },
          { alunoId: MEU_USUARIO_ID },
        ]
      }
    }
  });

  const turma4 = await prisma.turma.create({
    data: {
      codigo: "NEURO-201",
      nome: "Neuroanatomia Avançada",
      semestre: "3",
      ano: 2026,
      descricao: "Turma do terceiro semestre",
      professorId: PROFESSOR_ID,
      alunos: {
        create: [
          { alunoId: "aluno-teste-4" },
          { alunoId: "aluno-teste-5" },
          { alunoId: MEU_USUARIO_ID },
        ]
      }
    }
  });

  await prisma.turma.create({
    data: {
      codigo: "NEURO-101",
      nome: "Neuroanatomia Básica",
      semestre: "1",
      ano: 2026,
      descricao: "Turma do primeiro semestre",
      professorId: PROFESSOR_ID,
    }
  });

  await prisma.turma.create({
    data: {
      codigo: "TO-BE-EXCLUDED-101",
      nome: "Excluir turma",
      semestre: "2",
      ano: 2026,
      descricao: "Turma do segundo semestre",
      professorId: PROFESSOR_ID,
    }
  });
  console.log("Turmas criadas com sucesso.");

  // 4. Criando Questões Avulsas Iniciais
  await prisma.questao.create({
    data: {
      enunciado: "Segundo a divisão do sistema nervoso baseada na funcionalidade, o sistema nervoso autônomo (SNA) é a parte eferente do sistema nervoso visceral. Baseado nos seus conceitos de neuroanatomia, selecione a alternativa INCORRETA.",
      tipoQuestao: TipoQuestao.MULTIPLA_ESCOLHA,
      respostaCorreta: AlternativaQuestao.C,
      saibaMais: "A distribuição da parte parassimpática do SNA difere da divisão simpática, pois suas fibras não passam pelos ramos dos nervos espinhais.",
      dificuldade: Dificuldade.MEDIA,
      temaId: temas.neuro.id,
      criadoPorId: "system-seed-user",
      alternativas: {
        create: {
          alternativaA: "As respostas autonômicas simpáticas são elaboradas e coordenadas pela porção posterior do hipotálamo.",
          alternativaB: "A divisão simpática do SNA é denominada toracolombar devido a localização dos corpos celulares.",
          alternativaC: "Tanto as fibras da parte simpática como da parte parassimpática do SNA passam pelos ramos dos nervos espinhais.",
          alternativaD: "Os corpos celulares dos neurônios pré-ganglionares da divisão parassimpática podem estar nos núcleos encefálicos.",
          alternativaE: "Nenhuma das alternativas anteriores.",
        },
      },
    },
  });

  await prisma.questao.create({
    data: {
      enunciado: "Paciente feminino, 29 anos, chega mancando ao PS do Hospital com quadro de dor intensa em fossa ilíaca direita, parada de eliminação de fezes e flatos. No exame físico, apresenta palpação abdominal dolorosa, com dor à descompressão brusca. Qual o exame de imagem mais indicado para auxiliar no diagnóstico?",
      tipoQuestao: TipoQuestao.MULTIPLA_ESCOLHA,
      respostaCorreta: AlternativaQuestao.B,
      saibaMais: "O exame de imagem mais indicado para auxiliar no diagnóstico nesse caso é a Ultrassonografia. É um exame rápido, não invasivo e não utiliza radiação ionizante, sendo excelente para avaliar a presença de inflamação na fossa ilíaca direita.",
      dificuldade: Dificuldade.FACIL,
      temaId: temas.abdome.id,
      criadoPorId: "system-seed-user",
      alternativas: {
        create: {
          alternativaA: "Radiografia",
          alternativaB: "Ultrassonografia",
          alternativaC: "TC com contraste",
          alternativaD: "TC sem contraste",
          alternativaE: "Videolaparoscopia",
        },
      },
    },
  });
  console.log("Questões avulsas populadas.");

  // 5. Arrays de questões massivas
  console.log("Iniciando o seed massivo do Quiz-Service (27 Questões)...");
  const questoes = [
    // NEURO
    {
      temaId: temas.neuro.id, dif: Dificuldade.FACIL, resp: AlternativaQuestao.B,
      enunciado: "Qual estrutura central é responsável pelo controle motor e equilíbrio?",
      saibaMais: "O cerebelo coordena os movimentos.",
      alts: ["Hipotálamo", "Cerebelo", "Bulbo", "Ponte", "Amígdala"]
    },
    {
      temaId: temas.neuro.id, dif: Dificuldade.FACIL, resp: AlternativaQuestao.A,
      enunciado: "Qual lobo cerebral é primariamente associado à visão?",
      saibaMais: "O lobo occipital abriga o córtex visual primário.",
      alts: ["Occipital", "Frontal", "Temporal", "Parietal", "Insular"]
    },
    {
      temaId: temas.neuro.id, dif: Dificuldade.FACIL, resp: AlternativaQuestao.C,
      enunciado: "O sistema nervoso central é composto por quais estruturas principais?",
      saibaMais: "O SNC inclui apenas o encéfalo e a medula espinhal.",
      alts: ["Nervos e gânglios", "Cérebro e nervos", "Encéfalo e medula espinhal", "Apenas cérebro", "Tronco encefálico e nervos espinhais"]
    },
    {
      temaId: temas.neuro.id, dif: Dificuldade.MEDIA, resp: AlternativaQuestao.C,
      enunciado: "Sobre o sistema nervoso autônomo, qual afirmativa é INCORRETA?",
      saibaMais: "Fibras parassimpáticas não passam pelos ramos dos nervos espinhais.",
      alts: ["Respostas simpáticas vêm do hipotálamo.", "Divisão simpática é toracolombar.", "Fibras parassimpáticas passam pelos nervos espinhais.", "Corpos pré-ganglionares parassimpáticos estão no encéfalo.", "Nenhuma das anteriores."]
    },
    {
      temaId: temas.neuro.id, dif: Dificuldade.MEDIA, resp: AlternativaQuestao.B,
      enunciado: "Qual nervo craniano é responsável pela inervação motora dos músculos da mímica facial?",
      saibaMais: "O nervo facial (VII) controla as expressões faciais.",
      alts: ["Trigêmeo (V)", "Facial (VII)", "Oculomotor (III)", "Vago (X)", "Acessório (XI)"]
    },
    {
      temaId: temas.neuro.id, dif: Dificuldade.MEDIA, resp: AlternativaQuestao.D,
      enunciado: "Qual o principal neurotransmissor liberado pelos neurônios pós-ganglionares simpáticos?",
      saibaMais: "A noradrenalina atua nos receptores adrenérgicos dos órgãos alvo.",
      alts: ["Acetilcolina", "Dopamina", "Serotonina", "Noradrenalina", "GABA"]
    },
    {
      temaId: temas.neuro.id, dif: Dificuldade.DIFICIL, resp: AlternativaQuestao.A,
      enunciado: "Uma lesão no fascículo grácil da medula espinhal resulta na perda de qual função?",
      saibaMais: "O fascículo grácil conduz propriocepção e tato fino dos membros inferiores.",
      alts: ["Propriocepção dos membros inferiores", "Dor e temperatura contralaterais", "Motricidade dos membros superiores", "Visão periférica", "Audição ipsilateral"]
    },
    {
      temaId: temas.neuro.id, dif: Dificuldade.DIFICIL, resp: AlternativaQuestao.E,
      enunciado: "A artéria cerebral média é ramo direto de qual grande vaso?",
      saibaMais: "Ela é continuação direta da artéria carótida interna.",
      alts: ["Artéria basilar", "Artéria vertebral", "Artéria carótida externa", "Artéria cerebral posterior", "Artéria carótida interna"]
    },
    {
      temaId: temas.neuro.id, dif: Dificuldade.DIFICIL, resp: AlternativaQuestao.B,
      enunciado: "Qual núcleo dos gânglios da base degenera na Doença de Huntington?",
      saibaMais: "A perda de neurônios no núcleo caudado e putâmen gera a coreia.",
      alts: ["Substância negra", "Núcleo caudado e putâmen", "Globo pálido interno", "Núcleo subtalâmico", "Tálamo"]
    },

    // ABDOME
    {
      temaId: temas.abdome.id, dif: Dificuldade.FACIL, resp: AlternativaQuestao.B,
      enunciado: "Qual o exame de imagem inicial mais indicado para suspeita de apendicite aguda?",
      saibaMais: "A ultrassonografia é rápida e sem radiação.",
      alts: ["Radiografia", "Ultrassonografia", "TC com contraste", "TC sem contraste", "Ressonância"]
    },
    {
      temaId: temas.abdome.id, dif: Dificuldade.FACIL, resp: AlternativaQuestao.A,
      enunciado: "Dor intensa e súbita no hipocôndrio direito, irradiando para escápula, sugere inflamação em qual órgão?",
      saibaMais: "É o quadro clássico de colecistite aguda.",
      alts: ["Vesícula biliar", "Apêndice", "Baço", "Pâncreas", "Rim esquerdo"]
    },
    {
      temaId: temas.abdome.id, dif: Dificuldade.FACIL, resp: AlternativaQuestao.C,
      enunciado: "Sinal de descompressão brusca dolorosa em todo o abdome é indicativo de:",
      saibaMais: "A dor de rebote generalizada sugere peritonite difusa.",
      alts: ["Gastroenterite", "Cálculo renal", "Peritonite", "Constipação", "Hérnia umbilical"]
    },
    {
      temaId: temas.abdome.id, dif: Dificuldade.MEDIA, resp: AlternativaQuestao.D,
      enunciado: "Palpação profunda na fossa ilíaca esquerda provocando dor na direita é qual sinal?",
      saibaMais: "Sinal de Rovsing, típico de apendicite.",
      alts: ["Blumberg", "Murphy", "McBurney", "Rovsing", "Psoas"]
    },
    {
      temaId: temas.abdome.id, dif: Dificuldade.MEDIA, resp: AlternativaQuestao.B,
      enunciado: "Qual é a causa mais comum de obstrução intestinal em intestino delgado em adultos?",
      saibaMais: "Aderências (bridas) pós-cirúrgicas são a principal causa.",
      alts: ["Hérnias encarceradas", "Aderências pós-operatórias", "Tumores malignos", "Vólvulo", "Doença de Crohn"]
    },
    {
      temaId: temas.abdome.id, dif: Dificuldade.MEDIA, resp: AlternativaQuestao.A,
      enunciado: "O Sinal de Cullen (equimose periumbilical) pode ser encontrado em casos graves de:",
      saibaMais: "Sinal clássico de hemorragia retroperitoneal na pancreatite.",
      alts: ["Pancreatite aguda necro-hemorrágica", "Apendicite supurada", "Colecistite gangrenosa", "Úlcera péptica perfurada", "Diverticulite aguda"]
    },
    {
      temaId: temas.abdome.id, dif: Dificuldade.DIFICIL, resp: AlternativaQuestao.C,
      enunciado: "Em uma radiografia de abdome agudo obstrutivo, o sinal do 'grão de café' indica:",
      saibaMais: "É o achado radiológico patognomônico de vólvulo de sigmoide.",
      alts: ["Íleo biliar", "Intussuscepção", "Vólvulo de sigmoide", "Megacólon tóxico", "Perfuração gástrica"]
    },
    {
      temaId: temas.abdome.id, dif: Dificuldade.DIFICIL, resp: AlternativaQuestao.E,
      enunciado: "Qual critério tomográfico é utilizado para classificar a gravidade da pancreatite aguda?",
      saibaMais: "O Critério de Balthazar avalia necrose e coleções peripancreáticas.",
      alts: ["Ranson", "Apache II", "Alvarado", "Hinchey", "Balthazar"]
    },
    {
      temaId: temas.abdome.id, dif: Dificuldade.DIFICIL, resp: AlternativaQuestao.D,
      enunciado: "A tríade de Rigler (pneumobilia, obstrução de delgado e cálculo ectópico) sela o diagnóstico de:",
      saibaMais: "Íleo biliar ocorre por fístula colecistoentérica.",
      alts: ["Colangite aguda", "Isquemia mesentérica", "Síndrome de Mirizzi", "Íleo biliar", "Coledocolitíase"]
    },

    // ESQUELETO
    {
      temaId: temas.esqueleto.id, dif: Dificuldade.FACIL, resp: AlternativaQuestao.A,
      enunciado: "Qual dos ossos abaixo faz parte exclusivamente do esqueleto axial?",
      saibaMais: "O esterno compõe a caixa torácica anterior.",
      alts: ["Esterno", "Clavícula", "Escápula", "Ílio", "Fêmur"]
    },
    {
      temaId: temas.esqueleto.id, dif: Dificuldade.FACIL, resp: AlternativaQuestao.E,
      enunciado: "Qual é o maior e mais pesado osso do corpo humano?",
      saibaMais: "O fêmur é o osso da coxa.",
      alts: ["Tíbia", "Úmero", "Rádio", "Fíbula", "Fêmur"]
    },
    {
      temaId: temas.esqueleto.id, dif: Dificuldade.FACIL, resp: AlternativaQuestao.C,
      enunciado: "Qual estrutura conecta os músculos aos ossos?",
      saibaMais: "Os tendões transferem a força da contração muscular para o esqueleto.",
      alts: ["Ligamentos", "Cartilagens", "Tendões", "Fáscias", "Bursas"]
    },
    {
      temaId: temas.esqueleto.id, dif: Dificuldade.MEDIA, resp: AlternativaQuestao.C,
      enunciado: "Qual a estrutura cartilaginosa por onde os ossos longos crescem em comprimento?",
      saibaMais: "A placa epifisária permite a ossificação endocondral.",
      alts: ["Periósteo", "Linha epifisária", "Placa epifisária", "Canal medular", "Endósteo"]
    },
    {
      temaId: temas.esqueleto.id, dif: Dificuldade.MEDIA, resp: AlternativaQuestao.B,
      enunciado: "A articulação do ombro (glenoumeral) é classicamente classificada como:",
      saibaMais: "Articulações sinoviais esferoides permitem ampla mobilidade em vários eixos.",
      alts: ["Fibrosa (sindesmose)", "Sinovial esferoide", "Cartilagínea (sínfise)", "Sinovial gínglimo", "Plana"]
    },
    {
      temaId: temas.esqueleto.id, dif: Dificuldade.MEDIA, resp: AlternativaQuestao.D,
      enunciado: "Qual célula óssea é primariamente responsável pela reabsorção da matriz óssea?",
      saibaMais: "Os osteoclastos são as células que degradam o osso para remodelamento.",
      alts: ["Osteoblasto", "Osteócito", "Condrócito", "Osteoclasto", "Macrófago"]
    },
    {
      temaId: temas.esqueleto.id, dif: Dificuldade.DIFICIL, resp: AlternativaQuestao.A,
      enunciado: "A ossificação intramembranosa é o principal processo de formação de quais ossos?",
      saibaMais: "Forma ossos chatos do crânio, maxila, mandíbula e parte da clavícula.",
      alts: ["Ossos planos do crânio", "Ossos longos dos membros", "Vértebras", "Ossos do carpo", "Costelas"]
    },
    {
      temaId: temas.esqueleto.id, dif: Dificuldade.DIFICIL, resp: AlternativaQuestao.E,
      enunciado: "O ligamento cruzado anterior (LCA) do joelho impede principalmente qual movimento?",
      saibaMais: "Ele impede a translação anterior da tíbia em relação ao fêmur.",
      alts: ["Rotação externa da tíbia", "Valgo do joelho", "Translação posterior da tíbia", "Hiperflexão do joelho", "Translação anterior da tíbia"]
    },
    {
      temaId: temas.esqueleto.id, dif: Dificuldade.DIFICIL, resp: AlternativaQuestao.B,
      enunciado: "Em uma fratura do colo cirúrgico do úmero, qual nervo corre maior risco de lesão?",
      saibaMais: "O nervo axilar contorna o colo cirúrgico do úmero.",
      alts: ["Nervo radial", "Nervo axilar", "Nervo mediano", "Nervo ulnar", "Nervo musculocutâneo"]
    },
  ];

  const questoesNeuro: string[] = [];
  const questoesAbdome: string[] = [];
  const questoesFaceis: string[] = [];
  const todasQuestoesCriadas = [];

  for (const q of questoes) {
    const questaoCriada = await prisma.questao.create({
      data: {
        temaId: q.temaId,
        enunciado: q.enunciado,
        tipoQuestao: TipoQuestao.MULTIPLA_ESCOLHA,
        respostaCorreta: q.resp,
        saibaMais: q.saibaMais,
        status: StatusQuestao.ATIVO,
        dificuldade: q.dif,
        criadoPorId: PROFESSOR_ID,
        alternativas: {
          create: {
            alternativaA: q.alts[0], alternativaB: q.alts[1], alternativaC: q.alts[2], alternativaD: q.alts[3], alternativaE: q.alts[4]
          }
        }
      }
    });

    todasQuestoesCriadas.push(questaoCriada);

    if (q.temaId === temas.neuro.id) questoesNeuro.push(questaoCriada.id);
    if (q.temaId === temas.abdome.id) questoesAbdome.push(questaoCriada.id);
    if (q.dif === Dificuldade.FACIL) questoesFaceis.push(questaoCriada.id);
  }

  // Definição das Datas para testes dos prazos
  const agora = new Date();
  const prazoFuturo = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000); // Daqui a 7 dias
  const prazoPassado = new Date(agora.getTime() - 2 * 24 * 60 * 60 * 1000); // Expirou há 2 dias

  // 6. Criando as Listas e Vinculando às Turmas COM PRAZOS
  await prisma.listaQuestao.create({
    data: {
      nome: "Simulado de Neuroanatomia - 2026.1",
      criadoPorId: PROFESSOR_ID,
      itens: {
        create: questoesNeuro.map((id, index) => ({
          questaoId: id,
          ordem: index + 1
        }))
      },
      turmas: {
        create: [
          // Tem prazo futuro, está ativa
          { turmaId: turma4.id, prazo: prazoFuturo },
          { turmaId: turma2.id, prazo: prazoFuturo, gabaritoLiberado: true},
        ]
      }
    }
  });

  await prisma.listaQuestao.create({
    data: {
      nome: "Revisão de Abdome Agudo",
      criadoPorId: PROFESSOR_ID,
      itens: {
        create: questoesAbdome.map((id, index) => ({
          questaoId: id,
          ordem: index + 1
        }))
      },
      turmas: {
        create: [
          // Lista Expirada intencionalmente para teste (prazo passado, gabarito oculto)
          { turmaId: turma3.id, prazo: prazoPassado, gabaritoLiberado: false }
        ]
      }
    }
  });

  await prisma.listaQuestao.create({
    data: {
      nome: "Aquecimento Geral (Nível Fácil)",
      criadoPorId: PROFESSOR_ID,
      itens: {
        create: questoesFaceis.map((id, index) => ({
          questaoId: id,
          ordem: index + 1
        }))
      },
      turmas: {
        create: [
          // Uma com prazo futuro, outra Sem Prazo para testar a flexibilidade
          { turmaId: turma3.id, prazo: prazoFuturo },
          { turmaId: turma4.id } // Sem prazo estipulado
        ]
      }
    }
  });

  await prisma.listaQuestao.create({
    data: {
      nome: "A ser excluída",
      criadoPorId: PROFESSOR_ID,
      itens: {
        create: questoesFaceis.map((id, index) => ({
          questaoId: id,
          ordem: index + 1
        }))
      },
    }
  });

  await prisma.listaQuestao.create({
    data: {
      nome: "A ser manipuladada",
      criadoPorId: PROFESSOR_ID,
      itens: {
        create: questoesFaceis.map((id, index) => ({
          questaoId: id,
          ordem: index + 1
        }))
      },
      turmas: {
        create: [
          // Uma com prazo futuro, outra Sem Prazo para testar a flexibilidade
          { turmaId: turma3.id, prazo: prazoFuturo },
          { turmaId: turma4.id } // Sem prazo estipulado
        ]
      }
    }
  });

  await prisma.listaQuestao.create({
    data: {
      nome: "A ser ter nome modificado",
      criadoPorId: PROFESSOR_ID,
      itens: {
        create: questoesFaceis.map((id, index) => ({
          questaoId: id,
          ordem: index + 1
        }))
      },
    }
  });

  // 7. Simulando Respostas dos Alunos para popular o Dashboard
  console.log("Simulando resoluções de questões pelos alunos...");

  for (const q of todasQuestoesCriadas) {
    // Aluno 1 responde
    const acertaAluno1 = Math.random() > 0.2;
    await prisma.resolucaoQuestao.create({
      data: {
        usuarioId: ALUNO_1_ID,
        questaoId: q.id,
        respostaMarcada: acertaAluno1 ? q.respostaCorreta : (q.respostaCorreta === AlternativaQuestao.A ? AlternativaQuestao.B : AlternativaQuestao.A)
      }
    });

    // Aluno 2 responde
    const acertaAluno2 = Math.random() > 0.5;
    await prisma.resolucaoQuestao.create({
      data: {
        usuarioId: ALUNO_2_ID,
        questaoId: q.id,
        respostaMarcada: acertaAluno2 ? q.respostaCorreta : (q.respostaCorreta === AlternativaQuestao.A ? AlternativaQuestao.C : AlternativaQuestao.A)
      }
    });

  }

}

export const desconectarSeedE2E = () => prisma.$disconnect();

// Mantem o comportamento historico de `npm run prisma:seed:e2e` para os testes
// locais. O executor de homologacao importa a funcao acima e fornece IDs reais.
if (require.main === module) {
  executarSeedE2E()
    .then(desconectarSeedE2E)
    .catch(async (erro: unknown) => {
      console.error(erro);
      await desconectarSeedE2E();
      process.exit(1);
    });
}
