#!/usr/bin/env node
/* GERADOR OFFLINE — Mapa Regional Interativo
   Lê a malha oficial do IBGE já versionada em geodata/<slug>/<slug>.geojson e
   grava js/mapa-regional/geometria.js (caminhos SVG por município, chaveados
   pelo CÓDIGO IBGE). Nada é desenhado à mão: os limites são exatamente os do
   GeoJSON, só projetados para o plano e arredondados a 0,1 unidade.

   Uso:   node ferramentas/gerar-mapa-regional.js
   Saída: js/mapa-regional/geometria.js (gerado — não editar à mão)

   Projeção: equirretangular com correção de cos(latitude média) por regional
   (área pequena, perto de 10°S — distorção desprezível). Eixo y invertido
   (norte para cima). Cada regional ocupa 1000 unidades na maior dimensão.

   Este arquivo só gera GEOMETRIA (pública, do IBGE). Os números dos polos ficam
   separados, em js/mapa-regional/dados.js, e são desenhados pelo módulo do mapa. */

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const SAIDA = path.join(RAIZ, "js", "mapa-regional", "geometria.js");
const REGIONAIS = ["itabaiana", "lagarto", "dores", "propria", "maruim"]; // slugs de geodata/
const TAMANHO = 1000;
const MARGEM = 12;

function aneisDe(geometria) {
  if (geometria.type === "Polygon") return [geometria.coordinates];
  if (geometria.type === "MultiPolygon") return geometria.coordinates;
  throw new Error("geometria não suportada: " + geometria.type);
}

/** Projeta uma regional inteira (todas as feições na mesma escala). Função pura. */
function projetarRegional(featureCollection) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const f of featureCollection.features) {
    for (const poligono of aneisDe(f.geometry)) {
      for (const [lon, lat] of poligono[0]) {
        if (lon < minX) minX = lon; if (lon > maxX) maxX = lon;
        if (lat < minY) minY = lat; if (lat > maxY) maxY = lat;
      }
    }
  }
  const k = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
  const largura = (maxX - minX) * k;
  const altura = maxY - minY;
  const escala = (TAMANHO - 2 * MARGEM) / Math.max(largura, altura);
  const px = lon => +(MARGEM + (lon - minX) * k * escala).toFixed(1);
  const py = lat => +(MARGEM + (maxY - lat) * escala).toFixed(1);
  const W = +(largura * escala + 2 * MARGEM).toFixed(1);
  const H = +(altura * escala + 2 * MARGEM).toFixed(1);

  const municipios = {};
  for (const f of featureCollection.features) {
    const ibge = String(f.properties.municipio_ibge_codigo);
    const poligonos = aneisDe(f.geometry).map(poligono =>
      poligono.map(anel => {
        const pts = [];
        for (const [lon, lat] of anel) {
          const p = [px(lon), py(lat)];
          const u = pts[pts.length - 1];
          if (!u || u[0] !== p[0] || u[1] !== p[1]) pts.push(p);
        }
        return pts;
      })
    );
    const d = poligonos.map(poligono =>
      poligono.map(anel => "M" + anel.map(p => p[0] + " " + p[1]).join("L") + "Z").join("")
    ).join("");
    // rótulo no maior polígono (ilhas/fragmentos não "puxam" o texto)
    const maior = poligonos.slice().sort((a, b) => Math.abs(area(b[0])) - Math.abs(area(a[0])))[0];
    const rot = poloDeInacessibilidade(maior);
    municipios[ibge] = {
      nomeIbge: f.properties.municipio_ibge_nome,
      d,
      rotulo: [+rot.x.toFixed(1), +rot.y.toFixed(1)],
      raio: +rot.r.toFixed(1), // raio do maior círculo inscrito ≈ espaço para o rótulo
    };
  }
  return { viewBox: [0, 0, W, H], municipios };
}

function area(anel) {
  let s = 0;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) s += (anel[j][0] + anel[i][0]) * (anel[j][1] - anel[i][1]);
  return s / 2;
}

function dentro(x, y, poligono) {
  let c = false;
  for (const anel of poligono) {
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const [xi, yi] = anel[i], [xj, yj] = anel[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}

function distBorda(x, y, poligono) {
  let m = Infinity;
  for (const anel of poligono) {
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const [ax, ay] = anel[j], [bx, by] = anel[i];
      const dx = bx - ax, dy = by - ay;
      const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
      const ex = ax + t * dx - x, ey = ay + t * dy - y;
      m = Math.min(m, Math.hypot(ex, ey));
    }
  }
  return m;
}

/** Ponto interno mais distante da borda (busca em grade + refinamento). Determinística. */
function poloDeInacessibilidade(poligono) {
  const xs = poligono[0].map(p => p[0]), ys = poligono[0].map(p => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let melhor = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, r: -1 };
  for (let rodada = 0; rodada < 4; rodada++) {
    const N = 36;
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const x = x0 + (x1 - x0) * i / N, y = y0 + (y1 - y0) * j / N;
        if (!dentro(x, y, poligono)) continue;
        const r = distBorda(x, y, poligono);
        if (r > melhor.r) melhor = { x, y, r };
      }
    }
    const lx = (x1 - x0) / 6, ly = (y1 - y0) / 6;
    x0 = melhor.x - lx; x1 = melhor.x + lx; y0 = melhor.y - ly; y1 = melhor.y + ly;
  }
  return melhor;
}

/** Gera o conteúdo completo de geometria.js (string). Função pura sobre os arquivos de geodata/. */
function gerarConteudo(raiz) {
  const regionais = {};
  for (const slug of REGIONAIS) {
    const fc = JSON.parse(fs.readFileSync(path.join(raiz, "geodata", slug, slug + ".geojson"), "utf8"));
    regionais[slug] = projetarRegional(fc);
  }
  return (
    "/* GERADO por ferramentas/gerar-mapa-regional.js a partir de geodata/ (IBGE, malha\n" +
    "   territorial oficial). NÃO EDITAR À MÃO — rode o gerador de novo.\n" +
    "   Só geometria pública: chaves = código IBGE do município. */\n" +
    "const MAPA_REGIONAL_GEOMETRIA = " + JSON.stringify(regionais) + ";\n" +
    'if (typeof module !== "undefined") module.exports = { MAPA_REGIONAL_GEOMETRIA };\n'
  );
}

if (require.main === module) {
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  const conteudo = gerarConteudo(RAIZ);
  fs.writeFileSync(SAIDA, conteudo);
  console.log("ok:", path.relative(RAIZ, SAIDA), (conteudo.length / 1024).toFixed(1) + " KB");
}

module.exports = { gerarConteudo, projetarRegional, poloDeInacessibilidade, area, dentro, aneisDe, REGIONAIS };
