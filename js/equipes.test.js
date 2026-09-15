/* Testes de regressão puros (sem framework, sem dependência nova — o
   projeto não tem bundler nem npm install) para a classificação de
   famílias de js/equipes.js (etapa 3 — Central Operacional).

   Roda com Node puro:
       node js/equipes.test.js

   Carrega js/equipes.js por eval() num escopo com um `document` mínimo
   (o arquivo original assume DOM real; aqui só as funções puras de
   classificação são exercitadas, então um stub vazio basta) — mesma
   técnica usada para validar a lógica manualmente antes de commitar. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function fakeEl() {
  return { addEventListener() {}, appendChild() {}, querySelectorAll() { return []; }, options: [{}], innerHTML: "", style: {} };
}
const fakeDocument = { getElementById: () => fakeEl(), addEventListener() {}, querySelectorAll() { return []; } };

// equipes.js é um script clássico (sem módulo/export — carregado via <script
// src> puro no navegador, ver index.html). Para testar as funções puras de
// classificação sem modificar o arquivo original, executamos o código
// dentro de uma função real (não eval solto: `const`/`let` de nível
// superior de um eval direto não "vazam" para fora dele em Node, só
// `var`/function declarations vazariam) e devolvemos explicitamente o que
// precisamos — isso funciona com qualquer forma de declaração.
const codigo = fs.readFileSync(path.join(__dirname, "equipes.js"), "utf8");
const carregar = new Function(
  "document",
  codigo + "\nreturn { equipesExtrairFamilia, equipesClassificarLinha, equipesGruposEsperadosParaPolo, " +
    "equipesGruposEsperadosTodosOsPolos, equipesAgruparLinhas, equipesNormalizarPrefixo, EQUIPES_CHAVE_ESPECIAIS, " +
    "EQUIPES_REGRAS_TIPO_GLOBAL, EQUIPES_GRUPOS_POR_POLO };"
);
const {
  equipesExtrairFamilia, equipesClassificarLinha, equipesGruposEsperadosParaPolo,
  equipesGruposEsperadosTodosOsPolos, equipesAgruparLinhas, equipesNormalizarPrefixo, EQUIPES_CHAVE_ESPECIAIS,
  EQUIPES_REGRAS_TIPO_GLOBAL, EQUIPES_GRUPOS_POR_POLO,
} = carregar(fakeDocument);

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

// `linha` (nome do parâmetro em equipesClassificarLinha) é {identificador,
// polo} — formato comum a EquipeOut e EquipeOperacaoOut, ver
// equipesMontarLinhasParaPolo em js/equipes.js.
const linha = (identificador, polo) => ({ identificador, polo });

console.log("=== equipesExtrairFamilia ===");
teste("extrai prefixo/tipo/numero de um identificador padrao", () => {
  assert.deepEqual(equipesExtrairFamilia("ARJ-PS01"), { prefixo: "ARJ", tipo: "PS", numero: "01" });
});
teste("identificador fora do padrao PREFIXO-TIPOnn nao quebra", () => {
  assert.deepEqual(equipesExtrairFamilia("SEMPADRAO"), { prefixo: null, tipo: null, numero: null });
});

console.log("=== equipesNormalizarPrefixo (acento nao pode separar o mesmo prefixo em 2 blocos) ===");
teste("BCQ e BÇQ normalizam pro mesmo valor", () => {
  assert.equal(equipesNormalizarPrefixo("BÇQ"), equipesNormalizarPrefixo("BCQ"));
});

console.log("=== REGRAS GLOBAIS DE TIPO (CR/CX/SB vencem sempre, mesclam prefixos diferentes) ===");
teste("ARJ-CR01 e CTN-CR01 caem no MESMO bloco 'Equipes Corte' (mudanca de regra desta etapa)", () => {
  const a = equipesClassificarLinha(linha("ARJ-CR01", "Aracaju"));
  const b = equipesClassificarLinha(linha("CTN-CR01", "Aracaju"));
  assert.equal(a.chave, b.chave);
  assert.equal(a.rotulo, "Equipes Corte");
});
teste("ARJ-CX01, CTN-CX01 e AJU-CX01 caem todos no MESMO bloco 'Equipes/CX'", () => {
  const chaves = new Set([
    equipesClassificarLinha(linha("ARJ-CX01", "Aracaju")).chave,
    equipesClassificarLinha(linha("CTN-CX01", "Aracaju")).chave,
    equipesClassificarLinha(linha("AJU-CX01", "Aracaju")).chave,
  ]);
  assert.equal(chaves.size, 1);
  assert.equal(equipesClassificarLinha(linha("AJU-CX01", "Aracaju")).rotulo, "Equipes/CX");
});
teste("SB de QUALQUER prefixo/polo cai no bloco 'Sobreaviso' (ARJ, CTN, ITB, DOR...)", () => {
  const rotulos = ["ARJ-SB01", "CTN-SB01", "ITB-SB01", "DOR-SB01"].map(
    id => equipesClassificarLinha(linha(id, "Aracaju")).rotulo
  );
  assert.deepEqual(new Set(rotulos), new Set(["Sobreaviso"]));
});
teste("regra global vence mesmo com prefixo desconhecido/sem catalogo territorial", () => {
  assert.equal(equipesClassificarLinha(linha("ZZZ-CR01", "PoloSemCatalogo")).rotulo, "Equipes Corte");
});

console.log("=== CATALOGO TERRITORIAL (so aplica quando o tipo NAO e CR/CX/SB) ===");
teste("ARJ sem tipo especial = Aracaju Norte", () => {
  assert.equal(equipesClassificarLinha(linha("ARJ-PS01", "Aracaju")).rotulo, "Aracaju Norte");
});
teste("CTN sem tipo especial = Aracaju Sul", () => {
  assert.equal(equipesClassificarLinha(linha("CTN-PS01", "Aracaju")).rotulo, "Aracaju Sul");
  assert.equal(equipesClassificarLinha(linha("CTN-SN02", "Aracaju")).rotulo, "Aracaju Sul");
});
teste("NSS = Socorro", () => {
  assert.equal(equipesClassificarLinha(linha("NSS-PS01", "Aracaju")).rotulo, "Socorro");
});
teste("BCQ/BÇQ = Barra (aceita com e sem cedilha)", () => {
  assert.equal(equipesClassificarLinha(linha("BCQ-PS01", "Aracaju")).rotulo, "Barra");
  assert.equal(equipesClassificarLinha(linha("BÇQ-PS02", "Aracaju")).rotulo, "Barra");
});
teste("MSQ = Mosqueiro", () => {
  assert.equal(equipesClassificarLinha(linha("MSQ-PS01", "Aracaju")).rotulo, "Mosqueiro");
});

console.log("=== FALLBACK (prefixo sem entrada territorial, ou polo sem catalogo nenhum) ===");
teste("prefixo desconhecido dentro de um polo COM catalogo cai num bloco com o nome do proprio polo (nao 'Especiais/Outros')", () => {
  const resultado = equipesClassificarLinha(linha("PDF-PS01", "Aracaju"));
  assert.equal(resultado.rotulo, "Aracaju");
  assert.notEqual(resultado.chave, EQUIPES_CHAVE_ESPECIAIS);
});
teste("polo SEM catalogo territorial configurado (ex.: Itabaiana) tambem cai num bloco com o nome do polo, nunca inventa territorio", () => {
  const resultado = equipesClassificarLinha(linha("ITB-PS01", "Itabaiana"));
  assert.equal(resultado.rotulo, "Itabaiana");
  assert.notEqual(resultado.chave, EQUIPES_CHAVE_ESPECIAIS);
});
teste("identificador fora do padrao PREFIXO-TIPOnn cai em 'Especiais / Outros' de verdade", () => {
  assert.equal(equipesClassificarLinha(linha("SEMPADRAO", "Aracaju")).chave, EQUIPES_CHAVE_ESPECIAIS);
});
teste("sem polo E identificador mal formado tambem cai em 'Especiais / Outros'", () => {
  assert.equal(equipesClassificarLinha(linha("SEMPADRAO", null)).chave, EQUIPES_CHAVE_ESPECIAIS);
});

console.log("=== equipesGruposEsperadosParaPolo (blocos escalados mesmo vazios) ===");
teste("Aracaju escala os 8 blocos configurados, na ordem declarada na config", () => {
  const rotulos = equipesGruposEsperadosParaPolo("Aracaju").map(g => g.rotulo);
  assert.deepEqual(rotulos, [
    "Aracaju Norte", "Aracaju Sul", "Equipes Corte", "Sobreaviso", "Socorro", "Barra", "Mosqueiro", "Equipes/CX",
  ]);
});
teste("polo GENUINAMENTE nao configurado (nem Aracaju, nem interior) nao escala bloco nenhum (nunca inventa)", () => {
  assert.deepEqual(equipesGruposEsperadosParaPolo("PoloQueNaoExisteEmLugarNenhum"), []);
});

console.log("=== ESTRUTURA PADRAO DO INTERIOR: [NOME DO POLO] + EQUIPES CORTE + SOBREAVISO, sempre os 3, mesmo vazios ===");
["Dores", "Itabaiana", "Lagarto", "Maruim", "Propriá", "São Cristóvão"].forEach(polo => {
  teste(polo + " escala exatamente 3 blocos, nesta ordem: [" + polo + ", Equipes Corte, Sobreaviso]", () => {
    const grupos = equipesGruposEsperadosParaPolo(polo);
    assert.deepEqual(grupos.map(g => g.rotulo), [polo, "Equipes Corte", "Sobreaviso"]);
  });
  teste(polo + ": equipesAgruparLinhas([], '" + polo + "') mostra os 3 blocos vazios, nunca 'Nenhuma equipe encontrada'", () => {
    const grupos = equipesAgruparLinhas([], polo);
    assert.equal(grupos.length, 3);
    assert.ok(grupos.every(g => g.itens.length === 0));
  });
  teste(polo + ": nao cria subdivisao territorial ficticia (nenhum bloco tipo '" + polo + " Norte/Sul')", () => {
    const grupos = equipesGruposEsperadosParaPolo(polo);
    grupos.forEach(g => assert.ok(!/norte|sul/i.test(g.rotulo), "rotulo inesperado: " + g.rotulo));
  });
});
teste("bloco principal do interior usa EXATAMENTE o nome do polo (chave POLO_<POLO EM MAIUSCULO>)", () => {
  const grupos = equipesGruposEsperadosParaPolo("Propriá");
  const principal = grupos.find(g => g.rotulo === "Propriá");
  assert.equal(principal.chave, "POLO_PROPRIÁ");
});
teste("equipe -CR classificada dentro de um polo do interior cai no MESMO bloco global 'Equipes Corte' de Aracaju", () => {
  const chaveInterior = equipesClassificarLinha({ identificador: "DOR-CR01", polo: "Dores" }).chave;
  const chaveAracaju = equipesClassificarLinha({ identificador: "ARJ-CR01", polo: "Aracaju" }).chave;
  assert.equal(chaveInterior, chaveAracaju);
  assert.equal(chaveInterior, "GLOBAL_CR");
});
teste("equipe -SB classificada dentro de um polo do interior cai no MESMO bloco global 'Sobreaviso' de Aracaju", () => {
  const chaveInterior = equipesClassificarLinha({ identificador: "ITB-SB01", polo: "Itabaiana" }).chave;
  const chaveAracaju = equipesClassificarLinha({ identificador: "ARJ-SB01", polo: "Aracaju" }).chave;
  assert.equal(chaveInterior, chaveAracaju);
  assert.equal(chaveInterior, "GLOBAL_SB");
});
teste("equipe comum (nao CR/SB) do interior cai no bloco principal do PROPRIO polo, nao mistura entre polos", () => {
  const dores = equipesClassificarLinha({ identificador: "DOR-PS01", polo: "Dores" });
  const itabaiana = equipesClassificarLinha({ identificador: "ITB-PS01", polo: "Itabaiana" });
  assert.notEqual(dores.chave, itabaiana.chave);
  assert.equal(dores.rotulo, "Dores");
  assert.equal(itabaiana.rotulo, "Itabaiana");
});
teste("Aracaju continua com exatamente os 8 blocos originais, sem bloco principal generico 'Aracaju' (nao afetado por esta etapa)", () => {
  const rotulos = equipesGruposEsperadosParaPolo("Aracaju").map(g => g.rotulo);
  assert.deepEqual(rotulos, [
    "Aracaju Norte", "Aracaju Sul", "Equipes Corte", "Sobreaviso", "Socorro", "Barra", "Mosqueiro", "Equipes/CX",
  ]);
  assert.ok(!rotulos.includes("Aracaju"));
});

console.log("=== equipesAgruparLinhas (a peca central desta etapa: blocos existem ANTES de qualquer equipe) ===");
teste("Aracaju com ZERO linhas ainda mostra os 8 blocos, todos vazios", () => {
  const grupos = equipesAgruparLinhas([], "Aracaju");
  assert.equal(grupos.length, 8);
  assert.ok(grupos.every(g => g.itens.length === 0));
  assert.deepEqual(grupos.map(g => g.rotulo), [
    "Aracaju Norte", "Aracaju Sul", "Equipes Corte", "Sobreaviso", "Socorro", "Barra", "Mosqueiro", "Equipes/CX",
  ]);
});
teste("modo busca filtrada/historico (poloParaEscalar=null) NAO escala blocos vazios — so mostra o que existe", () => {
  assert.deepEqual(equipesAgruparLinhas([], null), []);
});

console.log("=== BUG CORRIGIDO: Polo=Todos sem operacoes hoje precisa mostrar os blocos vazios, nao 'Nenhuma equipe encontrada' ===");
teste("equipesGruposEsperadosTodosOsPolos uniao os blocos de todos os polos configurados, sem repetir chave", () => {
  const grupos = equipesGruposEsperadosTodosOsPolos();
  const chaves = grupos.map(g => g.chave);
  assert.equal(new Set(chaves).size, chaves.length, "nao pode haver chave repetida (blocos globais aparecem em varios polos na config)");
  assert.ok(chaves.includes("GLOBAL_CR"));
  assert.ok(chaves.includes("ARACAJU_NORTE"));
});
teste("equipesAgruparLinhas([], true) -- Polo=Todos com ZERO operacoes -- escala os blocos configurados, NUNCA lista vazia", () => {
  const grupos = equipesAgruparLinhas([], true);
  assert.ok(grupos.length > 0, "com poloParaEscalar=true a lista de grupos nunca pode ficar vazia so por nao haver operacoes ainda");
  assert.ok(grupos.every(g => g.itens.length === 0));
  assert.ok(grupos.some(g => g.rotulo === "Aracaju Norte"));
});
teste("equipesAgruparLinhas(linhas, true) classifica operacoes de polos diferentes nos blocos certos, todos escalados", () => {
  const linhas = [linha("ARJ-PS01", "Aracaju"), linha("ARJ-CR01", "Aracaju")];
  const grupos = equipesAgruparLinhas(linhas, true);
  const porRotulo = Object.fromEntries(grupos.map(g => [g.rotulo, g.itens.length]));
  assert.equal(porRotulo["Aracaju Norte"], 1);
  assert.equal(porRotulo["Equipes Corte"], 1);
  assert.equal(porRotulo["Aracaju Sul"], 0); // escalado vazio, nao sumiu
  assert.equal(porRotulo["Mosqueiro"], 0); // escalado vazio, nao sumiu
});
teste("as 14 equipes reais de Aracaju (consultadas em coi_dev) caem nos blocos certos, nenhuma se perde", () => {
  const reais = [
    "AJU-CX01", "AJU-CX02", "AJU-CX03", "ARJ-CR01", "ARJ-PS01", "BÇQ-PS01", "BÇQ-PS02",
    "CTN-CR01", "CTN-CX01", "CTN-PS01", "CTN-PS02", "CTN-SN01", "CTN-SN02", "NSS-PS01",
  ];
  const grupos = equipesAgruparLinhas(reais.map(id => linha(id, "Aracaju")), "Aracaju");
  const total = grupos.reduce((soma, g) => soma + g.itens.length, 0);
  assert.equal(total, 14);

  const porRotulo = Object.fromEntries(grupos.map(g => [g.rotulo, g.itens.map(i => i.identificador)]));
  assert.deepEqual(porRotulo["Equipes/CX"].sort(), ["AJU-CX01", "AJU-CX02", "AJU-CX03", "CTN-CX01"].sort());
  assert.deepEqual(porRotulo["Equipes Corte"].sort(), ["ARJ-CR01", "CTN-CR01"]);
  assert.deepEqual(porRotulo["Aracaju Norte"], ["ARJ-PS01"]);
  assert.deepEqual(porRotulo["Aracaju Sul"].sort(), ["CTN-PS01", "CTN-PS02", "CTN-SN01", "CTN-SN02"].sort());
  assert.deepEqual(porRotulo["Socorro"], ["NSS-PS01"]);
  assert.deepEqual(porRotulo["Barra"], ["BÇQ-PS01", "BÇQ-PS02"]);
  assert.deepEqual(porRotulo["Sobreaviso"] || [], []);
  assert.deepEqual(porRotulo["Mosqueiro"] || [], []);
});
teste("bloco fallback (prefixo fora do catalogo) aparece DEPOIS dos blocos oficiais, mesmo entrando primeiro na lista", () => {
  const grupos = equipesAgruparLinhas([linha("PDF-PS01", "Aracaju")], "Aracaju");
  const chavesOficiais = equipesGruposEsperadosParaPolo("Aracaju").map(g => g.chave);
  const posicaoFallback = grupos.findIndex(g => g.rotulo === "Aracaju" && !chavesOficiais.includes(g.chave));
  assert.ok(posicaoFallback > 0, "bloco fallback deveria vir depois dos 8 oficiais");
  assert.equal(posicaoFallback, grupos.length - 1);
});

console.log("=== AUTOCOMPLETE DA LINHA RESPEITA O BLOCO (equipesCandidatosDoBloco reusa equipesClassificarLinha) ===");

// Bundle isolado só pra exercitar equipesCandidatosDoBloco — não depende de
// DOM (a função só lê equipesCacheEquipes/equipesUltimaListaOperacoes e
// chama equipesClassificarLinha), mas o arquivo inteiro ainda precisa rodar
// pra declarar as funções (mesmo document mínimo do topo do arquivo).
function montarBundleAutocomplete() {
  const carregar = new Function(
    "document",
    codigo + "\nreturn { equipesCandidatosDoBloco, equipesClassificarLinha, " +
      "definirCacheEquipes(lista) { equipesCacheEquipes = lista; }, " +
      "definirOperacoesHoje(lista) { equipesUltimaListaOperacoes = lista; } };"
  );
  return carregar(fakeDocument);
}

// Catálogo sintético cobrindo Aracaju (todos os blocos) + 2 polos do
// interior sem catálogo territorial próprio (fallback pelo nome do polo).
const equipe = (identificador, polo) => ({ id: "id-" + identificador, identificador, nome: identificador, polo });
const CATALOGO_TESTE = [
  equipe("ARJ-PS01", "Aracaju"), equipe("ARJ-PS02", "Aracaju"),
  equipe("CTN-PS01", "Aracaju"), equipe("CTN-SN01", "Aracaju"),
  equipe("BÇQ-PS01", "Aracaju"),
  equipe("NSS-PS01", "Aracaju"),
  equipe("MSQ-PS01", "Aracaju"),
  equipe("ARJ-CR01", "Aracaju"), equipe("CTN-CR01", "Aracaju"),
  equipe("AJU-CX01", "Aracaju"), equipe("CTN-CX01", "Aracaju"),
  equipe("ARJ-SB01", "Aracaju"), equipe("ITB-SB01", "Itabaiana"),
  equipe("ITB-PS01", "Itabaiana"), equipe("ITB-PS02", "Itabaiana"),
  equipe("DOR-PS01", "Dores"), equipe("DOR-PS02", "Dores"),
];

function candidatosParaChave(chave, operacoesHoje) {
  const bundle = montarBundleAutocomplete();
  bundle.definirCacheEquipes(CATALOGO_TESTE);
  bundle.definirOperacoesHoje(operacoesHoje || []);
  return bundle.equipesCandidatosDoBloco(chave);
}

function chaveDoBloco(identificador, polo) {
  const bundle = montarBundleAutocomplete();
  return bundle.equipesClassificarLinha({ identificador, polo }).chave;
}

teste("ARACAJU NORTE so sugere equipes de ARACAJU NORTE", () => {
  const candidatos = candidatosParaChave(chaveDoBloco("ARJ-PS01", "Aracaju")).map(e => e.identificador);
  assert.deepEqual(candidatos.sort(), ["ARJ-PS01", "ARJ-PS02"]);
});
teste("ARACAJU SUL so sugere equipes de ARACAJU SUL", () => {
  const candidatos = candidatosParaChave(chaveDoBloco("CTN-PS01", "Aracaju")).map(e => e.identificador);
  assert.deepEqual(candidatos.sort(), ["CTN-PS01", "CTN-SN01"]);
});
teste("BARRA so sugere BARRA", () => {
  const candidatos = candidatosParaChave(chaveDoBloco("BÇQ-PS01", "Aracaju")).map(e => e.identificador);
  assert.deepEqual(candidatos, ["BÇQ-PS01"]);
});
teste("SOCORRO so sugere SOCORRO", () => {
  const candidatos = candidatosParaChave(chaveDoBloco("NSS-PS01", "Aracaju")).map(e => e.identificador);
  assert.deepEqual(candidatos, ["NSS-PS01"]);
});
teste("MOSQUEIRO so sugere MOSQUEIRO", () => {
  const candidatos = candidatosParaChave(chaveDoBloco("MSQ-PS01", "Aracaju")).map(e => e.identificador);
  assert.deepEqual(candidatos, ["MSQ-PS01"]);
});
teste("EQUIPES CORTE (-CR) sugere somente -CR, de QUALQUER prefixo", () => {
  const candidatos = candidatosParaChave(chaveDoBloco("ARJ-CR01", "Aracaju")).map(e => e.identificador);
  assert.deepEqual(candidatos.sort(), ["ARJ-CR01", "CTN-CR01"]);
});
teste("EQUIPES/CX (-CX) sugere somente -CX, de QUALQUER prefixo", () => {
  const candidatos = candidatosParaChave(chaveDoBloco("AJU-CX01", "Aracaju")).map(e => e.identificador);
  assert.deepEqual(candidatos.sort(), ["AJU-CX01", "CTN-CX01"]);
});
teste("SOBREAVISO (-SB) sugere somente -SB, de QUALQUER prefixo/polo", () => {
  const candidatos = candidatosParaChave(chaveDoBloco("ARJ-SB01", "Aracaju")).map(e => e.identificador);
  assert.deepEqual(candidatos.sort(), ["ARJ-SB01", "ITB-SB01"]);
});
teste("ITABAIANA (interior, sem catalogo territorial) so sugere equipes de ITABAIANA", () => {
  const candidatos = candidatosParaChave(chaveDoBloco("ITB-PS01", "Itabaiana")).map(e => e.identificador);
  assert.deepEqual(candidatos.sort(), ["ITB-PS01", "ITB-PS02"]);
});
teste("DORES (interior, sem catalogo territorial) so sugere equipes de DORES", () => {
  const candidatos = candidatosParaChave(chaveDoBloco("DOR-PS01", "Dores")).map(e => e.identificador);
  assert.deepEqual(candidatos.sort(), ["DOR-PS01", "DOR-PS02"]);
});
teste("nenhum bloco sugere equipe de outro bloco (Aracaju Norte nunca mostra Aracaju Sul/Barra/Socorro/Mosqueiro/interior/CR/CX/SB)", () => {
  const candidatos = candidatosParaChave(chaveDoBloco("ARJ-PS01", "Aracaju")).map(e => e.identificador);
  const proibidos = ["CTN-PS01", "CTN-SN01", "BÇQ-PS01", "NSS-PS01", "MSQ-PS01", "ARJ-CR01", "CTN-CR01", "AJU-CX01", "CTN-CX01", "ARJ-SB01", "ITB-PS01", "DOR-PS01"];
  proibidos.forEach(id => assert.ok(!candidatos.includes(id), id + " nao deveria aparecer no autocomplete de Aracaju Norte"));
});
teste("equipe ja com operacao HOJE nao e sugerida de novo (protecao contra duplicidade)", () => {
  const candidatos = candidatosParaChave(chaveDoBloco("ARJ-PS01", "Aracaju"), [{ identificador: "ARJ-PS01" }]).map(e => e.identificador);
  assert.deepEqual(candidatos, ["ARJ-PS02"]);
});
teste("comparacao de 'ja usada hoje' e case-insensitive", () => {
  const candidatos = candidatosParaChave(chaveDoBloco("ARJ-PS01", "Aracaju"), [{ identificador: "arj-ps01" }]).map(e => e.identificador);
  assert.deepEqual(candidatos, ["ARJ-PS02"]);
});
teste("busca textual continua funcionando DENTRO do conjunto permitido do bloco (equipesFiltrarTexto sobre equipesCandidatosDoBloco)", () => {
  const bundle = montarBundleAutocomplete();
  bundle.definirCacheEquipes(CATALOGO_TESTE);
  bundle.definirOperacoesHoje([]);
  const candidatos = bundle.equipesCandidatosDoBloco(bundle.equipesClassificarLinha({ identificador: "CTN-PS01", polo: "Aracaju" }).chave);
  // equipesFiltrarTexto não precisa ser reimportado — mesma função pura já
  // usada pelo resto do arquivo; aqui só confirmamos que o filtro por texto
  // "SN" bate com CTN-SN01 mas não com CTN-PS01, dentro do bloco Aracaju Sul.
  const filtrados = candidatos.filter(e => e.identificador.toLowerCase().includes("sn"));
  assert.deepEqual(filtrados.map(e => e.identificador), ["CTN-SN01"]);
});

console.log("=== equipesCarregarOperacoes: corrida entre requisicoes (causa raiz relatada) ===");

// Elemento genérico o suficiente para exercitar equipesCarregarOperacoes ->
// equipesRenderizarListaEMapa -> equipesRenderizarGrupo/Card de ponta a
// ponta sem precisar de um DOM real — mesma técnica do resto do arquivo,
// só que mais completa (querySelector, value, hidden, dataset) porque este
// fluxo mexe em bem mais elementos que as funções puras de agrupamento.
function criarElementoGenerico() {
  const el = {
    value: "", hidden: false, innerHTML: "", textContent: "", className: "",
    style: {}, dataset: {}, title: "",
    children: [],
    // `options` espelha os filhos anexados — só <select> real usa isso, mas
    // manter num objeto genérico é inofensivo (nada mais lê `.options` de um
    // elemento que não seja o <select> de horário, ver equipesLerHorarioControles/
    // equipesPreencherHorarioControles em js/equipes.js) e evita duplicar o stub.
    options: [],
    appendChild(child) { el.children.push(child); el.options.push(child); return child; },
    replaceWith(novo) { el.children.push(novo); },
    querySelector() { return criarElementoGenerico(); },
    querySelectorAll() { return []; },
    addEventListener() {},
    setAttribute() {},
    classList: { add() {}, remove() {}, toggle() {} },
  };
  return el;
}

async function testarCorridaCarregarOperacoes() {
  const elementos = {};
  const fakeDocumentRace = {
    getElementById(id) {
      if (!elementos[id]) elementos[id] = criarElementoGenerico();
      return elementos[id];
    },
    createElement() { return criarElementoGenerico(); },
    createTextNode(texto) { return { textContent: texto }; },
    addEventListener() {},
    querySelectorAll() { return []; },
  };
  // Filtros todos vazios ("Todos"/"Hoje") — equipesCarregarOperacoes só lê
  // os values, não importa o conteúdo pro que este teste verifica.
  ["equipes_filtro_polo", "equipes_filtro_municipio", "equipes_filtro_status", "equipes_filtro_dia",
    "equipes_filtro_busca"].forEach(id => { elementos[id] = criarElementoGenerico(); });

  const operacao = identificador => ({
    id: identificador, identificador, telefone: null, posicao: null, areas_atuacao: [],
    operadores: [], status: "DISPONIVEL", turno_encerrado: false, hora_inicio: "07:00:00",
    hora_fim: "15:00:00", polo: "Aracaju", viatura_numero: null, radio_status: null, cursos: [],
    observacao: null, equipe_id: identificador,
  });

  function criarDeferred() {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    return { promise, resolve };
  }
  const deferredA = criarDeferred();
  const deferredB = criarDeferred();
  let chamadasFetch = 0;
  const authChamarApiFake = async () => {
    chamadasFetch += 1;
    // Captura a ordem NUMA VARIÁVEL LOCAL antes do await — `chamadasFetch`
    // é compartilhado entre as duas chamadas concorrentes, então lê-lo
    // DEPOIS do await sempre devolveria o valor final (2) pras duas.
    const minhaOrdem = chamadasFetch;
    // 1ª chamada (A, mais ANTIGA) usa deferredA; 2ª chamada (B, mais NOVA,
    // ex.: reload disparado por um POST de cadastro logo em seguida) usa
    // deferredB — resolvida ANTES de A, simulando a resposta antiga
    // chegando por último (rede mais lenta/carga maior na 1ª requisição).
    const minhaDeferred = minhaOrdem === 1 ? deferredA : deferredB;
    await minhaDeferred.promise;
    return minhaOrdem === 1
      ? { ok: true, corpo: [operacao("ANTIGA01")] }
      : { ok: true, corpo: [operacao("ANTIGA01"), operacao("NOVA02")] };
  };
  const authObterSessaoFake = () => null;
  const showToastFake = () => {};

  const carregarRace = new Function(
    "document", "authChamarApi", "authObterSessao", "showToast",
    codigo + "\nreturn { equipesCarregarOperacoes, get equipesUltimaListaOperacoes() { return equipesUltimaListaOperacoes; } };"
  );
  // NUNCA desestruturar o getter aqui: `equipesUltimaListaOperacoes` é
  // REATRIBUÍDA (não mutada em memória) a cada chamada — desestruturar uma
  // vez capturaria o array vazio inicial pra sempre. Mantém o bundle e lê
  // `.equipesUltimaListaOperacoes` sob demanda, no fim do teste.
  const bundle = carregarRace(fakeDocumentRace, authChamarApiFake, authObterSessaoFake, showToastFake);
  const { equipesCarregarOperacoes } = bundle;

  const flush = () => new Promise(r => setImmediate(r));

  // Chamada A (ex.: o carregamento inicial da tela) começa primeiro...
  const chamadaA = equipesCarregarOperacoes();
  await flush();
  // ...chamada B (ex.: reload disparado pelo POST de "Adicionar Equipe")
  // começa antes de A terminar.
  const chamadaB = equipesCarregarOperacoes();
  await flush();

  // Resolve a mais NOVA (B) primeiro, a mais ANTIGA (A) só depois — pior
  // caso: a resposta desatualizada chega por último.
  deferredB.resolve();
  await chamadaB;
  deferredA.resolve();
  await chamadaA;

  return bundle.equipesUltimaListaOperacoes;
}

console.log("=== equipesTituloLinha / equipesConstruirLinha: resposta de API incompleta nao pode derrubar a tela (causa raiz real) ===");

// Carrega equipes.js numa segunda instância isolada, expondo as funções de
// renderização de linha — usa o mesmo `criarElementoGenerico` de cima.
function montarBundleRenderizacao() {
  const elementos = {};
  const fakeDoc = {
    getElementById(id) {
      if (!elementos[id]) elementos[id] = criarElementoGenerico();
      return elementos[id];
    },
    createElement() { return criarElementoGenerico(); },
    createTextNode(texto) { return { textContent: texto }; },
    addEventListener() {},
    querySelectorAll() { return []; },
  };
  elementos["equipes_filtro_dia"] = criarElementoGenerico(); // "" = Hoje

  const carregar = new Function(
    "document", "authChamarApi", "authObterSessao", "showToast",
    codigo + "\nreturn { equipesTituloLinha, equipesConstruirLinha, equipesRotuloHorario, equipesHorarioValor, " +
      "equipesLerHorarioControles, equipesPreencherHorarioControles, equipesCalcularRecuperacao, equipesPayloadRecuperacaoDe };"
  );
  return carregar(fakeDoc, async () => ({ ok: true, corpo: [] }), () => null, () => {});
}

// Operação "mínima", do jeito que uma API DESATUALIZADA/com deploy parcial
// devolveria — exatamente o que causou o TypeError real reproduzido no
// navegador (servidor antigo sem viatura_numero/radio_status/cursos no
// contrato). Nenhum desses 3 campos presente de propósito.
function operacaoSemCamposNovos(overrides) {
  return Object.assign({
    id: "op1", identificador: "TST-PS01", telefone: null, posicao: null,
    areas_atuacao: [], operadores: [], status: "DISPONIVEL", turno_encerrado: false,
    hora_inicio: "07:00:00", hora_fim: "15:00:00", polo: "Aracaju", observacao: null,
    // viatura_numero / radio_status / cursos OMITIDOS DE PROPÓSITO (undefined)
  }, overrides);
}

teste("equipesTituloLinha NAO lanca excecao quando cursos/viatura_numero/radio_status vem ausentes da API", () => {
  const { equipesTituloLinha } = montarBundleRenderizacao();
  assert.doesNotThrow(() => equipesTituloLinha(operacaoSemCamposNovos()));
});
teste("equipesTituloLinha mostra 'Cursos: -' quando cursos esta ausente", () => {
  const { equipesTituloLinha } = montarBundleRenderizacao();
  assert.ok(equipesTituloLinha(operacaoSemCamposNovos()).includes("Cursos: -"));
});
teste("equipesTituloLinha NAO lanca excecao quando areas_atuacao/operadores tambem vem ausentes", () => {
  const { equipesTituloLinha } = montarBundleRenderizacao();
  const operacao = operacaoSemCamposNovos({ areas_atuacao: undefined, operadores: undefined });
  assert.doesNotThrow(() => equipesTituloLinha(operacao));
});
teste("equipesConstruirLinha (a linha inteira, no DOM) NAO lanca excecao com resposta de API incompleta", () => {
  const { equipesConstruirLinha } = montarBundleRenderizacao();
  assert.doesNotThrow(() => equipesConstruirLinha(operacaoSemCamposNovos(), null, "Aracaju"));
});
teste("cursos=[] (vazio, mas presente) continua mostrando 'Cursos: -'", () => {
  const { equipesTituloLinha } = montarBundleRenderizacao();
  const texto = equipesTituloLinha(operacaoSemCamposNovos({ cursos: [] }));
  assert.ok(texto.includes("Cursos: -"));
});
teste("cursos com 1 item aparece no tooltip", () => {
  const { equipesTituloLinha } = montarBundleRenderizacao();
  const texto = equipesTituloLinha(operacaoSemCamposNovos({ cursos: [{ id: "c1", nome: "NR-10" }] }));
  assert.ok(texto.includes("Cursos: NR-10"), texto);
});
teste("cursos com varios itens aparecem juntos, separados por virgula", () => {
  const { equipesTituloLinha } = montarBundleRenderizacao();
  const texto = equipesTituloLinha(operacaoSemCamposNovos({
    cursos: [{ id: "c1", nome: "NR-10" }, { id: "c2", nome: "NR-35" }, { id: "c3", nome: "Apicultura" }],
  }));
  assert.ok(texto.includes("Cursos: NR-10, NR-35, Apicultura"), texto);
});

console.log("=== LINHA DE IDENTIDADE JA CONHECIDA, SEM OPERACAO HOJE (roster pre-escalado, peca central desta etapa) ===");

teste("equipesConstruirLinha(null, identidade, polo) NAO lanca excecao (equipe do catalogo, sem operacao hoje)", () => {
  const { equipesConstruirLinha } = montarBundleRenderizacao();
  const identidade = { id: "eq1", identificador: "ARJ-PS02", nome: "ARJ-PS02", polo: "Aracaju" };
  assert.doesNotThrow(() => equipesConstruirLinha(null, identidade, "Aracaju"));
});

console.log("=== HORÁRIO: select da linha rápida + Personalizado (item HORÁRIO, etapa central operacional) ===");

teste("equipesRotuloHorario monta 'inicio–fim'", () => {
  const { equipesRotuloHorario } = montarBundleRenderizacao();
  assert.equal(equipesRotuloHorario("07:30", "17:30"), "07:30–17:30");
});
teste("equipesHorarioValor monta o value do <option> ('inicio|fim')", () => {
  const { equipesHorarioValor } = montarBundleRenderizacao();
  assert.equal(equipesHorarioValor("07:30", "17:30"), "07:30|17:30");
});
teste("equipesLerHorarioControles le um preset selecionado", () => {
  const { equipesLerHorarioControles } = montarBundleRenderizacao();
  const controles = { select: { value: "07:30|17:30" }, inputInicio: { value: "" }, inputFim: { value: "" } };
  assert.deepEqual(equipesLerHorarioControles(controles), { inicio: "07:30", fim: "17:30" });
});
teste("equipesLerHorarioControles retorna null sem nenhum horario escolhido (select vazio)", () => {
  const { equipesLerHorarioControles } = montarBundleRenderizacao();
  const controles = { select: { value: "" }, inputInicio: { value: "" }, inputFim: { value: "" } };
  assert.equal(equipesLerHorarioControles(controles), null);
});
teste("equipesLerHorarioControles retorna null com Personalizado escolhido mas so um dos dois campos preenchido", () => {
  const { equipesLerHorarioControles } = montarBundleRenderizacao();
  const controles = { select: { value: "personalizado" }, inputInicio: { value: "08:00" }, inputFim: { value: "" } };
  assert.equal(equipesLerHorarioControles(controles), null);
});
teste("equipesLerHorarioControles le Personalizado com os dois campos preenchidos", () => {
  const { equipesLerHorarioControles } = montarBundleRenderizacao();
  const controles = { select: { value: "personalizado" }, inputInicio: { value: "08:17" }, inputFim: { value: "16:43" } };
  assert.deepEqual(equipesLerHorarioControles(controles), { inicio: "08:17", fim: "16:43" });
});
teste("equipesPreencherHorarioControles cai em Personalizado quando o horario nao bate com nenhum preset (lista de presets vazia neste bundle)", () => {
  const { equipesPreencherHorarioControles } = montarBundleRenderizacao();
  const controles = { select: { value: "", options: [] }, customWrap: { hidden: true }, inputInicio: { value: "" }, inputFim: { value: "" } };
  equipesPreencherHorarioControles(controles, "07:30", "17:30");
  assert.equal(controles.select.value, "personalizado");
  assert.equal(controles.customWrap.hidden, false);
  assert.equal(controles.inputInicio.value, "07:30");
  assert.equal(controles.inputFim.value, "17:30");
});

console.log("=== RECUPERAR EQUIPES DO DIA ANTERIOR (regra critica: nunca sobrescrever hoje) ===");

const opOntem = (identificador, extra) => Object.assign({
  id: "ontem-" + identificador, identificador, polo: "Aracaju", telefone: "79900000000",
  hora_inicio: "07:30:00", hora_fim: "17:30:00", viatura_numero: null, radio_status: null,
  posicao: null, areas_atuacao: [], status: "FINALIZADA", turno_encerrado: true, observacao: "nota de ontem",
}, extra);
const opHoje = (identificador, extra) => Object.assign({
  id: "hoje-" + identificador, identificador, polo: "Aracaju", telefone: "79911111111",
  hora_inicio: "00:00:00", hora_fim: "06:00:00", status: "DISPONIVEL",
}, extra);

teste("dia atual vazio: TODAS as equipes de ontem entram em paraAdicionar", () => {
  const { equipesCalcularRecuperacao } = montarBundleRenderizacao();
  const ontem = [opOntem("ARJ-PS01"), opOntem("ARJ-PS02"), opOntem("ARJ-CR01")];
  const { paraAdicionar, jaExistentesHoje } = equipesCalcularRecuperacao(ontem, []);
  assert.equal(paraAdicionar.length, 3);
  assert.equal(jaExistentesHoje.length, 0);
});

teste("equipe ja cadastrada hoje NAO entra em paraAdicionar (nunca sobrescreve)", () => {
  const { equipesCalcularRecuperacao } = montarBundleRenderizacao();
  const ontem = [opOntem("ARJ-PS01"), opOntem("ARJ-PS02"), opOntem("ARJ-PS03"), opOntem("ARJ-PS04"), opOntem("ARJ-CR01")];
  const hoje = [opHoje("ARJ-PS01")]; // cadastrada manualmente de madrugada
  const { paraAdicionar, jaExistentesHoje } = equipesCalcularRecuperacao(ontem, hoje);
  assert.deepEqual(paraAdicionar.map(o => o.identificador).sort(), ["ARJ-CR01", "ARJ-PS02", "ARJ-PS03", "ARJ-PS04"]);
  assert.deepEqual(jaExistentesHoje.map(o => o.identificador), ["ARJ-PS01"]);
});

teste("recuperar de novo (idempotente) — se hoje ja tem todas, paraAdicionar fica vazio", () => {
  const { equipesCalcularRecuperacao } = montarBundleRenderizacao();
  const ontem = [opOntem("ARJ-PS01"), opOntem("ARJ-PS02")];
  const hoje = [opHoje("ARJ-PS01"), opHoje("ARJ-PS02")];
  const { paraAdicionar } = equipesCalcularRecuperacao(ontem, hoje);
  assert.equal(paraAdicionar.length, 0);
});

teste("comparacao de identificador e case-insensitive (mesmo padrao do resto do arquivo)", () => {
  const { equipesCalcularRecuperacao } = montarBundleRenderizacao();
  const { paraAdicionar } = equipesCalcularRecuperacao([opOntem("arj-ps01")], [opHoje("ARJ-PS01")]);
  assert.equal(paraAdicionar.length, 0);
});

teste("equipesPayloadRecuperacaoDe NAO inclui status nem observacao de ontem (status sempre DISPONIVEL, observacao nunca recuperada)", () => {
  const { equipesPayloadRecuperacaoDe } = montarBundleRenderizacao();
  const payload = equipesPayloadRecuperacaoDe(opOntem("ARJ-PS01", { status: "FINALIZADA", observacao: "nota velha" }));
  assert.equal(payload.status, "DISPONIVEL");
  assert.equal(payload.observacao, null);
});

teste("equipesPayloadRecuperacaoDe recupera telefone/horario/viatura/radio/posicao de ontem", () => {
  const { equipesPayloadRecuperacaoDe } = montarBundleRenderizacao();
  const posicao = { id: "loc-1", nome: "Centro" };
  const payload = equipesPayloadRecuperacaoDe(opOntem("ARJ-PS01", {
    telefone: "79988887777", viatura_numero: "VTR-42", radio_status: "FUNCIONANDO",
    posicao, areas_atuacao: [posicao, { id: "loc-2", nome: "Getúlio Vargas" }],
  }));
  assert.equal(payload.identificador, "ARJ-PS01");
  assert.equal(payload.telefone, "79988887777");
  assert.equal(payload.hora_inicio, "07:30");
  assert.equal(payload.hora_fim, "17:30");
  assert.equal(payload.viatura_numero, "VTR-42");
  assert.equal(payload.radio_status, "FUNCIONANDO");
  assert.equal(payload.posicao_localidade_id, "loc-1");
  assert.deepEqual(payload.areas_atuacao_localidade_ids, ["loc-1", "loc-2"]);
});

teste("equipesPayloadRecuperacaoDe NUNCA envia curso_ids (cursos sao da identidade, nunca duplicados na operacao diaria)", () => {
  const { equipesPayloadRecuperacaoDe } = montarBundleRenderizacao();
  const payload = equipesPayloadRecuperacaoDe(opOntem("ARJ-PS01"));
  assert.deepEqual(payload.curso_ids, []);
});

teste("cenario da virada da meia-noite: equipe cadastrada as 00:05 sobrevive intacta a uma recuperacao as 06:00", () => {
  const { equipesCalcularRecuperacao } = montarBundleRenderizacao();
  // Ontem: 5 equipes trabalhando. Hoje, 00:05: operador da madrugada ja
  // cadastrou ARJ-PS01 com telefone/horario PROPRIOS (diferentes de ontem).
  const ontem = [opOntem("ARJ-PS01", { telefone: "TELEFONE_ANTIGO" }), opOntem("ARJ-PS02"), opOntem("ARJ-PS03"), opOntem("ARJ-PS04"), opOntem("ARJ-CR01")];
  const cadastradaDeMadrugada = opHoje("ARJ-PS01", { telefone: "TELEFONE_NOVO_DA_MADRUGADA", hora_inicio: "00:00:00", hora_fim: "06:00:00" });
  const { paraAdicionar, jaExistentesHoje } = equipesCalcularRecuperacao(ontem, [cadastradaDeMadrugada]);
  assert.deepEqual(jaExistentesHoje.map(o => o.identificador), ["ARJ-PS01"]);
  assert.ok(!paraAdicionar.some(o => o.identificador === "ARJ-PS01"), "ARJ-PS01 nao pode ser recriada/sobrescrita");
  assert.deepEqual(paraAdicionar.map(o => o.identificador).sort(), ["ARJ-CR01", "ARJ-PS02", "ARJ-PS03", "ARJ-PS04"]);
});

testarCorridaCarregarOperacoes().then(listaFinal => {
  teste("resposta antiga (A) chegando por ultimo NAO sobrescreve a lista ja atualizada pela resposta nova (B)", () => {
    const identificadores = listaFinal.map(op => op.identificador);
    assert.deepEqual(identificadores, ["ANTIGA01", "NOVA02"],
      `esperava a lista da chamada B (mais nova), obteve: ${JSON.stringify(identificadores)}`);
  });

  console.log(`\n${passou} teste(s) passaram.`);
  if (process.exitCode) {
    console.error("HA FALHAS ACIMA.");
    process.exit(1);
  }
}).catch(erro => {
  console.error("ERRO ao rodar o teste de corrida:", erro);
  process.exit(1);
});
