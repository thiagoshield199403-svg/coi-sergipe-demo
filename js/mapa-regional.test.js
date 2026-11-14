// Testes do Mapa Regional Interativo. Rodar: node js/mapa-regional.test.js
// Cobrem: as 5 regionais aprovadas (58 municípios, códigos, geometria intacta), a
// expansão (Regional Aracaju 001/010/020, São Cristóvão 620, Itaporanga sem código,
// bairros e localidades do IBGE dentro dos municípios, sem códigos nos bairros),
// regra de apresentação (mapa: só números), posicionamento dos números, hierarquia
// e sincronia mapa/lista, aproximação, ausência da antiga importação, remoção do
// mapa antigo e preservação dos outros módulos.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const ler = rel => fs.readFileSync(path.join(RAIZ, rel), "utf8");
const { MAPA_REGIONAL_DADOS: DADOS } = require("./mapa-regional/dados.js");
const { MAPA_REGIONAL_GEOMETRIA: GEO } = require("./mapa-regional/geometria.js");
const { MAPA_REGIONAL_GEOMETRIA_EXPANSAO: GEOX } = require("./mapa-regional/geometria-expansao.js");
const { MAPA_REGIONAL_SUBDIVISOES: SUB } = require("./mapa-regional/subdivisoes.js");
const MR = require("./mapa-regional.js");
const { gerarConteudo } = require("../ferramentas/gerar-mapa-regional.js");
const { gerar: gerarExpansao } = require("../ferramentas/gerar-mapa-expansao.js");

let ok = 0;
function teste(nome, fn) {
  try { fn(); ok++; console.log("✓ " + nome); }
  catch (e) { console.error("✗ " + nome + "\n  " + e.message); process.exitCode = 1; }
}
const regional = id => DADOS.regionais.find(r => r.id === id);
const APROVADAS = ["itabaiana", "lagarto", "gloria", "propria", "maruim"];
const EXPANSAO = ["aracaju", "sao-cristovao", "itaporanga"];
const originais = () => DADOS.regionais.filter(r => APROVADAS.includes(r.id));
const todos = () => originais().flatMap(r => r.municipios.map(m => Object.assign({ regional: r.id }, m)));
const geoDe = r => GEO[r.geodata] || GEOX[r.geodata];
const lerGeojson = nome => JSON.parse(ler(path.join("geodata", "ibge-2022", nome)));

/* Base de referência das 5 regionais aprovadas (imagens + correções confirmadas).
   IBGE → [código do polo, nome oficial]. */
const REFERENCIA = {
  itabaiana: {
    "2802908": ["30", "Itabaiana"], "2800506": ["50", "Areia Branca"], "2801009": ["60", "Campo do Brito"],
    "2801405": ["70", "Carira"], "2802304": ["80", "Frei Paulo"], "2803708": ["90", "Macambira"],
    "2803906": ["100", "Malhador"], "2804102": ["110", "Moita Bonita"], "2804458": ["120", "Nossa Senhora Aparecida"],
    "2805000": ["130", "Pedra Mole"], "2805208": ["140", "Pinhão"], "2806008": ["150", "Ribeirópolis"],
    "2806800": ["160", "São Domingos"], "2807006": ["170", "São Miguel do Aleixo"],
  },
  lagarto: {
    "2803500": ["180", "Lagarto"], "2806206": ["190", "Salgado"], "2805505": ["200", "Poço Verde"], "2807105": ["210", "Simão Dias"],
  },
  maruim: {
    "2804003": ["220", "Maruim"], "2801504": ["230", "Carmópolis"], "2802007": ["240", "Divina Pastora"],
    "2802502": ["250", "General Maynard"], "2803302": ["260", "Japaratuba"], "2803609": ["270", "Laranjeiras"],
    "2805307": ["280", "Pirambu"], "2805901": ["290", "Riachuelo"], "2806107": ["300", "Rosário do Catete"],
    "2806503": ["310", "Santa Rosa de Lima"], "2806602": ["320", "Santo Amaro das Brotas"], "2807204": ["330", "Siriri"],
  },
  gloria: {
    "2804607": ["340", "Nossa Senhora das Dores"], "2801207": ["350", "Canindé de São Francisco"], "2801306": ["360", "Capela"],
    "2801900": ["370", "Cumbe"], "2802205": ["380", "Feira Nova"], "2802403": ["390", "Gararu"],
    "2802601": ["400", "Graccho Cardoso"], "2803104": ["410", "Itabi"], "2804201": ["420", "Monte Alegre de Sergipe"],
    "2804508": ["430", "Nossa Senhora da Glória"], "2804706": ["440", "Nossa Senhora de Lourdes"],
    "2805406": ["450", "Poço Redondo"], "2805604": ["461", "Porto da Folha"],
  },
  propria: {
    "2805703": ["468", "Propriá"], "2800100": ["480", "Amparo do São Francisco"], "2800209": ["490", "Aquidabã"],
    "2807303": ["500", "Telha"], "2801108": ["510", "Canhoba"], "2801603": ["521", "Cedro de São João"],
    "2802700": ["530", "Ilha das Flores"], "2803401": ["541", "Japoatã"], "2803807": ["550", "Malhada dos Bois"],
    "2804300": ["560", "Muribeca"], "2804409": ["570", "Neópolis"], "2804904": ["580", "Pacatuba"],
    "2806404": ["590", "Santana do São Francisco"], "2806909": ["600", "São Francisco"], "2800704": ["700", "Brejo Grande"],
  },
};

