/* MAPA OPERACIONAL — segunda visão da Gestão de Equipes (mesmos dados, ver
   js/equipes.js). Este arquivo só DESENHA: não faz fetch de operações (isso
   é responsabilidade de equipes.js, que chama mapaAoAbrir(lista,
   localidades) sempre que a lista muda). Usa Leaflet (CDN, ver index.html).

   EVOLUÇÃO DA BASE TERRITORIAL: a posição de uma equipe no mapa é resolvida
   nesta ordem, nunca inventando nada:
     1) localidades.latitude/longitude, se já levantadas;
     2) geometria do GeoJSON da regional, casada por localidades.slug_geojson
        (vínculo não-ambíguo já confirmado, ver app/scripts/vincular_geojson.py);
     3) geometria do GeoJSON casada EM TEMPO REAL por nome normalizado
        (nome oficial + aliases) — mesmo algoritmo de
        app/services/territorio.py (Python, testado) espelhado abaixo;
     4) nenhuma das anteriores -> a equipe aparece só na lista "Sem
        geolocalização disponível", nunca com posição aproximada.
   Ambiguidade (nome bate com mais de uma feição) NUNCA escolhe sozinha —
   trata como "sem geometria", igual ao Python. */

// Amarração polo (nome de exibição, igual a `localidades.polo`) -> pasta em
// geodata/ (ver geodata/README.md). Puramente de apresentação — não é dado
// transacional, por isso não fica no banco. Regionais novas só precisam de
// uma entrada aqui + uma pasta em geodata/. Mantida em sincronia manual com
// POLO_SLUG em backend/app/scripts/vincular_geojson.py.
const MAPA_POLO_SLUG = {
  "Aracaju": "aracaju",
  "São Cristóvão": "sao-cristovao",
  "Itabaiana": "itabaiana",
  "Lagarto": "lagarto",
  "Dores": "dores",
  "Propriá": "propria",
  "Maruim": "maruim",
};

// Chaves de propriedade candidatas para o "nome" de uma feição GeoJSON —
// mesma lista de backend/app/scripts/vincular_geojson.py (CHAVES_NOME_CANDIDATAS).
const MAPA_CHAVES_NOME_CANDIDATAS = [
  "nome", "name", "NOME", "NAME", "Nome", "Name",
  "bairro", "BAIRRO", "Bairro", "NM_BAIRRO", "nm_bairro",
  "municipio", "MUNICIPIO", "NM_MUNICIP", "NM_MUN",
];

// Mesma lista de backend/app/scripts/vincular_geojson.py (CHAVES_MUNICIPIO_CANDIDATAS)
// — usada só para desambiguar nomes repetidos entre municípios do mesmo polo.
const MAPA_CHAVES_MUNICIPIO_CANDIDATAS = [
  "municipio", "MUNICIPIO", "Municipio", "NM_MUN", "NM_MUNICIP", "addr:city",
];

// Centro inicial da câmera (Aracaju/SE) — só o ponto de partida da
// visualização, NUNCA a posição de uma equipe/localidade específica.
const MAPA_CENTRO_INICIAL = [-10.9472, -37.0731];
const MAPA_ZOOM_INICIAL = 11;

const MAPA_COR_STATUS = {
  DISPONIVEL: "#22c55e",
  DESLOCAMENTO: "#3b82f6",
  EM_ATENDIMENTO: "#eab308",
  NO_LOCAL: "#a855f7",
  INDISPONIVEL: "#334155",
  FINALIZADA: "#dc2626",
};
const MAPA_COR_ENCERRADO = "#dc2626";

// Mesmas 6 chaves de MAPA_COR_STATUS acima (nunca uma tabela de cor nova) —
// só o rótulo textual, que MAPA_COR_STATUS não carrega. Espelha
// EQUIPES_STATUS[...].label (js/equipes.js), mantido separado aqui para o
// resumo do painel lateral (mapaRenderizarResumo) não depender de outro
// arquivo carregar antes / poder ser testado em isolamento (ver mapa.test.js).
const MAPA_STATUS_LABEL = {
  DISPONIVEL: "Disponível",
  DESLOCAMENTO: "Em deslocamento",
  EM_ATENDIMENTO: "Em atendimento",
  NO_LOCAL: "No local",
  INDISPONIVEL: "Indisponível",
  FINALIZADA: "Turno encerrado",
};

let mapaInstancia = null;
let mapaCamadaMarcadores = null;
let mapaGeoJsonCarregados = {}; // slug -> { camada: L.GeoJSON, indicePorNome: {nomeNormalizado: [layer,...]} } | null (404/erro)
let mapaCamadasVisiveisNoMapa = {}; // slug -> L.GeoJSON atualmente adicionada ao mapa (contorno visível)
let mapaJaInicializado = false;

// Vínculo equipe -> marcador (item "Resumo das equipes" clicável, ver
// mapaFocarEquipe). Chave = operacao.id (UUID da EquipeOperacao, único e
// estável — nunca o `identificador`, que é só um texto de exibição).
// Nunca uma segunda fonte de verdade dos marcadores: só um índice por cima
// dos mesmos objetos L.Marker que já vivem em mapaCamadaMarcadores,
// reconstruído junto com eles (mesmo clearLayers()) a cada mapaAoAbrir.
// Equipes sem geometria resolvida simplesmente não entram aqui.
let mapaMarcadoresPorOperacaoId = new Map();

// GERAÇÃO DA ATUALIZAÇÃO (causa raiz de "troca de Polo às vezes não muda o
// mapa"/"mapa não atualiza sozinho após cadastro"): mapaAoAbrir é chamado
// de vários pontos (troca de sub-aba, toda vez que a lista de operações
// recarrega, troca de filtro) e faz vários `await` (fetch+parse de GeoJSON,
// que pode ser bem mais lento para regionais maiores como Aracaju/Dores/
// Itabaiana do que para as menores). Sem controle de ordem, uma chamada
// MAIS ANTIGA — ainda buscando um GeoJSON grande — pode terminar DEPOIS de
// uma chamada MAIS NOVA (ex.: usuário já trocou de Dores para Lagarto) e
// sobrescrever contornos/marcadores com o estado antigo. Nunca é
// específico de um polo — é sempre o que estiver mais lento a resolver
// naquele momento, por isso Lagarto/Maruim/Propriá/São Cristóvão (GeoJSON
// menor, carrega rápido, cabe raramente na janela de corrida) pareciam
// "funcionar" enquanto Aracaju/Dores/Itabaiana (maiores) pareciam
// "travar". `mapaGeracaoAtual` é um contador monotônico: cada chamada tira
// um número na entrada e só aplica cada mutação de estado compartilhado
// (remover/adicionar camada, fitBounds, limpar/recriar marcadores) se
// ainda for a mais nova — nenhum setTimeout, nenhuma gambiarra de reload.
let mapaGeracaoAtual = 0;

