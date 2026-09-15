/* Testes de regressão puros (sem framework, sem dependência nova) para
   js/mapas-regionais.js — cor determinística, ponto de label (pole of
   inaccessibility, Polygon e MultiPolygon), colisão de labels, ordenação
   numérica de código operacional, estrutura da legenda (plana e agrupada
   por "Todos") e resolução de território por integridade territorial
   (slug_geojson / nome+alias escopado por município). Só exercita funções
   PURAS (sem Leaflet real nem DOM real) — desenho no mapa, hover/clique
   reais e colisão calculada a partir de latLngToContainerPoint só são
   verificáveis manualmente no navegador (ver relatório da Fase 3), mesmo
   padrão de js/mapa.test.js.

   Roda com Node puro:
       node js/mapas-regionais.test.js
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function fakeEl() {
  return { addEventListener() {}, appendChild() {}, querySelectorAll() { return []; }, options: [{}], innerHTML: "", style: {} };
}
// regtmEscapar (js/mapas-regionais.js) escapa via document.createElement("div")
// + textContent -> innerHTML — precisa de um <div> de verdade nesse par pra o
// texto sobreviver (senão toda string escapada viraria "").
function fakeElementoComTexto() {
  const el = { innerHTML: "", appendChild() {}, addEventListener() {} };
  Object.defineProperty(el, "textContent", {
    set(valor) { el.innerHTML = valor; },
    get() { return el.innerHTML; },
  });
  return el;
}
const fakeDocument = {
  getElementById: () => fakeEl(),
  createElement: () => fakeElementoComTexto(),
  addEventListener() {},
  querySelectorAll() { return []; },
};

// js/mapas-regionais.js é script clássico (sem module/export, carregado
// via <script src> no navegador). Mesma técnica de js/mapa.test.js:
// executa dentro de uma função real (não eval solto) e devolve
// explicitamente só as funções/constantes puras que este arquivo testa.
const codigo = fs.readFileSync(path.join(__dirname, "mapas-regionais.js"), "utf8");
const carregar = new Function(
  "document",
  "L",
  "fetch",
  codigo +
    "\nreturn { regtmHashString, regtmCorDaLocalidade, REGTM_PALETA_TERRITORIOS, " +
    "regtmPontoDentroDoPoligono, regtmPontoVisualDaGeometria, regtmAreaDaGeometria, " +
    "regtmChaveOrdenacaoLocalidade, regtmCompararLocalidades, regtmOrdenarLocalidades, " +
    "regtmRotuloLocalidade, regtmResolverColisaoLabels, regtmConstruirEstruturaLegenda, " +
    "regtmMontarIndicePorChave, regtmResolverFeatureDaLocalidade, regtmNormalizarNome, " +
    "regtmMontarHtmlLabel, regtmExtrairNomeOficialFeicao, REGTM_POLOS, REGTM_VALOR_TODOS, " +
    "regtmDeveOcultarLabelPermanente, REGTM_SELECOES_LABEL_SOB_DEMANDA, " +
    "regtmEncontrarLocalidadeMunicipio, regtmAgruparFallbackPorFeature, regtmChaveFallback, " +
    "regtmMontarPopupHtmlFallback, regtmMontarHtmlLabelFallback, REGTM_ESTILO_FALLBACK, " +
    "REGTM_ALIASES_CONFIRMADOS, regtmChaveAliasConfirmado };"
);
const {
  regtmHashString, regtmCorDaLocalidade, REGTM_PALETA_TERRITORIOS,
  regtmPontoDentroDoPoligono, regtmPontoVisualDaGeometria, regtmAreaDaGeometria,
  regtmChaveOrdenacaoLocalidade, regtmCompararLocalidades, regtmOrdenarLocalidades,
  regtmRotuloLocalidade, regtmResolverColisaoLabels, regtmConstruirEstruturaLegenda,
  regtmMontarIndicePorChave, regtmResolverFeatureDaLocalidade, regtmNormalizarNome,
  regtmMontarHtmlLabel, regtmExtrairNomeOficialFeicao, REGTM_POLOS, REGTM_VALOR_TODOS,
  regtmDeveOcultarLabelPermanente, REGTM_SELECOES_LABEL_SOB_DEMANDA,
  regtmEncontrarLocalidadeMunicipio, regtmAgruparFallbackPorFeature, regtmChaveFallback,
  regtmMontarPopupHtmlFallback, regtmMontarHtmlLabelFallback, REGTM_ESTILO_FALLBACK,
  REGTM_ALIASES_CONFIRMADOS, regtmChaveAliasConfirmado,
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

const localidade = (overrides) => Object.assign(
  { polo: "Itabaiana", municipio: "Itabaiana", nome: "Itabaiana", codigo_operacional: null, slug_territorial: "itabaiana-itabaiana-itabaiana", aliases: [], slug_geojson: null, grupo_operacional: null },
  overrides
);

console.log("=== COR DETERMINÍSTICA ===");

teste("mesma localidade (mesmo slug_territorial) recebe sempre a mesma cor", () => {
  const loc = localidade({ slug_territorial: "itabaiana-itabaiana-itabaiana" });
  const cor1 = regtmCorDaLocalidade(loc);
  const cor2 = regtmCorDaLocalidade(loc);
  assert.deepEqual(cor1, cor2);
});

teste("cor não depende da ordem/posição em um array — só do slug", () => {
  const a = localidade({ slug_territorial: "dores-dores-dores" });
  const b = localidade({ slug_territorial: "itabaiana-itabaiana-itabaiana" });
  const corAIsolada = regtmCorDaLocalidade(a);
  const corBIsolada = regtmCorDaLocalidade(b);
  // mesmo calculando em ordem invertida ou em outro momento, cada uma bate com a isolada
  const corBDepois = regtmCorDaLocalidade(b);
  const corADepois = regtmCorDaLocalidade(a);
  assert.deepEqual(corAIsolada, corADepois);
  assert.deepEqual(corBIsolada, corBDepois);
});

teste("hash é determinístico (mesma string -> mesmo número sempre)", () => {
  assert.equal(regtmHashString("dores-dores-dores"), regtmHashString("dores-dores-dores"));
});

teste("cor sempre vem da paleta fixa (nunca uma cor fora dela)", () => {
  const cor = regtmCorDaLocalidade(localidade({ slug_territorial: "qualquer-coisa-aqui" }));
  assert.ok(REGTM_PALETA_TERRITORIOS.some(p => p.fill === cor.fill && p.stroke === cor.stroke));
});

teste("paleta não é vazia e tem mais de uma cor (senão não diferenciaria nada)", () => {
  assert.ok(REGTM_PALETA_TERRITORIOS.length >= 8);
});

console.log("=== LABEL: PONTO INTERNO (Polygon) ===");

teste("ponto do label de um Polygon simples cai DENTRO do polígono", () => {
  const geometry = {
    type: "Polygon",
    coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
  };
  const [lat, lng] = regtmPontoVisualDaGeometria(geometry);
  assert.ok(regtmPontoDentroDoPoligono([lng, lat], geometry.coordinates));
});

teste("ponto do label NÃO é o centro do bounding box num polígono em L (côncavo)", () => {
  // "L" invertido: bounding box 0..10 x 0..10, mas o canto superior direito é vazio
  const geometry = {
    type: "Polygon",
    coordinates: [[[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10], [0, 0]]],
  };
  const centroBBox = [5, 5]; // getBounds().getCenter() equivalente — cai FORA da forma em L
  assert.equal(regtmPontoDentroDoPoligono(centroBBox, geometry.coordinates), false, "premissa do teste: centro do bbox precisa estar fora do L");
  const [lat, lng] = regtmPontoVisualDaGeometria(geometry);
  assert.ok(regtmPontoDentroDoPoligono([lng, lat], geometry.coordinates), "o ponto do label não pode usar o centro do bbox — precisa estar dentro da forma real");
});

teste("ponto do label fica afastado da borda (não gruda na linha do contorno)", () => {
  const geometry = {
    type: "Polygon",
    coordinates: [[[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]],
  };
  const [lat, lng] = regtmPontoVisualDaGeometria(geometry);
  // num quadrado 20x20 o ponto mais afastado da borda é perto do centro (10,10)
  assert.ok(Math.abs(lng - 10) < 1 && Math.abs(lat - 10) < 1);
});

console.log("=== LABEL: PONTO INTERNO (MultiPolygon) ===");

teste("MultiPolygon usa a MAIOR parte (por área) para o ponto do label", () => {
  const geometry = {
    type: "MultiPolygon",
    coordinates: [
      [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], // ilha pequena (área 1)
      [[[10, 10], [30, 10], [30, 30], [10, 30], [10, 10]]], // parte grande (área 400)
    ],
  };
  const [lat, lng] = regtmPontoVisualDaGeometria(geometry);
  // o ponto tem que cair dentro da parte GRANDE, nunca na ilha pequena
  const dentroDaGrande = lng >= 10 && lng <= 30 && lat >= 10 && lat <= 30;
  assert.ok(dentroDaGrande);
});

teste("regtmAreaDaGeometria soma as partes de um MultiPolygon", () => {
  const geometry = {
    type: "MultiPolygon",
    coordinates: [
      [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]], // área 4
      [[[0, 0], [3, 0], [3, 3], [0, 3], [0, 0]]], // área 9
    ],
  };
  assert.equal(regtmAreaDaGeometria(geometry), 13);
});

teste("geometry.type desconhecido (ex.: Point) não quebra — devolve null", () => {
  assert.equal(regtmPontoVisualDaGeometria({ type: "Point", coordinates: [1, 1] }), null);
});

console.log("=== ORDENAÇÃO NUMÉRICA DO CÓDIGO OPERACIONAL (nunca alfabética, nunca inventada) ===");

teste("'030' vem antes de '150' (numérica, não alfabética como string)", () => {
  const lista = [
    localidade({ nome: "Ribeirópolis", codigo_operacional: "150" }),
    localidade({ nome: "Itabaiana", codigo_operacional: "030" }),
  ];
  const ordenada = regtmOrdenarLocalidades(lista);
  assert.deepEqual(ordenada.map(l => l.codigo_operacional), ["030", "150"]);
});

teste("sequência real do Polo Itabaiana (30..170) ordena corretamente", () => {
  const codigos = ["170", "30", "150", "60", "100", "90", "80", "70", "140", "50", "160", "130", "120", "110"];
  const lista = codigos.map(c => localidade({ nome: "M" + c, codigo_operacional: c }));
  const ordenada = regtmOrdenarLocalidades(lista);
  const numeros = ordenada.map(l => parseInt(l.codigo_operacional, 10));
  const numerosOrdenados = [...numeros].sort((a, b) => a - b);
  assert.deepEqual(numeros, numerosOrdenados);
});

teste("localidades SEM código nunca ficam entre as numeradas — sempre depois", () => {
  const lista = [
    localidade({ nome: "Centro", codigo_operacional: null }),
    localidade({ nome: "Zeta", codigo_operacional: "999" }),
    localidade({ nome: "Alfa", codigo_operacional: "001" }),
  ];
  const ordenada = regtmOrdenarLocalidades(lista);
  assert.deepEqual(ordenada.map(l => l.nome), ["Alfa", "Zeta", "Centro"]);
});

teste("localidades sem código ordenam entre si por município/nome (nunca por posição de carregamento)", () => {
  const lista = [
    localidade({ nome: "Zebra", municipio: "Aracaju", codigo_operacional: null }),
    localidade({ nome: "Abacate", municipio: "Aracaju", codigo_operacional: null }),
  ];
  const ordenada = regtmOrdenarLocalidades(lista);
  assert.deepEqual(ordenada.map(l => l.nome), ["Abacate", "Zebra"]);
});

teste("regtmChaveOrdenacaoLocalidade nunca inventa um número quando codigo_operacional é null", () => {
  const chave = regtmChaveOrdenacaoLocalidade(localidade({ codigo_operacional: null }));
  assert.equal(chave[0], 1); // grupo "sem código", nunca no grupo numerado (0)
  assert.equal(chave[1], 0); // nunca um número fantasma
});

teste("código operacional inválido (não numérico) é tratado como 'sem código', nunca quebra", () => {
  const chave = regtmChaveOrdenacaoLocalidade(localidade({ codigo_operacional: "abc" }));
  assert.equal(chave[0], 1);
});

console.log("=== RÓTULO (código + nome, nunca código inventado) ===");

teste("com código: 'CÓDIGO — NOME'", () => {
  assert.equal(regtmRotuloLocalidade(localidade({ nome: "Itabaiana", codigo_operacional: "030" })), "030 — Itabaiana");
});

teste("sem código: só o nome, nunca um código fabricado", () => {
  assert.equal(regtmRotuloLocalidade(localidade({ nome: "Centro", codigo_operacional: null })), "Centro");
});

teste("regtmMontarHtmlLabel omite o bloco de código quando não existe (nunca escreve 'null'/'undefined')", () => {
  const html = regtmMontarHtmlLabel(localidade({ nome: "Centro", codigo_operacional: null }));
  assert.ok(!html.includes("null"));
  assert.ok(!html.includes("undefined"));
  assert.ok(html.includes("Centro"));
});

teste("regtmMontarHtmlLabel inclui o código quando existe", () => {
  const html = regtmMontarHtmlLabel(localidade({ nome: "Itabaiana", codigo_operacional: "030" }));
  assert.ok(html.includes("030"));
  assert.ok(html.includes("Itabaiana"));
});

console.log("=== COLISÃO DE LABELS (determinística, nunca move o ponto) ===");

teste("dois pontos bem afastados ficam os dois 'completo'", () => {
  const pontos = [
    { id: "a", x: 0, y: 0, prioridade: 10 },
    { id: "b", x: 500, y: 500, prioridade: 10 },
  ];
  const niveis = regtmResolverColisaoLabels(pontos, 70, 34);
  assert.equal(niveis.a, "completo");
  assert.equal(niveis.b, "completo");
});

teste("dois pontos muito próximos: só o de maior prioridade fica completo", () => {
  const pontos = [
    { id: "pequeno", x: 10, y: 10, prioridade: 1 },
    { id: "grande", x: 12, y: 12, prioridade: 100 },
  ];
  const niveis = regtmResolverColisaoLabels(pontos, 70, 34);
  assert.equal(niveis.grande, "completo");
  assert.notEqual(niveis.pequeno, "completo");
});

teste("resultado é o MESMO não importa a ordem de entrada (determinístico)", () => {
  const pontosA = [
    { id: "x", x: 0, y: 0, prioridade: 5 },
    { id: "y", x: 5, y: 5, prioridade: 20 },
    { id: "z", x: 200, y: 200, prioridade: 1 },
  ];
  const pontosB = [pontosA[2], pontosA[0], pontosA[1]]; // mesma entrada, ordem embaralhada
  assert.deepEqual(regtmResolverColisaoLabels(pontosA, 70, 34), regtmResolverColisaoLabels(pontosB, 70, 34));
});

teste("nunca devolve um nível fora de completo/compacto/oculto", () => {
  const pontos = [
    { id: "a", x: 0, y: 0, prioridade: 1 },
    { id: "b", x: 1, y: 1, prioridade: 2 },
    { id: "c", x: 2, y: 2, prioridade: 3 },
  ];
  const niveis = regtmResolverColisaoLabels(pontos, 70, 34);
  Object.values(niveis).forEach(n => assert.ok(["completo", "compacto", "oculto"].includes(n)));
});

teste("com muitos pontos empilhados no mesmo lugar, ninguém quebra (todo mundo recebe um nível)", () => {
  const pontos = Array.from({ length: 20 }, (_, i) => ({ id: "p" + i, x: 100, y: 100, prioridade: i }));
  const niveis = regtmResolverColisaoLabels(pontos, 70, 34);
  assert.equal(Object.keys(niveis).length, 20);
});

console.log("=== LEGENDA: ESTRUTURA (plana vs. agrupada por 'Todos') ===");

teste("seleção de UM polo: legenda não agrupa por polo", () => {
  const estrutura = regtmConstruirEstruturaLegenda("Itabaiana", [
    { polo: "Itabaiana", comGeometria: [localidade({ codigo_operacional: "030" })], semGeometria: [] },
  ]);
  assert.equal(estrutura.agrupadoPorPolo, false);
  assert.equal(estrutura.grupos.length, 1);
});

teste("'Todos': legenda agrupada por regional/polo", () => {
  const estrutura = regtmConstruirEstruturaLegenda(REGTM_VALOR_TODOS, [
    { polo: "Itabaiana", comGeometria: [localidade({ codigo_operacional: "030" })], semGeometria: [] },
    { polo: "Dores", comGeometria: [localidade({ polo: "Dores", codigo_operacional: "340" })], semGeometria: [] },
  ]);
  assert.equal(estrutura.agrupadoPorPolo, true);
  assert.equal(estrutura.grupos.length, 2);
  assert.deepEqual(estrutura.grupos.map(g => g.polo), ["Itabaiana", "Dores"]);
});

teste("grupo vazio (0 localidades) nunca aparece na estrutura", () => {
  const estrutura = regtmConstruirEstruturaLegenda(REGTM_VALOR_TODOS, [
    { polo: "Lagarto", comGeometria: [], semGeometria: [] },
    { polo: "Maruim", comGeometria: [localidade({ polo: "Maruim" })], semGeometria: [] },
  ]);
  assert.equal(estrutura.grupos.length, 1);
  assert.equal(estrutura.grupos[0].polo, "Maruim");
});

teste("dentro de cada grupo, comGeometria já sai ordenada por código numérico", () => {
  const estrutura = regtmConstruirEstruturaLegenda("Itabaiana", [
    {
      polo: "Itabaiana",
      comGeometria: [
        localidade({ nome: "Ribeirópolis", codigo_operacional: "150" }),
        localidade({ nome: "Itabaiana", codigo_operacional: "030" }),
      ],
      semGeometria: [],
    },
  ]);
  assert.deepEqual(estrutura.grupos[0].comGeometria.map(l => l.codigo_operacional), ["030", "150"]);
});

console.log("=== SEM GEOMETRIA (item 9 — nunca escondida; fallback municipal, quando existe, é testado à parte abaixo) ===");

teste("localidade sem geometria própria fica em semGeometria, nunca em comGeometria", () => {
  const estrutura = regtmConstruirEstruturaLegenda("Aracaju", [
    {
      polo: "Aracaju",
      comGeometria: [localidade({ nome: "Centro", municipio: "Aracaju" })],
      semGeometria: [localidade({ nome: "Bugio", municipio: "Aracaju", codigo_operacional: null })],
    },
  ]);
  assert.equal(estrutura.grupos[0].semGeometria.length, 1);
  assert.equal(estrutura.grupos[0].semGeometria[0].nome, "Bugio");
});

teste("regtmResolverFeatureDaLocalidade devolve null (nunca chuta) quando não há correspondência", () => {
  const indice = regtmMontarIndicePorChave({ features: [] });
  const resultado = regtmResolverFeatureDaLocalidade(localidade({ nome: "Bugio", slug_geojson: null }), indice);
  assert.equal(resultado, null);
});

teste("ambiguidade (2+ feições com o mesmo nome, sem município na feição) NUNCA é decidida sozinha", () => {
  const featureA = { properties: { nome: "Centro" }, geometry: { type: "Polygon", coordinates: [] } };
  const featureB = { properties: { nome: "Centro" }, geometry: { type: "Polygon", coordinates: [] } };
  const indice = regtmMontarIndicePorChave({ features: [featureA, featureB] });
  const resultado = regtmResolverFeatureDaLocalidade(localidade({ nome: "Centro", municipio: "Aracaju", slug_geojson: null }), indice);
  assert.equal(resultado, null, "duas feições 'Centro' sem município identificado -> ambíguo -> null, nunca escolhe uma");
});

teste("integridade territorial: nome igual mas município DIFERENTE não casa (nunca empresta geometria de outro município)", () => {
  const featureCentroAracaju = { properties: { nome: "Centro", municipio: "Aracaju" }, geometry: { type: "Polygon", coordinates: [] } };
  const indice = regtmMontarIndicePorChave({ features: [featureCentroAracaju] });
  const resultado = regtmResolverFeatureDaLocalidade(
    localidade({ nome: "Centro", municipio: "Barra dos Coqueiros", slug_geojson: null }),
    indice
  );
  assert.equal(resultado, null, "'Centro' da Barra dos Coqueiros não pode casar com o 'Centro' de Aracaju só pelo nome");
});

teste("slug_geojson explícito casa direto, sem precisar de nome/alias", () => {
  const feature = { properties: { nome: "Itabaiana" }, geometry: { type: "Polygon", coordinates: [] } };
  const indice = regtmMontarIndicePorChave({ features: [feature] });
  const resultado = regtmResolverFeatureDaLocalidade(localidade({ slug_geojson: "itabaiana" }), indice);
  assert.equal(resultado, feature);
});

teste("alias casa quando o nome principal não bate", () => {
  const feature = { properties: { nome: "Nossa Senhora da Glória" }, geometry: { type: "Polygon", coordinates: [] } };
  const indice = regtmMontarIndicePorChave({ features: [feature] });
  const resultado = regtmResolverFeatureDaLocalidade(
    localidade({ nome: "Glória", municipio: "Glória", aliases: ["Nossa Senhora da Glória"], slug_geojson: null }),
    indice
  );
  assert.equal(resultado, feature);
});

console.log("=== NOME OFICIAL (só quando o dado realmente existe, nunca inventado) ===");

teste("nome oficial vem de properties.municipio_ibge_nome quando presente", () => {
  const feature = { properties: { municipio_ibge_nome: "Campo do Brito" } };
  assert.equal(regtmExtrairNomeOficialFeicao(feature), "Campo do Brito");
});

teste("sem a propriedade, nome oficial é null (nunca um valor fabricado)", () => {
  assert.equal(regtmExtrairNomeOficialFeicao({ properties: {} }), null);
});

console.log("=== FALLBACK MUNICIPAL (finalização — item 9/13: usar contorno municipal, nunca inventar, sempre avisar) ===");

teste("regtmEncontrarLocalidadeMunicipio acha a linha-sede (nome === municipio) do MESMO polo+município", () => {
  const sede = localidade({ polo: "Aracaju", municipio: "Barra dos Coqueiros", nome: "Barra dos Coqueiros" });
  const bairro = localidade({ polo: "Aracaju", municipio: "Barra dos Coqueiros", nome: "Atalaia Nova" });
  const lista = [sede, bairro];
  assert.equal(regtmEncontrarLocalidadeMunicipio(bairro, lista), sede);
});

teste("regtmEncontrarLocalidadeMunicipio nunca cruza polo/município (mesmo raciocínio de mapaEncontrarLocalidadeMunicipio)", () => {
  const sedeErrada = localidade({ polo: "São Cristóvão", municipio: "São Cristóvão", nome: "São Cristóvão" });
  const bairro = localidade({ polo: "Aracaju", municipio: "Barra dos Coqueiros", nome: "Atalaia Nova" });
  assert.equal(regtmEncontrarLocalidadeMunicipio(bairro, [sedeErrada]), null);
});

teste("regtmEncontrarLocalidadeMunicipio devolve null quando não existe nenhuma linha-sede cadastrada", () => {
  const bairro = localidade({ polo: "Aracaju", municipio: "Barra dos Coqueiros", nome: "Atalaia Nova" });
  assert.equal(regtmEncontrarLocalidadeMunicipio(bairro, [bairro]), null);
});

teste("regtmChaveFallback é determinística e específica de polo+município (nunca colide entre municípios diferentes)", () => {
  assert.equal(regtmChaveFallback("Aracaju", "Barra dos Coqueiros"), regtmChaveFallback("Aracaju", "Barra dos Coqueiros"));
  assert.notEqual(regtmChaveFallback("Aracaju", "Barra dos Coqueiros"), regtmChaveFallback("Aracaju", "São Cristóvão"));
  assert.notEqual(regtmChaveFallback("Aracaju", "São Cristóvão"), regtmChaveFallback("São Cristóvão", "São Cristóvão"));
});

teste("regtmAgruparFallbackPorFeature: várias localidades do MESMO município compartilham UM único grupo (nunca duplica o contorno)", () => {
  const featureBarra = { properties: { nome: "Barra dos Coqueiros" }, geometry: { type: "Polygon", coordinates: [] } };
  const pares = [
    { localidade: localidade({ nome: "Atalaia Nova", municipio: "Barra dos Coqueiros" }), feature: featureBarra, polo: "Aracaju" },
    { localidade: localidade({ nome: "Centro", municipio: "Barra dos Coqueiros" }), feature: featureBarra, polo: "Aracaju" },
  ];
  const grupos = regtmAgruparFallbackPorFeature(pares);
  assert.equal(grupos.length, 1, "as duas localidades da Barra caem no MESMO grupo (mesma feature)");
  assert.equal(grupos[0].localidades.length, 2);
  assert.equal(grupos[0].municipio, "Barra dos Coqueiros");
});

teste("regtmAgruparFallbackPorFeature: municípios diferentes nunca se misturam no mesmo grupo", () => {
  const featureBarra = { properties: { nome: "Barra dos Coqueiros" }, geometry: { type: "Polygon", coordinates: [] } };
  const featureSaoCristovao = { properties: { nome: "São Cristóvão" }, geometry: { type: "Polygon", coordinates: [] } };
  const pares = [
    { localidade: localidade({ nome: "Atalaia Nova", municipio: "Barra dos Coqueiros" }), feature: featureBarra, polo: "Aracaju" },
    { localidade: localidade({ nome: "Rosa Elze", municipio: "São Cristóvão" }), feature: featureSaoCristovao, polo: "Aracaju" },
  ];
  const grupos = regtmAgruparFallbackPorFeature(pares);
  assert.equal(grupos.length, 2);
});

teste("regtmAgruparFallbackPorFeature de lista vazia devolve lista vazia, nunca quebra", () => {
  assert.deepEqual(regtmAgruparFallbackPorFeature([]), []);
  assert.deepEqual(regtmAgruparFallbackPorFeature(undefined), []);
});

teste("REGTM_ESTILO_FALLBACK é fixo/neutro e tracejado (nunca a cor categórica por hash — é o próprio aviso visual)", () => {
  assert.ok(REGTM_ESTILO_FALLBACK.dashArray, "precisa ter traço tracejado (dashArray) para se diferenciar visualmente de um território com contorno próprio");
  const corCategorica = REGTM_PALETA_TERRITORIOS.some(p => p.fill === REGTM_ESTILO_FALLBACK.fillColor);
  assert.ok(!corCategorica, "a cor do fallback não pode ser nenhuma das cores da paleta categórica por-território");
});

teste("regtmMontarHtmlLabelFallback deixa 'nível municipal' explícito em texto (nunca só na cor do polígono)", () => {
  const html = regtmMontarHtmlLabelFallback({ municipio: "Barra dos Coqueiros" });
  assert.ok(html.includes("nível municipal"));
  assert.ok(html.includes("Barra dos Coqueiros"));
});

teste("regtmMontarPopupHtmlFallback lista TODAS as localidades representadas, nunca finge ser posição exata de uma só", () => {
  const grupo = {
    municipio: "Barra dos Coqueiros",
    polo: "Aracaju",
    feature: { properties: {} },
    localidades: [
      localidade({ nome: "Atalaia Nova", municipio: "Barra dos Coqueiros" }),
      localidade({ nome: "Centro", municipio: "Barra dos Coqueiros" }),
    ],
  };
  const html = regtmMontarPopupHtmlFallback(grupo);
  assert.ok(html.includes("nível municipal"));
  assert.ok(html.includes("Atalaia Nova"));
  assert.ok(html.includes("Centro"));
  assert.ok(html.includes("(2)"), "precisa deixar explícita a contagem de localidades representadas");
});

teste("regtmConstruirEstruturaLegenda: bucket fallbackMunicipal é aceito, ordenado e não aparece em comGeometria/semGeometria", () => {
  const estrutura = regtmConstruirEstruturaLegenda("Aracaju", [
    {
      polo: "Aracaju",
      comGeometria: [localidade({ nome: "Centro", municipio: "Aracaju" })],
      fallbackMunicipal: [
        localidade({ nome: "Centro", municipio: "Barra dos Coqueiros", codigo_operacional: null }),
        localidade({ nome: "Atalaia Nova", municipio: "Barra dos Coqueiros", codigo_operacional: null }),
      ],
      semGeometria: [],
    },
  ]);
  assert.equal(estrutura.grupos[0].comGeometria.length, 1);
  assert.equal(estrutura.grupos[0].fallbackMunicipal.length, 2);
  assert.equal(estrutura.grupos[0].semGeometria.length, 0);
  assert.deepEqual(estrutura.grupos[0].fallbackMunicipal.map(l => l.nome).sort(), ["Atalaia Nova", "Centro"]);
});

teste("regtmConstruirEstruturaLegenda: grupo só com fallbackMunicipal (sem comGeometria) continua aparecendo na estrutura", () => {
  const estrutura = regtmConstruirEstruturaLegenda(REGTM_VALOR_TODOS, [
    { polo: "São Cristóvão", comGeometria: [], fallbackMunicipal: [localidade({ polo: "São Cristóvão", nome: "Rosa Elze" })], semGeometria: [] },
  ]);
  assert.equal(estrutura.grupos.length, 1);
  assert.equal(estrutura.grupos[0].polo, "São Cristóvão");
});

teste("regtmConstruirEstruturaLegenda: chamador antigo (sem passar fallbackMunicipal) continua funcionando — bucket vira [] por padrão", () => {
  const estrutura = regtmConstruirEstruturaLegenda("Itabaiana", [
    { polo: "Itabaiana", comGeometria: [localidade({ codigo_operacional: "030" })], semGeometria: [] },
  ]);
  assert.deepEqual(estrutura.grupos[0].fallbackMunicipal, []);
});

console.log("=== ALIASES CONFIRMADOS (etapa de conferência territorial — só por evidência objetiva, nunca por semelhança de nome) ===");

teste("'Bugio' (Aracaju/Aracaju) casa com a feição 'Assis Chateaubriand' via alias confirmado (evidência: tag loc_name do OSM)", () => {
  const feature = { properties: { nome: "Assis Chateaubriand", municipio: "Aracaju" }, geometry: { type: "Polygon", coordinates: [] } };
  const indice = regtmMontarIndicePorChave({ features: [feature] });
  const resultado = regtmResolverFeatureDaLocalidade(
    localidade({ polo: "Aracaju", municipio: "Aracaju", nome: "Bugio", slug_geojson: null, aliases: [] }),
    indice
  );
  assert.equal(resultado, feature);
});

teste("regtmChaveAliasConfirmado é normalizada (maiúscula/acento não impedem o casamento com a chave da tabela)", () => {
  assert.equal(
    regtmChaveAliasConfirmado(localidade({ polo: "ARACAJU", municipio: "Aracaju", nome: "bugio" })),
    "aracaju|aracaju|bugio"
  );
});

teste("nome exibido continua sendo o nome OFICIAL do catálogo, nunca o alias (regtmRotuloLocalidade nunca muda)", () => {
  assert.equal(regtmRotuloLocalidade(localidade({ nome: "Bugio", codigo_operacional: null })), "Bugio");
});

teste("'Dezoito do Forte' x '18 do Forte' NÃO tem alias confirmado — evidência insuficiente, fica pendência", () => {
  assert.equal(regtmChaveAliasConfirmado(localidade({ polo: "Aracaju", municipio: "Aracaju", nome: "Dezoito do Forte" })) in REGTM_ALIASES_CONFIRMADOS, false);
  const feature = { properties: { nome: "18 do Forte", municipio: "Aracaju" }, geometry: { type: "Polygon", coordinates: [] } };
  const indice = regtmMontarIndicePorChave({ features: [feature] });
  const resultado = regtmResolverFeatureDaLocalidade(
    localidade({ polo: "Aracaju", municipio: "Aracaju", nome: "Dezoito do Forte", slug_geojson: null, aliases: [] }),
    indice
  );
  assert.equal(resultado, null, "sem alias confirmado, 'Dezoito do Forte' não pode casar com '18 do Forte' só pela semelhança do nome");
});

teste("'Matapuã' x 'Matapoã' NÃO tem alias confirmado — evidência insuficiente, fica pendência", () => {
  assert.equal(regtmChaveAliasConfirmado(localidade({ polo: "Aracaju", municipio: "Aracaju", nome: "Matapuã" })) in REGTM_ALIASES_CONFIRMADOS, false);
  const feature = { properties: { nome: "Matapoã", municipio: "Aracaju" }, geometry: { type: "Polygon", coordinates: [] } };
  const indice = regtmMontarIndicePorChave({ features: [feature] });
  const resultado = regtmResolverFeatureDaLocalidade(
    localidade({ polo: "Aracaju", municipio: "Aracaju", nome: "Matapuã", slug_geojson: null, aliases: [] }),
    indice
  );
  assert.equal(resultado, null, "sem alias confirmado, 'Matapuã' não pode casar com 'Matapoã' só pela troca de uma vogal");
});

teste("'Dom Luciano' não corresponde a nenhuma localidade do catálogo — sem alias, continua sem correspondência", () => {
  const feature = { properties: { nome: "Dom Luciano", municipio: "Aracaju" }, geometry: { type: "Polygon", coordinates: [] } };
  const indice = regtmMontarIndicePorChave({ features: [feature] });
  const resultado = regtmResolverFeatureDaLocalidade(
    localidade({ polo: "Aracaju", municipio: "Aracaju", nome: "Bugio", slug_geojson: null, aliases: [] }),
    indice
  );
  assert.equal(resultado, null, "'Bugio' não pode casar com 'Dom Luciano' — são feições distintas, o alias confirmado de Bugio é só 'Assis Chateaubriand'");
});

teste("REGTM_ALIASES_CONFIRMADOS tem exatamente 1 entrada hoje (só o que tem evidência objetiva) — não vazou pra mais nenhuma", () => {
  assert.equal(Object.keys(REGTM_ALIASES_CONFIRMADOS).length, 1);
  assert.deepEqual(REGTM_ALIASES_CONFIRMADOS["aracaju|aracaju|bugio"], ["Assis Chateaubriand"]);
});

console.log("=== GENERICIDADE ARACAJU x INTERIOR (mesma função, sem 'if polo === Aracaju') ===");

teste("bairro de Aracaju (sem código) e município do interior (com código) ordenam pela MESMA função sem tratamento especial", () => {
  const lista = [
    localidade({ polo: "Aracaju", municipio: "Aracaju", nome: "Centro", codigo_operacional: null }),
    localidade({ polo: "Itabaiana", municipio: "Itabaiana", nome: "Itabaiana", codigo_operacional: "030" }),
  ];
  const ordenada = regtmOrdenarLocalidades(lista);
  // com código sempre primeiro, independente do polo
  assert.equal(ordenada[0].codigo_operacional, "030");
  assert.equal(ordenada[1].nome, "Centro");
});

teste("regtmRotuloLocalidade trata bairro (sem código) e município (com código) com a mesma regra", () => {
  assert.equal(regtmRotuloLocalidade(localidade({ polo: "Aracaju", nome: "Centro", codigo_operacional: null })), "Centro");
  assert.equal(regtmRotuloLocalidade(localidade({ polo: "Itabaiana", nome: "Itabaiana", codigo_operacional: "030" })), "030 — Itabaiana");
});

console.log("=== POLOS (7 regionais + 'Todos', mesma lista auditada) ===");

teste("REGTM_POLOS tem exatamente os 7 polos esperados", () => {
  assert.deepEqual(
    [...REGTM_POLOS].sort(),
    ["Aracaju", "Dores", "Itabaiana", "Lagarto", "Maruim", "Propriá", "São Cristóvão"].sort()
  );
});

console.log("=== ARACAJU + TODOS SEM LABEL PERMANENTE (só hover) ===");
// A criação/remoção real do marker de label (permanente x temporário) é
// DOM/Leaflet-dependente (marker.getElement(), L.marker/L.divIcon reais) —
// só verificável manualmente no navegador (ver relatório do ajuste), mesmo
// padrão já estabelecido para hover/clique reais nesta suíte. Aqui testamos
// a REGRA em si (o predicado que decide oculto-permanente x normal), que é
// pura e é o único lugar do código que "sabe" sobre Aracaju/Todos.

teste("Aracaju está na lista de label sob demanda (oculta o permanente)", () => {
  assert.equal(regtmDeveOcultarLabelPermanente("Aracaju"), true);
});

teste("'Todos' TAMBÉM está na lista de label sob demanda (ajuste de acabamento — mesma poluição de Aracaju)", () => {
  assert.equal(regtmDeveOcultarLabelPermanente(REGTM_VALOR_TODOS), true);
});

teste("São Cristóvão mantém o comportamento normal (label permanente)", () => {
  assert.equal(regtmDeveOcultarLabelPermanente("São Cristóvão"), false);
});

teste("demais regionais (Itabaiana, Dores, Propriá, Maruim, Lagarto) mantêm label permanente", () => {
  ["Itabaiana", "Dores", "Propriá", "Maruim", "Lagarto"].forEach(polo => {
    assert.equal(regtmDeveOcultarLabelPermanente(polo), false, polo + " não deveria estar na lista de label sob demanda");
  });
});

teste("nenhuma seleção vazia ('') é tratada como 'sob demanda'", () => {
  assert.equal(regtmDeveOcultarLabelPermanente(""), false);
});

teste("REGTM_SELECOES_LABEL_SOB_DEMANDA tem exatamente 2 entradas hoje (Aracaju + Todos) — não vazou pra mais nenhuma regional", () => {
  assert.equal(REGTM_SELECOES_LABEL_SOB_DEMANDA.size, 2);
  assert.ok(REGTM_SELECOES_LABEL_SOB_DEMANDA.has("Aracaju"));
  assert.ok(REGTM_SELECOES_LABEL_SOB_DEMANDA.has(REGTM_VALOR_TODOS));
  ["São Cristóvão", "Itabaiana", "Dores", "Propriá", "Maruim", "Lagarto"].forEach(polo => {
    assert.ok(!REGTM_SELECOES_LABEL_SOB_DEMANDA.has(polo), polo + " não deveria estar nessa lista");
  });
});

console.log("=== AJUSTE PÓS-FASE 3: LEGENDA COMO PAINEL LATERAL (CSS) ===");
// Regressão direta do bug relatado ("legenda aparecendo embaixo do mapa no
// desktop"): a causa foi `flex-wrap: wrap` incondicional em .regtm-layout.
// Não dá para testar layout renderizado em Node puro (sem motor de CSS),
// mas dá para travar a REGRA no arquivo-fonte: flex-wrap só pode existir
// dentro do @media de tela pequena, nunca na regra base.
{
  const cssBruto = fs.readFileSync(path.join(__dirname, "..", "css", "mapas-regionais.css"), "utf8");

  teste(".regtm-layout (regra base, fora de @media) não força flex-wrap — mapa e legenda nunca empilham no desktop", () => {
    const indiceMedia = cssBruto.indexOf("@media");
    const cssAntesDoMedia = indiceMedia === -1 ? cssBruto : cssBruto.slice(0, indiceMedia);
    const matchBase = cssAntesDoMedia.match(/\.regtm-layout\s*\{([^}]*)\}/);
    assert.ok(matchBase, ".regtm-layout precisa existir fora de qualquer @media");
    // \bflex-wrap\s*: (com dois-pontos) casa só a DECLARAÇÃO CSS real —
    // não um comentário que só MENCIONA a palavra (como o próprio
    // comentário desta regra, que explica por que não está aqui).
    assert.ok(!/flex-wrap\s*:/.test(matchBase[1]), "flex-wrap não pode estar na regra base de .regtm-layout (é isso que empilha a legenda no desktop)");
  });

  teste("dentro do @media de tela pequena, .regtm-layout SIM ganha flex-wrap (empilha só ali)", () => {
    const indiceMedia = cssBruto.indexOf("@media");
    assert.ok(indiceMedia !== -1, "precisa existir um @media de responsividade");
    const cssDoMediaEmDiante = cssBruto.slice(indiceMedia);
    const matchMedia = cssDoMediaEmDiante.match(/\.regtm-layout\s*\{([^}]*)\}/);
    assert.ok(matchMedia, ".regtm-layout precisa reaparecer dentro do @media");
    assert.ok(/flex-wrap\s*:\s*wrap/.test(matchMedia[1]), "o @media precisa reintroduzir flex-wrap:wrap para telas pequenas empilharem");
  });

  teste(".regtm-mapa-wrap e .regtm-painel-lateral seguem a proporção ~82-85%/~15-18% pedida (ajuste de acabamento)", () => {
    const matchMapa = cssBruto.match(/\.regtm-mapa-wrap\s*\{[^}]*flex:\s*1\s+1\s+(\d+)%/);
    const matchPainel = cssBruto.match(/\.regtm-painel-lateral\s*\{[^}]*flex:\s*0\s+1\s+(\d+)%/);
    assert.ok(matchMapa && matchPainel, "as duas regras precisam declarar flex-basis em %");
    const percentualMapa = Number(matchMapa[1]);
    const percentualPainel = Number(matchPainel[1]);
    assert.ok(percentualMapa >= 82 && percentualMapa <= 85, "mapa fora da faixa 82-85%: " + percentualMapa);
    assert.ok(percentualPainel >= 15 && percentualPainel <= 18, "painel fora da faixa 15-18%: " + percentualPainel);
  });

  teste("legenda continua com largura mínima suficiente pra swatch+código+nome (min-width) e não vira 'enorme' (max-width)", () => {
    const matchPainel = cssBruto.match(/\.regtm-painel-lateral\s*\{([^}]*)\}/);
    assert.ok(matchPainel, ".regtm-painel-lateral precisa existir");
    const minWidth = matchPainel[1].match(/min-width:\s*(\d+)px/);
    const maxWidth = matchPainel[1].match(/max-width:\s*(\d+)px/);
    assert.ok(minWidth && maxWidth, "precisa declarar min-width e max-width em px");
    assert.ok(Number(minWidth[1]) >= 200, "min-width baixo demais pra caber swatch+código+nome legíveis");
    assert.ok(Number(maxWidth[1]) <= 320, "max-width alto demais — legenda ficaria 'enorme'");
  });
}

if (passou > 0) {
  console.log(`\n${passou} teste(s) passaram.`);
}
if (process.exitCode === 1) {
  console.error("\nALGUM TESTE FALHOU.");
  process.exit(1);
}
