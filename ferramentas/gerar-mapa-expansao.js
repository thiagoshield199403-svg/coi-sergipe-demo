#!/usr/bin/env node
/* GERADOR OFFLINE — expansão do Mapa Regional Interativo (áreas com bairros).
   Lê geodata/ibge-2022/*.geojson (recorte do IBGE, ver NOTICE.md) e as áreas de
   js/mapa-regional/dados.js marcadas com fonte "ibge-2022", e grava:
     - js/mapa-regional/geometria-expansao.js — geometria (SVG) por área: municípios,
       bairros e pontos de localidades, todos numa mesma projeção por área;
     - js/mapa-regional/subdivisoes.js — metadados de bairros e localidades
       (id estável, nome, município pai, fonte, situação da delimitação,
       campo "codigo" reservado = null) e a cobertura de bairros por município.
   NÃO toca em js/mapa-regional/geometria.js (os 58 municípios aprovados).
   Mesma projeção do gerador original (equirretangular com cos da latitude média,
   1000 unidades na maior dimensão, norte para cima). Nada é desenhado à mão.

   Uso: node ferramentas/gerar-mapa-expansao.js */
const fs = require("node:fs");
const path = require("node:path");
const { poloDeInacessibilidade, area, aneisDe } = require("./gerar-mapa-regional.js");

const RAIZ = path.join(__dirname, "..");
const SAIDA_GEO = path.join(RAIZ, "js", "mapa-regional", "geometria-expansao.js");
const SAIDA_SUB = path.join(RAIZ, "js", "mapa-regional", "subdivisoes.js");
const TAMANHO = 1000;
const MARGEM = 12;

const lerGeo = (raiz, nome) => JSON.parse(fs.readFileSync(path.join(raiz, "geodata", "ibge-2022", nome), "utf8"));
const normalizar = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^bairro\s+/, "").trim();

