# geodata/ibge-2022/ — fontes da expansão do Mapa Regional Interativo

Recorte de bases **oficiais do IBGE** para a Regional Aracaju (Aracaju, Barra dos
Coqueiros, Nossa Senhora do Socorro), São Cristóvão e Itaporanga d'Ajuda.
Gerado por `node ferramentas/importar-ibge-2022.js <pasta-com-os-originais>` a partir
dos arquivos baixados (não versionados). Nenhum limite foi desenhado, recortado ou
ajustado à mão: as geometrias são as do IBGE, só com coordenadas arredondadas a
6 casas decimais (≈ 0,1 m). Sistema de referência: SIRGAS 2000 (graus).

Os 58 municípios das 5 regionais anteriores continuam com a geometria aprovada
(`geodata/<regional>/` → `js/mapa-regional/geometria.js`), que **não** foi alterada.
`geodata/aracaju/aracaju.geojson` (OpenStreetMap, usado pelo Mapa Operacional da
Gestão de Equipes) também não foi alterado nem é usado aqui.

| Arquivo | Origem (IBGE) | Download | Conteúdo |
|---|---|---|---|
| `municipios-2022.geojson` | Malha Municipal 2022 | https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2022/UFs/SE/SE_Municipios_2022.zip | 5 limites municipais |
| `bairros-cd2022.geojson` | Malha de Bairros — Censo Demográfico 2022 | https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/bairros/shp/UF/SE_bairros_CD2022.zip | 109 polígonos de bairro |
| `localidades-2010.geojson` | Cadastro de Localidades Selecionadas 2010 | https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/localidades/cadastro_de_localidades_selecionadas_2010/Shapefile_SHP/ | 40 pontos de localidades |

Licença: dados públicos do IBGE (uso livre com citação da fonte).

## Bairros por município (IBGE, Censo 2022)

| Município | Polo | Bairros | Território coberto por bairros |
|---|---|---|---|
| Aracaju | 001 | 48 | 87,8% |
| Barra dos Coqueiros | 010 | 18 | 19,4% |
| Nossa Senhora do Socorro | 020 | 29 registros (28 nomes) | 33,8% |
| São Cristóvão | 620 | 14 | 4,5% |
| Itaporanga d'Ajuda | (a confirmar) | 0 — o IBGE não publica bairros deste município | 0% |

Verificação feita na importação: **nenhum vértice de bairro fica fora do limite do
seu município** (tolerância de 1 m; as duas malhas são do mesmo ciclo IBGE 2022).
As áreas sem bairro delimitado (rurais, mangues, ilhas, faixas sem cadastro) aparecem
no tom do município — não foram "preenchidas" com bairros inventados.

### Observações de nomenclatura (como está na fonte)

- **Zona de Expansão (Aracaju)** não é um bairro na malha do IBGE: é uma designação
  regional. Os bairros oficiais dessa porção do município aparecem individualmente:
  Aruana (registrado como "Bairro Aruana"), Robalo, Mosqueiro, Areia Branca,
  Gameleira, Matapoã, São José dos Náufragos, entre outros. Não foi criado um
  polígono "Zona de Expansão" porque não há delimitação oficial dela.
- **Robalo** está classificado pelo IBGE (Censo 2022) como **bairro** de Aracaju.
- **Bugio** é o nome oficial do IBGE (no OpenStreetMap a mesma área aparece como
  "Assis Chateaubriand"); **Dezoito do Forte**, **Treze de Julho** e **Suíça** também
  seguem a grafia do IBGE.
- **Marivan** existe como bairro em Aracaju **e** em Barra dos Coqueiros (dois
  registros distintos do IBGE, um em cada município).
- **Porto Grande** (Socorro) tem **dois** registros IBGE com o mesmo nome
  (2804805020 e 2804805501). Ambos foram mantidos; na lista aparecem como
  "Porto Grande (1 de 2)" e "(2 de 2)" (só exibição — o nome oficial não muda).
- Exemplos citados no pedido e **não** encontrados como bairro no IBGE: **"Conjunto
  Jardim"** (Socorro) — o IBGE tem o bairro **Jardim** e a localidade **Complexo
  Jardim** (área urbana isolada, 2010); **"Taiçoca"** — o IBGE tem **Taiçoca de
  Dentro** e **Taiçoca de Fora** (bairros) e **Complexo Taiçoca** (localidade).

## Localidades (pontos, IBGE 2010)

Pontos de povoados, lugarejos, áreas urbanas isoladas e assentamentos — **sem limite
territorial** (a fonte não tem polígono). Regras aplicadas pelo gerador
(`ferramentas/gerar-mapa-expansao.js`):
- a sede (categoria "cidade") só aparece onde o município não tem bairros
  (em Itaporanga d'Ajuda);
- localidade com o mesmo nome de um bairro do mesmo município não é repetida
  (ex.: Atalaia Nova em Barra; Rosa Elze em São Cristóvão).

Resultado: Barra dos Coqueiros 4, Socorro 3, São Cristóvão 10, Itaporanga d'Ajuda 17
(incluindo **Caueira**, "área urbana isolada"). Aracaju: nenhuma além da sede.

Limitação: o cadastro é de **2010** (o mais recente publicado em pontos); localidades
surgidas depois não constam.

## Itaporanga d'Ajuda — área operacional

O usuário informou que a área de atendimento alcança a **Caueira** e a parte superior
do município. Não há delimitação confiável dessa área operacional: o mapa mostra o
**limite municipal do IBGE como referência**, as localidades como pontos e um aviso
explícito de que a delimitação operacional não está confirmada. Nenhum polígono
"aproximado" foi desenhado. Código do polo: **a confirmar** (campo `codigo: null` em
`js/mapa-regional/dados.js`).

## Pendências

- Código do polo de Itaporanga d'Ajuda.
- Delimitação da área operacional de Itaporanga d'Ajuda (quais localidades atende).
- Bairros oficiais de Itaporanga d'Ajuda (não publicados pelo IBGE).
- Localidades posteriores a 2010 (sem base oficial em pontos mais recente).
- Códigos de bairro: campo `codigo` reservado (= null) em `js/mapa-regional/subdivisoes.js`.
