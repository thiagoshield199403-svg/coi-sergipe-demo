# COI Sergipe — Versão Demonstrativa

Esta é uma cópia pública e demonstrativa (frontend/demo) do sistema interno **COI Sergipe** (Centro de Operação Integrado), usado pela Energisa Sergipe. **Não é o sistema de produção**, não contém o backend real, e algumas funções desta demo dependem de um backend privado que não faz parte deste repositório (ver "Módulos pausados" abaixo).

Resumo do que esta demo **não** é/não tem:

- **Somente frontend** — HTML/CSS/JS puro, sem nenhum código de servidor.
- **Sem backend** — a pasta `backend/` (FastAPI/Python) do projeto original foi
  **removida por completo** desta cópia; não existe mais nenhum backend nela.
- **Sem banco de dados** — nenhum PostgreSQL, nenhuma conexão de banco de nenhum tipo.
- **Sem envio de e-mail** — nenhum SMTP, nenhuma integração com provedor de e-mail.
- **Sem deploy/infraestrutura** — nenhuma configuração ou dependência de hospedagem.
- **Sem histórico interno** — este repositório começa com um commit inicial próprio, sem reaproveitar o histórico de desenvolvimento do projeto original.

## Como abrir

Não há instalação nem build. É um site estático. Para rodar localmente, sirva a pasta com
qualquer servidor de arquivos estáticos e abra `index.html`, por exemplo:

```bash
python -m http.server 8000
# depois abra http://localhost:8000/index.html
```

(Abrir `index.html` diretamente com `file://` também funciona na maior parte dos módulos,
mas alguns navegadores restringem `fetch`/`localStorage` nesse modo — um servidor local é
mais confiável.)

## Login de demonstração

Use o login `demo` na tela de acesso (qualquer senha é aceita — não existe uma senha fixa
para vazar, de propósito, já que o código deste repositório é público).

**O projeto possui autenticação demonstrativa local. Não utilize credenciais deste demo em
ambientes reais.** Não existe cadastro de usuários, recuperação de senha real, nem qualquer
autenticação de produção.

## Como funciona (sem backend)

Todo o "banco de dados" desta demo é simulado inteiramente no navegador:

- **`js/demo-backend.js`** intercepta as chamadas de rede (`fetch`) para `/api/teams/*`
  (Gestão de Equipes) e responde com **dados fictícios** guardados em `localStorage` — nada
  sai do seu navegador, nenhuma informação é enviada a servidor nenhum. Qualquer outra rota
  `/api/*` recebe uma resposta segura (nunca erro de rede), como proteção extra.
- **`js/auth.js`** faz a checagem de usuário/senha localmente, sem nenhuma chamada de rede.
- O **Callback WhatsApp** já usava `localStorage` no projeto original — continua igual.
- Os mapas usam arquivos GeoJSON estáticos já incluídos em `geodata/` (limites municipais
  públicos do IBGE/OSM) e a biblioteca Leaflet (CDN).

Para começar do zero (limpar os dados fictícios criados/editados durante o uso), basta
limpar o armazenamento local do site no navegador (dados do site / "Limpar dados do site"),
ou abrir em uma aba anônima.

## Módulos disponíveis nesta demo

- **Início** — tela de boas-vindas.
- **Scripts de Campo** (Bloqueio Linha Viva, Mais Sinergia, Desarme, Preenchimento de SS,
  Substituição de Poste/Transformador) — geram texto de relatório localmente.
- **Gestão de Equipes + Mapa Operacional** — funcional com dados **fictícios** (equipes,
  operadores, telefones, viaturas — nada real), incluindo cadastrar/editar/excluir equipe.
- **Mapas das Regionais** — módulo territorial independente (Leaflet), usa os limites
  municipais/distritais públicos do IBGE/OSM já presentes em `geodata/`. Quando uma
  localidade não tem contorno próprio no GeoJSON, o módulo reaproveita o contorno do
  MUNICÍPIO inteiro como aproximação (**fallback municipal**) — sinalizado visualmente por um
  traço tracejado e um selo "nível municipal" (nunca escondido, nunca com posição inventada).
