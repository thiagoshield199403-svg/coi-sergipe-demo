/* MAPAS DAS REGIONAIS (regtm-*) — módulo novo, independente do MAPA
   OPERACIONAL da Gestão de Equipes (js/mapa.js). Não lê/escreve nenhuma
   variável de js/mapa.js nem js/equipes.js, não reaproveita nenhuma
   classe/id do mapa operacional — instância Leaflet própria, cache
   próprio, algoritmos de geometria/normalização copiados (não importados)
   quando precisam do mesmo raciocínio já validado lá.

   Prefixo "regtm" em toda função/variável/estado deste arquivo, sem
   exceção, para nunca colidir com "mapa*"/"equipes*" do resto do sistema.

   FASE 3 — LABELS + CORES + LEGENDA PROFISSIONAL: adiciona cor
   determinística por território (hash do slug_territorial, nunca da
   ordem de carregamento), labels "CÓDIGO + NOME" posicionados pelo
   mesmo pole-of-inaccessibility já preparado na Fase 2 (nunca
   getBounds().getCenter()), uma resolução de colisão simples e
   determinística (reduz detalhe antes de mover/inventar posição) e uma
   legenda lateral interativa (hover/clique sincronizados com o mapa),
   ordenada sempre por código operacional numérico — nunca alfabética,
   nunca inventado. Nenhum fallback municipal nesta fase (mesma regra da
   Fase 2): localidade sem geometria própria aparece só na seção "Sem
   geometria territorial" da legenda.

   GENERICIDADE (item 10 da Fase 3): o casamento, a cor, a colisão e a
   legenda continuam servindo qualquer polo sem nenhum desvio condicional
   — a diferença de granularidade (bairro vs. município) já está
   inteiramente nos DADOS. A ÚNICA exceção visual (ajustes pós-Fase 3,
   pedidos explicitamente pelo usuário) é ONDE o label aparece — sempre
   permanente, exceto nas seleções declaradas em
   REGTM_SELECOES_LABEL_SOB_DEMANDA (hoje "Aracaju" e "Todos" — os dois
   casos com dezenas/centenas de territórios simultâneos em tela; os
   demais polos, todos com no máximo 15 territórios, mantêm label
   permanente). Essa exceção vive num único Set declarativo,
   consultado em UM ponto (regtmDesenharTerritorios/regtmDestacarTerritorio)
   — nunca um `if (polo === "Aracaju")` espalhado pela lógica de
   casamento/cor/colisão, que continuam 100% genéricas. */

// ================= CONFIG =================

// Amarração polo -> pasta em geodata/ — cópia própria (mesmo valor de
// MAPA_POLO_SLUG em js/mapa.js e POLO_SLUG em
// backend/app/scripts/vincular_geojson.py, mantida em sincronia manual,
// nunca importada de lá).
const REGTM_POLO_SLUG = {
  "Aracaju": "aracaju",
  "São Cristóvão": "sao-cristovao",
  "Itabaiana": "itabaiana",
  "Dores": "dores",
  "Propriá": "propria",
  "Maruim": "maruim",
  "Lagarto": "lagarto",
};

const REGTM_POLOS = Object.keys(REGTM_POLO_SLUG);
const REGTM_VALOR_TODOS = "__TODOS__";

// Ajuste pós-Fase 3 (ampliado no ajuste seguinte): SELEÇÕES onde o label
// "CÓDIGO + NOME" NÃO fica permanentemente sobre o mapa (poluição visual
// com dezenas/centenas de territórios simultâneos) — só aparece
// temporariamente no hover/mouseout. É um Set de valores de SELEÇÃO (nomes
// de polo OU o pseudo-valor REGTM_VALOR_TODOS — "Todos" tem exatamente o
// mesmo problema de poluição que Aracaju, então entra na MESMA regra
// declarativa, sem duplicar lógica), checado num único ponto
// (regtmDeveOcultarLabelPermanente), nunca espalhado como
// `if (polo === "Aracaju")`/`if (polo === "Todos")` pela lógica de
// desenho/colisão. Qualquer polo/seleção futura que precise do mesmo
// tratamento só precisa entrar aqui — nenhuma outra mudança de código.
const REGTM_SELECOES_LABEL_SOB_DEMANDA = new Set(["Aracaju", REGTM_VALOR_TODOS]);

function regtmDeveOcultarLabelPermanente(selecaoAtual) {
  return REGTM_SELECOES_LABEL_SOB_DEMANDA.has(selecaoAtual);
}

// Mesma lista de chaves candidatas de nome/município usada em
// backend/app/scripts/vincular_geojson.py e js/mapa.js — cópia própria.
const REGTM_CHAVES_NOME_CANDIDATAS = [
  "nome", "name", "NOME", "NAME", "Nome", "Name",
  "bairro", "BAIRRO", "Bairro", "NM_BAIRRO", "nm_bairro",
  "municipio", "MUNICIPIO", "NM_MUNICIP", "NM_MUN",
];
const REGTM_CHAVES_MUNICIPIO_CANDIDATAS = [
  "municipio", "MUNICIPIO", "Municipio", "NM_MUN", "NM_MUNICIP", "addr:city",
];

const REGTM_CENTRO_INICIAL = [-10.9472, -37.0731];
const REGTM_ZOOM_INICIAL = 8;

// Paleta categórica suave/muted (12 tons) — cada território recebe UM
// destes pares {fill, stroke} via hash determinístico do slug_territorial
// (ver regtmCorDaLocalidade), nunca da ordem de renderização. Fills claros
// e dessaturados (funcionam com texto sobreposto e com hover mais escuro
// em cima); strokes um pouco mais saturados só para separar bordas
// vizinhas. Não é uma paleta "todas-as-cores-contra-todas" (matematicamente
// impossível com 70+ territórios simultâneos em tela) — a identificação
// primária continua sendo o label/borda/hover/clique, cor é um reforço
// visual secundário para ajudar a diferenciar vizinhos, nunca a única
// forma de identificar um território (ver relatório da fase).
const REGTM_PALETA_TERRITORIOS = [
  { fill: "#dbeafe", stroke: "#3b82f6" }, // azul
  { fill: "#dcfce7", stroke: "#22c55e" }, // verde
  { fill: "#fef3c7", stroke: "#d97706" }, // âmbar
  { fill: "#ede9fe", stroke: "#8b5cf6" }, // violeta
  { fill: "#ffe4e6", stroke: "#e11d48" }, // rosa
  { fill: "#cffafe", stroke: "#0891b2" }, // ciano
  { fill: "#ffedd5", stroke: "#ea580c" }, // laranja
  { fill: "#e0e7ff", stroke: "#6366f1" }, // índigo
  { fill: "#d1fae5", stroke: "#059669" }, // esmeralda
  { fill: "#fce7f3", stroke: "#db2777" }, // magenta
  { fill: "#ecfccb", stroke: "#65a30d" }, // lima
  { fill: "#ccfbf1", stroke: "#0d9488" }, // teal
];

const REGTM_COR_SELECIONADO = "#111827";

// Estilo do FALLBACK MUNICIPAL (item 9/13 do pedido de finalização — "Usar o
// contorno municipal correspondente" + "Identificar visualmente que é
// fallback"): cor NEUTRA e FIXA (nunca a paleta categórica por hash de
// regtmCorDaLocalidade) e borda tracejada — a diferença visual em relação
// aos territórios com contorno próprio É o aviso. Nunca finge precisão de
// bairro/localidade (ver regtmMontarPopupHtmlFallback/regtmMontarHtmlLabelFallback,
// que deixam "nível municipal" explícito em texto também, não só na cor).
const REGTM_ESTILO_FALLBACK = { color: "#78716c", weight: 2, dashArray: "8,5", fillColor: "#e7e5e4", fillOpacity: 0.35 };
const REGTM_ESTILO_FALLBACK_HOVER = { color: "#57534e", weight: 3, dashArray: "8,5", fillColor: "#e7e5e4", fillOpacity: 0.55 };
const REGTM_ESTILO_FALLBACK_SELECIONADO = { color: REGTM_COR_SELECIONADO, weight: 3.5, dashArray: "8,5", fillColor: "#e7e5e4", fillOpacity: 0.65 };

