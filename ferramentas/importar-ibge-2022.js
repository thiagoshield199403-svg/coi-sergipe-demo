#!/usr/bin/env node
/* IMPORTADOR OFFLINE — fontes IBGE da expansão do Mapa Regional Interativo
   (Regional Aracaju, São Cristóvão, Itaporanga d'Ajuda).

   Lê os arquivos ORIGINAIS baixados do IBGE (fora do repositório) e grava, em
   geodata/ibge-2022/, só o recorte dos 5 municípios, em GeoJSON:
     - municipios-2022.geojson  ← Malha Municipal 2022 (SE_Municipios_2022)
     - bairros-cd2022.geojson   ← Malha de Bairros do Censo 2022 (SE_bairros_CD2022)
     - localidades-2010.geojson ← Cadastro de Localidades Selecionadas 2010 (BR_Localidades_2010_v1)
   Nenhum limite é desenhado, recortado ou "ajustado": as geometrias são as do IBGE,
   só com coordenadas arredondadas a 6 casas (≈ 0,1 m).

   Uso: node ferramentas/importar-ibge-2022.js <pasta-fontes>
     <pasta-fontes>/ibge-malha-municipal-2022/extraido/SE_Municipios_2022.{shp,dbf}
     <pasta-fontes>/ibge-bairros-2022/extraido/SE_bairros_CD2022.{shp,dbf}
     <pasta-fontes>/ibge-localidades-2010/BR_Localidades_2010_v1.{shp,dbf}
   Endereços de download: ver geodata/ibge-2022/NOTICE.md. */
const fs = require("node:fs");
const path = require("node:path");
const { lerShapefile, lerDbf, lerShp } = require("./ler-shapefile.js");

const RAIZ = path.join(__dirname, "..");
const DESTINO = path.join(RAIZ, "geodata", "ibge-2022");
const MUNICIPIOS = {
  "2800308": "Aracaju", "2800605": "Barra dos Coqueiros", "2804805": "Nossa Senhora do Socorro",
  "2806701": "São Cristóvão", "2803203": "Itaporanga d'Ajuda",
};

const r6 = v => Math.round(v * 1e6) / 1e6;
function arredondar(g) {
  if (g.type === "Point") return { type: "Point", coordinates: g.coordinates.map(r6) };
  const anel = a => a.map(p => [r6(p[0]), r6(p[1])]);
  if (g.type === "Polygon") return { type: "Polygon", coordinates: g.coordinates.map(anel) };
  return { type: "MultiPolygon", coordinates: g.coordinates.map(p => p.map(anel)) };
}

/** "NOSSA SENHORA DO SOCORRO" → "Nossa Senhora do Socorro"; "D'AJUDA" → "d'Ajuda". */
function tituloPt(s) {
  const minusculas = new Set(["de", "da", "do", "das", "dos", "e", "a", "o"]);
  return s.toLowerCase().split(/(\s+|-)/).map((p, i) => {
    if (/^\s+$|^-$/.test(p)) return p;
    if (i > 0 && minusculas.has(p)) return p;
    if (/^d'/.test(p)) return "d'" + p.charAt(2).toUpperCase() + p.slice(3);
    if (/^pa$/.test(p)) return "PA"; // projeto de assentamento ("PA 8 de Março")
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join("");
}
const CATEGORIAS = {
  "CIDADE": "Sede municipal (cidade)", "VILA": "Vila", "POVOADO": "Povoado", "LUGAREJO": "Lugarejo",
  "AUI": "Área urbana isolada", "PROJETO DE ASSENTAMENTO": "Projeto de assentamento", "NÚCLEO": "Núcleo",
};

function gravar(nome, fc) {
  fs.mkdirSync(DESTINO, { recursive: true });
  const linhas = fc.features.map(f => JSON.stringify(f));
  fs.writeFileSync(path.join(DESTINO, nome), '{"type":"FeatureCollection","features":[\n' + linhas.join(",\n") + "\n]}\n");
  console.log("ok:", nome, fc.features.length, "feições");
}

function importar(fontes) {
  // ---- municípios (Malha Municipal 2022) ----
  const M = lerShapefile(path.join(fontes, "ibge-malha-municipal-2022", "extraido", "SE_Municipios_2022"));
  const municipios = M.features.filter(f => MUNICIPIOS[f.properties.CD_MUN]).map(f => ({
    type: "Feature",
    properties: {
      municipio_ibge_codigo: f.properties.CD_MUN, municipio_ibge_nome: f.properties.NM_MUN,
      area_km2: f.properties.AREA_KM2, fonte: "IBGE — Malha Municipal 2022",
    },
    geometry: arredondar(f.geometry),
  }));
  if (municipios.length !== 5) throw new Error("esperados 5 municípios, achados " + municipios.length);

  // ---- bairros (Censo 2022) ----
  const B = lerShapefile(path.join(fontes, "ibge-bairros-2022", "extraido", "SE_bairros_CD2022"));
  const bairros = B.features.filter(f => MUNICIPIOS[f.properties.CD_MUN]).map(f => ({
    type: "Feature",
    properties: {
      bairro_ibge_codigo: f.properties.CD_BAIRRO, bairro_nome: f.properties.NM_BAIRRO,
      municipio_ibge_codigo: f.properties.CD_MUN, municipio_ibge_nome: f.properties.NM_MUN,
      fonte: "IBGE — Malha de Bairros, Censo Demográfico 2022", delimitacao: "oficial",
    },
    geometry: arredondar(f.geometry),
  })).sort((a, b) => a.properties.bairro_ibge_codigo.localeCompare(b.properties.bairro_ibge_codigo));

  // ---- localidades (pontos, Cadastro de Localidades Selecionadas 2010) ----
  const base = path.join(fontes, "ibge-localidades-2010", "BR_Localidades_2010_v1");
  const reg = lerDbf(base + ".dbf", "windows-1252").registros;
  const pts = lerShp(base + ".shp");
  const localidades = reg.map((r, i) => ({ r, g: pts[i] })).filter(({ r }) => MUNICIPIOS[String(r.CD_GEOCODM)]).map(({ r, g }) => ({
    type: "Feature",
    properties: {
      localidade_ibge_id: String(r.ID), localidade_nome: tituloPt(r.NM_LOCALID),
      categoria: CATEGORIAS[r.NM_CATEGOR] || tituloPt(r.NM_CATEGOR), categoria_ibge: r.NM_CATEGOR,
      municipio_ibge_codigo: String(r.CD_GEOCODM), municipio_ibge_nome: MUNICIPIOS[String(r.CD_GEOCODM)],
      fonte: "IBGE — Cadastro de Localidades Selecionadas 2010", delimitacao: "ponto (sem limite)",
    },
    geometry: arredondar(g),
  })).sort((a, b) => Number(a.properties.localidade_ibge_id) - Number(b.properties.localidade_ibge_id));

  gravar("municipios-2022.geojson", { features: municipios });
  gravar("bairros-cd2022.geojson", { features: bairros });
  gravar("localidades-2010.geojson", { features: localidades });
}

if (require.main === module) {
  const fontes = process.argv[2];
  if (!fontes) { console.error("uso: node ferramentas/importar-ibge-2022.js <pasta-fontes>"); process.exit(1); }
  importar(path.resolve(fontes));
}
module.exports = { tituloPt, MUNICIPIOS };