/* ================= GEOMETRIA PURA (sem Leaflet/DOM — testável em Node puro) =================
   Ver js/mapa.test.js. Nenhuma função desta seção lê `document`/`L`/estado
   de módulo — só recebem coordenadas e devolvem coordenadas/números. */

// Point-in-polygon (ray casting) + distância mínima até a borda — a base do
// "pole of inaccessibility" abaixo. `aneis`: [anelExterno, ...aneisInternos],
// cada anel uma lista de [x,y] (mesma convenção de coordenadas GeoJSON:
// x=longitude, y=latitude).
function mapaPontoDentroDoPoligono(ponto, aneis) {
  let dentro = false;
  aneis.forEach((anel, indiceAnel) => {
    let cruzouEsteAnel = false;
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const [xi, yi] = anel[i];
      const [xj, yj] = anel[j];
      const denom = (yj - yi) || 1e-12; // evita divisão por zero em aresta horizontal degenerada
      if ((yi > ponto[1]) !== (yj > ponto[1]) && ponto[0] < ((xj - xi) * (ponto[1] - yi)) / denom + xi) {
        cruzouEsteAnel = !cruzouEsteAnel;
      }
    }
    // anel 0 = externo (soma); demais = buracos (subtraem, "furam" o resultado).
    dentro = indiceAnel === 0 ? cruzouEsteAnel : dentro && !cruzouEsteAnel;
  });
  return dentro;
}

function mapaDistanciaPontoSegmento(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function mapaDistanciaAteBorda(ponto, aneis) {
  let distancia = Infinity;
  aneis.forEach(anel => {
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      distancia = Math.min(distancia, mapaDistanciaPontoSegmento(ponto, anel[i], anel[j]));
    }
  });
  return distancia;
}

/* "Pole of inaccessibility" (técnica pública de geometria computacional —
   o mesmo problema que rotulagem de mapas resolve: achar o ponto mais
   distante da borda que ainda está DENTRO do polígono real). Implementação
   própria por busca em grade com refinamento (sem dependência nova — o
   projeto não usa bundler/npm install): avalia uma grade de candidatos
   dentro da caixa delimitadora, fica com o melhor (dentro do polígono e
   mais longe da borda) e encolhe a janela de busca em torno dele a cada
   passo. NUNCA inventa coordenada — todo candidato vem de dentro da
   geometria real já carregada; se o polígono for degenerado demais para a
   grade encontrar um ponto interno (fatia muito fina), cai no centro do
   bounding box (o mesmo comportamento de antes — nunca pior do que já
   era). `aneis` no mesmo formato de mapaPontoDentroDoPoligono. */
function mapaPoloDeInacessibilidade(aneis) {
  const anelExterno = aneis[0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  anelExterno.forEach(([x, y]) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  });
  const centroBBox = [minX + (maxX - minX) / 2, minY + (maxY - minY) / 2];

  let melhor = { ponto: centroBBox, distancia: -Infinity };
  const avaliarCandidato = (x, y) => {
    if (!mapaPontoDentroDoPoligono([x, y], aneis)) return;
    const distancia = mapaDistanciaAteBorda([x, y], aneis);
    if (distancia > melhor.distancia) melhor = { ponto: [x, y], distancia };
  };

  let centroX = centroBBox[0], centroY = centroBBox[1];
  let raioX = (maxX - minX) / 2, raioY = (maxY - minY) / 2;
  const DIVISOES = 8; // resolução de cada passo da grade
  const PASSOS = 8; // refinamentos sucessivos — encolhe a janela a cada passo
  for (let passo = 0; passo < PASSOS && (raioX > 0 || raioY > 0); passo++) {
    for (let i = 0; i <= DIVISOES; i++) {
      for (let j = 0; j <= DIVISOES; j++) {
        avaliarCandidato(centroX - raioX + (2 * raioX * i) / DIVISOES, centroY - raioY + (2 * raioY * j) / DIVISOES);
      }
    }
    centroX = melhor.ponto[0]; centroY = melhor.ponto[1];
    raioX /= DIVISOES / 2; raioY /= DIVISOES / 2;
  }
  return melhor.ponto; // [lng, lat] — quem chama converte pra [lat,lng] do Leaflet
}

// Escolhe o maior polígono de um MultiPolygon (por área, fórmula do
// shoelace) — o ponto de rótulo de um multipolígono real usa a maior parte
// dele, mesma convenção de ferramentas de rotulagem de mapa.
function mapaAreaAnel(anel) {
  let area = 0;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    area += anel[j][0] * anel[i][1] - anel[i][0] * anel[j][1];
  }
  return Math.abs(area / 2);
}

// Recebe uma geometria GeoJSON (Polygon ou MultiPolygon) e devolve o ponto
// visual [lat, lng] — já convertido pra ordem do Leaflet — calculado com
// mapaPoloDeInacessibilidade sobre a geometria REAL.
function mapaPontoVisualDaGeometria(geometry) {
  let aneis;
  if (geometry.type === "Polygon") {
    aneis = geometry.coordinates;
  } else if (geometry.type === "MultiPolygon") {
    aneis = geometry.coordinates.reduce((maior, poligono) =>
      mapaAreaAnel(poligono[0]) > mapaAreaAnel(maior[0]) ? poligono : maior
    );
  } else {
    return null;
  }
  const [lng, lat] = mapaPoloDeInacessibilidade(aneis);
  return [lat, lng];
}

