# AnatoQuizUp Quiz-Service

Servico privado responsavel pelo dominio de quiz do AnatoQuizUp.

O Frontend nao chama este servico diretamente. O fluxo publico continua sendo:

```text
Web -> BFF -> Quiz-Service
```

## Responsabilidades

- Temas
- Questoes
- Alternativas
- Resolucoes
- Infraestrutura de imagens de questoes via MinIO/S3
- Quiz DB proprio

O Backend/Auth nao acessa o banco do Quiz-Service, e o Quiz-Service nao acessa a tabela de usuarios do Backend/Auth. IDs como `criadoPorId` e `usuarioId` sao referencias externas.

## Stack

- Node.js 24+
- TypeScript
- Express 5
- Prisma
- PostgreSQL
- MinIO/S3
- Jest
- ESLint
- SonarCloud

## Setup local

```powershell
Copy-Item .env.example .env
npm ci
npm run prisma:generate
docker compose up -d
npm run prisma:migrate
npm run dev
```

Porta padrao: `3334`.
Banco local padrao: `localhost:5433`.

## Variaveis principais

| Variavel | Descricao |
|---|---|
| `PORT` | Porta HTTP do servico, padrao `3334` |
| `DATABASE_URL` | URL do Quiz DB |
| `JWT_SECRET_KEY` | Mesmo segredo usado pelo Backend/Auth para assinar access tokens |
| `INTERNAL_TOKEN` | Mesmo segredo configurado no BFF e Backend/Auth |
| `STORAGE_ENABLED` | Habilita o armazenamento de imagens; o padrao e `true` |
| `MINIO_*` | Configuracao de storage de imagens de questoes |

## Seed de homologacao

O container **nao** executa este seed no startup. Ele executa somente as
migrations e o seed idempotente do catalogo da loja. O seed de homologacao e
um reset intencional e manual apenas do banco do Quiz-Service: recria temas,
questoes, turmas, listas, loja, conquistas e dados de demonstracao; em seguida
sincroniza o catalogo atual, incluindo consumiveis como o Cafe do Foco.

Antes de executa-lo, informe os IDs reais do professor e do aluno de
demonstracao, obtidos no Usuario-Service. A confirmacao explicita evita um
reset acidental:

```bash
HOMOLOG_SEED_RESET=true \
HOMOLOG_PROFESSOR_ID='<id-do-professor>' \
HOMOLOG_ALUNO_ID='<id-do-aluno>' \
npm run prisma:seed:homologacao
```

Os IDs opcionais `HOMOLOG_ALUNO_SECUNDARIO_ID` e
`HOMOLOG_ALUNO_TERCIARIO_ID` servem apenas para popular indicadores do cenario.
O seed nao cria contas: usuarios, e-mails e senhas continuam sob
responsabilidade do Usuario-Service.

## Rotas

Todas as rotas `/api/*` exigem `X-Internal-Token`. Rotas de questoes tambem validam `Authorization: Bearer <accessToken>`.

| Metodo | Path |
|---|---|
| GET | `/health` |
| GET | `/api/v1/questoes` |
| GET | `/api/v1/questoes/busca` |
| GET | `/api/v1/questoes/:id` |
| POST | `/api/v1/questoes` |
| PUT | `/api/v1/questoes/:id` |
| DELETE | `/api/v1/questoes/:id` |

## Atalhos

```bash
make lint
make test
make build
```