// Chave de registro/seleção de um polígono de fallback (compartilhado por
// TODAS as localidades sem geometria própria do mesmo polo+município — nunca
// uma chave por localidade, isso duplicaria o mesmo contorno na legenda
// apontando pra camadas diferentes). Pura e determinística — mesmo par
// polo+município sempre gera a mesma chave, em qualquer ordem de carregamento.
function regtmChaveFallback(polo, municipio) {
  return "fallback::" + polo + "::" + municipio;
}

// Zoom abaixo do qual NENHUM label aparece (visão muito ampla — ex.:
// "Todos" recém-carregado — texto seria ilegível/poluição pura); entre
// esse limiar e o próximo, labels aparecem só com o código (compacto);
// a partir do segundo limiar, código+nome completos (sujeito ainda à
// colisão par a par).
const REGTM_ZOOM_LABEL_OCULTO_ABAIXO = 8;
const REGTM_ZOOM_LABEL_COMPLETO_A_PARTIR = 10;

// Distância mínima em pixels de tela entre dois labels para conviverem no
// mesmo nível de detalhe — ver regtmResolverColisaoLabels.
const REGTM_LIMIAR_COLISAO_COMPLETO = 70;
const REGTM_LIMIAR_COLISAO_COMPACTO = 34;

// ================= ESTADO =================

let regtmMapaInstancia = null;
let regtmJaInicializado = false;
let regtmPoloAtual = ""; // "" | "__TODOS__" | nome de um polo

let regtmCacheLocalidadesPorPolo = {}; // polo -> [LocalidadeOut] | promessa em andamento
let regtmCacheGeoJsonPorSlug = {}; // slug -> FeatureCollection | null (404/erro) | promessa em andamento

let regtmCamadaTerritoriosAtual = null; // L.GeoJSON atualmente no mapa (territórios com contorno próprio)
let regtmCamadaFallbackAtual = null; // L.FeatureGroup dos polígonos de fallback municipal atuais
let regtmCamadaLabelsAtual = null; // L.LayerGroup dos labels da seleção atual
let regtmLabelsAtuais = []; // [{id, marker, ponto, area}] — usado pela colisão a cada zoomend
let regtmRegistroPorSlug = {}; // slug_territorial -> {layer, localidade, feature} — ponte legenda <-> mapa
let regtmCamadaSelecionada = null;
let regtmSlugSelecionado = null;
let regtmGeracaoAtual = 0; // defesa contra corrida entre trocas rápidas de seleção (mesmo princípio de mapaGeracaoAtual, cópia independente)

// Ajuste pós-Fase 3 (label sob demanda) — true quando a seleção atual está
// em REGTM_SELECOES_LABEL_SOB_DEMANDA (hoje "Aracaju" e "Todos"): nenhum
// label permanente foi criado para esta seleção, só o marcador temporário
// abaixo.
let regtmLabelsPermanentesOcultosNestaSelecao = false;
let regtmMarkerHoverTemporario = null; // um único marker reaproveitado — nunca cria/acumula um por hover

function regtmVerificarLeafletDisponivel() {
  return typeof L !== "undefined";
}

// Cabeçalho de autenticação — cópia própria de equipesHeaders() (não
// chama js/equipes.js), reaproveitando só authObterSessao() de js/auth.js,
// que já é compartilhado por todo o sistema (não exclusivo da Gestão de
// Equipes).
function regtmHeaders() {
  const sessao = authObterSessao();
  return sessao && sessao.access_token ? { "Authorization": "Bearer " + sessao.access_token } : {};
}

function regtmEscapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto === null || texto === undefined ? "" : String(texto);
  return div.innerHTML;
}

/* ================= GEOMETRIA PURA (sem Leaflet/DOM) =================
   Point-in-polygon + pole of inaccessibility (mesmo algoritmo já validado
   em js/mapa.js, cópia adaptada) — usados AGORA para posicionar os labels
   (nunca getBounds().getCenter()). */

function regtmPontoDentroDoPoligono(ponto, aneis) {
  let dentro = false;
  aneis.forEach((anel, indiceAnel) => {
    let cruzouEsteAnel = false;
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const xi = anel[i][0], yi = anel[i][1];
      const xj = anel[j][0], yj = anel[j][1];
      const intersecta = yi > ponto[1] !== yj > ponto[1] &&
        ponto[0] < ((xj - xi) * (ponto[1] - yi)) / (yj - yi) + xi;
      if (intersecta) cruzouEsteAnel = !cruzouEsteAnel;
    }
    if (indiceAnel === 0) dentro = cruzouEsteAnel;
    else if (cruzouEsteAnel) dentro = false; // dentro de um anel interno (buraco) -> fora da geometria
  });
  return dentro;
}

function regtmDistanciaPontoSegmento(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function regtmDistanciaAteBorda(ponto, aneis) {
  let minima = Infinity;
  aneis.forEach(anel => {
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      minima = Math.min(minima, regtmDistanciaPontoSegmento(ponto, anel[j], anel[i]));
    }
  });
  return minima;
}

function regtmPoloDeInacessibilidade(aneis) {
  const anelExterno = aneis[0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  anelExterno.forEach(([x, y]) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  });
  const centroBBox = [minX + (maxX - minX) / 2, minY + (maxY - minY) / 2];

  let melhor = { ponto: centroBBox, distancia: -Infinity };
  const avaliarCandidato = (x, y) => {
    if (!regtmPontoDentroDoPoligono([x, y], aneis)) return;
    const distancia = regtmDistanciaAteBorda([x, y], aneis);
    if (distancia > melhor.distancia) melhor = { ponto: [x, y], distancia };
  };

  let centroX = centroBBox[0], centroY = centroBBox[1];
  let raioX = (maxX - minX) / 2, raioY = (maxY - minY) / 2;
  const DIVISOES = 8;
  const PASSOS = 8;
  for (let passo = 0; passo < PASSOS && (raioX > 0 || raioY > 0); passo++) {
    for (let i = 0; i <= DIVISOES; i++) {
      for (let j = 0; j <= DIVISOES; j++) {
        avaliarCandidato(centroX - raioX + (2 * raioX * i) / DIVISOES, centroY - raioY + (2 * raioY * j) / DIVISOES);
      }
    }
    centroX = melhor.ponto[0]; centroY = melhor.ponto[1];
    raioX /= DIVISOES / 2; raioY /= DIVISOES / 2;
  }
  return melhor.ponto; // [lng, lat]
}

function regtmAreaAnel(anel) {
  let area = 0;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    area += anel[j][0] * anel[i][1] - anel[i][0] * anel[j][1];
  }
  return Math.abs(area / 2);
}

function regtmPontoVisualDaGeometria(geometry) {
  let aneis;
  if (geometry.type === "Polygon") {
    aneis = geometry.coordinates;
  } else if (geometry.type === "MultiPolygon") {
    aneis = geometry.coordinates.reduce((maior, poligono) =>
      regtmAreaAnel(poligono[0]) > regtmAreaAnel(maior[0]) ? poligono : maior
    );
  } else {
    return null;
  }
  const [lng, lat] = regtmPoloDeInacessibilidade(aneis);
  return [lat, lng];
}

// Área total da geometria (soma de todos os polígonos, se MultiPolygon) —
// usada só como prioridade determinística na colisão de labels (território
// maior tem mais chance de manter o label completo), nunca para decidir
// posição.
function regtmAreaDaGeometria(geometry) {
  if (geometry.type === "Polygon") return regtmAreaAnel(geometry.coordinates[0]);
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.reduce((soma, poligono) => soma + regtmAreaAnel(poligono[0]), 0);
  }
  return 0;
}

/* ================= NORMALIZAÇÃO (espelha app/services/territorio.py) ================= */

const REGTM_REGEX_DIACRITICOS = /[̀-ͯ]/g;