// Distribui N pontos em círculo ao redor de um ponto central real — só
// para separar VISUALMENTE marcadores que resolveriam pro mesmo ponto
// (mesma localidade). N=1 devolve o próprio ponto central, sem offset.
// Determinística (mesma entrada -> mesma saída sempre) e independente de
// estado — cada chamada recalcula do zero, então adicionar/remover uma
// equipe do grupo redistribui automaticamente todo mundo na próxima
// renderização, sem lógica incremental própria.
const MAPA_RAIO_OFFSET_GRAUS = 0.0007; // ~78m no equador — visualmente separado sem afastar da localidade real
function mapaDistribuirEmCirculo(latlngCentral, quantidade, raioGraus) {
  raioGraus = raioGraus == null ? MAPA_RAIO_OFFSET_GRAUS : raioGraus;
  if (quantidade <= 1) return [latlngCentral];
  const [lat, lng] = latlngCentral;
  const correcaoLongitude = Math.cos((lat * Math.PI) / 180) || 1;
  const pontos = [];
  for (let i = 0; i < quantidade; i++) {
    const angulo = (2 * Math.PI * i) / quantidade - Math.PI / 2; // primeiro ponto "para cima"
    pontos.push([lat + raioGraus * Math.sin(angulo), lng + (raioGraus * Math.cos(angulo)) / correcaoLongitude]);
  }
  return pontos;
}

/* ================= NORMALIZAÇÃO (espelha app/services/territorio.py) ================= */

// Faixa Unicode "Combining Diacritical Marks" (U+0300-U+036F) — escrita via
// \u para não depender de caracteres combinantes crus no arquivo-fonte.
const MAPA_REGEX_DIACRITICOS = /[̀-ͯ]/g;

function mapaNormalizarNome(texto) {
  if (!texto) return "";
  const semAcento = texto.normalize("NFD").replace(MAPA_REGEX_DIACRITICOS, "");
  const minusculo = semAcento.toLowerCase();
  const comEspacos = minusculo.replace(/[-_/.,;:]+/g, " ");
  const semPontuacaoResidual = comEspacos.replace(/[^\w\s]/g, "");
  return semPontuacaoResidual.replace(/\s+/g, " ").trim();
}

function mapaExtrairNomeFeicao(feature) {
  const propriedades = (feature && feature.properties) || {};
  for (const chave of MAPA_CHAVES_NOME_CANDIDATAS) {
    const valor = propriedades[chave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
  }
  return null;
}

function mapaExtrairMunicipioFeicao(feature) {
  const propriedades = (feature && feature.properties) || {};
  for (const chave of MAPA_CHAVES_MUNICIPIO_CANDIDATAS) {
    const valor = propriedades[chave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
  }
  return null;
}

function mapaVerificarLeafletDisponivel() {
  return typeof L !== "undefined";
}

function mapaEscapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto === null || texto === undefined ? "" : String(texto);
  return div.innerHTML;
}

function mapaCorPara(operacao) {
  if (operacao.turno_encerrado) return MAPA_COR_ENCERRADO;
  return MAPA_COR_STATUS[operacao.status] || "#94a3b8";
}

function mapaInicializar() {
  if (mapaJaInicializado) return;
  if (!mapaVerificarLeafletDisponivel()) {
    document.getElementById("mapa_indisponivel").hidden = false;
    document.getElementById("mapa_leaflet").hidden = true;
    return;
  }
  mapaInstancia = L.map("mapa_leaflet").setView(MAPA_CENTRO_INICIAL, MAPA_ZOOM_INICIAL);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 19,
  }).addTo(mapaInstancia);
  mapaCamadaMarcadores = L.layerGroup().addTo(mapaInstancia);
  mapaJaInicializado = true;
}

/* ================= CARREGAMENTO DO GEOJSON DA REGIONAL (por polo) ================= */

function mapaMontarIndicePorChave(camadaGeoJson) {
  // Índice único com DOIS estilos de chave por feição: o nome solto
  // normalizado ("centro") e, quando a feição identifica o município, a
  // chave qualificada ("nossa senhora do socorro|centro") — mesmo par que
  // backend/app/scripts/vincular_geojson.py grava em `slug_geojson`. Nomes
  // repetidos entre municípios do mesmo polo (ex.: "Centro" em Aracaju e em
  // Barra dos Coqueiros) colidem na chave solta (grupo com >1 candidato,
  // tratado como ambíguo) mas ficam distintos na chave qualificada.
  const indice = {};
  const adicionar = (chave, entrada) => {
    if (!chave) return;
    if (!indice[chave]) indice[chave] = [];
    indice[chave].push(entrada);
  };
  camadaGeoJson.eachLayer(layer => {
    const nomeBruto = mapaExtrairNomeFeicao(layer.feature);
    if (!nomeBruto) return;
    const nomeNormalizado = mapaNormalizarNome(nomeBruto);
    if (!nomeNormalizado) return;
    const municipioNormalizado = mapaNormalizarNome(mapaExtrairMunicipioFeicao(layer.feature) || "");
    // `municipioNormalizado` viaja com a entrada (não só na chave) para que
    // o fallback por nome solto (ver mapaResolverGeometriaLocalidade) possa
    // filtrar por compatibilidade de município mesmo usando a chave solta.
    const entrada = { layer, nomeBruto, municipioNormalizado: municipioNormalizado || null };
    adicionar(nomeNormalizado, entrada);
    if (municipioNormalizado) adicionar(`${municipioNormalizado}|${nomeNormalizado}`, entrada);
  });
  return indice;
}

function mapaVincularTooltipsDeTerritorio(camadaGeoJson, indicePorNome, listaLocalidades) {
  // Nome exibido no hover: se a feição casa (sem ambiguidade) com uma
  // localidade nossa, mostramos o nome CANÔNICO cadastrado; senão, o nome
  // bruto da própria feição (melhor esforço, só pra orientação visual).
  const nomeCanonicoPorNormalizado = {};
  (listaLocalidades || []).forEach(loc => {
    const candidatos = [loc.nome, ...(loc.aliases || [])].map(mapaNormalizarNome).filter(Boolean);
    candidatos.forEach(c => { nomeCanonicoPorNormalizado[c] = loc.nome; });
  });

  camadaGeoJson.eachLayer(layer => {
    const nomeBruto = mapaExtrairNomeFeicao(layer.feature);
    if (!nomeBruto) {
      layer.bindTooltip("Território sem nome cadastrado no GeoJSON", { sticky: true });
      return;
    }
    const normalizado = mapaNormalizarNome(nomeBruto);
    const nomeExibicao = nomeCanonicoPorNormalizado[normalizado] || nomeBruto;
    layer.bindTooltip(nomeExibicao, { sticky: true });
    layer.on("mouseover", () => layer.setStyle && layer.setStyle({ weight: 3, fillOpacity: 0.15 }));
    layer.on("mouseout", () => layer.setStyle && layer.setStyle({ weight: 2, fillOpacity: 0.05 }));
  });
}

