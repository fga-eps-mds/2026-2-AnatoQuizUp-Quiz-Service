import {
  PrismaClient,
  TierConquista,
  TipoConquista,
  TipoEfeitoItem,
  TipoItemLoja,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const iconeAnatomia = (nome: string) =>
  `https://api.iconify.design/game-icons/${nome}.svg?color=%23ffffff`;

const avatar = (seed: string, skinColor: string) =>
  `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&skinColor=${skinColor}`;

const GRADIENTE_OURO = "linear-gradient(135deg, #FCD34D 0%, #D4AF37 100%)";

const itensCatalogo: Prisma.ItemLojaCreateInput[] = [
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
  },
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

  // Itens consumiveis (issue #35): podem ser comprados varias vezes e acumulam
  // quantidade no inventario. O "codigo" identifica o efeito que a #38 aplica.
  {
    codigo: "dica-vacina",
    nome: "Vacina da Dica",
    descricao: "Um reforço rápido para destravar a questão.",
    efeito: "Revela uma dica para a questão.",
    tipo: TipoItemLoja.DICA,
    consumivel: true,
    precoMoedas: 50,
    valor: "linear-gradient(135deg, #7dd3fc 0%, #0284c7 100%)",
    imagemUrl: iconeAnatomia("syringe"),
    previewImagemUrl: iconeAnatomia("syringe"),
  },
  {
    codigo: "dica-pista-extra",
    nome: "Pista Extra",
    descricao: "Uma luz para quando a resposta não vem.",
    efeito: "Mostra uma pista adicional.",
    tipo: TipoItemLoja.DICA,
    consumivel: true,
    precoMoedas: 30,
    valor: "linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)",
    imagemUrl: iconeAnatomia("light-bulb"),
    previewImagemUrl: iconeAnatomia("light-bulb"),
  },
  {
    codigo: "dica-elimina-alternativas",
    nome: "Elimina Alternativas",
    descricao: "Menos opções, mais chances de acertar.",
    efeito: "Remove 2 alternativas erradas.",
    tipo: TipoItemLoja.DICA,
    consumivel: true,
    precoMoedas: 70,
    valor: "linear-gradient(135deg, #fda4af 0%, #e11d48 100%)",
    imagemUrl: iconeAnatomia("cross-mark"),
    previewImagemUrl: iconeAnatomia("cross-mark"),
  },
  {
    codigo: "potencializador-tempo-extra",
    nome: "Tempo Extra",
    descricao: "Mais fôlego para pensar com calma.",
    efeito: "+30 segundos na questão.",
    tipo: TipoItemLoja.POTENCIALIZADOR,
    consumivel: true,
    precoMoedas: 60,
    valor: "linear-gradient(135deg, #93c5fd 0%, #1d4ed8 100%)",
    imagemUrl: iconeAnatomia("stopwatch"),
    previewImagemUrl: iconeAnatomia("stopwatch"),
  },
  {
    codigo: "potencializador-vida-extra",
    nome: "Vida Extra",
    descricao: "Um erro não precisa acabar com a sua sequência.",
    efeito: "Errou? Continue sua sequência.",
    tipo: TipoItemLoja.POTENCIALIZADOR,
    consumivel: true,
    precoMoedas: 100,
    valor: "linear-gradient(135deg, #fb7185 0%, #be123c 100%)",
    imagemUrl: iconeAnatomia("heart-plus"),
    previewImagemUrl: iconeAnatomia("heart-plus"),
  },
  {
    codigo: "potencializador-cafe-do-foco",
    nome: "Café do Foco",
    descricao: "Energia extra para a próxima rodada de estudos.",
    efeito: "Dobra as ATP do proximo acerto elegivel.",
    tipoEfeito: TipoEfeitoItem.DOBRAR_MOEDAS_PROXIMO_ACERTO,
    tipo: TipoItemLoja.POTENCIALIZADOR,
    consumivel: true,
    precoMoedas: 120,
    valor: "linear-gradient(135deg, #d6a77a 0%, #7c4a22 100%)",
    imagemUrl: iconeAnatomia("coffee-cup"),
    previewImagemUrl: iconeAnatomia("coffee-cup"),
  },
];

async function salvarItem(item: Prisma.ItemLojaCreateInput) {
  const { codigo, ...dados } = item;

  return prisma.itemLoja.upsert({
    where: { codigo },
    update: {
      ...dados,
      ativo: true,
      disponivelNaLoja: true,
      excluidoEm: null,
    },
    create: {
      codigo,
      ...dados,
      ativo: true,
      disponivelNaLoja: true,
    },
  });
}

async function main() {
  console.log("Sincronizando catálogo padrão da loja...");

  for (const item of itensCatalogo) {
    await salvarItem(item);
  }

  const conquista = await prisma.conquista.upsert({
    where: { id: "total-acertos" },
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
      ativo: true,
    },
  });

  const avatarExclusivo = await prisma.itemLoja.upsert({
    where: { codigo: "avatar-explorador-anatomia" },
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
        conquistaId: conquista.id,
        tier: TierConquista.BRONZE,
      },
    },
    update: {
      itemLojaId: avatarExclusivo.id,
    },
    create: {
      conquistaId: conquista.id,
      tier: TierConquista.BRONZE,
      itemLojaId: avatarExclusivo.id,
    },
  });

  console.log(`Catálogo sincronizado: ${itensCatalogo.length} itens públicos e 1 item exclusivo.`);
}

main()
  .catch((error) => {
    console.error("Falha ao sincronizar o catálogo da loja.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