function regtmNormalizarNome(texto) {
  if (!texto) return "";
  const semAcento = texto.normalize("NFD").replace(REGTM_REGEX_DIACRITICOS, "");
  const minusculo = semAcento.toLowerCase();
  const comEspacos = minusculo.replace(/[-_/.,;:]+/g, " ");
  const semPontuacaoResidual = comEspacos.replace(/[^\w\s]/g, "");
  return semPontuacaoResidual.replace(/\s+/g, " ").trim();
}

function regtmExtrairNomeFeicao(feature) {
  const propriedades = (feature && feature.properties) || {};
  for (const chave of REGTM_CHAVES_NOME_CANDIDATAS) {
    const valor = propriedades[chave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
  }
  return null;
}

function regtmExtrairMunicipioFeicao(feature) {
  const propriedades = (feature && feature.properties) || {};
  for (const chave of REGTM_CHAVES_MUNICIPIO_CANDIDATAS) {
    const valor = propriedades[chave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
  }
  return null;
}

// "Nome oficial" (item 7 da Fase 3): só a propriedade real e confirmada nos
// GeoJSON desta etapa (municipio_ibge_nome, ver geodata/*/NOTICE.md) —
// nenhuma outra chave é tratada como "oficial" por suposição. Quem chama
// decide se é diferente do nome operacional (ver regtmMontarPopupHtml).
function regtmExtrairNomeOficialFeicao(feature) {
  const propriedades = (feature && feature.properties) || {};
  const valor = propriedades.municipio_ibge_nome;
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

/* ================= COR DETERMINÍSTICA POR TERRITÓRIO =================
   Hash simples e estável (mesmo algoritmo sempre devolve o mesmo número
   para a mesma string) sobre `slug_territorial` — identificador territorial
   ESTÁVEL da localidade (nunca muda, nunca é digitado, ver
   app/models/localidade.py), não sobre id de banco (que poderia mudar se
   o registro fosse recriado) nem sobre índice de array (que muda com a
   ordem de carregamento). Mesma localidade -> sempre a mesma cor, em
   qualquer navegação, em qualquer ordem de seleção. */

function regtmHashString(texto) {
  let hash = 0;
  const str = String(texto || "");
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function regtmCorDaLocalidade(localidade) {
  const chave = (localidade && localidade.slug_territorial) || (localidade && localidade.nome) || "";
  const indice = regtmHashString(chave) % REGTM_PALETA_TERRITORIOS.length;
  return REGTM_PALETA_TERRITORIOS[indice];
}

/* ================= ORDENAÇÃO (item 8 da Fase 3) =================
   Mesma disciplina de _chave_ordenacao_localidade (backend, já validado na
   Gestão de Equipes): código operacional NUMÉRICO primeiro (nunca string —
   "030" viria depois de "150" numa ordenação alfabética), localidades sem
   código depois, ordenadas entre si por município/nome. Cópia própria,
   nunca ordena por índice de carregamento nem inventa código para quem não
   tem. */

function regtmChaveOrdenacaoLocalidade(localidade) {
  const bruto = localidade && localidade.codigo_operacional;
  let numero = null;
  if (bruto) {
    const parsed = parseInt(bruto, 10);
    if (!Number.isNaN(parsed)) numero = parsed;
  }
  const temCodigo = numero !== null;
  return [temCodigo ? 0 : 1, temCodigo ? numero : 0, (localidade && localidade.municipio) || "", (localidade && localidade.nome) || ""];
}

function regtmCompararLocalidades(a, b) {
  const ka = regtmChaveOrdenacaoLocalidade(a);
  const kb = regtmChaveOrdenacaoLocalidade(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

function regtmOrdenarLocalidades(lista) {
  return [...(lista || [])].sort(regtmCompararLocalidades);
}

function regtmRotuloLocalidade(localidade) {
  return localidade.codigo_operacional
    ? localidade.codigo_operacional + " — " + localidade.nome
    : localidade.nome;
}

/* ================= DADOS: localidades (GET /api/teams/localidades, já
   existente — reaproveitado só como leitura, nunca escreve nada) ================= */

async function regtmCarregarLocalidades(polo) {
  if (regtmCacheLocalidadesPorPolo[polo]) return regtmCacheLocalidadesPorPolo[polo];
  const promessa = authChamarApi(
    "/api/teams/localidades?" + new URLSearchParams({ polo }).toString(),
    { headers: regtmHeaders() }
  ).then(r => (r.ok ? r.corpo : []));
  regtmCacheLocalidadesPorPolo[polo] = promessa;
  const lista = await promessa;
  regtmCacheLocalidadesPorPolo[polo] = lista; // substitui a promessa pelo resultado (cache real)
  return lista;
}

/* ================= DADOS: GeoJSON estático (geodata/<slug>/<slug>.geojson) ================= */

async function regtmCarregarGeoJson(slug) {
  if (Object.prototype.hasOwnProperty.call(regtmCacheGeoJsonPorSlug, slug)) {
    return regtmCacheGeoJsonPorSlug[slug];
  }
  const promessa = fetch(`geodata/${slug}/${slug}.geojson`)
    .then(resposta => (resposta.ok ? resposta.json() : null))
    .catch(() => null);
  regtmCacheGeoJsonPorSlug[slug] = promessa;
  const dados = await promessa;
  regtmCacheGeoJsonPorSlug[slug] = dados;
  return dados;
}

// Índice único por chave (nome solto normalizado + "municipio|nome"
// qualificado) — mesmo par que backend/app/scripts/vincular_geojson.py
// grava em slug_geojson e que js/mapa.js usa pra resolver geometria de
// marcador. Cópia própria, mesma lógica.
function regtmMontarIndicePorChave(featureCollection) {
  const indice = {};
  const adicionar = (chave, entrada) => {
    if (!chave) return;
    if (!indice[chave]) indice[chave] = [];
    indice[chave].push(entrada);
  };
  (featureCollection.features || []).forEach(feature => {
    const nomeBruto = regtmExtrairNomeFeicao(feature);
    if (!nomeBruto) return;
    const nomeNormalizado = regtmNormalizarNome(nomeBruto);
    if (!nomeNormalizado) return;
    const municipioNormalizado = regtmNormalizarNome(regtmExtrairMunicipioFeicao(feature) || "");
    const entrada = { feature, nomeBruto, municipioNormalizado: municipioNormalizado || null };
    adicionar(nomeNormalizado, entrada);
    if (municipioNormalizado) adicionar(`${municipioNormalizado}|${nomeNormalizado}`, entrada);
  });
  return indice;
}

// Aliases CONFIRMADOS por EVIDÊNCIA OBJETIVA do próprio dado de origem —
// nunca por semelhança textual entre nomes (regra explícita da etapa de
// conferência territorial). Cada entrada só entra aqui com a evidência
// citada no comentário; sem evidência, a localidade fica em semGeometria
// (ou cai no fallback municipal, se o município tiver contorno), nunca
// "adivinhada". Aplicado SÓ no casamento com o GeoJSON (regtmResolverFeatureDaLocalidade)
// — nunca no nome exibido ao usuário (regtmRotuloLocalidade sempre usa
// localidade.nome, o nome oficial do catálogo, intocado). Chave:
// "polo normalizado|município normalizado|nome normalizado" (regtmChaveAliasConfirmado).
//
//   "Bugio" (Polo Aracaju / Aracaju) -> "Assis Chateaubriand": a feição do
//   GeoJSON tem name="Assis Chateaubriand" (o nome administrativo oficial
//   OSM), mas com a tag loc_name="Bugio" — o PRÓPRIO OpenStreetMap grava
//   "Bugio" como nome popular/local dessa feição (relation id 4023044,
//   ver .geodata_bruto_cache/osm_Aracaju.json, extraído por
//   app/scripts/importar_geodata_real.py). Não é parecença de nome: é o
//   dado de origem confirmando que são a MESMA feição.
//
// "18 do Forte"/"Matapoã" (GeoJSON) x "Dezoito do Forte"/"Matapuã"
// (catálogo) foram CONFERIDOS e ficam DE FORA desta tabela — a feição OSM
// não tem loc_name/alt_name/old_name ligando aos nomes do catálogo, só
// semelhança textual (numeral escrito x algarismo; troca de uma vogal),
// que a regra desta etapa proíbe tratar como correspondência. Continuam
// como pendência territorial (ver relatório da etapa).
const REGTM_ALIASES_CONFIRMADOS = {
  "aracaju|aracaju|bugio": ["Assis Chateaubriand"],
};

function regtmChaveAliasConfirmado(localidade) {
  return [
    regtmNormalizarNome(localidade.polo),
    regtmNormalizarNome(localidade.municipio),
    regtmNormalizarNome(localidade.nome),
  ].join("|");
}

// Resolve a feição de UMA localidade — MESMA disciplina de integridade
// territorial de mapaResolverGeometriaPropria (js/mapa.js): só
// slug_geojson OU nome/alias (do catálogo OU de REGTM_ALIASES_CONFIRMADOS
// acima) normalizado escopado por município; qualquer ambiguidade (0 ou >1
// candidatos) NUNCA é decidida sozinha, devolve null (a localidade fica sem
// geometria própria nesta seleção — cai pro fallback municipal ou pra
// legenda "sem geometria", nunca com a geometria errada).
function regtmResolverFeatureDaLocalidade(localidade, indicePorChave) {
  if (localidade.slug_geojson) {
    const grupo = indicePorChave[localidade.slug_geojson];
    if (grupo && grupo.length === 1) return grupo[0].feature;
    return null;
  }

  const municipioNormalizado = regtmNormalizarNome(localidade.municipio || "");
  const aliasesConfirmados = REGTM_ALIASES_CONFIRMADOS[regtmChaveAliasConfirmado(localidade)] || [];
  const nomesCandidatos = Array.from(
    new Set(
      [localidade.nome, ...(localidade.aliases || []), ...aliasesConfirmados].map(regtmNormalizarNome).filter(Boolean)
    )
  );

  const featuresEncontradas = new Set();
  nomesCandidatos.forEach(nome => {
    const grupo = indicePorChave[nome];
    if (!grupo) return;
    grupo
      .filter(g => !g.municipioNormalizado || g.municipioNormalizado === municipioNormalizado)
      .forEach(g => featuresEncontradas.add(g.feature));
  });

  return featuresEncontradas.size === 1 ? Array.from(featuresEncontradas)[0] : null;
}

// Acha, dentro da lista de localidades já carregada, a linha que representa
// o MUNICÍPIO INTEIRO da localidade recebida — mesma disciplina já validada
// em mapaEncontrarLocalidadeMunicipio (js/mapa.js, cópia própria, não
// importada): nunca por nome da localidade (reabriria o mesmo risco que
// motivou aquela etapa lá — "Centro" da Barra dos Coqueiros encontrando o
// "Centro" de Aracaju), sempre pela combinação real polo+município. Uma
// linha "é o município inteiro" quando o próprio `nome` dela é IDÊNTICO ao
// `municipio` (mesmo padrão estrutural usado por todos os scripts de seed,
// ver backend/app/scripts/seed_localidades_*.py).
function regtmEncontrarLocalidadeMunicipio(localidade, listaLocalidades) {
  if (!localidade) return null;
  return (
    (listaLocalidades || []).find(
      l => l.polo === localidade.polo && l.municipio === localidade.municipio && l.nome === l.municipio
    ) || null
  );
}

// Agrupa pares de fallback (localidade sem geometria própria + feição do
// MUNICÍPIO inteiro) por feição — várias localidades do mesmo município
// compartilham a MESMA feição/polígono, então precisam desenhar UM contorno
// só (item "não duplicar o mesmo contorno de maneira confusa"), listando
// todas as localidades representadas. Pura (sem Leaflet/DOM) — a chave do
// Map é a própria referência do objeto `feature` (regtmCarregarGeoJson
// cacheia o FeatureCollection por slug, então a mesma feição do mesmo
// arquivo é sempre o MESMO objeto entre chamadas, nunca uma cópia).
function regtmAgruparFallbackPorFeature(paresFallback) {
  const porFeature = new Map();
  (paresFallback || []).forEach(({ localidade, feature, polo }) => {
    if (!porFeature.has(feature)) {
      porFeature.set(feature, { feature, polo, municipio: localidade.municipio, localidades: [] });
    }
    porFeature.get(feature).localidades.push(localidade);
  });
  return Array.from(porFeature.values());
}

// Carrega localidades + GeoJSON de UM polo em paralelo e separa em
// {pares, fallback, semGeometria}:
//  - pares = casaram com a PRÓPRIA geometria, sem ambiguidade (ver acima);
//  - fallback = sem geometria própria, mas o MUNICÍPIO inteiro delas tem
//    contorno (item 9 do pedido de finalização — "usar o contorno municipal
//    correspondente" — nunca inventa coordenada, só reaproveita o polígono
//    do município já presente no mesmo GeoJSON, exatamente como
//    mapaResolverGeometriaLocalidade já faz para o marcador no Mapa
//    Operacional, ver js/mapa.js);
//  - semGeometria = localidades reais do catálogo que não têm (ainda)
//    correspondência territorial NENHUMA, nem própria nem municipal (nunca
//    escondidas, aparecem na legenda).
// `geracao` é checado logo após os dois `await` — se uma seleção mais nova
// já começou nesse meio-tempo, descarta o resultado (mesmo princípio de
// mapaGeracaoAtual, cópia independente).
async function regtmCarregarTerritoriosDoPolo(polo, geracao) {
  const slug = REGTM_POLO_SLUG[polo];
  if (!slug) return { pares: [], fallback: [], semGeometria: [] };

  const [localidades, geojson] = await Promise.all([
    regtmCarregarLocalidades(polo),
    regtmCarregarGeoJson(slug),
  ]);
  if (geracao !== regtmGeracaoAtual) return { pares: [], fallback: [], semGeometria: [] };

  if (!geojson) {
    return { pares: [], fallback: [], semGeometria: [...localidades] };
  }

  const indice = regtmMontarIndicePorChave(geojson);
  const pares = [];
  const semResolucaoDireta = [];
  localidades.forEach(localidade => {
    const feature = regtmResolverFeatureDaLocalidade(localidade, indice);
    if (feature) pares.push({ localidade, feature });
    else semResolucaoDireta.push(localidade);
  });

  const fallback = [];
  const semGeometria = [];
  semResolucaoDireta.forEach(localidade => {
    const sede = regtmEncontrarLocalidadeMunicipio(localidade, localidades);
    const featureMunicipio = sede && sede.id !== localidade.id
      ? regtmResolverFeatureDaLocalidade(sede, indice)
      : null;
    if (featureMunicipio) {
      fallback.push({ localidade, feature: featureMunicipio, polo });
    } else {
      semGeometria.push(localidade);
    }
  });

  return { pares, fallback, semGeometria };
}

/* ================= COLISÃO DE LABELS (pura — sem Leaflet/DOM) =================
   Estratégia simples e determinística (item 3 da Fase 3): NUNCA move um
   label do seu ponto real (isso seria inventar posição) — só decide, em
   ordem de prioridade fixa (maior área primeiro, desempate pelo id), se
   cada um cabe "completo" (código+nome), só "compacto" (só código) ou
   "oculto", checando distância em pixels de tela contra os labels já
   aceitos no mesmo nível ou mais detalhado. Prioriza sempre, nesta ordem:
   permanecer no território (nunca muda `ponto`) > legibilidade > evitar
   sobreposição > preservar o código (por isso o compacto nunca esconde o
   código, só o nome). */
function regtmResolverColisaoLabels(pontos, limiarCompleto, limiarCompacto) {
  const ordenados = [...pontos].sort((a, b) => b.prioridade - a.prioridade || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const aceitosCompletos = [];
  const aceitosCompactos = [];
  const resultado = {};

  ordenados.forEach(p => {
    const distanciaMinima = lista => lista.reduce((min, q) => Math.min(min, Math.hypot(p.x - q.x, p.y - q.y)), Infinity);

    if (distanciaMinima(aceitosCompletos) >= limiarCompleto) {
      aceitosCompletos.push(p);
      resultado[p.id] = "completo";
      return;
    }
    if (distanciaMinima(aceitosCompletos) >= limiarCompacto && distanciaMinima(aceitosCompactos) >= limiarCompacto) {
      aceitosCompactos.push(p);
      resultado[p.id] = "compacto";
      return;
    }
    resultado[p.id] = "oculto";
  });

  return resultado; // {id: "completo" | "compacto" | "oculto"}
}

/* ================= LEGENDA: ESTRUTURA (pura — sem DOM) =================
   Item 11 (Todos agrupa por regional) + item 9 (seção "sem geometria")
   construídos aqui como dado puro, testável sem Leaflet/documento — quem
   desenha (regtmRenderizarLegenda) só percorre esta estrutura. */
function regtmConstruirEstruturaLegenda(poloSelecionado, resultadosPorPolo) {
  const grupos = (resultadosPorPolo || [])
    .filter(g =>
      (g.comGeometria && g.comGeometria.length) ||
      (g.fallbackMunicipal && g.fallbackMunicipal.length) ||
      (g.semGeometria && g.semGeometria.length)
    )
    .map(g => ({
      polo: g.polo,
      comGeometria: regtmOrdenarLocalidades(g.comGeometria),
      // fallbackMunicipal é opcional (default []) — chamadores existentes que
      // só passam comGeometria/semGeometria continuam funcionando sem mudar
      // nada (ver js/mapas-regionais.test.js).
      fallbackMunicipal: regtmOrdenarLocalidades(g.fallbackMunicipal || []),
      semGeometria: regtmOrdenarLocalidades(g.semGeometria),
    }));
  return { agrupadoPorPolo: poloSelecionado === REGTM_VALOR_TODOS, grupos };
}

/* ================= RENDER: ESTILOS / POPUP / LABEL ================= */

function regtmEstiloParaLocalidade(localidade) {
  const cor = regtmCorDaLocalidade(localidade);
  return { color: cor.stroke, weight: 1.5, fillColor: cor.fill, fillOpacity: 0.5 };
}
function regtmEstiloHoverParaLocalidade(localidade) {
  const cor = regtmCorDaLocalidade(localidade);
  return { color: cor.stroke, weight: 2.5, fillColor: cor.fill, fillOpacity: 0.72 };
}
function regtmEstiloSelecionadoParaLocalidade(localidade) {
  const cor = regtmCorDaLocalidade(localidade);
  return { color: REGTM_COR_SELECIONADO, weight: 3, fillColor: cor.fill, fillOpacity: 0.82 };
}

function regtmMontarPopupHtml(localidade, feature) {
  const nomeOficial = regtmExtrairNomeOficialFeicao(feature);
  const nomeOficialDiferente = nomeOficial && regtmNormalizarNome(nomeOficial) !== regtmNormalizarNome(localidade.nome);

  let html = '<div class="regtm-popup">';
  html += "<strong>" + regtmEscapar(regtmRotuloLocalidade(localidade)) + "</strong>";
  html += '<div class="regtm-popup-linha"><span class="regtm-popup-rotulo">Município:</span> ' + regtmEscapar(localidade.municipio) + "</div>";
  html += '<div class="regtm-popup-linha"><span class="regtm-popup-rotulo">Regional:</span> ' + regtmEscapar(localidade.polo) + "</div>";
  if (nomeOficialDiferente) {
    html += '<div class="regtm-popup-linha"><span class="regtm-popup-rotulo">Nome oficial:</span> ' + regtmEscapar(nomeOficial) + "</div>";
  }
  if (localidade.grupo_operacional) {
    html += '<div class="regtm-popup-linha"><span class="regtm-popup-rotulo">Observação territorial:</span> ' + regtmEscapar(localidade.grupo_operacional) + "</div>";
  }
  html += "</div>";
  return html;
}

function regtmMontarHtmlLabel(localidade) {
  const codigo = localidade.codigo_operacional;
  return (
    (codigo ? '<div class="regtm-label-codigo">' + regtmEscapar(codigo) + "</div>" : "") +
    '<div class="regtm-label-nome">' + regtmEscapar(localidade.nome) + "</div>"
  );
}

// Popup/label do polígono de FALLBACK MUNICIPAL — nunca reaproveita
// regtmMontarPopupHtml/regtmMontarHtmlLabel (que são de UMA localidade com
// geometria própria): aqui é sempre um MUNICÍPIO representando várias
// localidades, e isso precisa ficar explícito em texto (item 13 — aviso
// visual de fallback), nunca só na cor/traço do polígono.
function regtmMontarHtmlLabelFallback(grupo) {
  return (
    '<div class="regtm-label-codigo regtm-label-fallback-badge">nível municipal</div>' +
    '<div class="regtm-label-nome">' + regtmEscapar(grupo.municipio) + "</div>"
  );
}

function regtmMontarPopupHtmlFallback(grupo) {
  const nomeOficial = regtmExtrairNomeOficialFeicao(grupo.feature);
  const nomeOficialDiferente = nomeOficial && regtmNormalizarNome(nomeOficial) !== regtmNormalizarNome(grupo.municipio);

  let html = '<div class="regtm-popup regtm-popup-fallback">';
  html += '<div class="regtm-popup-aviso-fallback">Contorno em nível municipal — sem contorno próprio por localidade</div>';
  html += "<strong>" + regtmEscapar(grupo.municipio) + "</strong>";
  html += '<div class="regtm-popup-linha"><span class="regtm-popup-rotulo">Regional:</span> ' + regtmEscapar(grupo.polo) + "</div>";
  if (nomeOficialDiferente) {
    html += '<div class="regtm-popup-linha"><span class="regtm-popup-rotulo">Nome oficial:</span> ' + regtmEscapar(nomeOficial) + "</div>";
  }
  html += '<div class="regtm-popup-linha"><span class="regtm-popup-rotulo">Localidades representadas (' + grupo.localidades.length + '):</span></div>';
  html += '<ul class="regtm-popup-lista-fallback">' +
    grupo.localidades.map(l => "<li>" + regtmEscapar(regtmRotuloLocalidade(l)) + "</li>").join("") +
    "</ul>";
  html += "</div>";
  return html;
}

/* ================= RENDER: TERRITÓRIOS + LABELS ================= */

// Desenha o conjunto de territórios recebido (um polo ou a união de
// "Todos") — sempre remove a camada anterior primeiro, nunca acumula
// seleção antiga em cima da nova. Cria também os labels (ainda sem nível
// de detalhe definido — regtmAtualizarVisibilidadeLabels decide isso logo
// em seguida, a partir do zoom pós-fitBounds) e o registro slug->layer que
// a legenda usa para sincronizar hover/clique com o mapa.
//
// `ocultarLabelPermanente` (ajuste pós-Fase 3): quando true (seleção em
// REGTM_SELECOES_LABEL_SOB_DEMANDA), nenhum marker de label permanente é
// criado — só o registro/ponto fica guardado, para o hover mostrar um
// label TEMPORÁRIO (ver regtmDestacarTerritorio/regtmAlternarLabelTemporario).
//
// `gruposFallback` (finalização — fallback municipal): grupos já deduplicados
// por regtmAgruparFallbackPorFeature, um por MUNICÍPIO (nunca um por
// localidade — evita duplicar o mesmo contorno). Desenhados numa camada
// PRÓPRIA (regtmCamadaFallbackAtual), estilo fixo/neutro (nunca a paleta
// categórica), registrados sob regtmChaveFallback(polo, município) — a
// MESMA chave para todas as localidades daquele município na legenda, então
// hover/clique em qualquer uma delas destaca o único polígono compartilhado.
function regtmDesenharTerritorios(paresLocalidadeFeature, gruposFallback, ocultarLabelPermanente) {
  if (regtmCamadaTerritoriosAtual) {
    regtmMapaInstancia.removeLayer(regtmCamadaTerritoriosAtual);
    regtmCamadaTerritoriosAtual = null;
  }
  if (regtmCamadaFallbackAtual) {
    regtmMapaInstancia.removeLayer(regtmCamadaFallbackAtual);
    regtmCamadaFallbackAtual = null;
  }
  if (regtmCamadaLabelsAtual) {
    regtmMapaInstancia.removeLayer(regtmCamadaLabelsAtual);
    regtmCamadaLabelsAtual = null;
  }
  if (regtmMarkerHoverTemporario) {
    regtmMapaInstancia.removeLayer(regtmMarkerHoverTemporario);
    regtmMarkerHoverTemporario = null;
  }
  regtmCamadaSelecionada = null;
  regtmSlugSelecionado = null;
  regtmRegistroPorSlug = {};
  regtmLabelsAtuais = [];
  regtmLabelsPermanentesOcultosNestaSelecao = !!ocultarLabelPermanente;

  const camadaLabels = L.layerGroup();
  const camadasParaLimites = [];

  if (paresLocalidadeFeature.length > 0) {
    const featureCollection = {
      type: "FeatureCollection",
      features: paresLocalidadeFeature.map(p => p.feature),
    };
    // Feature -> localidade: se dois pares (ex.: São Cristóvão cadastrado sob
    // o Polo Aracaju E sob o Polo São Cristóvão, ver auditoria da Fase 1)
    // apontarem pra MESMA feição, o Map naturalmente mantém só a última —
    // desenha o polígono uma vez só (item 11: evitar duplicação visual),
    // sem decidir arbitrariamente qual das duas linhas do catálogo "vale
    // mais" (as duas continuam aparecendo normalmente na legenda).
    const localidadePorFeature = new Map(paresLocalidadeFeature.map(p => [p.feature, p.localidade]));

    const camada = L.geoJSON(featureCollection, {
      style: feature => {
        const localidade = localidadePorFeature.get(feature);
        return localidade ? regtmEstiloParaLocalidade(localidade) : { color: "#64748b", weight: 1, fillOpacity: 0.1 };
      },
      onEachFeature: (feature, layer) => {
        const localidade = localidadePorFeature.get(feature);
        if (!localidade) return;

        const ponto = regtmPontoVisualDaGeometria(feature.geometry);
        // `ponto` guardado no registro SEMPRE (mesmo quando o label
        // permanente está oculto) — é o que o hover temporário usa, sem
        // recalcular a geometria de novo.
        regtmRegistroPorSlug[localidade.slug_territorial] = { layer, localidade, feature, ponto, isFallback: false };

        layer.bindPopup(regtmMontarPopupHtml(localidade, feature));
        layer.on("mouseover", () => regtmDestacarTerritorio(localidade.slug_territorial, true));
        layer.on("mouseout", () => regtmDestacarTerritorio(localidade.slug_territorial, false));
        layer.on("click", () => regtmSelecionarTerritorioPorSlug(localidade.slug_territorial));

        if (ponto && !regtmLabelsPermanentesOcultosNestaSelecao) {
          const marker = L.marker(ponto, {
            icon: L.divIcon({
              className: "regtm-label-wrap regtm-label-completo",
              html: regtmMontarHtmlLabel(localidade),
              iconSize: [0, 0],
            }),
            interactive: false,
            keyboard: false,
          });
          camadaLabels.addLayer(marker);
          regtmLabelsAtuais.push({
            id: localidade.slug_territorial,
            marker,
            ponto,
            area: regtmAreaDaGeometria(feature.geometry),
          });
        }
      },
    }).addTo(regtmMapaInstancia);

    regtmCamadaTerritoriosAtual = camada;
    camadasParaLimites.push(camada);
  }

  if (gruposFallback && gruposFallback.length > 0) {
    const camadaFallback = L.featureGroup();

    gruposFallback.forEach(grupo => {
      const chave = regtmChaveFallback(grupo.polo, grupo.municipio);
      const layer = L.geoJSON(grupo.feature, { style: () => REGTM_ESTILO_FALLBACK });
      layer.bindPopup(regtmMontarPopupHtmlFallback(grupo));
      layer.on("mouseover", () => regtmDestacarTerritorio(chave, true));
      layer.on("mouseout", () => regtmDestacarTerritorio(chave, false));
      layer.on("click", () => regtmSelecionarTerritorioPorSlug(chave));
      layer.addTo(camadaFallback);

      const ponto = regtmPontoVisualDaGeometria(grupo.feature.geometry);
      regtmRegistroPorSlug[chave] = {
        layer, localidade: null, localidades: grupo.localidades, feature: grupo.feature,
        ponto, isFallback: true, municipio: grupo.municipio, polo: grupo.polo,
      };

      if (ponto && !regtmLabelsPermanentesOcultosNestaSelecao) {
        const marker = L.marker(ponto, {
          icon: L.divIcon({
            className: "regtm-label-wrap regtm-label-completo regtm-label-fallback",
            html: regtmMontarHtmlLabelFallback(grupo),
            iconSize: [0, 0],
          }),
          interactive: false,
          keyboard: false,
        });
        camadaLabels.addLayer(marker);
        regtmLabelsAtuais.push({ id: chave, marker, ponto, area: regtmAreaDaGeometria(grupo.feature.geometry) });
      }
    });

    camadaFallback.addTo(regtmMapaInstancia);
    regtmCamadaFallbackAtual = camadaFallback;
    camadasParaLimites.push(camadaFallback);
  }

  camadaLabels.addTo(regtmMapaInstancia);
  regtmCamadaLabelsAtual = camadaLabels;

  if (camadasParaLimites.length === 0) return null;
  return L.featureGroup(camadasParaLimites);
}

// Mostra/esconde o label TEMPORÁRIO de hover (ajuste pós-Fase 3, só entra
// em ação quando regtmLabelsPermanentesOcultosNestaSelecao é true — hoje só
// Aracaju). Reaproveita um ÚNICO marker (nunca cria um novo por hover, nunca
// acumula) — some ao tirar o mouse, mesmo comportamento de um tooltip.
function regtmAlternarLabelTemporario(registro, mostrar) {
  if (regtmMarkerHoverTemporario) {
    regtmMapaInstancia.removeLayer(regtmMarkerHoverTemporario);
    regtmMarkerHoverTemporario = null;
  }
  if (!mostrar || !registro.ponto) return;

  regtmMarkerHoverTemporario = L.marker(registro.ponto, {
    icon: L.divIcon({
      className: "regtm-label-wrap regtm-label-completo regtm-label-temporario",
      html: regtmMontarHtmlLabel(registro.localidade),
      iconSize: [0, 0],
    }),
    interactive: false,
    keyboard: false,
  }).addTo(regtmMapaInstancia);
}

// Devolve o trio de estilos (normal/hover/selecionado) do registro certo —
// fallback municipal usa sempre o estilo NEUTRO fixo (REGTM_ESTILO_FALLBACK*,
// nunca a paleta categórica por hash, que é por-localidade e não faria
// sentido pra um polígono que representa várias de uma vez); território com
// geometria própria continua usando regtmCorDaLocalidade como sempre. Um
// único ponto de decisão — nem regtmDestacarTerritorio nem
// regtmSelecionarTerritorioPorSlug precisam saber a diferença.
function regtmEstilosDoRegistro(registro) {
  if (registro.isFallback) {
    return { normal: REGTM_ESTILO_FALLBACK, hover: REGTM_ESTILO_FALLBACK_HOVER, selecionado: REGTM_ESTILO_FALLBACK_SELECIONADO };
  }
  return {
    normal: regtmEstiloParaLocalidade(registro.localidade),
    hover: regtmEstiloHoverParaLocalidade(registro.localidade),
    selecionado: regtmEstiloSelecionadoParaLocalidade(registro.localidade),
  };
}

// Sincronização mapa -> legenda (e vice-versa, ver regtmMontarItemLegenda):
// hover nunca sobrescreve o destaque de quem está selecionado — mas o label
// temporário (quando aplicável) sempre reage ao hover, mesmo em cima do
// território já selecionado. querySelectorAll (não querySelector) porque um
// polígono de FALLBACK pode ter várias localidades/itens de legenda
// apontando pra MESMA chave (ver regtmChaveFallback) — todas precisam
// destacar juntas, não só a primeira.
function regtmDestacarTerritorio(slug, ligar) {
  const registro = regtmRegistroPorSlug[slug];
  if (!registro) return;

  if (regtmLabelsPermanentesOcultosNestaSelecao) {
    regtmAlternarLabelTemporario(registro, ligar);
  }

  if (registro.layer !== regtmCamadaSelecionada) {
    const estilos = regtmEstilosDoRegistro(registro);
    registro.layer.setStyle(ligar ? estilos.hover : estilos.normal);
  }

  document.querySelectorAll('.regtm-legenda-item[data-regtm-slug="' + CSS.escape(slug) + '"]')
    .forEach(item => item.classList.toggle("regtm-legenda-item-hover", ligar));
}

// Ação de clique — vem tanto do território no mapa quanto do item na
// legenda (mesmo caminho, sem duplicar lógica): destaca, centraliza e abre
// o popup de informações (item 6/7 da Fase 3).
function regtmSelecionarTerritorioPorSlug(slug) {
  const registro = regtmRegistroPorSlug[slug];
  if (!registro) return;

  if (regtmSlugSelecionado && regtmSlugSelecionado !== slug) {
    const anterior = regtmRegistroPorSlug[regtmSlugSelecionado];
    if (anterior) anterior.layer.setStyle(regtmEstilosDoRegistro(anterior).normal);
    document.querySelectorAll('.regtm-legenda-item[data-regtm-slug="' + CSS.escape(regtmSlugSelecionado) + '"]')
      .forEach(item => item.classList.remove("regtm-legenda-item-selecionado"));
  }

  regtmCamadaSelecionada = registro.layer;
  regtmSlugSelecionado = slug;
  registro.layer.setStyle(regtmEstilosDoRegistro(registro).selecionado);

  const itensAtuais = document.querySelectorAll('.regtm-legenda-item[data-regtm-slug="' + CSS.escape(slug) + '"]');
  itensAtuais.forEach((item, indice) => {
    item.classList.add("regtm-legenda-item-selecionado");
    if (indice === 0) item.scrollIntoView({ block: "nearest" });
  });

  if (registro.layer.getBounds) {
    regtmMapaInstancia.panTo(registro.layer.getBounds().getCenter());
  }
  registro.layer.openPopup();
}

/* ================= ZOOM / VISIBILIDADE DOS LABELS (item 4 da Fase 3) =================
   Recalcula em cada 'zoomend' (distância em pixels entre dois pontos fixos
   só muda com zoom, não com pan — não precisa recalcular em 'moveend').
   Nunca recria os markers: só troca a classe CSS do elemento já existente
   (marker.getElement(), API do Leaflet) — barato mesmo com 70+ labels
   (item 14: evitar recriar tudo desnecessariamente). */
function regtmAplicarNivelLabel(labelInfo, nivel) {
  const elemento = labelInfo.marker.getElement && labelInfo.marker.getElement();
  if (!elemento) return;
  elemento.classList.remove("regtm-label-completo", "regtm-label-compacto", "regtm-label-oculto");
  elemento.classList.add("regtm-label-" + nivel);
}

function regtmAtualizarVisibilidadeLabels() {
  if (!regtmMapaInstancia || regtmLabelsAtuais.length === 0) return;
  const zoom = regtmMapaInstancia.getZoom();

  if (zoom < REGTM_ZOOM_LABEL_OCULTO_ABAIXO) {
    regtmLabelsAtuais.forEach(l => regtmAplicarNivelLabel(l, "oculto"));
    return;
  }

  const tetoNivel = zoom < REGTM_ZOOM_LABEL_COMPLETO_A_PARTIR ? "compacto" : "completo";

  const pontos = regtmLabelsAtuais.map(l => {
    const p = regtmMapaInstancia.latLngToContainerPoint(l.ponto);
    return { id: l.id, x: p.x, y: p.y, prioridade: l.area };
  });
  const niveis = regtmResolverColisaoLabels(pontos, REGTM_LIMIAR_COLISAO_COMPLETO, REGTM_LIMIAR_COLISAO_COMPACTO);

  regtmLabelsAtuais.forEach(l => {
    let nivel = niveis[l.id] || "oculto";
    if (tetoNivel === "compacto" && nivel === "completo") nivel = "compacto";
    regtmAplicarNivelLabel(l, nivel);
  });
}

/* ================= LEGENDA: RENDER (DOM) ================= */

function regtmMontarItemLegenda(localidade) {
  const item = document.createElement("li");
  item.className = "regtm-legenda-item";
  item.dataset.regtmSlug = localidade.slug_territorial;

  const cor = regtmCorDaLocalidade(localidade);
  const swatch = document.createElement("span");
  swatch.className = "regtm-legenda-swatch";
  swatch.style.background = cor.fill;
  swatch.style.borderColor = cor.stroke;

  const texto = document.createElement("span");
  texto.className = "regtm-legenda-texto";
  texto.textContent = regtmRotuloLocalidade(localidade);

  item.appendChild(swatch);
  item.appendChild(texto);

  item.addEventListener("mouseenter", () => regtmDestacarTerritorio(localidade.slug_territorial, true));
  item.addEventListener("mouseleave", () => regtmDestacarTerritorio(localidade.slug_territorial, false));
  item.addEventListener("click", () => regtmSelecionarTerritorioPorSlug(localidade.slug_territorial));

  return item;
}

// Item de legenda de uma localidade em FALLBACK MUNICIPAL — visualmente
// distinto (swatch tracejado neutro + selo "nível municipal", nunca a cor
// categórica da localidade, que ela nem tem contorno próprio pra colorir) e
// interativo do mesmo jeito (hover/clique), só que apontando pra chave
// COMPARTILHADA do polígono do município (ver regtmChaveFallback) — nunca
// uma camada própria por localidade.
function regtmMontarItemLegendaFallback(localidade, chaveFallback) {
  const item = document.createElement("li");
  item.className = "regtm-legenda-item regtm-legenda-item-fallback";
  item.dataset.regtmSlug = chaveFallback;

  const swatch = document.createElement("span");
  swatch.className = "regtm-legenda-swatch regtm-legenda-swatch-fallback";

  const texto = document.createElement("span");
  texto.className = "regtm-legenda-texto";
  texto.textContent = regtmRotuloLocalidade(localidade);

  const badge = document.createElement("span");
  badge.className = "regtm-legenda-badge-fallback";
  badge.textContent = "nível municipal";

  item.appendChild(swatch);
  item.appendChild(texto);
  item.appendChild(badge);

  item.addEventListener("mouseenter", () => regtmDestacarTerritorio(chaveFallback, true));
  item.addEventListener("mouseleave", () => regtmDestacarTerritorio(chaveFallback, false));
  item.addEventListener("click", () => regtmSelecionarTerritorioPorSlug(chaveFallback));

  return item;
}

function regtmRenderizarLegenda(estrutura) {
  const painel = document.getElementById("regtm_painel_lateral");
  if (!painel) return;
  painel.innerHTML = "";

  const titulo = document.createElement("h3");
  titulo.textContent = "Legenda / Informações";
  painel.appendChild(titulo);

  if (!estrutura || estrutura.grupos.length === 0) {
    const vazio = document.createElement("div");
    vazio.className = "regtm-painel-vazio";
    vazio.textContent = "Selecione uma regional para ver a legenda.";
    painel.appendChild(vazio);
    return;
  }

  estrutura.grupos.forEach(grupo => {
    if (estrutura.agrupadoPorPolo) {
      const tituloGrupo = document.createElement("div");
      tituloGrupo.className = "regtm-legenda-grupo-titulo";
      tituloGrupo.textContent = grupo.polo;
      painel.appendChild(tituloGrupo);
    }

    if (grupo.comGeometria.length > 0) {
      const lista = document.createElement("ul");
      lista.className = "regtm-legenda-lista";
      grupo.comGeometria.forEach(localidade => lista.appendChild(regtmMontarItemLegenda(localidade)));
      painel.appendChild(lista);
    }

    if (grupo.fallbackMunicipal.length > 0) {
      const tituloFallback = document.createElement("div");
      tituloFallback.className = "regtm-legenda-fallback-titulo";
      tituloFallback.textContent = "Nível municipal (sem contorno próprio)";
      painel.appendChild(tituloFallback);

      const listaFallback = document.createElement("ul");
      listaFallback.className = "regtm-legenda-lista regtm-legenda-lista-fallback";
      grupo.fallbackMunicipal.forEach(localidade => {
        const chave = regtmChaveFallback(localidade.polo, localidade.municipio);
        listaFallback.appendChild(regtmMontarItemLegendaFallback(localidade, chave));
      });
      painel.appendChild(listaFallback);
    }

    if (grupo.semGeometria.length > 0) {
      const tituloSemGeo = document.createElement("div");
      tituloSemGeo.className = "regtm-legenda-sem-geo-titulo";
      tituloSemGeo.textContent = "Sem geometria territorial";
      painel.appendChild(tituloSemGeo);

      const listaSemGeo = document.createElement("ul");
      listaSemGeo.className = "regtm-legenda-lista regtm-legenda-lista-sem-geo";
      grupo.semGeometria.forEach(localidade => {
        const item = document.createElement("li");
        item.className = "regtm-legenda-item-sem-geo";
        item.innerHTML =
          "<strong>" + regtmEscapar(regtmRotuloLocalidade(localidade)) + "</strong>" +
          '<span class="regtm-legenda-sem-geo-texto">Geometria territorial não disponível.</span>';
        listaSemGeo.appendChild(item);
      });
      painel.appendChild(listaSemGeo);
    }
  });
}

function regtmAtualizarIndicador(texto, vazio) {
  const indicador = document.getElementById("regtm_selecao_indicador");
  if (!indicador) return;
  indicador.textContent = texto;
  indicador.dataset.regtmVazio = vazio ? "true" : "false";
}

function regtmRotuloSelecao(poloSelecionado) {
  return poloSelecionado === REGTM_VALOR_TODOS ? "Todas as regionais" : "Regional selecionada: " + poloSelecionado;
}

/* ================= ORQUESTRAÇÃO (troca de seleção) ================= */

async function regtmAplicarSelecao() {
  if (!regtmMapaInstancia) return;

  const geracao = ++regtmGeracaoAtual;
  const poloSelecionado = regtmPoloAtual;

  if (!poloSelecionado) {
    regtmDesenharTerritorios([], []);
    regtmRenderizarLegenda(null);
    regtmAtualizarIndicador("Nenhuma regional selecionada ainda.", true);
    return;
  }

  regtmAtualizarIndicador(regtmRotuloSelecao(poloSelecionado) + " — carregando território...", false);

  const polosParaCarregar = poloSelecionado === REGTM_VALOR_TODOS ? REGTM_POLOS : [poloSelecionado];
  const resultados = await Promise.all(
    polosParaCarregar.map(async polo => {
      const { pares, fallback, semGeometria } = await regtmCarregarTerritoriosDoPolo(polo, geracao);
      return { polo, pares, fallback, semGeometria };
    })
  );
  if (geracao !== regtmGeracaoAtual) return;

  const todosPares = resultados.flatMap(r => r.pares);
  const todosFallback = resultados.flatMap(r => r.fallback);
  const totalLocalidades = resultados.reduce((soma, r) => soma + r.pares.length + r.fallback.length + r.semGeometria.length, 0);

  const gruposFallback = regtmAgruparFallbackPorFeature(todosFallback);

  const camada = regtmDesenharTerritorios(todosPares, gruposFallback, regtmDeveOcultarLabelPermanente(poloSelecionado));
  if (geracao !== regtmGeracaoAtual) return;

  regtmRenderizarLegenda(
    regtmConstruirEstruturaLegenda(
      poloSelecionado,
      resultados.map(r => ({
        polo: r.polo,
        comGeometria: r.pares.map(p => p.localidade),
        fallbackMunicipal: r.fallback.map(f => f.localidade),
        semGeometria: r.semGeometria,
      }))
    )
  );

  // Aviso visual (item 13 do pedido de finalização) também em texto, no
  // indicador de seleção — nunca só na cor do polígono/legenda.
  regtmAtualizarIndicador(
    regtmRotuloSelecao(poloSelecionado) + " — " + todosPares.length + " com contorno próprio" +
      (todosFallback.length > 0 ? ", " + todosFallback.length + " em nível municipal (fallback)" : "") +
      " de " + totalLocalidades + " localidade(s).",
    false
  );

  if (camada) {
    regtmMapaInstancia.fitBounds(camada.getBounds(), { padding: [20, 20] });
  }

  regtmAtualizarVisibilidadeLabels();
}

function regtmAoSelecionarPolo() {
  const select = document.getElementById("regtm_select_polo");
  regtmPoloAtual = select ? select.value : "";
  regtmAplicarSelecao();
}

function regtmPopularSelectPolos() {
  const select = document.getElementById("regtm_select_polo");
  if (!select || select.dataset.regtmPopulado === "true") return;

  const opcaoTodos = document.createElement("option");
  opcaoTodos.value = REGTM_VALOR_TODOS;
  opcaoTodos.textContent = "Todos";
  select.appendChild(opcaoTodos);

  REGTM_POLOS.forEach(polo => {
    const opcao = document.createElement("option");
    opcao.value = polo;
    opcao.textContent = polo;
    select.appendChild(opcao);
  });
  select.dataset.regtmPopulado = "true";
}

// Cria a instância Leaflet PRÓPRIA deste módulo — só quando o módulo é
// aberto pela primeira vez (nunca no carregamento da página, nunca
// reaproveitando `mapaInstancia` de js/mapa.js). Idempotente: chamadas
// seguintes não recriam o mapa nem duplicam o listener de zoom.
function regtmMapaInicializar() {
  if (regtmJaInicializado) return;

  if (!regtmVerificarLeafletDisponivel()) {
    console.error("[Mapas das Regionais] Leaflet indisponível — módulo não inicializado.");
    return;
  }

  const elemento = document.getElementById("mapas_territoriais_mapa");
  if (!elemento) return;

  regtmMapaInstancia = L.map("mapas_territoriais_mapa").setView(REGTM_CENTRO_INICIAL, REGTM_ZOOM_INICIAL);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 19,
  }).addTo(regtmMapaInstancia);

  regtmMapaInstancia.on("zoomend", regtmAtualizarVisibilidadeLabels);

  regtmJaInicializado = true;

  // O container só ganha tamanho real depois que openModule() troca a
  // classe .active (display:none -> visível) — Leaflet mede o container no
  // instante da criação, então recalcula o tamanho num próximo tick, senão
  // o tile inicial pode renderizar cortado/cinza até o usuário interagir.
  setTimeout(() => {
    if (regtmMapaInstancia) regtmMapaInstancia.invalidateSize();
  }, 0);
}

// Chamado pelo botão do menu (ver index.html) toda vez que o módulo é
// aberto — inicializa o mapa só na primeira vez e garante que o <select>
// está populado. NÃO redesenha território (a seleção já feita permanece
// exatamente como estava — reabrir o módulo não é uma nova seleção).
function regtmAoAbrir() {
  regtmPopularSelectPolos();
  regtmMapaInicializar();

  // O container fica display:none enquanto outro módulo está ativo — o
  // Leaflet só sabe o tamanho real dele no instante em que é medido, então
  // toda REABERTURA (não só a criação) precisa remedir depois que
  // openModule() já trocou a classe .active, senão os tiles ficam
  // cortados/em branco até o usuário interagir manualmente com o mapa.
  if (regtmMapaInstancia) {
    setTimeout(() => {
      regtmMapaInstancia.invalidateSize();
      regtmAtualizarVisibilidadeLabels();
    }, 0);
  }
}

function regtmConectarEventos() {
  const select = document.getElementById("regtm_select_polo");
  if (select) select.addEventListener("change", regtmAoSelecionarPolo);
}

document.addEventListener("DOMContentLoaded", regtmConectarEventos);