// Só busca/monta/indexa (com cache) — NUNCA adiciona ao mapa. Quem decide
// se um contorno fica visível é mapaAtualizarContornos, abaixo (separação
// deliberada: dado carregado != contorno exibido, ver etapa 3 item 7).
async function mapaGarantirGeoJSONCarregado(slug, listaLocalidades) {
  if (Object.prototype.hasOwnProperty.call(mapaGeoJsonCarregados, slug)) {
    return mapaGeoJsonCarregados[slug];
  }
  try {
    const resposta = await fetch(`geodata/${slug}/${slug}.geojson`);
    if (!resposta.ok) {
      mapaGeoJsonCarregados[slug] = null; // ainda não fornecido — fallback silencioso
      return null;
    }
    const dados = await resposta.json();
    const camada = L.geoJSON(dados, {
      style: { color: "#0b5394", weight: 2, fillOpacity: 0.05 },
    });
    const indicePorChave = mapaMontarIndicePorChave(camada);
    mapaVincularTooltipsDeTerritorio(camada, indicePorChave, listaLocalidades);
    mapaGeoJsonCarregados[slug] = { camada, indicePorChave };
    return mapaGeoJsonCarregados[slug];
  } catch (erro) {
    mapaGeoJsonCarregados[slug] = null;
    return null;
  }
}

// Pura (sem Leaflet/DOM) — decide quais polos devem ter CONTORNO visível
// dado o filtro de Polo atual: "" (Todos, valor do <select> quando nenhuma
// opção específica está selecionada) -> todos os polos conhecidos;
// um polo específico -> só ele. Nunca depende de quais equipes têm
// posição — é isso que corrige o item 7 (Polo=Dores mostrando contornos
// de outros polos que ficaram carregados de uma navegação anterior).
function mapaPolosParaExibirContorno(poloSelecionado) {
  return poloSelecionado ? [poloSelecionado] : Object.keys(MAPA_POLO_SLUG);
}

// Remove os contornos que não pertencem mais à seleção, carrega/adiciona
// os que faltam, e enquadra o mapa (fitBounds) na união do que ficou
// visível — item 6 (foco automático) + item 7 (isolamento por polo),
// sempre calculado a partir da geometria real já carregada, nunca de um
// zoom/centro fixo por polo.
//
// `geracao` (obrigatório, vem de mapaAoAbrir) é a defesa contra corrida
// entre chamadas sobrepostas — ver comentário de `mapaGeracaoAtual` acima.
// A remoção inicial (síncrona, roda antes de qualquer `await` desta mesma
// chamada) é sempre segura pela ordem de execução do JS; o risco real é
// cada `await mapaGarantirGeoJSONCarregado(...)` demorar o suficiente para
// uma chamada mais nova já ter mudado `mapaGeracaoAtual` — por isso o
// `geracao !== mapaGeracaoAtual` é checado antes de CADA mutação do mapa
// real (addTo, fitBounds), nunca só uma vez no início.
async function mapaAtualizarContornos(poloSelecionado, listaLocalidades, geracao) {
  const slugsDesejados = new Set(
    mapaPolosParaExibirContorno(poloSelecionado).map(p => MAPA_POLO_SLUG[p]).filter(Boolean)
  );

  Object.keys(mapaCamadasVisiveisNoMapa).forEach(slug => {
    if (!slugsDesejados.has(slug)) {
      mapaInstancia.removeLayer(mapaCamadasVisiveisNoMapa[slug]);
      delete mapaCamadasVisiveisNoMapa[slug];
    }
  });

  await Promise.all(
    Array.from(slugsDesejados).map(async slug => {
      if (mapaCamadasVisiveisNoMapa[slug]) return; // já visível
      const entrada = await mapaGarantirGeoJSONCarregado(slug, listaLocalidades);
      if (geracao !== mapaGeracaoAtual) return; // uma chamada mais nova já assumiu — descarta
      if (entrada && mapaInstancia) {
        entrada.camada.addTo(mapaInstancia);
        mapaCamadasVisiveisNoMapa[slug] = entrada.camada;
      }
    })
  );

  if (geracao !== mapaGeracaoAtual) return; // idem — não força fitBounds de uma seleção já abandonada

  const camadasVisiveis = Object.values(mapaCamadasVisiveisNoMapa);
  if (mapaInstancia && camadasVisiveis.length > 0) {
    const bounds = L.featureGroup(camadasVisiveis).getBounds();
    if (bounds.isValid()) mapaInstancia.fitBounds(bounds, { padding: [24, 24] });
  }
}

/* ================= RESOLUÇÃO DA GEOMETRIA DE UMA LOCALIDADE ================= */

/* Resolve a geometria da PRÓPRIA localidade recebida — nunca olha pra
   nenhuma outra. Retorna { latlng:[lat,lon], temContorno:bool } ou null
   (sem geometria própria disponível — nunca inventa). Prioridade:
   coordenada explícita > vínculo slug_geojson confirmado > correspondência
   por nome em tempo real (só se inequívoca).

   Extraída à parte (etapa territorial — fallback município) porque
   `mapaResolverGeometriaLocalidade`, abaixo, chama esta MESMA função duas
   vezes: uma para a localidade pedida, e — só se a primeira falhar — outra
   para a linha que representa o MUNICÍPIO inteiro dela. Nunca duplicar a
   lógica de resolução entre os dois casos. */