console.log("=== 5 REGIONAIS APROVADAS (58 MUNICÍPIOS) ===");
teste("as 5 regionais aprovadas continuam primeiro, na ordem pedida; as novas áreas vêm depois", () => {
  assert.deepEqual(DADOS.regionais.map(r => r.id), [...APROVADAS, ...EXPANSAO]);
  assert.deepEqual(originais().map(r => r.nome), ["Itabaiana", "Lagarto", "Glória", "Propriá", "Maruim"]);
});
teste("exatamente 58 municípios — 14 / 4 / 13 / 15 / 12", () => {
  assert.deepEqual(originais().map(r => r.municipios.length), [14, 4, 13, 15, 12]);
  assert.equal(todos().length, 58);
});
teste("código IBGE único, com 7 dígitos de Sergipe (28xxxxx) — em todas as áreas", () => {
  const ibges = DADOS.regionais.flatMap(r => r.municipios.map(m => m.ibge));
  assert.equal(new Set(ibges).size, 63);
  ibges.forEach(c => assert.match(c, /^28\d{5}$/));
});
teste("códigos de polo: 58 + 4 novos presentes (1 a 4 dígitos) e nenhum duplicado no sistema", () => {
  const cods = DADOS.regionais.flatMap(r => r.municipios.map(m => m.codigo)).filter(c => c !== null);
  assert.equal(cods.length, 62);
  cods.forEach(c => assert.match(String(c), /^\d{1,4}$/));
  assert.equal(new Set(cods.map(c => parseInt(c, 10))).size, 62);
});
teste("correspondência exata código ↔ município ↔ IBGE ↔ regional (base de referência)", () => {
  Object.entries(REFERENCIA).forEach(([id, tabela]) => {
    const r = regional(id);
    assert.equal(r.municipios.length, Object.keys(tabela).length, id);
    r.municipios.forEach(m => {
      assert.ok(tabela[m.ibge], id + ": IBGE fora da referência " + m.ibge);
      assert.deepEqual([m.codigo, m.nome], tabela[m.ibge], id + " / " + m.ibge);
    });
  });
});
teste("correções confirmadas: 250, 200, 350, 450, 461, 468, 521, 541, 700", () => {
  const por = nome => todos().find(m => m.nome === nome);
  [["General Maynard", "250", "maruim"], ["Poço Verde", "200", "lagarto"], ["Canindé de São Francisco", "350", "gloria"],
   ["Poço Redondo", "450", "gloria"], ["Porto da Folha", "461", "gloria"], ["Propriá", "468", "propria"],
   ["Cedro de São João", "521", "propria"], ["Japoatã", "541", "propria"], ["Brejo Grande", "700", "propria"]]
    .forEach(([nome, cod, reg]) => { const m = por(nome); assert.equal(m.codigo, cod, nome); assert.equal(m.regional, reg, nome); });
});
teste("dados: cada município tem só ibge, codigo e nome", () => {
  DADOS.regionais.flatMap(r => r.municipios).forEach(m => assert.deepEqual(Object.keys(m).sort(), ["codigo", "ibge", "nome"]));
});
teste("cada regional aprovada tem exatamente os municípios do geojson correspondente (mesmo IBGE e nome oficial)", () => {
  originais().forEach(r => {
    const fc = JSON.parse(ler(path.join("geodata", r.geodata, r.geodata + ".geojson")));
    const doGeo = new Map(fc.features.map(f => [String(f.properties.municipio_ibge_codigo), f.properties.municipio_ibge_nome]));
    assert.equal(doGeo.size, r.municipios.length, r.nome);
    r.municipios.forEach(m => assert.equal(doGeo.get(m.ibge), m.nome, r.nome + " / " + m.ibge));
  });
});
teste("geometria.js: um caminho SVG para cada um dos 58 municípios e nada a mais (só as 5 regionais)", () => {
  assert.deepEqual(Object.keys(GEO).sort(), ["dores", "itabaiana", "lagarto", "maruim", "propria"]);
  originais().forEach(r => {
    const g = GEO[r.geodata];
    assert.deepEqual(Object.keys(g.municipios).sort(), r.municipios.map(m => m.ibge).sort(), r.nome);
    r.municipios.forEach(m => {
      const gm = g.municipios[m.ibge];
      assert.match(gm.d, /^M[\d. L]+Z/, m.nome);
      assert.ok(gm.raio > 5, "sem espaço interno: " + m.nome);
    });
  });
});
teste("geometria dos 58 municípios INTACTA: regenerar de geodata/ dá exatamente o mesmo geometria.js", () => {
  assert.equal(gerarConteudo(RAIZ), ler("js/mapa-regional/geometria.js"), "rode: node ferramentas/gerar-mapa-regional.js");
});
teste("dados e geometria separados: as geometrias geradas não têm códigos de polo", () => {
  Object.values(GEO).forEach(g => Object.values(g.municipios).forEach(m =>
    assert.deepEqual(Object.keys(m).sort(), ["d", "nomeIbge", "raio", "rotulo"])));
  Object.values(GEOX).forEach(g => {
    Object.values(g.municipios).forEach(m => assert.deepEqual(Object.keys(m).sort(), ["d", "nomeIbge", "raio", "rotulo"]));
    Object.values(g.bairros).forEach(b => assert.deepEqual(Object.keys(b).sort(), ["d", "raio", "rotulo"]));
    Object.values(g.localidades).forEach(l => assert.deepEqual(Object.keys(l), ["ponto"]));
  });
});
teste("projeção sem distorção nas 5 regionais aprovadas (proporção do viewBox = proporção real)", () => {
  originais().forEach(r => {
    const fc = JSON.parse(ler(path.join("geodata", r.geodata, r.geodata + ".geojson")));
    const pts = fc.features.flatMap(f => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).flatMap(p => p[0]));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const k = Math.cos(((Math.min(...ys) + Math.max(...ys)) / 2) * Math.PI / 180);
    const real = ((Math.max(...xs) - Math.min(...xs)) * k) / (Math.max(...ys) - Math.min(...ys));
    const [, , W, H] = GEO[r.geodata].viewBox;
    assert.ok(Math.abs((W - 24) / (H - 24) - real) / real < 0.005, r.nome);
  });
});

