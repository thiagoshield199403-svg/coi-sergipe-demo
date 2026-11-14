#!/usr/bin/env node
/* VERSIONAMENTO DE RECURSOS (cache-busting) — rodar ANTES de cada publicação.
   O GitHub Pages serve CSS/JS com cache de 10 min (Cache-Control: max-age=600) e o
   index.html referenciava "styles.css", "js/x.js" sem versão: logo após publicar, o
   navegador podia combinar o HTML NOVO com CSS ANTIGO em cache (ícones SVG sem
   tamanho → gigantes, cabeçalho desmontado). Aqui cada referência local de CSS/JS do
   index.html ganha "?v=<hash do conteúdo>": mudou o arquivo, muda a URL, e o
   navegador é obrigado a buscar a versão nova. Arquivo que não mudou mantém a URL
   (continua aproveitando o cache).

   Uso:  node ferramentas/versionar-recursos.js          (atualiza o index.html)
         node ferramentas/versionar-recursos.js --check  (só confere; sai com erro se desatualizado) */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const RAIZ = path.join(__dirname, "..");
// href/src de arquivo LOCAL .css/.js (sem protocolo, sem barra inicial), com ou sem ?v= anterior
const REF = /(\b(?:href|src)=")((?![a-z]+:|\/)[^"?#]+\.(?:css|js))(?:\?v=[0-9a-f]*)?(")/g;

/** Hash curto do conteúdo (fins de linha normalizados: igual no Windows e no servidor). */
function hashDe(raiz, rel) {
  const txt = fs.readFileSync(path.join(raiz, rel), "utf8").replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(txt).digest("hex").slice(0, 10);
}

/** Devolve o index.html com todas as referências locais versionadas. Função pura sobre os arquivos. */
function versionar(raiz, html) {
  return html.replace(REF, (_, ini, rel, fim) => ini + rel + "?v=" + hashDe(raiz, rel) + fim);
}

/** Lista de referências locais { rel, versao } presentes no html. */
function referencias(html) {
  const re = /\b(?:href|src)="((?![a-z]+:|\/)[^"?#]+\.(?:css|js))(?:\?v=([0-9a-f]*))?"/g;
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push({ rel: m[1], versao: m[2] || null });
  return out;
}

if (require.main === module) {
  const arq = path.join(RAIZ, "index.html");
  const bruto = fs.readFileSync(arq, "utf8");
  const crlf = bruto.includes("\r\n");
  const html = bruto.replace(/\r\n/g, "\n");
  const novo = versionar(RAIZ, html);
  if (process.argv.includes("--check")) {
    if (novo !== html) { console.error("index.html com versões desatualizadas — rode: node ferramentas/versionar-recursos.js"); process.exit(1); }
    console.log("ok: versões em dia (" + referencias(html).length + " referências)");
  } else {
    fs.writeFileSync(arq, crlf ? novo.replace(/\n/g, "\r\n") : novo);
    console.log("ok: " + referencias(novo).length + " referências versionadas");
  }
}
module.exports = { versionar, referencias, hashDe };