function mapaResolverGeometriaPropria(localidade) {
  if (!localidade) return null;

  if (typeof localidade.latitude === "number" && typeof localidade.longitude === "number") {
    return { latlng: [localidade.latitude, localidade.longitude], temContorno: false };
  }

  const slug = MAPA_POLO_SLUG[localidade.polo];
  const entradaGeo = slug ? mapaGeoJsonCarregados[slug] : null;
  if (!entradaGeo) return null; // ainda não carregado / não existe (404) / polo sem pasta conhecida

  let candidato = null;

  if (localidade.slug_geojson) {
    const grupo = entradaGeo.indicePorChave[localidade.slug_geojson];
    if (grupo && grupo.length === 1) candidato = grupo[0].layer;
    // grupo.length > 1 (ambíguo mesmo com slug_geojson gravado) ou 0 (arquivo
    // mudou desde o vínculo) -> não usa, cai para tentativa por nome abaixo.
  }

  if (!candidato) {
    const municipioNormalizado = mapaNormalizarNome(localidade.municipio || "");
    const nomesCandidatos = Array.from(
      new Set([localidade.nome, ...(localidade.aliases || [])].map(mapaNormalizarNome).filter(Boolean))
    );

    // Busca pela chave solta (nome/alias), mas só aceita uma entrada cujo
    // PRÓPRIO município bate com o da localidade OU que não tenha município
    // identificado na feição (mesma regra de escopo do backend, ver
    // backend/app/scripts/vincular_geojson.py::vincular). Sem esse filtro,
    // "Centro" de um município sem polígono próprio cairia por engano no
    // "Centro" de outro município só porque o índice solto tem só uma
    // entrada com esse nome — o filtro é o que garante que a chave solta
    // nunca empresta a geometria de um município diferente do da consulta.
    const layersEncontrados = new Set();
    nomesCandidatos.forEach(nome => {
      const grupo = entradaGeo.indicePorChave[nome];
      if (!grupo) return;
      grupo
        .filter(g => !g.municipioNormalizado || g.municipioNormalizado === municipioNormalizado)
        .forEach(g => layersEncontrados.add(g.layer));
    });
    if (layersEncontrados.size === 1) {
      candidato = Array.from(layersEncontrados)[0];
    }
    // 0 -> sem correspondência; >1 -> ambíguo. Em ambos os casos NÃO associa.
  }

  if (!candidato) return null;

  // Ponto visual = "pole of inaccessibility" da geometria REAL (etapa 3) —
  // ponto garantidamente dentro do polígono, mais distante da borda (ver
  // mapaPontoVisualDaGeometria). Substituiu o centro do bounding box, que
  // podia cair fora da mancha urbana em municípios de contorno alongado
  // (caso relatado: Nossa Senhora da Glória). Se por algum motivo a
  // geometria não puder ser lida (tipo inesperado), cai no centro do
  // bounding box do Leaflet como último recurso — nunca uma coordenada
  // inventada, sempre derivada da feição real.
  const feature = candidato.feature || (candidato.toGeoJSON && candidato.toGeoJSON());
  const pontoVisual = feature && feature.geometry ? mapaPontoVisualDaGeometria(feature.geometry) : null;
  if (pontoVisual) return { latlng: pontoVisual, temContorno: true };

  const centro = candidato.getBounds().getCenter();
  return { latlng: [centro.lat, centro.lng], temContorno: true };
}

// Acha, dentro da lista de localidades já carregada, a linha que representa
// o MUNICÍPIO INTEIRO da localidade recebida — nunca por nome da
// localidade (isso reabriria exatamente o risco de confusão que motivou
// esta etapa: "Centro" da Barra dos Coqueiros encontrando o "Centro" de
// Aracaju), sempre pela combinação real polo+município da própria
// localidade. Uma linha "é o município inteiro" quando o próprio `nome`
// dela é IDÊNTICO ao `municipio` — mesmo padrão usado por todos os scripts
// de seed (cada município tem exatamente uma linha "sede" cadastrada assim,
// que recebe o slug_geojson do contorno municipal inteiro); confirmado
// empiricamente em coi_dev: toda linha com esse formato, em qualquer polo,
// segue esse padrão. Não usa `tipo` como critério porque esse campo varia
// de string entre scripts de seed diferentes ("BAIRRO"/"LOCALIDADE"/
// "MUNICIPIO") — `nome === municipio` é estrutural e sempre verdadeiro pra
// a linha-sede, então é a checagem confiável.
function mapaEncontrarLocalidadeMunicipio(localidade, listaLocalidades) {
  if (!localidade) return null;
  return (
    (listaLocalidades || []).find(
      l => l.polo === localidade.polo && l.municipio === localidade.municipio && l.nome === l.municipio
    ) || null
  );
}

/* Resolve a geometria de UMA POSIÇÃO para fins de MARCADOR — a própria
   localidade primeiro; se ela não tiver geometria própria (bairro ainda
   não levantado em nenhum GeoJSON/OSM/IBGE — caso real: bairros da Barra
   dos Coqueiros), cai para o polígono do MUNICÍPIO inteiro ao qual ela
   pertence, SE esse município tiver geometria própria. Nunca inventa
   coordenada, nunca usa a geometria de outro município, nunca decide por
   nome solto da localidade — só a combinação real polo+município da
   própria posição. Genérico: qualquer localidade futura, em qualquer polo,
   sem geometria de bairro própria, se beneficia da mesma regra.

   IMPORTANTE: isto NUNCA muda qual CONTORNO fica visível no mapa (isso
   continua controlado só pelo filtro de Polo, ver mapaAtualizarContornos)
   — é só o ponto onde o MARCADOR da equipe é desenhado.

   `precisao` diferencia os dois casos para o popup nunca apresentar o
   fallback como se fosse a posição exata do bairro (ver
   mapaMontarPopupHtml). Retorna
   { latlng, temContorno, precisao: "localidade" | "municipio" } ou null. */
function mapaResolverGeometriaLocalidade(localidade, listaLocalidades) {
  if (!localidade) return null;

  const propria = mapaResolverGeometriaPropria(localidade);
  if (propria) return Object.assign({ precisao: "localidade" }, propria);

  const localidadeMunicipio = mapaEncontrarLocalidadeMunicipio(localidade, listaLocalidades);
  if (localidadeMunicipio && localidadeMunicipio.id !== localidade.id) {
    const doMunicipio = mapaResolverGeometriaPropria(localidadeMunicipio);
    if (doMunicipio) return Object.assign({ precisao: "municipio" }, doMunicipio);
  }

  return null;
}

/* ================= POPUP / MARCADOR ================= */