- **Callback WhatsApp** — gera links `wa.me` e mantém histórico local no navegador.
- **Tabelas Técnicas** — conteúdo estático inalterado.

## Módulos pausados nesta demo

Aparecem no menu, mas mostram "Em desenvolvimento" ao serem abertos — **não fazem nenhuma
chamada de rede**:

- **Pendências** (Todas / Comerciais / Técnicas)
- **Passagem de Turno** e **Histórico de Passagens**
- **Administração** (gestão de usuários reais)

Esses módulos **dependem de um backend privado** (banco de dados, autenticação de produção,
envio de e-mail) que não existe nesta cópia e não faz parte deste repositório. O código
frontend original de cada um continua em `js/`/`css/` para eventual reaproveitamento futuro,
só não é executado a partir desta versão.

## Dados fictícios

Todos os nomes de operador, telefones, números de viatura, matrículas e ocorrências desta
demo são inventados especificamente para demonstração — não correspondem a nenhuma pessoa,
equipe ou ocorrência real da Energisa. Os únicos dados "reais" mantidos são os **nomes e
limites geográficos públicos** dos municípios de Sergipe (Aracaju, Itabaiana, Lagarto,
etc.), necessários para os módulos de mapa funcionarem — nenhum código de despacho ou
informação operacional interna real foi incluído.

## Material operacional interno removido

Dois conjuntos de material com dados operacionais internos reais da Energisa foram
**removidos por completo** desta cópia (deletados, nunca editados/borrados/substituídos por
versão parcial):

- As imagens `mapas/mapa1.jpg` a `mapa5.jpg` (códigos de despacho por município) e
  `mapas/mapa_empreiteiras.jpg` (protocolo real de acionamento de empreiteiras, com escalas
  e nomes de contrato). Os itens de menu que abriam essas imagens mostram agora a mensagem
  "Material operacional interno removido da versão demonstrativa."
- A pasta **`backend/`** inteira — que continha, entre outras coisas, a mesma numeração de
  despacho operacional real, além do backend real (FastAPI/PostgreSQL/JWT/e-mail) que esta
  demo nunca usou. Nada da pasta `backend/` foi movido, copiado ou publicado — foi apagada
  desta cópia.
- O link real de um formulário interno (Microsoft Forms) usado pela função `abrirTurno()`
  em `index.html` — substituído por um aviso de que o link não está configurado nesta demo
  pública (nunca aberto de fato).

## Varredura de segurança

A cópia foi varrida em busca de segredos e dados internos reais (códigos de despacho,
nomes de contrato, protocolos, escalas, telefones, e-mails institucionais, links/URLs
internas da Energisa, `DATABASE_URL`, `AUTH_SECRET_KEY`, chaves de API, tokens, senhas,
URLs de produção, referências a infraestrutura de hospedagem privada). Nenhum resultado real
restante — só os dados fictícios criados para esta demonstração (nomes "... Demonstração",
telefones `(79) 90000-000X`, etc.).

## Não usar em produção

Este código é só para fins de demonstração/portfólio. Não use estas credenciais, este
padrão de "autenticação" ou esta arquitetura sem backend em nenhum ambiente real de
call center — o sistema de produção da Energisa é um projeto separado, com backend, banco
de dados, autenticação e controle de acesso reais.

## Desenvolvimento e testes

Sem framework de teste, sem instalação — cada `*.test.js` roda direto com Node e não depende
de backend nenhum:

```bash
node js/equipes.test.js
node js/mapa.test.js
node js/mapas-regionais.test.js
node js/auth.test.js
node js/passagem-turno.test.js
node js/pendencias.test.js
node js/scripts-campo/bloqueios.test.js
node js/scripts-campo/desarme.test.js
node js/scripts-campo/preenchimento-ss.test.js
node js/scripts-campo/sinergia.test.js
node js/scripts-campo/substituicao-poste.test.js
node js/scripts-campo/substituicao-transformador.test.js
```
