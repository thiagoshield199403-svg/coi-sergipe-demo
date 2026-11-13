/* Testes puros (sem framework, sem dependência nova) da escolha de versão do fundo natalino
   (fundoNatalEscolherFonte em js/fundo-natal.js) e da presença dos arquivos que ela referencia.

   Roda com Node puro:
       node js/fundo-natal.test.js
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {fundoNatalEscolherFonte} = require("./fundo-natal.js");

const PASTA = path.join(__dirname, "..", "assets", "natal");
let ok = 0;
function teste(nome, fn) {
  fn();
  ok++;
  console.log("✓ " + nome);
}

const desktop = {reduzirMovimento: false, economiaDados: false, nucleos: 8, memoriaGB: 8, ladoMaiorPx: 1920, vp9: true};

teste("menos movimento → imagem estática", () => {
  assert.equal(fundoNatalEscolherFonte({...desktop, reduzirMovimento: true}).tipo, "imagem");
});
teste("economia de dados → imagem estática", () => {
  assert.equal(fundoNatalEscolherFonte({...desktop, economiaDados: true}).tipo, "imagem");
});
teste("desktop com VP9 → WebM 1080p com MP4 de reserva", () => {
  const e = fundoNatalEscolherFonte(desktop);
  assert.deepEqual(e.fontes.map((f) => f[0]), ["natal-coi-1080p.webm", "natal-coi-1080p.mp4"]);
});
teste("sem VP9 → MP4 1080p", () => {
  assert.deepEqual(fundoNatalEscolherFonte({...desktop, vp9: false}).fontes.map((f) => f[0]), ["natal-coi-1080p.mp4"]);
});
teste("4 núcleos → 720p", () => {
  assert.deepEqual(fundoNatalEscolherFonte({...desktop, nucleos: 4}).fontes.map((f) => f[0]), ["natal-coi-720p.mp4"]);
});
teste("4 GB de memória → 720p", () => {
  assert.deepEqual(fundoNatalEscolherFonte({...desktop, memoriaGB: 4}).fontes.map((f) => f[0]), ["natal-coi-720p.mp4"]);
});
teste("tela pequena → 720p", () => {
  assert.deepEqual(fundoNatalEscolherFonte({...desktop, ladoMaiorPx: 1366}).fontes.map((f) => f[0]), ["natal-coi-720p.mp4"]);
});
teste("capacidades desconhecidas (navegador não informa) → trata como desktop", () => {
  assert.equal(fundoNatalEscolherFonte({...desktop, nucleos: undefined, memoriaGB: undefined}).fontes[0][0], "natal-coi-1080p.webm");
});
teste("todos os arquivos referenciados existem em assets/natal/", () => {
  const nomes = ["natal-coi-1080p.webm", "natal-coi-1080p.mp4", "natal-coi-720p.mp4", "natal-coi-poster.jpg", "natal-coi-poster-720.jpg"];
  for (const n of nomes) assert.ok(fs.statSync(path.join(PASTA, n)).size > 0, n);
});

console.log(`\n${ok} testes ok`);