function mapaMontarPopupHtml(operacao, geometria) {
  const encerrado = operacao.turno_encerrado;
  const temContorno = Boolean(geometria && geometria.temContorno);
  const precisaoMunicipio = Boolean(geometria && geometria.precisao === "municipio");
  // (operacao.areas_atuacao || []) — nunca confiar que a API sempre manda o
  // array (contrato de resposta incompleto não pode derrubar o popup do
  // marcador); mesmo raciocínio aplicado em equipesTituloLinha (js/equipes.js).
  const areasHtml = (operacao.areas_atuacao || [])
    .map(a => "<li>" + mapaEscapar(a.rotulo_exibicao) + "</li>")
    .join("");

  // "Contorno"/"Precisão territorial" nunca deixam o fallback por município
  // (etapa territorial — Barra dos Coqueiros e qualquer localidade futura
  // sem geometria de bairro própria) parecer a posição exata do bairro —
  // sempre explícito quando o ponto vem do município, não da localidade.
  const contornoTexto = !temContorno
    ? "não disponível"
    : precisaoMunicipio
      ? "disponível (nível municipal — bairro sem contorno próprio)"
      : "disponível";
  const linhaPrecisao = precisaoMunicipio
    ? '<div class="mapa-popup-linha mapa-popup-aviso-precisao"><b>Precisão territorial:</b> aproximada — nível do município (' +
      mapaEscapar(operacao.posicao.municipio) + "), não do bairro</div>"
    : "";

  return (
    '<div class="mapa-popup">' +
    '<div class="mapa-popup-titulo' + (encerrado ? " equipes-identificador-encerrado" : "") + '">' +
    mapaEscapar(operacao.identificador) + "</div>" +
    (encerrado ? '<div class="mapa-popup-aviso-encerrado">🔴 TURNO ENCERRADO — NÃO CONSIDERAR PARA NOVO DESPACHO</div>' : "") +
    '<div class="mapa-popup-linha"><b>Contorno:</b> ' + contornoTexto + "</div>" +
    linhaPrecisao +
    '<div class="mapa-popup-linha"><b>Posição atual:</b> ' + mapaEscapar(operacao.posicao.rotulo_exibicao) + "</div>" +
    '<div class="mapa-popup-linha"><b>Áreas de atuação:</b></div>' +
    '<ul class="mapa-popup-areas">' + areasHtml + "</ul>" +
    '<div class="mapa-popup-linha"><b>Telefone:</b> ' + mapaEscapar(operacao.telefone || "-") + "</div>" +
    '<div class="mapa-popup-linha"><b>Polo:</b> ' + mapaEscapar(operacao.polo || "-") + "</div>" +
    '<div class="mapa-popup-linha"><b>Município:</b> ' + mapaEscapar(operacao.posicao.municipio) + "</div>" +
    '<div class="mapa-popup-linha"><b>Status:</b> ' + mapaEscapar(operacao.status) + "</div>" +
    '<div class="mapa-popup-linha"><b>Turno:</b> ' + (encerrado ? "ENCERRADO" : "em andamento") + " (" +
    mapaEscapar((operacao.hora_inicio || "").slice(0, 5)) + "–" + mapaEscapar((operacao.hora_fim || "").slice(0, 5)) + ")</div>" +
    "</div>"
  );
}