console.log("=== EXPANSÃO: REGIONAL ARACAJU, SÃO CRISTÓVÃO, ITAPORANGA D'AJUDA ===");
teste("Regional Aracaju: 001 Aracaju, 010 Barra dos Coqueiros, 020 Nossa Senhora do Socorro (por IBGE)", () => {
  assert.deepEqual(regional("aracaju").municipios.map(m => [m.ibge, m.codigo, m.nome]), [
    ["2800308", "001", "Aracaju"], ["2800605", "010", "Barra dos Coqueiros"], ["2804805", "020", "Nossa Senhora do Socorro"]]);
  assert.equal(regional("aracaju").tipo, "regional");
});
teste("São Cristóvão possui o código 620", () => {
  assert.deepEqual(regional("sao-cristovao").municipios.map(m => [m.ibge, m.codigo, m.nome]), [["2806701", "620", "São Cristóvão"]]);
});
teste("Itaporanga d'Ajuda permanece SEM código (campo preparado = null) e com aviso de delimitação", () => {
  const it = regional("itaporanga");
  assert.deepEqual(it.municipios.map(m => [m.ibge, m.codigo, m.nome]), [["2803203", null, "Itaporanga d'Ajuda"]]);
  assert.match(it.aviso, /referência/);
  assert.match(it.aviso, /Caueira/);
  assert.equal(MR.mrIdentificacao(it.municipios[0]), "Itaporanga d'Ajuda");
});
teste("fontes da expansão estão documentadas (NOTICE com IBGE e endereços de download)", () => {
  const n = ler("geodata/ibge-2022/NOTICE.md");
  ["Malha Municipal 2022", "Censo Demográfico 2022", "Localidades Selecionadas 2010", "geoftp.ibge.gov.br", "Zona de Expansão", "Robalo", "Caueira"]
    .forEach(t => assert.ok(n.includes(t), t));
});
teste("arquivos gerados da expansão estão em dia com geodata/ibge-2022 (regenerar dá o mesmo resultado)", () => {
  const r = gerarExpansao(RAIZ);
  assert.equal(r.geometria, ler("js/mapa-regional/geometria-expansao.js"), "rode: node ferramentas/gerar-mapa-expansao.js");
  assert.equal(r.subdivisoes, ler("js/mapa-regional/subdivisoes.js"), "rode: node ferramentas/gerar-mapa-expansao.js");
});
const BAIRROS_FONTE = lerGeojson("bairros-cd2022.geojson").features;
const MUNS_FONTE = lerGeojson("municipios-2022.geojson").features;
const LOCS_FONTE = lerGeojson("localidades-2010.geojson").features;
teste("quantidade de bairros = base IBGE: Aracaju 48, Barra 18, Socorro 29, São Cristóvão 14, Itaporanga 0", () => {
  const esperado = { "2800308": 48, "2800605": 18, "2804805": 29, "2806701": 14, "2803203": 0 };
  Object.entries(esperado).forEach(([c, n]) => {
    assert.equal(BAIRROS_FONTE.filter(f => f.properties.municipio_ibge_codigo === c).length, n, "fonte " + c);
    assert.equal(Object.values(SUB.bairros).filter(b => b.municipio === c).length, n, "sistema " + c);
    assert.equal(SUB.municipios[c].bairros, n);
  });
  assert.equal(Object.keys(SUB.bairros).length, 109);
});
teste("cada bairro: id estável (IBGE), nome, município pai correto, fonte, delimitação, código reservado (null)", () => {
  BAIRROS_FONTE.forEach(f => {
    const p = f.properties, b = SUB.bairros["b" + p.bairro_ibge_codigo];
    assert.ok(b, "bairro ausente: " + p.bairro_nome);
    assert.equal(b.nome, p.bairro_nome);
    assert.equal(b.municipio, p.municipio_ibge_codigo);
    assert.ok(p.bairro_ibge_codigo.startsWith(p.municipio_ibge_codigo), "código do bairro começa pelo IBGE do município");
    assert.equal(b.fonte, "IBGE — Malha de Bairros, Censo Demográfico 2022");
    assert.equal(b.delimitacao, "oficial");
    assert.equal(b.codigo, null);
    const area = DADOS.regionais.find(r => r.id === b.regional);
    assert.ok(area.municipios.some(m => m.ibge === b.municipio), "bairro na área do seu município");
  });
});
teste("os códigos dos polos NÃO se repetem nos bairros nem nas localidades", () => {
  const codigos = new Set(DADOS.regionais.flatMap(r => r.municipios.map(m => m.codigo)).filter(Boolean));
  [...Object.values(SUB.bairros), ...Object.values(SUB.localidades)].forEach(x => {
    assert.equal(x.codigo, null, x.nome);
    assert.ok(!codigos.has(x.nome), x.nome);
  });
  const sub = ler("js/mapa-regional/subdivisoes.js");
  ["\"001\"", "\"010\"", "\"020\"", "\"620\""].forEach(c => assert.ok(!sub.includes(c), "código " + c + " em subdivisoes.js"));
});
// geometria (graus): ponto dentro do polígono ou a ≤ 1 m da borda
const polys = g => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
const dentroAnel = (pt, anel) => { let d = false; for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) { const [xi, yi] = anel[i], [xj, yj] = anel[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) d = !d; } return d; };
const dentroG = (pt, g) => polys(g).some(p => dentroAnel(pt, p[0]) && !p.slice(1).some(h => dentroAnel(pt, h)));
const distSeg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const pertoDaBorda = (pt, g, tol) => polys(g).some(p => p.some(an => { for (let i = 0; i < an.length - 1; i++) if (distSeg(pt, an[i], an[i + 1]) <= tol) return true; return false; }));
const UM_METRO = 1 / 111000;
teste("nenhum bairro ultrapassa o limite do seu município (todos os vértices dentro, tolerância 1 m)", () => {
  const porMun = Object.fromEntries(MUNS_FONTE.map(f => [f.properties.municipio_ibge_codigo, f.geometry]));
  let vertices = 0;
  BAIRROS_FONTE.forEach(f => {
    const mun = porMun[f.properties.municipio_ibge_codigo];
    polys(f.geometry).forEach(p => p[0].forEach(pt => {
      vertices++;
      assert.ok(dentroG(pt, mun) || pertoDaBorda(pt, mun, UM_METRO), "vértice fora: " + f.properties.bairro_nome);
    }));
  });
  assert.ok(vertices > 15000);
});
teste("localidades: pontos dentro do seu município; Caueira presente em Itaporanga d'Ajuda", () => {
  const porMun = Object.fromEntries(MUNS_FONTE.map(f => [f.properties.municipio_ibge_codigo, f.geometry]));
  LOCS_FONTE.forEach(f => assert.ok(dentroG(f.geometry.coordinates, porMun[f.properties.municipio_ibge_codigo]), f.properties.localidade_nome));
  const caueira = Object.values(SUB.localidades).find(l => l.nome === "Caueira");
  assert.ok(caueira);
  assert.equal(caueira.municipio, "2803203");
  assert.equal(caueira.categoria, "Área urbana isolada");
  assert.equal(caueira.delimitacao, "ponto (sem limite)");
  assert.equal(SUB.municipios["2803203"].localidades, 17);
});
teste("localidades: sede só onde não há bairros; nenhuma repete o nome de um bairro do mesmo município", () => {
  const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^bairro\s+/, "");
  Object.values(SUB.localidades).forEach(l => {
    const temBairros = SUB.municipios[l.municipio].bairros > 0;
    if (temBairros) assert.ok(!/Sede/.test(l.categoria), l.nome);
    assert.ok(!Object.values(SUB.bairros).some(b => b.municipio === l.municipio && norm(b.nome) === norm(l.nome)), l.nome);
  });
});
teste("geometria da expansão: cada município, bairro e localidade do sistema tem geometria na área certa", () => {
  EXPANSAO.forEach(id => {
    const r = regional(id), g = GEOX[r.geodata];
    assert.ok(g, id);
    assert.deepEqual(Object.keys(g.municipios).sort(), r.municipios.map(m => m.ibge).sort());
    Object.keys(g.bairros).forEach(b => assert.equal(SUB.bairros[b].regional, id));
    Object.keys(g.localidades).forEach(l => assert.equal(SUB.localidades[l].regional, id));
  });
  assert.equal(Object.values(GEOX).reduce((s, g) => s + Object.keys(g.bairros).length, 0), 109);
});
teste("nomes repetidos no mesmo município (Porto Grande) são distinguidos só na exibição", () => {
  const s = MR.mrSubdivisoesDe(SUB, "2804805");
  const pg = s.bairros.filter(b => b.nome === "Porto Grande");
  assert.deepEqual(pg.map(b => b.rotulo), ["Porto Grande (1 de 2)", "Porto Grande (2 de 2)"]);
  assert.deepEqual(pg.map(b => b.codigoIbge), ["2804805020", "2804805501"]);
  assert.equal(s.bairros.find(b => b.nome === "Jardim").rotulo, "Jardim");
});
teste("lista do município: bairros e localidades em ordem alfabética (pt-BR)", () => {
  const s = MR.mrSubdivisoesDe(SUB, "2800308");
  const nomes = s.bairros.map(b => b.nome);
  assert.deepEqual(nomes, [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));
  assert.equal(s.bairros.length, 48);
  assert.equal(s.localidades.length, 0);
  assert.equal(MR.mrSubdivisoesDe(SUB, "2806701").localidades.length, 10);
});
teste("descrição de ids: município (nível 1), bairro e localidade (nível 2, com município pai)", () => {
  const atalaia = Object.values(SUB.bairros).find(b => b.nome === "Atalaia");
  const d = MR.mrDescrever(DADOS, SUB, atalaia.id);
  assert.equal(d.tipo, "bairro");
  assert.equal(d.pai, "2800308");
  assert.equal(MR.mrIdentificacao(d.municipio), "001 — Aracaju");
  assert.equal(MR.mrDescrever(DADOS, SUB, "2800605").tipo, "municipio");
  const caueira = Object.values(SUB.localidades).find(l => l.nome === "Caueira");
  assert.equal(MR.mrDescrever(DADOS, SUB, caueira.id).municipio.nome, "Itaporanga d'Ajuda");
  assert.equal(MR.mrDescrever(DADOS, SUB, "inexistente"), null);
});

