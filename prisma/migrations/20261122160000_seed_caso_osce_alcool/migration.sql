-- Seed idempotente do unico caso OSCE validado com o PO ate aqui (US26): "Alcool:
-- dependencia e abstinencia" (Simulacao Realistica SFC 5, UnB). Id fixo e estavel
-- para poder rodar em qualquer ambiente sem duplicar (ON CONFLICT DO NOTHING).
-- criadoPorId reaproveita o mesmo PROFESSOR_ID fixo ja usado em todo o prisma/seed.ts
-- (cmp7fx97j00034hyqazqwrk3e); esse id nao tem garantia de existir no Usuario-Service
-- em um ambiente limpo (o seed de professor de la nao fixa id), mas e o mesmo valor
-- que o resto do seed deste repo ja assume, entao mantemos a consistencia.
INSERT INTO "casos_osce" (
    "id",
    "titulo",
    "especialidade",
    "dificuldade",
    "diagnosticoEsperado",
    "local",
    "papelEstudante",
    "idadePaciente",
    "sexoPaciente",
    "queixaPaciente",
    "perfilPaciente",
    "historiaSintomas",
    "exameFisico",
    "status",
    "criadoPorId",
    "atualizadoEm"
) VALUES (
    'caso-osce-alcool-dependencia-abstinencia',
    'Tremedeira e enjoo quando fico sem beber',
    'Medicina de Família e Comunidade',
    'MEDIA',
    'Dependência de álcool (CID-10: F10.2) com síndrome de abstinência leve',
    'Unidade Básica de Saúde (UBS) - consulta de demanda espontânea',
    'Médico(a) de Família e Comunidade, atendendo a primeira consulta',
    48,
    'Masculino',
    'Tremedeira e enjoo quando fico sem beber',
    'José Carlos da Silva, 48 anos, motorista de caminhão, casado, acompanhado pela esposa Marta Fagundes Rocha (46 anos, diarista). Fala de forma ansiosa, com leve sudorese e mãos trêmulas; se o médico for acolhedor, demonstra confiança e alívio, caso contrário fica defensivo. Teme perder o emprego e está envergonhado de procurar ajuda.',
    'Bebe cerca de 5 latas de cerveja por dia há mais de 12 anos, consumo que se intensificou nos últimos meses. Ao tentar reduzir ou parar, surgem tremores nas mãos, sudorese, enjoo e ansiedade, aliviados imediatamente com nova dose de álcool (inclusive pela manhã). Consegue ficar sem beber só 6 a 8 horas antes dos sintomas começarem. Fica agressivo quando a esposa tenta falar sobre o assunto e já perdeu dias de trabalho. Pai faleceu de cirrose alcoólica; nega doenças crônicas, alergias ou uso de medicações contínuas; cirurgia prévia há 15 anos (acidente de caminhão). Relata culpa e vergonha pela situação.',
    'Ansioso, com leve sudorese e tremores finos e visíveis em extremidades superiores; leves telangiectasias em região malar; orientado no tempo e espaço. PA 145x95 mmHg, FC 95 bpm. Pele e mucosas normocoradas e anictéricas, sem aranhas vasculares. Aparelho cardiovascular com bulhas rítmicas e normofonéticas em 2 tempos. Aparelho respiratório com murmúrio vesicular audível e simétrico. Abdome globoso, indolor à palpação, ruídos hidroaéreos presentes, sem visceromegalias. Neurológico com tremores de repouso e ação.',
    'PUBLICADO',
    'cmp7fx97j00034hyqazqwrk3e',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "exames_caso_osce" ("id", "nome", "resultado", "casoOsceId") VALUES
    (
        'caso-osce-alcool-exame-hemograma',
        'Hemograma completo',
        'VCM elevado (macrocitose), achado comum no abuso crônico de álcool.',
        'caso-osce-alcool-dependencia-abstinencia'
    ),
    (
        'caso-osce-alcool-exame-funcao-hepatica',
        'Função hepática (AST/TGO, ALT/TGP, GGT, bilirrubinas, albumina)',
        'GGT elevada (150 U/L, referência até 60 U/L), indicando lesão hepática alcoólica; demais transaminases e bilirrubinas sem alterações significativas.',
        'caso-osce-alcool-dependencia-abstinencia'
    ),
    (
        'caso-osce-alcool-exame-glicemia-ureia-creatinina',
        'Glicemia, ureia e creatinina',
        'Dentro da normalidade.',
        'caso-osce-alcool-dependencia-abstinencia'
    ),
    (
        'caso-osce-alcool-exame-audit',
        'Questionário AUDIT',
        '17 pontos - Zona de Risco Moderado-Grave (Zona III), indicando consumo prejudicial e necessidade de tratamento formal.',
        'caso-osce-alcool-dependencia-abstinencia'
    )
ON CONFLICT ("id") DO NOTHING;