function mapaCriarIcone(cor, encerrado) {
  return L.divIcon({
    className: "",
    html: '<div class="mapa-marcador' + (encerrado ? " mapa-marcador-encerrado" : "") +
      '" style="background:' + cor + '"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

/* ================= RESUMO DAS EQUIPES FILTRADAS (painel lateral) =================
   Reaproveita a MESMA lista já recebida por mapaAoAbrir — nenhum fetch novo,
   nenhum endpoint novo. Mostra TODAS as equipes filtradas (com ou sem
   geometria — quem não tem geometria some do MAPA mas nunca do resumo),
   na MESMA ordem recebida (a de equipesListaFiltradaPorBusca/
   equipesUltimaListaOperacoes, ver js/equipes.js) — nunca reordena por nome.
   Split em duas funções (dados puros + escrita no DOM) no mesmo padrão do
   resto deste arquivo (ver cabeçalho da seção de geometria pura acima e
   js/mapa.test.js): mapaMontarResumoDados não toca document/L, então é
   testável em Node puro; só mapaRenderizarResumo mexe no DOM. */
function mapaRotuloStatus(operacao) {
  const rotulo = MAPA_STATUS_LABEL[operacao.status] || operacao.status;
  return operacao.turno_encerrado ? rotulo + " — turno encerrado" : rotulo;
}

// Máximo de localidades mostradas por item antes de resumir em "+N" — o
// resto continua acessível (nunca escondido de vez) via title (tooltip
// nativo, ver mapaRenderizarResumo), só não some pra fora do layout.
const MAPA_RESUMO_MAX_LOCALIDADES_VISIVEIS = 3;

// `areasAtuacao`: EXATAMENTE `operacao.areas_atuacao` (lista de
// LocalidadeResumo vinda do backend, ver backend/app/schemas/equipes.py —
// mesma propriedade que js/equipes.js já usa em equipesTituloLinha via
// `.rotulo_exibicao`). Preserva a ORDEM recebida (nunca ordena por nome —
// mesma regra do resumo geral) e só remove duplicatas exatas de rótulo
// (a posição atual já vem replicada dentro de areas_atuacao, ver comentário
// no topo de js/equipes.js — sem dedupe apareceria repetida).
function mapaMontarLocalidadesResumo(areasAtuacao) {
  const vistos = new Set();
  const nomes = [];
  (areasAtuacao || []).forEach(area => {
    const rotulo = area && area.rotulo_exibicao;
    if (!rotulo || vistos.has(rotulo)) return;
    vistos.add(rotulo);
    nomes.push(rotulo);
  });
  const visiveis = nomes.slice(0, MAPA_RESUMO_MAX_LOCALIDADES_VISIVEIS);
  return { nomes, visiveis, restantes: nomes.length - visiveis.length };
}

function mapaMontarResumoDados(listaOperacoes) {
  const lista = listaOperacoes || [];
  return {
    contagemTexto: lista.length === 1 ? "1 equipe encontrada" : lista.length + " equipes encontradas",
    itens: lista.map(op => ({
      id: op.id, // UUID estável da operação (nunca `identificador` — só texto de exibição) — vínculo com mapaMarcadoresPorOperacaoId
      identificador: op.identificador,
      cor: mapaCorPara(op),
      rotulo: mapaRotuloStatus(op),
      telefone: op.telefone || null, // nunca inventado — some do card quando ausente
      localidades: mapaMontarLocalidadesResumo(op.areas_atuacao),
    })),
  };
}

// Destaca (classe, nunca inline style — mesmo padrão de .equipes-horario-ativo/
// .cbw-tab-btn.ativo já usados no projeto) o item lateral da equipe
// `operacaoId`, e SÓ ele. Retorna o elemento (ou null) para quem chamou
// poder reutilizá-lo sem precisar buscar de novo (ver mapaFocarEquipe).
function mapaSelecionarItemResumoPorId(operacaoId) {
  const listaEl = document.getElementById("mapa_resumo_lista");
  if (!listaEl) return null;
  listaEl.querySelectorAll(".mapa-resumo-item-selecionado").forEach(el => el.classList.remove("mapa-resumo-item-selecionado"));
  const item = Array.from(listaEl.children).find(el => el.dataset.operacaoId === String(operacaoId));
  if (item) item.classList.add("mapa-resumo-item-selecionado");
  return item || null;
}

// Clique numa equipe do resumo (ou Enter/Espaço, ver mapaRenderizarResumo) —
// nunca recria marcador/contorno/instância do Leaflet, só reaproveita o que
// mapaAoAbrir já desenhou: localiza via mapaMarcadoresPorOperacaoId,
// panTo (preserva o zoom atual — nunca fitBounds/setView aqui) e abre o
// popup já existente do marcador (bindPopup, ver criação dos marcadores).
// Equipe sem marcador (sem geolocalização) nunca é erro — só avisa,
// discretamente, dentro do próprio item.
function mapaFocarEquipe(operacaoId) {
  const itemEl = mapaSelecionarItemResumoPorId(operacaoId);
  const avisoEl = itemEl && itemEl.querySelector(".mapa-resumo-item-aviso-geo");
  const marcador = mapaMarcadoresPorOperacaoId.get(operacaoId);

  if (!marcador) {
    if (avisoEl) avisoEl.hidden = false;
    return;
  }
  if (avisoEl) avisoEl.hidden = true;
  if (mapaInstancia) mapaInstancia.panTo(marcador.getLatLng());
  marcador.openPopup();
}

function mapaRenderizarResumo(listaOperacoes) {
  const contagemEl = document.getElementById("mapa_resumo_contagem");
  const listaEl = document.getElementById("mapa_resumo_lista");
  if (!contagemEl || !listaEl) return; // painel ainda não presente no DOM — nada a fazer

  const dados = mapaMontarResumoDados(listaOperacoes);
  contagemEl.textContent = dados.contagemTexto;

  listaEl.innerHTML = "";
  if (dados.itens.length === 0) {
    listaEl.innerHTML = '<div class="mapa-resumo-vazio">Nenhuma equipe encontrada com os filtros atuais.</div>';
    return;
  }

  dados.itens.forEach(item => {
    const linha = document.createElement("div");
    linha.className = "mapa-resumo-item";
    linha.dataset.operacaoId = item.id;
    // role/tabindex/teclado: item é clicável (foca a equipe no mapa), então
    // precisa ser alcançável por teclado como qualquer outro controle do
    // sistema — nunca só por mouse.
    linha.tabIndex = 0;
    linha.setAttribute("role", "button");
    linha.setAttribute("aria-label", "Localizar equipe " + item.identificador + " no mapa");

    const bolinha = document.createElement("span");
    bolinha.className = "mapa-legenda-bolinha";
    bolinha.style.background = item.cor;

    const texto = document.createElement("span");
    texto.className = "mapa-resumo-item-texto";

    const idEl = document.createElement("span");
    idEl.className = "mapa-resumo-item-id";
    idEl.textContent = item.identificador;
    texto.appendChild(idEl);

    const statusEl = document.createElement("span");
    statusEl.className = "mapa-resumo-item-status";
    statusEl.textContent = item.rotulo;
    texto.appendChild(statusEl);

    if (item.telefone) {
      const telEl = document.createElement("span");
      telEl.className = "mapa-resumo-item-telefone";
      telEl.textContent = "📞 " + item.telefone;
      texto.appendChild(telEl);
    }

    const localEl = document.createElement("span");
    if (item.localidades.nomes.length === 0) {
      localEl.className = "mapa-resumo-item-localidades mapa-resumo-item-localidades-vazio";
      localEl.textContent = "Sem localidades informadas";
    } else {
      localEl.className = "mapa-resumo-item-localidades";
      localEl.textContent =
        "📍 " + item.localidades.visiveis.join(" · ") +
        (item.localidades.restantes > 0 ? " +" + item.localidades.restantes : "");
      // Lista completa acessível via tooltip nativo — nunca escondida de
      // vez, só resumida visualmente (item.localidades.restantes > 0).
      if (item.localidades.restantes > 0) localEl.title = item.localidades.nomes.join(", ");
    }
    texto.appendChild(localEl);

    const avisoGeo = document.createElement("span");
    avisoGeo.className = "mapa-resumo-item-aviso-geo";
    avisoGeo.textContent = "Sem geolocalização disponível para esta equipe.";
    avisoGeo.hidden = true;
    texto.appendChild(avisoGeo);

    linha.appendChild(bolinha);
    linha.appendChild(texto);

    linha.addEventListener("click", () => mapaFocarEquipe(item.id));
    linha.addEventListener("keydown", evento => {
      if (evento.key === "Enter" || evento.key === " ") {
        evento.preventDefault();
        mapaFocarEquipe(item.id);
      }
    });

    listaEl.appendChild(linha);
  });
}

// Duas razões distintas pra uma equipe não virar marcador — nunca a mesma
// mensagem: (a) tem posição, mas ainda não há geometria territorial pra
// ela; (b) a equipe simplesmente não tem posição definida ainda (cadastro
// incompleto, ver etapa "ajuste cadastro de equipes"). Nenhuma das duas
// nunca inventa uma posição no mapa.
function mapaRenderizarSemGeo(operacoesSemMarcador) {
  const cont = document.getElementById("mapa_sem_geo_lista");
  cont.innerHTML = "";

  if (operacoesSemMarcador.length === 0) {
    cont.innerHTML = '<div class="mapa-sem-geo-vazio">Todas as equipes filtradas têm geometria territorial disponível.</div>';
    return;
  }

  const porGrupo = {};
  operacoesSemMarcador.forEach(op => {
    const chave = op.posicao ? op.posicao.municipio : "Sem posição definida";
    if (!porGrupo[chave]) porGrupo[chave] = [];
    porGrupo[chave].push(op);
  });

  Object.keys(porGrupo).sort((a, b) => a.localeCompare(b, "pt-BR")).forEach(grupoChave => {
    const grupo = document.createElement("div");
    grupo.className = "mapa-sem-geo-grupo";
    const titulo = document.createElement("div");
    titulo.className = "mapa-sem-geo-grupo-titulo";
    titulo.textContent = grupoChave;
    grupo.appendChild(titulo);

    porGrupo[grupoChave].forEach(op => {
      const item = document.createElement("div");
      item.className = "mapa-sem-geo-item";
      const cor = mapaCorPara(op);
      const rotuloLocalidade = op.posicao ? op.posicao.rotulo_exibicao : "";
      const motivo = op.posicao ? "(geometria territorial ainda não disponível)" : "(posição não definida)";
      item.innerHTML =
        '<span class="mapa-legenda-bolinha" style="background:' + cor + '"></span>' +
        "<span>" + mapaEscapar(op.identificador) + (rotuloLocalidade ? " — " + mapaEscapar(rotuloLocalidade) : "") +
        ' <span class="equipes-hint">' + motivo + "</span></span>";
      grupo.appendChild(item);
    });
    cont.appendChild(grupo);
  });
}

async function mapaAoAbrir(listaOperacoes, listaLocalidades, poloSelecionado) {
  // Ver comentário de `mapaGeracaoAtual` — esta chamada só tem permissão de
  // mutar o mapa real enquanto for a mais nova em andamento; cada `await`
  // abaixo é um ponto onde outra chamada pode ter assumido entretanto.
  const geracao = ++mapaGeracaoAtual;

  // Resumo geral: nenhum `await` acima dele, então roda na mesma ordem das
  // chamadas (sem precisar do guard de `geracao`) e nunca depende de
  // Leaflet/GeoJSON — cobre também o caminho "Leaflet indisponível" abaixo.
  mapaRenderizarResumo(listaOperacoes || []);

  mapaInicializar();
  if (!mapaJaInicializado) {
    // Leaflet indisponível — ainda assim mantém a lista "sem geo" utilizável.
    mapaRenderizarSemGeo(listaOperacoes || []);
    return;
  }

  // container estava escondido (display:none) até a troca de sub-aba —
  // Leaflet mede o tamanho na criação, então precisa recalcular agora.
  setTimeout(() => mapaInstancia.invalidateSize(), 0);

  const mapaLocalidadePorId = {};
  (listaLocalidades || []).forEach(l => { mapaLocalidadePorId[l.id] = l; });

  // GeoJSON é carregado (dado, não contorno visível) pelo polo DA POSIÇÃO
  // (localidades.polo), não pelo polo de pertencimento da equipe — Polo !=
  // localização atual. Equipes sem posição definida (cadastro incompleto)
  // não entram nesse cálculo. Isso é independente de quais contornos ficam
  // VISÍVEIS (decidido só pelo filtro de Polo, ver mapaAtualizarContornos)
  // — uma equipe posicionada num polo fora do filtro ainda precisa resolver
  // sua geometria para aparecer no marcador, mesmo com o contorno oculto.
  const polosDePosicaoPresentes = new Set(
    (listaOperacoes || [])
      .filter(op => op.posicao)
      .map(op => (mapaLocalidadePorId[op.posicao.id] || {}).polo)
      .filter(Boolean)
  );
  await Promise.all(
    Array.from(polosDePosicaoPresentes)
      .map(polo => MAPA_POLO_SLUG[polo])
      .filter(Boolean)
      .map(slug => mapaGarantirGeoJSONCarregado(slug, listaLocalidades))
  );
  // (Este await só alimenta o cache mapaGeoJsonCarregados — não muta o mapa
  // real, então não precisa checar `geracao` aqui: é seguro nas duas ordens.)

  // Contornos visíveis + fitBounds — só o(s) polo(s) do filtro atual
  // (item 7), enquadrando pela geometria real (item 6). mapaAtualizarContornos
  // já se protege internamente contra ficar obsoleta a meio caminho.
  await mapaAtualizarContornos(poloSelecionado || "", listaLocalidades, geracao);
  if (geracao !== mapaGeracaoAtual) return; // uma chamada mais nova já assumiu — não desenha marcadores obsoletos

  mapaCamadaMarcadores.clearLayers();
  mapaMarcadoresPorOperacaoId.clear(); // reconstruído junto com os marcadores, nunca uma fonte de verdade separada
  const semGeo = [];

  // Passo 1: resolve a geometria de cada operação posicionada, sem ainda
  // criar marcador nenhum — precisamos ver todo mundo antes de saber quem
  // divide ponto com quem.
  const resolvidas = [];
  (listaOperacoes || []).forEach(operacao => {
    if (!operacao.posicao) {
      // Sem posição definida — nunca inventa marcador, some pra lista.
      semGeo.push(operacao);
      return;
    }
    const localidadeCompleta = mapaLocalidadePorId[operacao.posicao.id];
    const geometria = mapaResolverGeometriaLocalidade(localidadeCompleta, listaLocalidades);
    if (geometria) {
      resolvidas.push({ operacao, geometria });
    } else {
      semGeo.push(operacao);
    }
  });

  // Passo 2: agrupa por ponto resolvido IDÊNTICO (mesma localidade/mesma
  // geometria) — nunca por proximidade aproximada, só coincidência exata,
  // que é o caso real de "duas equipes na mesma localidade". Ordena por
  // identificador dentro do grupo para a distribuição ser determinística
  // (mesmo conjunto de equipes sempre produz o mesmo layout visual).
  const grupos = new Map();
  resolvidas.forEach(item => {
    const chave = item.geometria.latlng[0].toFixed(6) + "," + item.geometria.latlng[1].toFixed(6);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(item);
  });

  grupos.forEach(grupo => {
    grupo.sort((a, b) => a.operacao.identificador.localeCompare(b.operacao.identificador, "pt-BR"));
    const pontos =
      grupo.length > 1
        ? mapaDistribuirEmCirculo(grupo[0].geometria.latlng, grupo.length, MAPA_RAIO_OFFSET_GRAUS)
        : [grupo[0].geometria.latlng];

    grupo.forEach((item, indice) => {
      const marcador = L.marker(pontos[indice], {
        icon: mapaCriarIcone(mapaCorPara(item.operacao), item.operacao.turno_encerrado),
      });
      marcador.bindPopup(mapaMontarPopupHtml(item.operacao, item.geometria));
      // Sincroniza o destaque do item lateral quando o clique parte do
      // PRÓPRIO marcador (não só do resumo) — Leaflet já abre o popup
      // sozinho no clique (bindPopup), então só falta selecionar o item.
      marcador.on("click", () => mapaSelecionarItemResumoPorId(item.operacao.id));
      marcador.addTo(mapaCamadaMarcadores);
      mapaMarcadoresPorOperacaoId.set(item.operacao.id, marcador);
    });
  });

  mapaRenderizarSemGeo(semGeo);
}