console.log("=== APRESENTAÇÃO: MAPA SÓ NÚMERO; NOMES SÓ NA LISTA/TOOLTIP/PAINEL ===");
teste("identificação no formato 'CÓDIGO — NOME'", () => {
  assert.equal(MR.mrIdentificacao(todos().find(x => x.ibge === "2801207")), "350 — Canindé de São Francisco");
  assert.equal(MR.mrIdentificacao(regional("aracaju").municipios[0]), "001 — Aracaju");
});
teste("lista de cada área em ordem crescente de código (numérica; sem código por último)", () => {
  DADOS.regionais.forEach(r => {
    const cods = MR.mrOrdenarPorCodigo(r.municipios).map(m => (m.codigo ? parseInt(m.codigo, 10) : Infinity));
    assert.deepEqual(cods, [...cods].sort((a, b) => a - b), r.nome);
  });
  assert.deepEqual(MR.mrOrdenarPorCodigo(regional("aracaju").municipios).map(m => m.codigo), ["001", "010", "020"]);
  assert.equal(MR.mrOrdenarPorCodigo(regional("itabaiana").municipios)[0].codigo, "30");
});
teste("o mapa escreve SOMENTE o código sobre o território (nunca nomes de municípios, bairros ou localidades)", () => {
  const src = ler("js/mapa-regional.js");
  const trecho = src.slice(src.indexOf("function mrDesenharRotulos"), src.indexOf("/** Retângulos que se sobrepõem"));
  const textos = (trecho.match(/textContent\s*=\s*[^;]+;/g) || []).filter(x => x !== 'textContent = "";');
  assert.deepEqual(textos, ["textContent = itens[i].codigo;"]);
  assert.ok(!/\.nome\b/.test(trecho), "nenhum nome usado na camada do mapa");
  const loc = src.slice(src.indexOf("function mrDesenharLocalidades"), src.indexOf("function mrDefinirEstado"));
  assert.ok(!/textContent|mrSvgEl\("text"/.test(loc), "pontos de localidades sem texto");
  const reg = src.slice(src.indexOf("function mrDesenharRegional"), src.indexOf("/** Interação de um item da lista"));
  const camadaBairros = reg.slice(reg.indexOf("// bairros (nível 2)"), reg.indexOf("mrRefs.palco.insertBefore(svg"));
  assert.ok(!/textContent|"text"/.test(camadaBairros), "bairros sem texto no mapa");
});
teste("tooltip e painel montados com número, nome e regional (e município pai para bairros)", () => {
  const src = ler("js/mapa-regional.js");
  const tip = src.slice(src.indexOf("function mrPreencherTooltip"), src.indexOf("function mrPosicionarTooltip"));
  assert.ok(/municipio\.codigo/.test(tip) && /municipio\.nome/.test(tip) && /item\.rotulo/.test(tip));
  const ficha = src.slice(src.indexOf("function mrPreencherFicha"));
  assert.ok(/m\.codigo/.test(ficha) && /m\.nome/.test(ficha) && /regional\.nome/.test(ficha) && /"Município", mrIdentificacao\(d\.municipio\)/.test(ficha));
});

console.log("=== POSICIONAMENTO DOS NÚMEROS ===");
const itensRegional = r => r.municipios.filter(m => m.codigo).map(m => {
  const g = geoDe(r).municipios[m.ibge];
  return { ibge: m.ibge, x: g.rotulo[0], y: g.rotulo[1], raio: g.raio, codigo: m.codigo };
});
const limitesDe = r => { const [, , W, H] = geoDe(r).viewBox, P = Math.max(W, H) * 0.07; return [-P, -P, W + P, H + P]; };
const ESCALAS = [0.25, 0.33, 0.45, 0.7, 1];
teste("TODOS os números de todas as áreas são posicionados (interno ou selo) — nenhum some, em todas as escalas", () => {
  DADOS.regionais.forEach(r => ESCALAS.forEach(k => {
    const plano = MR.mrPlanejarRotulos(itensRegional(r), { k, limites: limitesDe(r) });
    assert.equal(plano.length, r.municipios.filter(m => m.codigo).length);
    plano.forEach(p => assert.ok(p && (p.tipo === "interno" || p.tipo === "chamada"), r.nome + " k=" + k));
  }));
});
teste("números nunca se sobrepõem e ficam dentro da área do mapa (não cortados)", () => {
  DADOS.regionais.forEach(r => ESCALAS.forEach(k => {
    const lim = limitesDe(r);
    const plano = MR.mrPlanejarRotulos(itensRegional(r), { k, limites: lim });
    plano.forEach((a, i) => {
      assert.ok(a.caixa.x >= lim[0] - 1e-6 && a.caixa.y >= lim[1] - 1e-6 && a.caixa.x + a.caixa.width <= lim[2] + 1e-6 && a.caixa.y + a.caixa.height <= lim[3] + 1e-6, r.nome + " fora: " + a.ibge);
      plano.slice(i + 1).forEach(b => assert.ok(!MR.mrSobrepoeFolga(a.caixa, b.caixa, 0), r.nome + " k=" + k + ": " + a.ibge + " × " + b.ibge));
    });
  }));
});
teste("legibilidade: corpo entre 12,5 e 21 px na tela, maior nos municípios maiores", () => {
  originais().forEach(r => ESCALAS.forEach(k => {
    const itens = itensRegional(r);
    const plano = MR.mrPlanejarRotulos(itens, { k, limites: limitesDe(r) });
    plano.forEach(p => assert.ok(p.fs * k >= MR.MR_ROTULO.minPx - 1e-6 && p.fs * k <= MR.MR_ROTULO.maxPx + 1e-6));
    const maior = itens.reduce((a, b) => (b.raio > a.raio ? b : a)), menor = itens.reduce((a, b) => (b.raio < a.raio ? b : a));
    const fs = ibge => plano.find(p => p.ibge === ibge).fs;
    assert.ok(fs(maior.ibge) >= fs(menor.ibge), r.nome);
  }));
});
teste("município grande: número centralizado na melhor área interna (centro do maior círculo inscrito)", () => {
  const r = regional("gloria");
  const pr = MR.mrPlanejarRotulos(itensRegional(r), { k: 0.7, limites: limitesDe(r) }).find(p => p.ibge === "2805406");
  assert.equal(pr.tipo, "interno");
  assert.deepEqual([pr.x, pr.y], GEO.dores.municipios["2805406"].rotulo);
});
teste("município pequeno: selo externo com linha indicadora que parte do próprio território", () => {
  const r = regional("maruim");
  const gm = MR.mrPlanejarRotulos(itensRegional(r), { k: 0.33, limites: limitesDe(r) }).find(p => p.ibge === "2802502");
  assert.equal(gm.tipo, "chamada");
  const g = GEO.maruim.municipios["2802502"];
  assert.deepEqual([gm.linha[0], gm.linha[1]], g.rotulo);
  assert.ok(Math.hypot(gm.x - g.rotulo[0], gm.y - g.rotulo[1]) > g.raio);
});
teste("posicionamento determinístico (a seleção não move números)", () => {
  const r = regional("aracaju");
  assert.deepEqual(MR.mrPlanejarRotulos(itensRegional(r), { k: 0.45, limites: limitesDe(r) }),
    MR.mrPlanejarRotulos(itensRegional(r), { k: 0.45, limites: limitesDe(r) }));
});

console.log("=== HIERARQUIA E SINCRONIA MAPA / LISTA (estado único) ===");
const AT = Object.values(SUB.bairros).find(b => b.nome === "Atalaia").id;
teste("seleção GERAL (município): marca o município e coordena TODOS os bairros dele, não os de outro", () => {
  const e = MR.mrAoClicar(MR.mrEstadoInicial("aracaju"), "2800308");
  assert.deepEqual(MR.mrMarcacao(e, "2800308", null), { hover: false, selecionado: true, municipioSelecionado: false, municipioHover: false });
  Object.values(SUB.bairros).filter(b => b.municipio === "2800308").forEach(b =>
    assert.equal(MR.mrMarcacao(e, b.id, b.municipio).municipioSelecionado, true));
  Object.values(SUB.bairros).filter(b => b.municipio === "2804805").forEach(b =>
    assert.equal(MR.mrMarcacao(e, b.id, b.municipio).municipioSelecionado, false));
});
teste("seleção INDIVIDUAL (bairro): só aquele bairro fica selecionado; o município não", () => {
  const e = MR.mrAoClicar(MR.mrEstadoInicial("aracaju"), AT);
  assert.equal(MR.mrMarcacao(e, AT, "2800308").selecionado, true);
  assert.equal(MR.mrMarcacao(e, "2800308", null).selecionado, false);
  const outros = Object.values(SUB.bairros).filter(b => b.id !== AT);
  outros.forEach(b => { const m = MR.mrMarcacao(e, b.id, b.municipio); assert.ok(!m.selecionado && !m.municipioSelecionado); });
});
teste("hover temporário: entra destaca, sair remove; sair de outro elemento não apaga", () => {
  let e = MR.mrAoPassar(MR.mrEstadoInicial("aracaju"), AT);
  assert.equal(MR.mrMarcacao(e, AT, "2800308").hover, true);
  assert.equal(MR.mrAoSair(e, "x"), e);
  e = MR.mrAoSair(e, AT);
  assert.equal(e.hover, null);
  assert.equal(MR.mrMarcacao(e, AT, "2800308").hover, false);
});
teste("clicar de novo no mesmo item limpa a seleção (município ou bairro); limpar volta ao estado inicial", () => {
  let e = MR.mrAoClicar(MR.mrEstadoInicial("aracaju"), "2800308");
  e = MR.mrAoClicar(e, "2800308");
  assert.equal(e.selecionado, null);
  e = MR.mrAoClicar(MR.mrAoClicar(e, AT), "2800605");
  assert.equal(e.selecionado, "2800605");
  assert.deepEqual(MR.mrLimparSelecao(e), MR.mrEstadoInicial("aracaju"));
});
teste("trocar de regional limpa hover e seleção; mesma regional não muda nada", () => {
  const e = MR.mrAoClicar(MR.mrEstadoInicial("maruim"), "2802502");
  assert.deepEqual(MR.mrTrocarRegional(e, "aracaju"), { regional: "aracaju", hover: null, selecionado: null });
  assert.equal(MR.mrTrocarRegional(e, "maruim"), e);
});
teste("lista expansível: alternar abre e fecha sem alterar o conjunto anterior", () => {
  const a = new Set();
  const b = MR.mrAlternarExpansao(a, "2800308");
  assert.ok(b.has("2800308") && !a.has("2800308"));
  assert.ok(!MR.mrAlternarExpansao(b, "2800308").has("2800308"));
});

console.log("=== APROXIMAÇÃO (câmera) ===");
const TOTAL = { x: -70, y: -70, w: 1140, h: 1140 };
teste("aproximar reduz a janela em torno do ponto; afastar até o fim volta à vista inteira (null)", () => {
  const j = MR.mrZoomJanela(null, 2, 500, 500, TOTAL);
  assert.ok(Math.abs(j.w - 570) < 1e-9 && Math.abs(j.x + j.w / 2 - (500 + (TOTAL.x + TOTAL.w / 2 - 500) / 2)) < 1);
  assert.equal(MR.mrZoomJanela(j, 1 / 2, 500, 500, TOTAL), null);
});
teste("aproximação limitada (16×) e janela sempre dentro dos limites", () => {
  let j = null;
  for (let i = 0; i < 40; i++) j = MR.mrZoomJanela(j, 1.6, 1060, -60, TOTAL);
  assert.ok(Math.abs(j.w - TOTAL.w / MR.MR_ZOOM_MAX) < 1e-6);
  assert.ok(j.x >= TOTAL.x && j.y >= TOTAL.y && j.x + j.w <= TOTAL.x + TOTAL.w + 1e-9 && j.y + j.h <= TOTAL.y + TOTAL.h + 1e-9);
  const m = MR.mrMoverJanela(j, 99999, -99999, TOTAL);
  assert.ok(m.x + m.w <= TOTAL.x + TOTAL.w + 1e-9 && m.y >= TOTAL.y);
  assert.equal(MR.mrMoverJanela(null, 10, 10, TOTAL), null);
});
teste("enquadrar um bairro: a janela contém a caixa do bairro", () => {
  const c = { x: 400, y: 300, width: 30, height: 20 };
  const j = MR.mrJanelaPara(c, TOTAL);
  assert.ok(j.x <= c.x && j.y <= c.y && j.x + j.w >= c.x + c.width && j.y + j.h >= c.y + c.height);
  assert.equal(MR.mrJanelaPara({ x: -70, y: -70, width: 1140, height: 1140 }, TOTAL), null);
});

console.log("=== SEM IMPORTAÇÃO, SEM 'RESTRITO', SEM ARMAZENAMENTO ===");
teste("nenhum resquício da importação no módulo, no CSS e no HTML", () => {
  const proibidos = /Importar códigos|mr_codigos|mr-codigos|Restrito|restrito|cadeado|CADEADO|mrImportar|mrValidarArquivo|mrCodigos|mrSessao|sessionStorage|localStorage|FileReader|type="file"|\.files\b|Manter até fechar|Limpar códigos|PEND\.|pendente/;
  ["js/mapa-regional.js", "js/mapa-regional/dados.js", "css/mapa-regional.css"].forEach(f =>
    assert.ok(!proibidos.test(ler(f)), f + ": " + (ler(f).match(proibidos) || [])[0]));
  const html = ler("index.html");
  const modulo = html.slice(html.indexOf('<div id="mapa_regional_interativo"'), html.indexOf("<!-- ///////////////CALLBACK WHATSAPP"));
  assert.ok(modulo.length > 100 && !proibidos.test(modulo));
});
teste("a pasta local/ de importação continua removida", () => {
  assert.ok(!fs.existsSync(path.join(RAIZ, "local")));
});
teste("arquivos do módulo não usam fetch / XMLHttpRequest / import / console (funciona em file://)", () => {
  ["js/mapa-regional/dados.js", "js/mapa-regional/geometria.js", "js/mapa-regional/geometria-expansao.js", "js/mapa-regional/subdivisoes.js", "js/mapa-regional.js"].forEach(f =>
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|^\s*import\s|console\.(log|info|warn|error|debug)/m.test(ler(f)), f));
});
teste("index.html carrega dados → geometria → expansão → subdivisões → controlador, nessa ordem, e o CSS", () => {
  const html = ler("index.html");
  const pos = ["js/mapa-regional/dados.js", "js/mapa-regional/geometria.js", "js/mapa-regional/geometria-expansao.js", "js/mapa-regional/subdivisoes.js", "js/mapa-regional.js"]
    .map(s => html.indexOf('<script src="' + s + '"></script>'));
  pos.forEach(p => assert.ok(p > 0));
  pos.slice(1).forEach((p, i) => assert.ok(pos[i] < p));
  assert.ok(html.includes('href="css/mapa-regional.css"'));
  assert.ok(html.includes("openModule('mapa_regional_interativo', this); mapaRegionalAoAbrir();"));
});