function gerar(raiz) {
  delete require.cache[require.resolve(path.join(raiz, "js", "mapa-regional", "dados.js"))];
  const { MAPA_REGIONAL_DADOS } = require(path.join(raiz, "js", "mapa-regional", "dados.js"));
  const MUN = lerGeo(raiz, "municipios-2022.geojson").features;
  const BAI = lerGeo(raiz, "bairros-cd2022.geojson").features;
  const LOC = lerGeo(raiz, "localidades-2010.geojson").features;

  const geometria = {};
  const subdivisoes = { bairros: {}, localidades: {}, municipios: {} };

  for (const r of MAPA_REGIONAL_DADOS.regionais.filter(x => x.fonte === "ibge-2022")) {
    const ibges = r.municipios.map(m => m.ibge);
    const muns = ibges.map(c => {
      const f = MUN.find(x => x.properties.municipio_ibge_codigo === c);
      if (!f) throw new Error("município sem geometria IBGE 2022: " + c);
      return f;
    });
    const bairros = BAI.filter(f => ibges.includes(f.properties.municipio_ibge_codigo));
    // localidades: pontos que acrescentam informação — a sede só onde não há bairros,
    // e nenhuma localidade que repita o nome de um bairro do mesmo município
    const localidades = LOC.filter(f => {
      const p = f.properties;
      if (!ibges.includes(p.municipio_ibge_codigo)) return false;
      const bs = bairros.filter(b => b.properties.municipio_ibge_codigo === p.municipio_ibge_codigo);
      if (p.categoria_ibge === "CIDADE" && bs.length) return false;
      return !bs.some(b => normalizar(b.properties.bairro_nome) === normalizar(p.localidade_nome));
    });

    // ---- projeção da área (limites = municípios) ----
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    muns.forEach(f => aneisDe(f.geometry).forEach(p => p[0].forEach(([x, y]) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    })));
    const k = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
    const escala = (TAMANHO - 2 * MARGEM) / Math.max((maxX - minX) * k, maxY - minY);
    const px = lon => +(MARGEM + (lon - minX) * k * escala).toFixed(1);
    const py = lat => +(MARGEM + (maxY - lat) * escala).toFixed(1);
    const W = +((maxX - minX) * k * escala + 2 * MARGEM).toFixed(1);
    const H = +((maxY - minY) * escala + 2 * MARGEM).toFixed(1);
    const projetar = g => aneisDe(g).map(poligono => poligono.map(anel => {
      const pts = [];
      for (const [lon, lat] of anel) {
        const p = [px(lon), py(lat)], u = pts[pts.length - 1];
        if (!u || u[0] !== p[0] || u[1] !== p[1]) pts.push(p);
      }
      return pts;
    }));
    const caminho = poligonos => poligonos.map(p => p.map(a => "M" + a.map(q => q[0] + " " + q[1]).join("L") + "Z").join("")).join("");
    const areaPoligonos = poligonos => poligonos.reduce((s, p) => s + Math.abs(area(p[0])) - p.slice(1).reduce((t, h) => t + Math.abs(area(h)), 0), 0);
    const rotuloDe = poligonos => {
      const maior = poligonos.slice().sort((a, b) => Math.abs(area(b[0])) - Math.abs(area(a[0])))[0];
      const rot = poloDeInacessibilidade(maior);
      return { rotulo: [+rot.x.toFixed(1), +rot.y.toFixed(1)], raio: +rot.r.toFixed(1) };
    };

    const g = { viewBox: [0, 0, W, H], municipios: {}, bairros: {}, localidades: {} };
    const areaMun = {};
    muns.forEach(f => {
      const poligonos = projetar(f.geometry);
      const c = f.properties.municipio_ibge_codigo;
      areaMun[c] = areaPoligonos(poligonos);
      g.municipios[c] = Object.assign({ nomeIbge: f.properties.municipio_ibge_nome, d: caminho(poligonos) }, rotuloDe(poligonos));
    });
    const areaBairros = {};
    bairros.forEach(f => {
      const p = f.properties, id = "b" + p.bairro_ibge_codigo;
      const poligonos = projetar(f.geometry);
      areaBairros[p.municipio_ibge_codigo] = (areaBairros[p.municipio_ibge_codigo] || 0) + areaPoligonos(poligonos);
      g.bairros[id] = Object.assign({ d: caminho(poligonos) }, rotuloDe(poligonos));
      subdivisoes.bairros[id] = {
        id, tipo: "bairro", nome: p.bairro_nome, municipio: p.municipio_ibge_codigo, regional: r.id,
        codigoIbge: p.bairro_ibge_codigo, fonte: p.fonte, delimitacao: p.delimitacao, codigo: null,
      };
    });
    localidades.forEach(f => {
      const p = f.properties, id = "l2010-" + p.localidade_ibge_id;
      const [lon, lat] = f.geometry.coordinates;
      g.localidades[id] = { ponto: [px(lon), py(lat)] };
      subdivisoes.localidades[id] = {
        id, tipo: "localidade", nome: p.localidade_nome, categoria: p.categoria, municipio: p.municipio_ibge_codigo,
        regional: r.id, fonte: p.fonte, delimitacao: p.delimitacao, codigo: null,
      };
    });
    ibges.forEach(c => {
      subdivisoes.municipios[c] = {
        bairros: bairros.filter(b => b.properties.municipio_ibge_codigo === c).length,
        localidades: localidades.filter(l => l.properties.municipio_ibge_codigo === c).length,
        coberturaBairros: +(100 * (areaBairros[c] || 0) / areaMun[c]).toFixed(1), // % do território com bairro delimitado
        fonteLimite: "IBGE — Malha Municipal 2022",
      };
    });
    geometria[r.geodata] = g;
  }

  const cab = "/* GERADO por ferramentas/gerar-mapa-expansao.js a partir de geodata/ibge-2022/ (IBGE).\n   NÃO EDITAR À MÃO — rode o gerador de novo. ";
  return {
    geometria: cab + "Só geometria (municípios, bairros, pontos de localidades). */\n" +
      "const MAPA_REGIONAL_GEOMETRIA_EXPANSAO = " + JSON.stringify(geometria) + ";\n" +
      'if (typeof module !== "undefined") module.exports = { MAPA_REGIONAL_GEOMETRIA_EXPANSAO };\n',
    subdivisoes: cab + "Só metadados das subdivisões (sem geometria);\n   os bairros/localidades NÃO têm código operacional (\"codigo\" reservado = null). */\n" +
      "const MAPA_REGIONAL_SUBDIVISOES = " + JSON.stringify(subdivisoes, null, 1) + ";\n" +
      'if (typeof module !== "undefined") module.exports = { MAPA_REGIONAL_SUBDIVISOES };\n',
  };
}

if (require.main === module) {
  const r = gerar(RAIZ);
  fs.writeFileSync(SAIDA_GEO, r.geometria);
  fs.writeFileSync(SAIDA_SUB, r.subdivisoes);
  console.log("ok:", path.relative(RAIZ, SAIDA_GEO), (r.geometria.length / 1024).toFixed(1) + " KB;",
    path.relative(RAIZ, SAIDA_SUB), (r.subdivisoes.length / 1024).toFixed(1) + " KB");
}
module.exports = { gerar };
