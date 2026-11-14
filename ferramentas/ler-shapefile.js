/* Leitor mínimo de Shapefile (.shp polígonos) + .dbf, sem dependências.
   Usado por ferramentas/importar-bairros-ibge.js para converter a malha oficial
   de bairros do IBGE (Censo 2022) em GeoJSON. Suporta só o que as bases usam:
   tipo 5 (Polygon) e tipo 1 (Point), coordenadas geográficas (SIRGAS 2000, graus). */
const fs = require("node:fs");

function lerDbf(caminho, codificacao) {
  const b = fs.readFileSync(caminho);
  const nRegistros = b.readUInt32LE(4);
  const tamCabecalho = b.readUInt16LE(8);
  const tamRegistro = b.readUInt16LE(10);
  const campos = [];
  for (let p = 32; b[p] !== 0x0d; p += 32) {
    const nome = b.toString("latin1", p, p + 11).replace(/\0.*$/, "");
    campos.push({ nome, tipo: String.fromCharCode(b[p + 11]), tam: b[p + 16] });
  }
  const dec = new TextDecoder(codificacao || "utf-8");
  const registros = [];
  for (let i = 0; i < nRegistros; i++) {
    let p = tamCabecalho + i * tamRegistro + 1; // 1º byte = marca de exclusão
    const r = {};
    for (const c of campos) {
      const bruto = dec.decode(b.subarray(p, p + c.tam)).trim();
      r[c.nome] = c.tipo === "N" || c.tipo === "F" ? (bruto === "" ? null : Number(bruto)) : bruto;
      p += c.tam;
    }
    registros.push(r);
  }
  return { campos, registros };
}

/** Anéis de um polígono shapefile → GeoJSON (anel externo horário no shp; furos anti-horários). */
function aneisParaGeometria(aneis) {
  const area = a => { let s = 0; for (let i = 0; i < a.length - 1; i++) s += a[i][0] * a[i + 1][1] - a[i + 1][0] * a[i][1]; return s / 2; };
  const dentro = (pt, anel) => {
    let d = false;
    for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
      const [xi, yi] = anel[i], [xj, yj] = anel[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) d = !d;
    }
    return d;
  };
  const externos = [], furos = [];
  aneis.forEach(a => (area(a) < 0 ? externos : furos).push(a)); // shp: externo = horário = área negativa
  const poligonos = externos.map(e => [e]);
  furos.forEach(f => { const pai = poligonos.find(p => dentro(f[0], p[0])); if (pai) pai.push(f); });
  return poligonos.length === 1 ? { type: "Polygon", coordinates: poligonos[0] } : { type: "MultiPolygon", coordinates: poligonos };
}

function lerShp(caminho) {
  const b = fs.readFileSync(caminho);
  const geometrias = [];
  let p = 100;
  while (p < b.length) {
    const tamConteudo = b.readInt32BE(p + 4) * 2;
    const c = p + 8;
    const tipo = b.readInt32LE(c);
    if (tipo === 0) { geometrias.push(null); p = c + tamConteudo; continue; }
    if (tipo === 1) { // Point (cadastro de localidades)
      geometrias.push({ type: "Point", coordinates: [b.readDoubleLE(c + 4), b.readDoubleLE(c + 12)] });
      p = c + tamConteudo; continue;
    }
    if (tipo !== 5) throw new Error("tipo de geometria não suportado: " + tipo);
    const nPartes = b.readInt32LE(c + 36), nPontos = b.readInt32LE(c + 40);
    const partes = [];
    for (let i = 0; i < nPartes; i++) partes.push(b.readInt32LE(c + 44 + i * 4));
    const base = c + 44 + nPartes * 4;
    const pts = [];
    for (let i = 0; i < nPontos; i++) pts.push([b.readDoubleLE(base + i * 16), b.readDoubleLE(base + i * 16 + 8)]);
    const aneis = partes.map((ini, i) => pts.slice(ini, i + 1 < nPartes ? partes[i + 1] : nPontos));
    geometrias.push(aneisParaGeometria(aneis));
    p = c + tamConteudo;
  }
  return geometrias;
}

function lerShapefile(base) {
  const cpg = fs.existsSync(base + ".cpg") ? fs.readFileSync(base + ".cpg", "utf8").trim().toLowerCase() : "utf-8";
  const { registros } = lerDbf(base + ".dbf", /1252|latin/.test(cpg) ? "windows-1252" : "utf-8");
  const geometrias = lerShp(base + ".shp");
  if (registros.length !== geometrias.length) throw new Error("dbf e shp com quantidades diferentes");
  return { type: "FeatureCollection", features: registros.map((r, i) => ({ type: "Feature", properties: r, geometry: geometrias[i] })) };
}

module.exports = { lerShapefile, lerDbf, lerShp };