console.log("=== MÓDULO ANTIGO REMOVIDO / OUTROS MÓDULOS PRESERVADOS ===");
teste("o antigo 'Mapas das Regionais' (Leaflet) não está no menu, no Início nem no HTML", () => {
  const html = ler("index.html");
  assert.ok(!/mapas_territoriais|mapas_regionais|regtm|mapas-regionais/.test(html));
  ["js/mapas-regionais.js", "css/mapas-regionais.css", "js/mapas-regionais.test.js"].forEach(f => assert.ok(!fs.existsSync(path.join(RAIZ, f))));
});
teste("um único mapa regional no menu: 'Mapa Regional Interativo' (e o atalho do Início aponta para ele)", () => {
  const html = ler("index.html");
  const rotulos = [...html.matchAll(/<span class="menu-label">([^<]+)<\/span>/g)].map(m => m[1]);
  assert.deepEqual(rotulos.filter(t => /mapa/i.test(t) && /regiona/i.test(t)), ["Mapa Regional Interativo"]);
  assert.ok(html.includes(`data-atalho="openModule('mapa_regional_interativo'"`));
});
teste("Mapa Operacional (Gestão de Equipes): geodata/aracaju (OpenStreetMap) intocado e ainda usado por js/mapa.js", () => {
  const fc = JSON.parse(ler("geodata/aracaju/aracaju.geojson"));
  assert.equal(fc.features.length, 80);
  assert.ok(/geodata\/\$\{slug\}\/\$\{slug\}\.geojson/.test(ler("js/mapa.js")));
});
teste("nenhuma referência quebrada: todo script/CSS local do index.html existe; nenhum JS chama o módulo antigo", () => {
  const html = ler("index.html");
  const locais = [...html.matchAll(/(?:src|href)="([^"#:]+\.(?:js|css))"/g)].map(m => m[1]);
  assert.ok(locais.length > 10);
  locais.forEach(f => assert.ok(fs.existsSync(path.join(RAIZ, f)), "arquivo ausente: " + f));
  fs.readdirSync(path.join(RAIZ, "js"), { recursive: true }).filter(f => /\.js$/.test(f) && !/\.test\.js$/.test(f))
    .forEach(f => assert.ok(!/\bregtm[A-Z_]/.test(fs.readFileSync(path.join(RAIZ, "js", f), "utf8")), f));
});
teste("outros módulos preservados: telas e itens de menu continuam no HTML", () => {
  const html = ler("index.html");
  ["equipes", "callback", "bloqueios_lv", "substituicao_poste", "material_removido", "inicio"].forEach(id =>
    assert.ok(html.includes('id="' + id + '"'), "tela " + id));
  ["openModule('equipes', this); equipesAoAbrir();", "openModule('bloqueios_lv', this)", "openModule('substituicao_poste', this)",
   "abrirTabela()", "abrirMaterialRemovido(this)", "abrirEscala()", "abrirPassagemTurno()", "abrirCentralCallback()"].forEach(s => assert.ok(html.includes(s), s));
  ["login_btn_entrar", "acesso_btn_enviar", "esqueci_btn_enviar", "auth_btn_meu_perfil", "auth_btn_sair", "mapa_leaflet"].forEach(id =>
    assert.ok(html.includes('id="' + id + '"'), id));
  ["js/mapa.js", "js/equipes.js", "js/auth.js", "js/callback-whatsapp.js", "js/fundo-natal.js", "js/layout-ui.js"].forEach(s =>
    assert.ok(html.includes('<script src="' + s + '"></script>'), s));
  assert.ok(html.includes("leaflet@1.9.4/dist/leaflet.js"));
});

console.log(`\n${ok} testes ok`);
