# Publicação do Quiz-Service em homologação

O workflow **CD - Homologação Quiz-Service** publica o serviço privado de quiz
no Railway após a **CI - Quiz-Service** aprovar um push na `main`. Pull requests
e a branch `develop` não publicam na homologação.

O fluxo Web → BFF → Quiz-Service não muda: o Web continua acessando somente o
BFF público, e o BFF chama o Quiz-Service pela rede privada do Railway.

## Preparar o acesso uma única vez

Uma pessoa com acesso ao projeto Railway deve:

1. Confirmar o projeto, ambiente e serviço existentes do Quiz-Service em
   homologação e registrar o deploy atual para eventual retorno.
2. Configurar o health check do serviço no Railway com o caminho `/health`.
   O endpoint já responde HTTP 200 somente quando a aplicação está pronta.
3. Conferir de onde vêm as publicações atuais. Se houver deploy automático da
   integração Git do Railway, coordenar sua desativação antes de ativar o CD do
   GitHub, preservando serviço, variáveis e histórico de deploys.
4. Criar um **Project Token** do Railway com escopo limitado ao ambiente de
   homologação e cadastrá-lo no repositório do Quiz-Service, em
   **Settings → Secrets and variables → Actions → Repository secrets**:

   | Secret | Conteúdo |
   | --- | --- |
   | `RAILWAY_TOKEN` | Project Token autorizado para publicar na homologação |

5. Em **Settings → Secrets and variables → Actions → Variables**, cadastrar os
   identificadores não sensíveis do destino:

   | Variável | Conteúdo |
   | --- | --- |
   | `RAILWAY_PROJECT_ID` | Identificador do projeto Railway |
   | `RAILWAY_ENVIRONMENT_ID` | Identificador do ambiente de homologação |
   | `RAILWAY_SERVICE_ID` | Identificador do serviço Quiz-Service |

Não registrar valores de `DATABASE_URL`, `JWT_SECRET_KEY`, `INTERNAL_TOKEN`,
tokens ou senhas no código, nos logs, em issues ou PRs. As variáveis de execução
permanecem configuradas no serviço Railway existente.

## O que acontece após o merge

1. A CI executa lint, Prisma Client, migrations de teste, build, testes,
   cobertura e Sonar.
2. Se aprovada, o CD confirma que o SHA ainda é o commit atual da `main` e que
   há uma CI de push aprovada para esse SHA.
3. O CD instala dependências, gera o Prisma Client e valida os artefatos de
   execução antes de enviar o código.
4. A CLI oficial do Railway publica no projeto, ambiente e serviço configurados.
   O Dockerfile do serviço mantém a execução de `prisma migrate deploy` e do
   seed idempotente do catálogo no início do contêiner.
5. O Railway só marca a nova versão saudável após o health check `/health`.
   O workflow aguarda esse resultado e falha se o deploy falhar, travar ou
   encerrar inesperadamente.

O CD não executa `prisma:seed:homologacao`. Esse comando reinicia dados de
cenário e continua sendo manual, com confirmação explícita.

## Restaurar imagens de questões

No serviço **Quiz-Service** do Railway, configurar as variáveis abaixo antes
de ativar o armazenamento. Inserir os valores na plataforma, sem copiá-los
para o repositório ou para capturas de tela.

| Variável | Valor esperado |
| --- | --- |
| `STORAGE_ENABLED` | `true` |
| `MINIO_ENDPOINT` | URL HTTP(S) da API S3/MinIO acessível pelo Quiz-Service; para serviço privado Railway, usar o domínio privado e protocolo real |
| `MINIO_API_PORT` | Porta da API de objetos, não a porta do console |
| `MINIO_ROOT_USER` | Chave de acesso autorizada ao bucket |
| `MINIO_ROOT_PASSWORD` | Chave secreta correspondente |
| `MINIO_PUBLIC_URL` | Origem HTTPS pública que serve os objetos, sem nome do bucket e sem barra final |

O bucket usado pelo serviço é `anatoquizup-imagens`. Ao iniciar, a aplicação
cria o bucket se necessário e aplica a política de leitura pública dos objetos,
inclusive quando o bucket já existe. O provedor precisa permitir essa operação;
se bloquear políticas públicas, o serviço não inicia e será necessário ajustar
a política do provedor ou usar uma origem pública/CDN compatível. A URL pública
deve carregar no navegador sem autenticação e permitir `GET` das imagens. O
domínio `minio-homolog.up.railway.app` é do **BFF** e não serve objetos.

Após o deploy, registrar SHA e identificação do deploy, então executar com
contas de teste autorizadas:

1. Professor cria questão com PNG ou JPEG de teste (até 5 MB). Confirmar que a
   API devolve `imagem` com origem HTTPS pública e que a URL responde com a
   imagem correta em janela anônima.
2. Aluno abre um quiz que contém a questão. Confirmar imagem carregada, sem
   conteúdo misto ou erro de CORS, e concluir a resposta.
3. Professor substitui a imagem. Confirmar que a questão e o quiz usam a URL
   nova. Ao desativar a questão, verificar que ela deixa de ser oferecida. A
   exclusão física do objeto não faz parte da operação atual e deve ser
   gerenciada separadamente.
4. Reiniciar o Quiz-Service e repetir a leitura pública de uma imagem já
   criada, comprovando persistência do bucket.

Não marcar o fluxo como validado apenas pelo health check. Guardar as
capturas, URLs sem assinatura e resultados HTTP na evidência da R2, sem
publicar credenciais ou imagens com dados de pacientes.

## Repetir, validar e retornar

Para repetir a publicação do commit atual, use **Actions → CD - Homologação
Quiz-Service → Run workflow**, selecionando `main`. A publicação só ocorre se
existir uma CI de push aprovada para esse mesmo commit.

Depois da primeira publicação, valide pelo ambiente integrado:

- conferir CI e CD aprovados em Actions;
- registrar o SHA e o identificador do deploy Railway;
- abrir a homologação em janela anônima e executar um fluxo que dependa de
  questões ou quiz, confirmando a comunicação BFF → Quiz-Service;
- verificar que o catálogo e os dados de homologação permaneceram preservados.

Se houver regressão, interrompa novas publicações no GitHub antes de restaurar
o deploy estável no Railway. Registre o SHA afetado e a evidência do retorno;
corrija por PR e reteste antes de reativar o fluxo. O workflow não executa
rollback automático.

## Referências

- [Issue #104](https://github.com/fga-eps-mds/2026-2-AnatoQuizUp-Doc/issues/104)
- [Ambiente de homologação](https://fga-eps-mds.github.io/2026-2-AnatoQuizUp-Doc/operacao/ambiente-homologacao/)
- [CLI do Railway](https://docs.railway.com/cli/deploying)
- [Health checks do Railway](https://docs.railway.com/deployments/healthchecks)
