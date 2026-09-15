/* Testes de regressão puros (sem framework, sem dependência nova) para a
   geometria e a orquestração de contornos de js/mapa.js (etapa 3 — Central
   Operacional). Só exercita funções que NÃO dependem do Leaflet real nem do
   DOM (mapaAoAbrir/mapaAtualizarContornos continuam integradas ao Leaflet e
   só são verificáveis manualmente no navegador — ver checklist da etapa).

   Roda com Node puro:
       node js/mapa.test.js
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");

function fakeEl() {
  return { addEventListener() {}, appendChild() {}, querySelectorAll() { return []; }, options: [{}], innerHTML: "", style: {} };
}
const fakeDocument = { getElementById: () => fakeEl(), addEventListener() {}, querySelectorAll() { return []; } };

// js/mapa.js é script clássico (sem module/export, carregado via <script
// src> no navegador). Mesma técnica de js/equipes.test.js: executa dentro
// de uma função real (não eval solto — const/let de nível superior de um
// eval direto não vazam pra fora dele em Node) e devolve explicitamente só
// as funções puras (geometria + decisão de contornos) que este arquivo
// testa. `L`, `fetch` e `document` nunca são chamados pelas funções abaixo,
// então stubs vazios bastam.
const codigo = fs.readFileSync(path.join(__dirname, "mapa.js"), "utf8");
const carregar = new Function(
  "document",
  "L",
  "fetch",
  codigo +
    "\nreturn { mapaPontoDentroDoPoligono, mapaDistanciaAteBorda, mapaPoloDeInacessibilidade, " +
    "mapaAreaAnel, mapaPontoVisualDaGeometria, mapaDistribuirEmCirculo, mapaPolosParaExibirContorno, " +
    "MAPA_POLO_SLUG, MAPA_RAIO_OFFSET_GRAUS, mapaAoAbrir, mapaMontarResumoDados, " +
    "mapaMontarLocalidadesResumo, MAPA_RESUMO_MAX_LOCALIDADES_VISIVEIS, " +
    "get mapaCamadasVisiveisNoMapa() { return mapaCamadasVisiveisNoMapa; } };"
);
const {
  mapaPontoDentroDoPoligono, mapaDistanciaAteBorda, mapaPoloDeInacessibilidade,
  mapaAreaAnel, mapaPontoVisualDaGeometria, mapaDistribuirEmCirculo, mapaPolosParaExibirContorno,
  MAPA_POLO_SLUG, MAPA_RAIO_OFFSET_GRAUS, mapaMontarResumoDados,
  mapaMontarLocalidadesResumo, MAPA_RESUMO_MAX_LOCALIDADES_VISIVEIS,
} = carregar(fakeDocument, undefined, undefined);

let passou = 0;
function teste(nome, fn) {
  try {
    fn();
    passou++;
    console.log("  ok -", nome);
  } catch (e) {
    console.error("  FALHOU -", nome, "\n   ", e.message);
    process.exitCode = 1;
  }
}

// Distância plana simples (graus), suficiente pra comparar raios pequenos
// (~0.0007°) sem precisar de haversine.
function distancia(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

console.log("=== mapaPontoDentroDoPoligono (ray casting) ===");
teste("ponto claramente dentro de um quadrado simples", () => {
  const quadrado = [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]];
  assert.equal(mapaPontoDentroDoPoligono([5, 5], quadrado), true);
});
teste("ponto claramente fora de um quadrado simples", () => {
  const quadrado = [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]];
  assert.equal(mapaPontoDentroDoPoligono([50, 50], quadrado), false);
});
teste("buraco (segundo anel) exclui pontos do interior do buraco", () => {
  const comBuraco = [
    [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]], // anel externo
    [[4, 4], [4, 6], [6, 6], [6, 4], [4, 4]], // buraco
  ];
  assert.equal(mapaPontoDentroDoPoligono([5, 5], comBuraco), false); // dentro do buraco
  assert.equal(mapaPontoDentroDoPoligono([1, 1], comBuraco), true); // fora do buraco, dentro do anel externo
});

console.log("=== mapaAreaAnel (shoelace) ===");
teste("area de um quadrado 10x10 e 100", () => {
  const quadrado = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]];
  assert.equal(mapaAreaAnel(quadrado), 100);
});

console.log("=== mapaPoloDeInacessibilidade / mapaPontoVisualDaGeometria — garantia geral ===");
teste("forma em C (concava): pole of inaccessibility fica DENTRO, onde o centro do bounding box cairia FORA", () => {
  // "C" abrindo pra direita: bloco solido a esquerda (x 0-10 nas bordas
  // superior/inferior) com uma fenda entalhada no meio direito (x 4-10,
  // y 3-7) — o centro do bounding box (o antigo getBounds().getCenter())
  // cai bem dentro dessa fenda, fora da forma. E exatamente o defeito
  // relatado (marcador de Gloria fora da mancha povoada) reproduzido de
  // forma controlada e verificavel.
  const formaC = [[
    [0, 0], [0, 10], [10, 10], [10, 7], [4, 7], [4, 3], [10, 3], [10, 0], [0, 0],
  ]];
  const bboxCentro = [5, 5]; // (minX+maxX)/2, (minY+maxY)/2 = (5,5) -> cai na fenda
  assert.equal(mapaPontoDentroDoPoligono(bboxCentro, formaC), false, "pre-condicao do teste: bbox center devia estar fora");

  const ponto = mapaPoloDeInacessibilidade(formaC);
  assert.equal(mapaPontoDentroDoPoligono(ponto, formaC), true, "pole of inaccessibility deve estar dentro da forma em C");
});
teste("pole of inaccessibility fica razoavelmente longe da borda (nao cola na margem)", () => {
  const quadrado = [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]];
  const ponto = mapaPoloDeInacessibilidade(quadrado);
  const distanciaBorda = mapaDistanciaAteBorda(ponto, quadrado);
  assert.ok(distanciaBorda > 3, `esperava distancia > 3 da borda num quadrado 10x10, obteve ${distanciaBorda}`);
});

console.log("=== mapaPontoVisualDaGeometria — caso real: Gloria (Polo Dores) ===");
teste("ponto visual da geometria real de Gloria fica dentro do proprio poligono", () => {
  const dadosDores = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "geodata", "dores", "dores.geojson"), "utf8"));
  const gloria = dadosDores.features.find(f => (f.properties || {}).nome === "Glória");
  assert.ok(gloria, "feature 'Gloria' precisa existir em geodata/dores/dores.geojson para este teste ser valido");

  const pontoVisual = mapaPontoVisualDaGeometria(gloria.geometry); // [lat, lon]
  // mapaPontoDentroDoPoligono espera aneis em [x,y] = [lon,lat], igual ao
  // GeoJSON bruto — converte o ponto de volta pra conferir com a mesma
  // geometria original, sem recalcular nada (nunca inventa coordenada).
  const pontoXY = [pontoVisual[1], pontoVisual[0]];
  assert.equal(gloria.geometry.type, "Polygon");
  assert.equal(mapaPontoDentroDoPoligono(pontoXY, gloria.geometry.coordinates), true,
    "o ponto visual calculado para Gloria precisa cair dentro do poligono real do municipio");
});

console.log("=== mapaDistribuirEmCirculo ===");
teste("N=1 devolve o proprio ponto central, sem alterar", () => {
  const central = [-10.5, -37.3];
  const pontos = mapaDistribuirEmCirculo(central, 1, MAPA_RAIO_OFFSET_GRAUS);
  assert.deepEqual(pontos, [central]);
});
teste("N=2 devolve 2 pontos distintos, ambos a ~raio de distancia do centro", () => {
  const central = [-10.5, -37.3];
  const pontos = mapaDistribuirEmCirculo(central, 2, MAPA_RAIO_OFFSET_GRAUS);
  assert.equal(pontos.length, 2);
  assert.notDeepEqual(pontos[0], pontos[1]);
  pontos.forEach(p => {
    const d = distancia(central, p);
    assert.ok(d > 0, "ponto distribuido nao pode coincidir com o centro");
  });
});
teste("N=3 devolve 3 pontos todos distintos entre si", () => {
  const central = [-10.5, -37.3];
  const pontos = mapaDistribuirEmCirculo(central, 3, MAPA_RAIO_OFFSET_GRAUS);
  assert.equal(pontos.length, 3);
  const chaves = new Set(pontos.map(p => p[0].toFixed(8) + "," + p[1].toFixed(8)));
  assert.equal(chaves.size, 3, "os 3 pontos distribuidos precisam ser todos distintos");
});
teste("N generico (8) continua gerando pontos distintos e nao altera lat/lon original em nenhum deles", () => {
  const central = [-10.5, -37.3];
  const pontos = mapaDistribuirEmCirculo(central, 8, MAPA_RAIO_OFFSET_GRAUS);
  assert.equal(pontos.length, 8);
  const chaves = new Set(pontos.map(p => p[0].toFixed(8) + "," + p[1].toFixed(8)));
  assert.equal(chaves.size, 8);
  pontos.forEach(p => assert.notDeepEqual(p, central));
});

console.log("=== mapaPolosParaExibirContorno (isolamento de contornos por Polo, item 7) ===");
teste("'Todos' (string vazia, valor do <select> sem polo especifico) mostra TODOS os polos conhecidos", () => {
  const resultado = mapaPolosParaExibirContorno("");
  assert.deepEqual(new Set(resultado), new Set(Object.keys(MAPA_POLO_SLUG)));
});
teste("um polo especifico mostra so ele mesmo", () => {
  assert.deepEqual(mapaPolosParaExibirContorno("Dores"), ["Dores"]);
});
teste("sequencia Todos -> Dores -> Lagarto -> Aracaju: cada passo isola exatamente o polo do filtro", () => {
  const sequencia = ["", "Dores", "Lagarto", "Aracaju"];
  const esperado = [Object.keys(MAPA_POLO_SLUG), ["Dores"], ["Lagarto"], ["Aracaju"]];
  sequencia.forEach((poloSelecionado, i) => {
    const resultado = mapaPolosParaExibirContorno(poloSelecionado);
    assert.deepEqual(new Set(resultado), new Set(esperado[i]), `passo ${i} (polo="${poloSelecionado}") divergiu`);
  });
});

console.log("=== mapaMontarResumoDados (resumo das equipes filtradas, painel lateral) ===");
teste("lista vazia -> contagem zero e nenhum item", () => {
  const dados = mapaMontarResumoDados([]);
  assert.equal(dados.contagemTexto, "0 equipes encontradas");
  assert.deepEqual(dados.itens, []);
});
teste("lista ausente (undefined) -> mesmo comportamento de lista vazia, nunca lança", () => {
  const dados = mapaMontarResumoDados(undefined);
  assert.equal(dados.contagemTexto, "0 equipes encontradas");
  assert.deepEqual(dados.itens, []);
});
teste("uma equipe -> contagem no singular e um item", () => {
  const dados = mapaMontarResumoDados([{ identificador: "ARJ-PS01", status: "DISPONIVEL", turno_encerrado: false }]);
  assert.equal(dados.contagemTexto, "1 equipe encontrada");
  assert.equal(dados.itens.length, 1);
  assert.equal(dados.itens[0].identificador, "ARJ-PS01");
  assert.equal(dados.itens[0].rotulo, "Disponível");
  assert.equal(dados.itens[0].cor, "#22c55e");
});
teste("varias equipes -> contagem no plural, quantidade bate e preserva a ORDEM recebida (nunca alfabética)", () => {
  const lista = [
    { identificador: "ZZZ-PS01", status: "DISPONIVEL", turno_encerrado: false },
    { identificador: "AAA-PS01", status: "DESLOCAMENTO", turno_encerrado: false },
    { identificador: "MMM-PS01", status: "NO_LOCAL", turno_encerrado: false },
  ];
  const dados = mapaMontarResumoDados(lista);
  assert.equal(dados.contagemTexto, "3 equipes encontradas");
  assert.deepEqual(dados.itens.map(i => i.identificador), ["ZZZ-PS01", "AAA-PS01", "MMM-PS01"]);
});
teste("rotulo usa o status REAL de cada equipe (nunca inventado) e sinaliza turno encerrado", () => {
  const dados = mapaMontarResumoDados([
    { identificador: "A", status: "EM_ATENDIMENTO", turno_encerrado: false },
    { identificador: "B", status: "INDISPONIVEL", turno_encerrado: true },
  ]);
  assert.equal(dados.itens[0].rotulo, "Em atendimento");
  assert.equal(dados.itens[1].rotulo, "Indisponível — turno encerrado");
});
teste("cor reaproveita a MESMA tabela dos marcadores/legenda (mapaCorPara) — nenhuma tabela de cor nova", () => {
  const dados = mapaMontarResumoDados([
    { identificador: "A", status: "DESLOCAMENTO", turno_encerrado: false },
    { identificador: "B", status: "DESLOCAMENTO", turno_encerrado: true }, // turno encerrado sobrepõe a cor, mesma regra de mapaCorPara
  ]);
  assert.equal(dados.itens[0].cor, "#3b82f6");
  assert.equal(dados.itens[1].cor, "#dc2626");
});
teste("equipes COM e SEM geometria/posição aparecem igualmente no resumo (resumo nunca filtra por geo) — nenhuma duplicação", () => {
  const lista = [
    { identificador: "COM-GEO", status: "DISPONIVEL", turno_encerrado: false, posicao: { municipio: "Aracaju" } },
    { identificador: "SEM-GEO", status: "DISPONIVEL", turno_encerrado: false, posicao: null },
  ];
  const dados = mapaMontarResumoDados(lista);
  assert.equal(dados.itens.length, 2);
  assert.deepEqual(dados.itens.map(i => i.identificador), ["COM-GEO", "SEM-GEO"]);
});

console.log("=== mapaMontarResumoDados — id estável, telefone e localidades (item operacional clicável) ===");
teste("cada item carrega o `id` (operacao.id, UUID) — nunca `identificador`, que é só texto de exibição", () => {
  const dados = mapaMontarResumoDados([{ id: "uuid-1", identificador: "ARJ-PS01", status: "DISPONIVEL", turno_encerrado: false }]);
  assert.equal(dados.itens[0].id, "uuid-1");
});
teste("equipe COM telefone -> telefone aparece exatamente como veio (nunca formatado/inventado)", () => {
  const dados = mapaMontarResumoDados([
    { id: "1", identificador: "ARJ-PS01", status: "DISPONIVEL", turno_encerrado: false, telefone: "(79) 99999-9999" },
  ]);
  assert.equal(dados.itens[0].telefone, "(79) 99999-9999");
});
teste("equipe SEM telefone (null) -> telefone fica null, nunca string vazia/inventada", () => {
  const dados = mapaMontarResumoDados([
    { id: "1", identificador: "ARJ-PS01", status: "DISPONIVEL", turno_encerrado: false, telefone: null },
  ]);
  assert.equal(dados.itens[0].telefone, null);
});
teste("equipe sem o campo telefone (ausente, não só null) -> mesmo tratamento, nunca lança", () => {
  const dados = mapaMontarResumoDados([{ id: "1", identificador: "ARJ-PS01", status: "DISPONIVEL", turno_encerrado: false }]);
  assert.equal(dados.itens[0].telefone, null);
});
teste("equipe COM localidades -> aparecem na MESMA ordem de areas_atuacao (nunca alfabética)", () => {
  const dados = mapaMontarResumoDados([
    {
      id: "1", identificador: "ARJ-PS01", status: "DISPONIVEL", turno_encerrado: false,
      areas_atuacao: [{ rotulo_exibicao: "13 de Julho" }, { rotulo_exibicao: "São José" }, { rotulo_exibicao: "Centro" }],
    },
  ]);
  assert.deepEqual(dados.itens[0].localidades.nomes, ["13 de Julho", "São José", "Centro"]);
});
teste("equipe SEM localidades (areas_atuacao vazio) -> lista de nomes vazia (painel mostra aviso discreto)", () => {
  const dados = mapaMontarResumoDados([
    { id: "1", identificador: "ARJ-PS01", status: "DISPONIVEL", turno_encerrado: false, areas_atuacao: [] },
  ]);
  assert.deepEqual(dados.itens[0].localidades.nomes, []);
});
teste("equipe sem o campo areas_atuacao (ausente) -> mesmo tratamento de vazio, nunca lança", () => {
  const dados = mapaMontarResumoDados([{ id: "1", identificador: "ARJ-PS01", status: "DISPONIVEL", turno_encerrado: false }]);
  assert.deepEqual(dados.itens[0].localidades.nomes, []);
});

console.log("=== mapaMontarLocalidadesResumo (localidades de uma equipe — limite visual + dedupe) ===");
teste("lista vazia -> nomes/visiveis vazios, 0 restantes", () => {
  const r = mapaMontarLocalidadesResumo([]);
  assert.deepEqual(r, { nomes: [], visiveis: [], restantes: 0 });
});
teste("poucas localidades (<= limite) -> todas visiveis, 0 restantes", () => {
  const r = mapaMontarLocalidadesResumo([{ rotulo_exibicao: "Centro" }, { rotulo_exibicao: "13 de Julho" }]);
  assert.deepEqual(r.visiveis, ["Centro", "13 de Julho"]);
  assert.equal(r.restantes, 0);
});
teste("muitas localidades -> corta em MAPA_RESUMO_MAX_LOCALIDADES_VISIVEIS e conta o restante (nunca destrói o layout)", () => {
  const areas = ["Centro", "13 de Julho", "São José", "Jabotiana", "Luzia", "Farolândia", "Grageru"]
    .map(nome => ({ rotulo_exibicao: nome }));
  const r = mapaMontarLocalidadesResumo(areas);
  assert.equal(r.visiveis.length, MAPA_RESUMO_MAX_LOCALIDADES_VISIVEIS);
  assert.deepEqual(r.visiveis, areas.slice(0, MAPA_RESUMO_MAX_LOCALIDADES_VISIVEIS).map(a => a.rotulo_exibicao));
  assert.equal(r.restantes, areas.length - MAPA_RESUMO_MAX_LOCALIDADES_VISIVEIS);
  assert.equal(r.nomes.length, areas.length, "a lista COMPLETA continua acessível (nunca perdida) mesmo cortando a visível");
});
teste("localidade repetida (mesmo rótulo) -> aparece só UMA vez, nunca duplicada", () => {
  const r = mapaMontarLocalidadesResumo([
    { rotulo_exibicao: "Centro" },
    { rotulo_exibicao: "13 de Julho" },
    { rotulo_exibicao: "Centro" }, // ex.: posição atual replicada dentro de areas_atuacao (ver js/equipes.js)
  ]);
  assert.deepEqual(r.nomes, ["Centro", "13 de Julho"]);
});
teste("area sem rotulo_exibicao (contrato incompleto) -> ignorada, nunca quebra nem vira 'undefined' na lista", () => {
  const r = mapaMontarLocalidadesResumo([{ rotulo_exibicao: "Centro" }, {}, { rotulo_exibicao: null }]);
  assert.deepEqual(r.nomes, ["Centro"]);
});

console.log("=== mapaMontarResumoDados — lista sem equipes e equipe sem geolocalização (id continua presente) ===");
teste("lista vazia -> nenhum item (sem id/telefone/localidades pra montar)", () => {
  const dados = mapaMontarResumoDados([]);
  assert.deepEqual(dados.itens, []);
});
teste("equipe sem posição/geolocalização continua com id, telefone e localidades normalmente montados no resumo", () => {
  const dados = mapaMontarResumoDados([
    {
      id: "sem-geo-1", identificador: "SEM-GEO01", status: "DISPONIVEL", turno_encerrado: false,
      telefone: "79988887777", areas_atuacao: [{ rotulo_exibicao: "Bairro Novo" }], posicao: null,
    },
  ]);
  assert.equal(dados.itens[0].id, "sem-geo-1");
  assert.equal(dados.itens[0].telefone, "79988887777");
  assert.deepEqual(dados.itens[0].localidades.nomes, ["Bairro Novo"]);
});

console.log("=== mapaAoAbrir: corrida entre chamadas sobrepostas (causa raiz relatada) ===");

// Deferred controlável: deixa o teste decidir a ORDEM de resolução dos
// fetches, simulando exatamente o cenário relatado — uma regional "grande"
// (ex.: Aracaju) demora mais para responder que uma "pequena" (ex.:
// Lagarto), então uma troca de Polo rápida pode fazer a resposta da
// chamada MAIS ANTIGA chegar DEPOIS da mais nova.
function criarDeferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

async function testarCorridaDeChamadas() {
  const registros = [];
  const deferredsPorSlug = {};

  const fakeL = {
    map() { return { setView() { return this; }, removeLayer(camada) { registros.push({ ev: "remove", slug: camada.__slug }); }, fitBounds() { registros.push({ ev: "fitBounds" }); }, invalidateSize() {} }; },
    tileLayer() { return { addTo() { return this; } }; },
    layerGroup() { return { addTo() { return this; }, clearLayers() { registros.push({ ev: "clearLayers" }); } }; },
    geoJSON(dados) { return { __slug: dados.__slug, eachLayer() {}, addTo(mapa) { registros.push({ ev: "addContorno", slug: this.__slug }); return this; } }; },
    featureGroup() { return { getBounds() { return { isValid: () => true }; } }; },
    marker(latlng) { return { bindPopup() { return this; }, on() {}, addTo() { registros.push({ ev: "marker", latlng }); return this; } }; },
    divIcon(opts) { return opts; },
  };

  function fakeElemento() {
    // dataset/style/setAttribute/addEventListener: superfície mínima que
    // mapaRenderizarResumo (item clicável do resumo) agora usa pra montar
    // cada card — sem isso o teste quebra em algo que nem é o que ele testa
    // (corrida de chamadas), só por faltar API de DOM no stub.
    const el = { innerHTML: "", hidden: false, children: [], dataset: {}, style: {} };
    el.appendChild = child => { el.children.push(child); };
    el.setAttribute = () => {};
    el.addEventListener = () => {};
    return el;
  }
  const fakeDocRace = {
    getElementById: () => fakeElemento(),
    createElement: () => fakeElemento(),
  };

  const fakeFetchRace = url => {
    const slug = url.match(/geodata\/([^/]+)\//)[1];
    if (!deferredsPorSlug[slug]) deferredsPorSlug[slug] = criarDeferred();
    return deferredsPorSlug[slug].promise.then(() => ({
      ok: true,
      json: async () => ({ __slug: slug, type: "FeatureCollection", features: [] }),
    }));
  };

  const carregarRace = new Function(
    "document", "L", "fetch",
    codigo + "\nreturn { mapaAoAbrir, get mapaCamadasVisiveisNoMapa() { return mapaCamadasVisiveisNoMapa; } };"
  );
  const { mapaAoAbrir: mapaAoAbrirRace, mapaCamadasVisiveisNoMapa: camadasRace } =
    carregarRace(fakeDocRace, fakeL, fakeFetchRace);

  const flush = () => new Promise(r => setImmediate(r));

  // Chamada A (mais ANTIGA, polo "Dores" — vai demorar) inicia primeiro...
  const chamadaA = mapaAoAbrirRace([], [], "Dores");
  await flush(); // deixa A avançar de verdade até o fetch (várias etapas assíncronas antes dele)

  // ...chamada B (mais NOVA, polo "Lagarto") começa antes de A terminar —
  // exatamente uma troca rápida de filtro no <select> de Polo.
  const chamadaB = mapaAoAbrirRace([], [], "Lagarto");
  await flush(); // idem para B

  // Resolve a chamada MAIS NOVA (Lagarto) primeiro, a mais ANTIGA (Dores)
  // só depois — é o pior caso possível: a resposta antiga chega por último.
  deferredsPorSlug["lagarto"].resolve();
  await chamadaB;
  deferredsPorSlug["dores"].resolve();
  await chamadaA;

  return { registros, camadasVisiveis: Object.keys(camadasRace) };
}

console.log("=== fallback territorial município->localidade (etapa Barra dos Coqueiros) ===");

// Infraestrutura de teste com GeoJSON REAL (geodata/aracaju/aracaju.geojson,
// geodata/dores/dores.geojson) — nunca sintético — pra provar que o
// fallback resolve dentro do polígono municipal VERDADEIRO, nunca de outro
// município, e que localidades com geometria própria nunca acionam o
// fallback. Mock de Leaflet suficiente pra rodar mapaAoAbrir de ponta a
// ponta (mesma técnica das seções acima), capturando cada marcador criado
// (posição final + HTML do popup) pra inspecionar depois.
const DADOS_ARACAJU = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "geodata", "aracaju", "aracaju.geojson"), "utf8"));
const DADOS_DORES = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "geodata", "dores", "dores.geojson"), "utf8"));

function criarLayerDeFeature(feature) {
  const anel = feature.geometry.type === "Polygon" ? feature.geometry.coordinates.flat(1) : feature.geometry.coordinates.flat(2);
  const lats = anel.map(c => c[1]), lons = anel.map(c => c[0]);
  return {
    feature,
    toGeoJSON() { return feature; },
    getBounds() {
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const minLon = Math.min(...lons), maxLon = Math.max(...lons);
      return { getCenter: () => ({ lat: (minLat + maxLat) / 2, lng: (minLon + maxLon) / 2 }) };
    },
    bindTooltip() { return this; },
    on() { return this; },
    setStyle() { return this; },
  };
}
function criarCamadaGeoJSON(dadosGeoJSON) {
  const layers = dadosGeoJSON.features.map(criarLayerDeFeature);
  return { eachLayer(cb) { layers.forEach(cb); }, addTo() { return this; } };
}

function montarAmbienteFallback() {
  const marcadores = []; // { latlng, popupHtml }
  const fakeL = {
    map() { return { setView() { return this; }, removeLayer() {}, fitBounds() {}, invalidateSize() {} }; },
    tileLayer() { return { addTo() { return this; } }; },
    layerGroup() { return { addTo() { return this; }, clearLayers() { marcadores.length = 0; } }; },
    geoJSON(dados) { return criarCamadaGeoJSON(dados); },
    featureGroup() { return { getBounds() { return { isValid: () => true }; } }; },
    marker(latlng) {
      const m = { __latlng: latlng, __popupHtml: "" };
      m.bindPopup = html => { m.__popupHtml = html; return m; };
      m.on = () => m;
      m.addTo = () => { marcadores.push(m); return m; };
      return m;
    },
    divIcon(opts) { return opts; },
  };
  function fakeElemento() {
    // `mapaEscapar` (js/mapa.js) escapa via document.createElement("div") +
    // .textContent = ... + lê .innerHTML de volta — precisa de um getter/
    // setter de verdade aqui, senão .innerHTML fica sempre "" e todo texto
    // escapado (identificador, nome de localidade etc.) some do popup,
    // quebrando qualquer asserção que procure texto dentro dele.
    // dataset/style/setAttribute/addEventListener: idem, agora exigidos por
    // mapaRenderizarResumo (item clicável do resumo, ver js/mapa.js).
    let _html = "";
    const el = {
      hidden: false, children: [], dataset: {}, style: {},
      get innerHTML() { return _html; },
      set innerHTML(v) { _html = v; },
      get textContent() { return _html; },
      set textContent(v) {
        _html = String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      },
    };
    el.appendChild = c => el.children.push(c);
    el.setAttribute = () => {};
    el.addEventListener = () => {};
    return el;
  }
  const fakeDoc = { getElementById: () => fakeElemento(), createElement: () => fakeElemento() };
  const fakeFetch = url => {
    // Nunca method != GET (implícito aqui — fetch(url) sem 2º argumento):
    // mapa.js não tem nenhum caminho de escrita, nunca chama authChamarApi
    // nem faz POST/PUT/DELETE — confirmado por inspeção do próprio arquivo.
    if (url.includes("/aracaju/")) return Promise.resolve({ ok: true, json: async () => DADOS_ARACAJU });
    if (url.includes("/dores/")) return Promise.resolve({ ok: true, json: async () => DADOS_DORES });
    return Promise.resolve({ ok: false });
  };

  const carregar = new Function(
    "document", "L", "fetch",
    codigo + "\nreturn { mapaAoAbrir, mapaPontoDentroDoPoligono, mapaNormalizarNome };"
  );
  const bundle = carregar(fakeDoc, fakeL, fakeFetch);
  return { ...bundle, marcadores };
}

// Mesmo formato de objeto que a API real devolve em GET /api/teams/localidades.
function localidade(overrides) {
  return Object.assign({
    id: "loc-" + Math.random().toString(36).slice(2, 10),
    polo: "Aracaju", municipio: "Aracaju", nome: "X", slug_geojson: null,
    latitude: null, longitude: null, aliases: [],
  }, overrides);
}

function operacao(identificador, posicao, overrides) {
  return Object.assign({
    id: identificador, identificador, telefone: null, posicao,
    areas_atuacao: posicao ? [posicao] : [], operadores: [], status: "DISPONIVEL",
    turno_encerrado: false, hora_inicio: "07:00:00", hora_fim: "15:00:00",
    polo: posicao ? posicao.polo : "Aracaju", viatura_numero: null, radio_status: null, cursos: [],
    observacao: null, equipe_id: identificador,
  }, overrides);
}

// A localidade "sede" (nome === municipio) da Barra dos Coqueiros — mesmo
// formato real do banco (slug_geojson já vinculado ao contorno municipal
// inteiro, confirmado na auditoria territorial).
const BARRA_MUNICIPIO = localidade({
  id: "barra-municipio", municipio: "Barra dos Coqueiros", nome: "Barra dos Coqueiros",
  slug_geojson: "barra dos coqueiros|barra dos coqueiros",
});
const ATALAIA_NOVA = localidade({ id: "atalaia-nova", municipio: "Barra dos Coqueiros", nome: "Atalaia Nova", slug_geojson: null });
const CENTRO_BARRA = localidade({ id: "centro-barra", municipio: "Barra dos Coqueiros", nome: "Centro", slug_geojson: null });
const CENTRO_ARACAJU = localidade({ id: "centro-aracaju", municipio: "Aracaju", nome: "Centro", slug_geojson: "aracaju|centro" });
const LOCALIDADE_FANTASMA = localidade({ id: "fantasma", municipio: "Município Sem Geojson Nenhum", nome: "Bairro Fantasma", slug_geojson: null });

async function testarFallbackTerritorial() {
  const { mapaAoAbrir, mapaPontoDentroDoPoligono, marcadores } = montarAmbienteFallback();
  const listaLocalidades = [BARRA_MUNICIPIO, ATALAIA_NOVA, CENTRO_BARRA, CENTRO_ARACAJU, LOCALIDADE_FANTASMA];

  // Polígono real da Barra dos Coqueiros e de Centro-Aracaju, direto do
  // GeoJSON em uso — usados só para VERIFICAR onde os pontos caíram, nunca
  // para gerar o marcador.
  const featureBarra = DADOS_ARACAJU.features.find(f => (f.properties || {}).nome === "Barra dos Coqueiros");
  const featureCentroAracaju = DADOS_ARACAJU.features.find(f => (f.properties || {}).nome === "Centro" && (f.properties || {}).municipio === "Aracaju");
  const dentroDoPoligono = (latlng, feature) => mapaPontoDentroDoPoligono([latlng[1], latlng[0]], feature.geometry.coordinates);

  // --- Item 1/2/6: Atalaia Nova + Centro da Barra, cada uma numa operação
  // separada, mais uma equipe extra em Centro-Barra pra testar 2-no-mesmo-
  // ponto-de-fallback (item 5) e uma terceira mais tarde (item 6).
  const opAtalaia = operacao("BÇQ-PS01", ATALAIA_NOVA);
  const opCentroBarraA = operacao("BÇQ-PS02", CENTRO_BARRA);
  const opCentroBarraB = operacao("BÇQ-PS03", CENTRO_BARRA);
  const opCentroAracaju = operacao("CTN-PS01", CENTRO_ARACAJU);
  const opFantasma = operacao("FTM-PS01", LOCALIDADE_FANTASMA);

  await mapaAoAbrir([opAtalaia, opCentroBarraA, opCentroBarraB, opCentroAracaju, opFantasma], listaLocalidades, "");

  const porId = id => marcadores.find(m => m.__popupHtml.includes(">" + id + "<"));

  teste("Atalaia Nova (sem geometria própria) ganha marcador via fallback município", () => {
    assert.ok(porId("BÇQ-PS01"), "esperava um marcador pra BÇQ-PS01");
  });
  teste("o marcador de Atalaia Nova cai DENTRO do polígono real da Barra dos Coqueiros", () => {
    const m = porId("BÇQ-PS01");
    assert.ok(dentroDoPoligono(m.__latlng, featureBarra), `ponto ${JSON.stringify(m.__latlng)} fora do polígono da Barra`);
  });
  teste("popup de Atalaia Nova deixa explícito 'nível municipal' (nunca finge ser a posição exata do bairro)", () => {
    const m = porId("BÇQ-PS01");
    assert.ok(m.__popupHtml.includes("nível municipal"), m.__popupHtml);
    assert.ok(m.__popupHtml.includes("Precisão territorial"), m.__popupHtml);
  });

  teste("Centro da Barra dos Coqueiros usa o fallback (é a mesma Barra), NUNCA o Centro de Aracaju", () => {
    const m = porId("BÇQ-PS02");
    assert.ok(dentroDoPoligono(m.__latlng, featureBarra), "deveria estar dentro da Barra dos Coqueiros");
    assert.equal(dentroDoPoligono(m.__latlng, featureCentroAracaju), false, "NUNCA pode cair dentro do polígono de Centro-Aracaju");
  });

  teste("localidade COM geometria própria (Centro-Aracaju) nunca aciona o fallback", () => {
    const m = porId("CTN-PS01");
    assert.ok(m.__popupHtml.includes("Contorno:</b> disponível</div>"),
      `Centro-Aracaju tem geometria própria — Contorno devia ser só "disponível": ${m.__popupHtml}`);
    assert.ok(!m.__popupHtml.includes("nível municipal"), "Centro-Aracaju não pode mencionar fallback municipal");
    assert.ok(dentroDoPoligono(m.__latlng, featureCentroAracaju), "ponto deveria estar dentro do próprio polígono de Centro-Aracaju");
  });

  teste("localidade sem geometria própria E sem município com geometria continua sem geolocalização (nenhum marcador inventado)", () => {
    assert.equal(porId("FTM-PS01"), undefined, "FTM-PS01 não pode ganhar marcador nenhum");
  });

  teste("duas equipes caindo no MESMO ponto de fallback (Centro da Barra) ficam em pontos distintos (distribuição visual)", () => {
    const mA = porId("BÇQ-PS02"), mB = porId("BÇQ-PS03");
    assert.notDeepEqual(mA.__latlng, mB.__latlng, "duas equipes não podem ficar visualmente sobrepostas");
  });

  // --- Item 6: uma TERCEIRA equipe some se junta ao mesmo fallback —
  // redistribuição determinística de todas as 3, não só a nova.
  const opCentroBarraC = operacao("BÇQ-PS04", CENTRO_BARRA);
  await mapaAoAbrir([opAtalaia, opCentroBarraA, opCentroBarraB, opCentroBarraC, opCentroAracaju, opFantasma], listaLocalidades, "");
  teste("com uma 3ª equipe no mesmo fallback, as 3 continuam em pontos distintos entre si (redistribuição determinística)", () => {
    const pontos = ["BÇQ-PS02", "BÇQ-PS03", "BÇQ-PS04"].map(id => JSON.stringify(porId(id).__latlng));
    assert.equal(new Set(pontos).size, 3, `esperava 3 pontos distintos, obteve: ${pontos}`);
  });
}

async function testarFallbackNaoVazaEntrePolos() {
  // Item 7/8: troca de Polo não deixa resíduo de fallback de um polo
  // anterior, e "Todos" mostra tudo — reusa o mesmo mecanismo de geração
  // (mapaGeracaoAtual) já testado acima; aqui o foco é só o fallback em si
  // não persistir estado indevido entre chamadas.
  const { mapaAoAbrir, marcadores } = montarAmbienteFallback();
  const listaLocalidades = [BARRA_MUNICIPIO, ATALAIA_NOVA];
  const opAtalaia = operacao("BÇQ-PS01", ATALAIA_NOVA);

  await mapaAoAbrir([opAtalaia], listaLocalidades, "Aracaju");
  const primeiraPassagem = marcadores.length;

  // Troca pro polo Dores (sem nenhuma equipe da Barra) — o marcador de
  // fallback da chamada anterior não pode sobreviver.
  await mapaAoAbrir([], listaLocalidades, "Dores");
  teste("trocar de Polo remove o marcador de fallback da chamada anterior (clearLayers, sem residuo)", () => {
    assert.equal(marcadores.length, 0, `esperava 0 marcadores após trocar de polo sem equipes, obteve ${marcadores.length}`);
  });
  assert.ok(primeiraPassagem === 1, "pre-condição do teste: a primeira passagem devia ter criado 1 marcador");

  // "Todos" com a mesma equipe volta a mostrar o fallback normalmente.
  await mapaAoAbrir([opAtalaia], listaLocalidades, "");
  teste("'Todos' volta a mostrar o marcador de fallback normalmente", () => {
    assert.equal(marcadores.length, 1);
  });
}

async function testarGloriaEInteriorPreservados() {
  // Item 9: Glória (Polo Dores) TEM geometria própria — precisa continuar
  // resolvendo por ela mesma (pole of inaccessibility já testado acima),
  // nunca cair no fallback município mesmo que o município "Dores" também
  // tenha geometria própria.
  const { mapaAoAbrir, mapaPontoDentroDoPoligono, marcadores } = montarAmbienteFallback();
  const featureGloria = DADOS_DORES.features.find(f => (f.properties || {}).nome === "Glória");
  const GLORIA = localidade({
    id: "gloria", polo: "Dores", municipio: "Glória", nome: "Glória",
    slug_geojson: "gloria|gloria",
  });
  // A "sede" do município de Glória é a própria localidade acima — mesmo
  // padrão nome===municipio confirmado em toda a base real.
  const opGloria = operacao("NSG-PS01", GLORIA);
  await mapaAoAbrir([opGloria], [GLORIA], "Dores");

  const m = marcadores[0];
  teste("Glória continua resolvendo pela própria geometria (nunca 'nível municipal')", () => {
    assert.ok(m, "esperava um marcador para NSG-PS01");
    assert.ok(!m.__popupHtml.includes("nível municipal"), "Glória tem geometria própria — não é fallback");
  });
  teste("o ponto de Glória continua dentro do próprio polígono real (pole of inaccessibility preservado)", () => {
    const dentro = mapaPontoDentroDoPoligono([m.__latlng[1], m.__latlng[0]], featureGloria.geometry.coordinates);
    assert.ok(dentro, `ponto de Glória ${JSON.stringify(m.__latlng)} caiu fora do próprio polígono`);
  });
}

async function testarInteriorSedeNaoAcionaFallback() {
  // Item 11: localidades "sede" do interior (nome === municipio, já com
  // slug_geojson próprio) resolvem no primeiro passo (geometria própria) —
  // o fallback nem chega a ser consultado. Reusa Glória como o caso real
  // já disponível em geodata/dores/dores.geojson (é, ela mesma, a sede do
  // seu município dentro do Polo Dores).
  const { mapaAoAbrir, marcadores } = montarAmbienteFallback();
  const GLORIA = localidade({ id: "gloria", polo: "Dores", municipio: "Glória", nome: "Glória", slug_geojson: "gloria|gloria" });
  await mapaAoAbrir([operacao("NSG-PS01", GLORIA)], [GLORIA], "Dores");
  teste("localidade-sede do interior com geometria própria nunca aparece como fallback no popup", () => {
    assert.ok(!marcadores[0].__popupHtml.includes("Precisão territorial"));
  });
}

Promise.all([testarFallbackTerritorial(), testarFallbackNaoVazaEntrePolos(), testarGloriaEInteriorPreservados(), testarInteriorSedeNaoAcionaFallback()])
  .then(() => testarCorridaDeChamadas())
  .then(({ registros, camadasVisiveis }) => {
  teste("apos a chamada antiga (Dores) resolver por ultimo, o contorno visivel final e o da chamada mais nova (Lagarto)", () => {
    assert.deepEqual(camadasVisiveis, ["lagarto"], `esperava só 'lagarto' visível, obteve: ${JSON.stringify(camadasVisiveis)}`);
  });
  teste("o contorno da chamada antiga (Dores) NUNCA chega a ser adicionado ao mapa, mesmo resolvendo por ultimo", () => {
    const adicionouDores = registros.some(r => r.ev === "addContorno" && r.slug === "dores");
    assert.equal(adicionouDores, false, "a chamada obsoleta (Dores) não pode mutar o mapa depois de uma chamada mais nova ter assumido");
  });
  teste("clearLayers/marcadores só rodam para a chamada mais nova (Lagarto), nunca duas vezes por causa da obsoleta", () => {
    const clearLayersCount = registros.filter(r => r.ev === "clearLayers").length;
    assert.equal(clearLayersCount, 1, `esperava clearLayers exatamente 1 vez (só a chamada vencedora), obteve ${clearLayersCount}`);
  });

  console.log(`\n${passou} teste(s) passaram.`);
  if (process.exitCode) {
    console.error("HA FALHAS ACIMA.");
    process.exit(1);
  }
}).catch(erro => {
  console.error("ERRO ao rodar os testes assincronos (fallback territorial / corrida):", erro);
  process.exit(1);
});
