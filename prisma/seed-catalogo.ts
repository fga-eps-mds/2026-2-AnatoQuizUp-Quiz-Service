import {
  PrismaClient,
  TierConquista,
  TipoConquista,
  TipoEfeitoItem,
  TipoItemLoja,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

import {
  CODIGO_RECOMPENSA_PRIMEIROS_ACERTOS,
  removerItensLegados,
} from "../src/modules/loja/itens-legados";

const prisma = new PrismaClient();

const iconeAnatomia = (nome: string) =>
  `https://api.iconify.design/game-icons/${nome}.svg?color=%23ffffff`;

const GRADIENTE_OURO = "linear-gradient(135deg, #FCD34D 0%, #D4AF37 100%)";

// Itens de avatar (acessorio/luva/calcado/cabelo) sao arte propria, servida pelo Web em
// public/avatar/<categoria>/<codigo>.png — caminho relativo, resolvido no proprio
// dominio do Web que exibe a loja (CosmeticPreview), sem depender de host externo.
const imagemAvatarWeb = (categoria: string, codigo: string) => `/avatar/${categoria}/${codigo}.png`;

const itensCatalogo: Prisma.ItemLojaCreateInput[] = [
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

  // Acessorios (US36, #199 T1.4): 10 modelos novos, sem base existente pra herdar
  // preco (todos sao design novo, nao recolor).
  {
    codigo: "bone",
    nome: "Boné",
    descricao: "Um boné casual pra qualquer ocasião.",
    tipo: TipoItemLoja.ACESSORIO,
    precoMoedas: 150,
    imagemUrl: imagemAvatarWeb("acessorios", "acessorio-bone"),
    previewImagemUrl: imagemAvatarWeb("acessorios", "acessorio-bone"),
  },
  {
    codigo: "tiara",
    nome: "Tiara",
    descricao: "Uma tiara elegante, puro brilho.",
    tipo: TipoItemLoja.ACESSORIO,
    precoMoedas: 220,
    imagemUrl: imagemAvatarWeb("acessorios", "acessorio-tiara"),
    previewImagemUrl: imagemAvatarWeb("acessorios", "acessorio-tiara"),
  },
  {
    codigo: "oculos-sol",
    nome: "Óculos de Sol",
    descricao: "Estilo e proteção contra o sol.",
    tipo: TipoItemLoja.ACESSORIO,
    precoMoedas: 150,
    imagemUrl: imagemAvatarWeb("acessorios", "acessorio-oculos-sol"),
    previewImagemUrl: imagemAvatarWeb("acessorios", "acessorio-oculos-sol"),
  },
  {
    codigo: "chapeu-festa",
    nome: "Chapéu de Festa",
    descricao: "Pra comemorar com estilo.",
    tipo: TipoItemLoja.ACESSORIO,
    precoMoedas: 150,
    imagemUrl: imagemAvatarWeb("acessorios", "acessorio-chapeu-festa"),
    previewImagemUrl: imagemAvatarWeb("acessorios", "acessorio-chapeu-festa"),
  },
  {
    codigo: "capacete",
    nome: "Capacete",
    descricao: "Segurança em primeiro lugar.",
    tipo: TipoItemLoja.ACESSORIO,
    precoMoedas: 220,
    imagemUrl: imagemAvatarWeb("acessorios", "acessorio-capacete"),
    previewImagemUrl: imagemAvatarWeb("acessorios", "acessorio-capacete"),
  },
  {
    codigo: "chapeu-mago",
    nome: "Chapéu de Mago",
    descricao: "Pra quem domina a magia dos estudos.",
    tipo: TipoItemLoja.ACESSORIO,
    precoMoedas: 220,
    imagemUrl: imagemAvatarWeb("acessorios", "acessorio-chapeu-mago"),
    previewImagemUrl: imagemAvatarWeb("acessorios", "acessorio-chapeu-mago"),
  },
  {
    codigo: "chapeu-chef",
    nome: "Chapéu de Chef",
    descricao: "Pra quem cozinha as melhores respostas.",
    tipo: TipoItemLoja.ACESSORIO,
    precoMoedas: 150,
    imagemUrl: imagemAvatarWeb("acessorios", "acessorio-chapeu-chef"),
    previewImagemUrl: imagemAvatarWeb("acessorios", "acessorio-chapeu-chef"),
  },
  {
    codigo: "chapeu-palha",
    nome: "Chapéu de Palha",
    descricao: "Aba larga, estilo de verão.",
    tipo: TipoItemLoja.ACESSORIO,
    precoMoedas: 150,
    imagemUrl: imagemAvatarWeb("acessorios", "acessorio-chapeu-palha"),
    previewImagemUrl: imagemAvatarWeb("acessorios", "acessorio-chapeu-palha"),
  },
  {
    codigo: "mascara-carnaval",
    nome: "Máscara de Carnaval",
    descricao: "Penas coloridas pra brincar o ano inteiro.",
    tipo: TipoItemLoja.ACESSORIO,
    precoMoedas: 220,
    imagemUrl: imagemAvatarWeb("acessorios", "acessorio-mascara-carnaval"),
    previewImagemUrl: imagemAvatarWeb("acessorios", "acessorio-mascara-carnaval"),
  },
  {
    codigo: "chapeu-cowboy",
    nome: "Chapéu de Cowboy",
    descricao: "Pra quem estuda no estilo caubói.",
    tipo: TipoItemLoja.ACESSORIO,
    precoMoedas: 150,
    imagemUrl: imagemAvatarWeb("acessorios", "acessorio-chapeu-cowboy"),
    previewImagemUrl: imagemAvatarWeb("acessorios", "acessorio-chapeu-cowboy"),
  },

  // Luvas (US36, #199 T1.7). Recolor de uma luva existente mantem o preco do
  // modelo-base; a imagem e a mesma arte usada no overlay do avatar (ver Web).
  {
    codigo: "luva-boxe-azul",
    nome: "Boxe Azul",
    descricao: "A luva de boxe clássica, agora em azul.",
    tipo: TipoItemLoja.LUVA,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("luvas", "luva-boxe-azul"),
    previewImagemUrl: imagemAvatarWeb("luvas", "luva-boxe-azul"),
  },
  {
    codigo: "luva-boxe-verde",
    nome: "Boxe Verde",
    descricao: "A luva de boxe clássica, agora em verde.",
    tipo: TipoItemLoja.LUVA,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("luvas", "luva-boxe-verde"),
    previewImagemUrl: imagemAvatarWeb("luvas", "luva-boxe-verde"),
  },
  {
    codigo: "luva-boxe-dourado",
    nome: "Boxe Dourada",
    descricao: "A luva de boxe clássica, agora em dourado.",
    tipo: TipoItemLoja.LUVA,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("luvas", "luva-boxe-dourado"),
    previewImagemUrl: imagemAvatarWeb("luvas", "luva-boxe-dourado"),
  },
  {
    codigo: "luva-boxe-roxo",
    nome: "Boxe Roxa",
    descricao: "A luva de boxe clássica, agora em roxo.",
    tipo: TipoItemLoja.LUVA,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("luvas", "luva-boxe-roxo"),
    previewImagemUrl: imagemAvatarWeb("luvas", "luva-boxe-roxo"),
  },
  {
    codigo: "luva-boxe-preta",
    nome: "Boxe Preta",
    descricao: "A luva de boxe clássica, agora em preto.",
    tipo: TipoItemLoja.LUVA,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("luvas", "luva-boxe-preta"),
    previewImagemUrl: imagemAvatarWeb("luvas", "luva-boxe-preta"),
  },
  {
    codigo: "luva-la-rosa",
    nome: "Lã Rosa",
    descricao: "A luva de lã clássica, em nova paleta rosa com punho branco.",
    tipo: TipoItemLoja.LUVA,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("luvas", "luva-la-rosa"),
    previewImagemUrl: imagemAvatarWeb("luvas", "luva-la-rosa"),
  },
  {
    codigo: "luva-la-verde",
    nome: "Lã Verde",
    descricao: "A luva de lã clássica, em nova paleta verde com punho branco.",
    tipo: TipoItemLoja.LUVA,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("luvas", "luva-la-verde"),
    previewImagemUrl: imagemAvatarWeb("luvas", "luva-la-verde"),
  },
  {
    codigo: "luva-la-azul",
    nome: "Lã Azul",
    descricao: "A luva de lã clássica, em nova paleta azul com punho prateado.",
    tipo: TipoItemLoja.LUVA,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("luvas", "luva-la-azul"),
    previewImagemUrl: imagemAvatarWeb("luvas", "luva-la-azul"),
  },
  {
    codigo: "luva-jardinagem",
    nome: "Jardinagem",
    descricao: "Luva de pano simples, com punho elástico.",
    tipo: TipoItemLoja.LUVA,
    precoMoedas: 150,
    imagemUrl: imagemAvatarWeb("luvas", "luva-jardinagem"),
    previewImagemUrl: imagemAvatarWeb("luvas", "luva-jardinagem"),
  },
  {
    codigo: "luva-goleiro",
    nome: "Goleiro",
    descricao: "Luva com grip emborrachado nos dedos, mais robusta.",
    tipo: TipoItemLoja.LUVA,
    precoMoedas: 220,
    imagemUrl: imagemAvatarWeb("luvas", "luva-goleiro"),
    previewImagemUrl: imagemAvatarWeb("luvas", "luva-goleiro"),
  },

  // Calcados (US36, #199 T1.10). Recolor de um tenis existente mantem o preco do
  // modelo-base; a imagem e a mesma arte usada no overlay do avatar (ver Web).
  {
    codigo: "tenis-esportivo-vermelho",
    nome: "Esportivo Vermelho",
    descricao: "O tênis esportivo clássico, agora em vermelho.",
    tipo: TipoItemLoja.CALCADO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("calcados", "tenis-esportivo-vermelho"),
    previewImagemUrl: imagemAvatarWeb("calcados", "tenis-esportivo-vermelho"),
  },
  {
    codigo: "tenis-esportivo-verde",
    nome: "Esportivo Verde",
    descricao: "O tênis esportivo clássico, agora em verde.",
    tipo: TipoItemLoja.CALCADO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("calcados", "tenis-esportivo-verde"),
    previewImagemUrl: imagemAvatarWeb("calcados", "tenis-esportivo-verde"),
  },
  {
    codigo: "tenis-esportivo-amarelo",
    nome: "Esportivo Amarelo",
    descricao: "O tênis esportivo clássico, agora em amarelo.",
    tipo: TipoItemLoja.CALCADO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("calcados", "tenis-esportivo-amarelo"),
    previewImagemUrl: imagemAvatarWeb("calcados", "tenis-esportivo-amarelo"),
  },
  {
    codigo: "tenis-esportivo-preto",
    nome: "Esportivo Preto",
    descricao: "O tênis esportivo clássico, agora em preto.",
    tipo: TipoItemLoja.CALCADO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("calcados", "tenis-esportivo-preto"),
    previewImagemUrl: imagemAvatarWeb("calcados", "tenis-esportivo-preto"),
  },
  {
    codigo: "tenis-cano-alto-azul",
    nome: "Cano Alto Azul",
    descricao: "O tênis cano alto clássico, agora em azul.",
    tipo: TipoItemLoja.CALCADO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("calcados", "tenis-cano-alto-azul"),
    previewImagemUrl: imagemAvatarWeb("calcados", "tenis-cano-alto-azul"),
  },
  {
    codigo: "tenis-cano-alto-verde",
    nome: "Cano Alto Verde",
    descricao: "O tênis cano alto clássico, agora em verde.",
    tipo: TipoItemLoja.CALCADO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("calcados", "tenis-cano-alto-verde"),
    previewImagemUrl: imagemAvatarWeb("calcados", "tenis-cano-alto-verde"),
  },
  {
    codigo: "tenis-cano-alto-amarelo",
    nome: "Cano Alto Amarelo",
    descricao: "O tênis cano alto clássico, agora em amarelo.",
    tipo: TipoItemLoja.CALCADO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("calcados", "tenis-cano-alto-amarelo"),
    previewImagemUrl: imagemAvatarWeb("calcados", "tenis-cano-alto-amarelo"),
  },
  {
    codigo: "tenis-cano-alto-preto",
    nome: "Cano Alto Preto",
    descricao: "O tênis cano alto clássico, agora em preto.",
    tipo: TipoItemLoja.CALCADO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("calcados", "tenis-cano-alto-preto"),
    previewImagemUrl: imagemAvatarWeb("calcados", "tenis-cano-alto-preto"),
  },
  {
    codigo: "tenis-skate",
    nome: "Skate",
    descricao: "Cano baixo, sola grossa, estilo skatista.",
    tipo: TipoItemLoja.CALCADO,
    precoMoedas: 150,
    imagemUrl: imagemAvatarWeb("calcados", "tenis-skate"),
    previewImagemUrl: imagemAvatarWeb("calcados", "tenis-skate"),
  },
  {
    codigo: "bota-coturno",
    nome: "Coturno",
    descricao: "Cano alto, cadarço cruzado, sola grossa.",
    tipo: TipoItemLoja.CALCADO,
    precoMoedas: 220,
    imagemUrl: imagemAvatarWeb("calcados", "bota-coturno"),
    previewImagemUrl: imagemAvatarWeb("calcados", "bota-coturno"),
  },

  // Cabelos novos (US36, #199 T1.1). Recolor de um estilo existente mantem o
  // preco do modelo-base; a imagem e a mesma arte usada no overlay do avatar.
  {
    codigo: "loiro-castanho",
    nome: "Liso Castanho",
    descricao: "O corte loiro clássico, agora em castanho.",
    tipo: TipoItemLoja.CABELO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("cabelo", "cabelo-loiro-castanho"),
    previewImagemUrl: imagemAvatarWeb("cabelo", "cabelo-loiro-castanho"),
  },
  {
    codigo: "loiro-ruivo",
    nome: "Liso Ruivo",
    descricao: "O corte loiro clássico, agora em ruivo.",
    tipo: TipoItemLoja.CABELO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("cabelo", "cabelo-loiro-ruivo"),
    previewImagemUrl: imagemAvatarWeb("cabelo", "cabelo-loiro-ruivo"),
  },
  {
    codigo: "cacheado-loiro",
    nome: "Cacheado Loiro",
    descricao: "O corte cacheado clássico, agora em loiro.",
    tipo: TipoItemLoja.CABELO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("cabelo", "cabelo-cacheado-loiro"),
    previewImagemUrl: imagemAvatarWeb("cabelo", "cabelo-cacheado-loiro"),
  },
  {
    codigo: "cacheado-castanho",
    nome: "Cacheado Castanho",
    descricao: "O corte cacheado clássico, agora em castanho.",
    tipo: TipoItemLoja.CABELO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("cabelo", "cabelo-cacheado-castanho"),
    previewImagemUrl: imagemAvatarWeb("cabelo", "cabelo-cacheado-castanho"),
  },
  {
    codigo: "moicano-loiro",
    nome: "Topete Loiro",
    descricao: "O moicano clássico, agora em loiro.",
    tipo: TipoItemLoja.CABELO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("cabelo", "cabelo-moicano-loiro"),
    previewImagemUrl: imagemAvatarWeb("cabelo", "cabelo-moicano-loiro"),
  },
  {
    codigo: "moicano-ruivo",
    nome: "Topete Ruivo",
    descricao: "O moicano clássico, agora em ruivo.",
    tipo: TipoItemLoja.CABELO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("cabelo", "cabelo-moicano-ruivo"),
    previewImagemUrl: imagemAvatarWeb("cabelo", "cabelo-moicano-ruivo"),
  },
  {
    codigo: "curto-cacheado",
    nome: "Curto Cacheado",
    descricao: "Corte curto cacheado, estilo masculino.",
    tipo: TipoItemLoja.CABELO,
    precoMoedas: 150,
    imagemUrl: imagemAvatarWeb("cabelo", "cabelo-curto-cacheado"),
    previewImagemUrl: imagemAvatarWeb("cabelo", "cabelo-curto-cacheado"),
  },
  {
    codigo: "trancas",
    nome: "Tranças",
    descricao: "Tranças gêmeas com contas nas pontas.",
    tipo: TipoItemLoja.CABELO,
    precoMoedas: 150,
    imagemUrl: imagemAvatarWeb("cabelo", "cabelo-trancas"),
    previewImagemUrl: imagemAvatarWeb("cabelo", "cabelo-trancas"),
  },
  {
    codigo: "curto-grisalho",
    nome: "Curto Grisalho",
    descricao: "Corte curto grisalho, cheio de estilo.",
    tipo: TipoItemLoja.CABELO,
    precoMoedas: 220,
    imagemUrl: imagemAvatarWeb("cabelo", "cabelo-curto-grisalho"),
    previewImagemUrl: imagemAvatarWeb("cabelo", "cabelo-curto-grisalho"),
  },
  {
    codigo: "curto-cacheado-loiro",
    nome: "Curto Cacheado Loiro",
    descricao: "O corte curto cacheado, agora em loiro.",
    tipo: TipoItemLoja.CABELO,
    precoMoedas: 120,
    imagemUrl: imagemAvatarWeb("cabelo", "cabelo-curto-cacheado-loiro"),
    previewImagemUrl: imagemAvatarWeb("cabelo", "cabelo-curto-cacheado-loiro"),
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

/**
 * Sincroniza o catalogo atual da loja sem remover inventarios ou transacoes.
 * Tambem e reutilizado pelo reset manual da homologacao, para que itens
 * recentes — como o Cafe do Foco — estejam disponiveis imediatamente.
 */
export async function sincronizarCatalogo() {
  console.log("Sincronizando catálogo padrão da loja...");

  for (const item of itensCatalogo) {
    await salvarItem(item);
  }

  const conquista = await prisma.conquista.upsert({
    where: { id: "total-acertos" },
    update: {
      nome: "Primeiros 5 Acertos",
      descricao: "Acerte cinco questões para desbloquear o Óculos de Sol.",
      tipoConquista: TipoConquista.TOTAL_ACERTOS,
      ativo: true,
    },
    create: {
      id: "total-acertos",
      nome: "Primeiros 5 Acertos",
      descricao: "Acerte cinco questões para desbloquear o Óculos de Sol.",
      tipoConquista: TipoConquista.TOTAL_ACERTOS,
      ativo: true,
    },
  });

  // A recompensa da conquista era um avatar ilustrado (tipo removido na US39); agora e
  // um acessorio do avatar-cerebro que ja esta no catalogo.
  const recompensa = await prisma.itemLoja.findUniqueOrThrow({
    where: { codigo: CODIGO_RECOMPENSA_PRIMEIROS_ACERTOS },
  });

  await prisma.recompensaItemConquista.upsert({
    where: {
      conquistaId_tier: {
        conquistaId: conquista.id,
        tier: TierConquista.BRONZE,
      },
    },
    update: {
      itemLojaId: recompensa.id,
    },
    create: {
      conquistaId: conquista.id,
      tier: TierConquista.BRONZE,
      itemLojaId: recompensa.id,
    },
  });

  // Itens do avatar antigo (icones, avatares, rosto e cabelos antigos) saem da loja, do
  // inventario e do historico, com reembolso do ATP gasto. Idempotente a cada deploy.
  const remocao = await removerItensLegados(prisma);

  console.log(`Catálogo sincronizado: ${itensCatalogo.length} itens públicos.`);
  if (remocao.itensRemovidos > 0 || remocao.inventariosRemovidos > 0) {
    console.log(
      `Itens legados removidos: ${remocao.itensRemovidos} itens, ${remocao.inventariosRemovidos} inventários, ` +
        `${remocao.moedasReembolsadas} ATP reembolsados a ${remocao.usuariosReembolsados} usuários, ` +
        `${remocao.recompensasSubstituidas} recompensas trocadas pelo ${CODIGO_RECOMPENSA_PRIMEIROS_ACERTOS}.`,
    );
  }
}

export const desconectarCatalogo = () => prisma.$disconnect();

if (require.main === module) {
  sincronizarCatalogo()
    .catch((error: unknown) => {
      console.error("Falha ao sincronizar o catálogo da loja.", error);
      process.exitCode = 1;
    })
    .finally(desconectarCatalogo);
}
