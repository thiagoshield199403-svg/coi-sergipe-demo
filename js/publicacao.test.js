// Testes de PUBLICAÇÃO (GitHub Pages em /coi-sergipe-demo/). Rodar: node js/publicacao.test.js
// Evitam a repetição do incidente de 14/11/2026: HTML novo + CSS antigo em cache
// (Cache-Control: max-age=600) → ícones SVG sem tamanho, gigantes, e layout desmontado.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { versionar, referencias, hashDe } = require("../ferramentas/versionar-recursos.js");

const RAIZ = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8").replace(/\r\n/g, "\n");

let ok = 0;
function teste(nome, fn) {
  try { fn(); ok++; console.log("✓ " + nome); }
  catch (e) { console.error("✗ " + nome + "\n  " + e.message); process.exitCode = 1; }
}

teste("todo CSS/JS local do index.html tem ?v=<hash do conteúdo> EM DIA (rode ferramentas/versionar-recursos.js)", () => {
  const refs = referencias(html);
  assert.ok(refs.length >= 30, "referências encontradas: " + refs.length);
  refs.forEach(r => assert.equal(r.versao, hashDe(RAIZ, r.rel), r.rel));
  assert.equal(versionar(RAIZ, html), html);
});
teste("todo arquivo referenciado existe (sem 404 no Pages)", () => {
  referencias(html).forEach(r => assert.ok(fs.existsSync(path.join(RAIZ, r.rel)), r.rel));
});
teste("todo CSS de css/ e o styles.css estão carregados pelo index.html", () => {
  const usados = new Set(referencias(html).map(r => r.rel));
  ["styles.css", ...fs.readdirSync(path.join(RAIZ, "css")).filter(f => f.endsWith(".css")).map(f => "css/" + f)]
    .forEach(f => assert.ok(usados.has(f), f + " não é carregado"));
});
teste("nenhum caminho absoluto à raiz do domínio (o site vive em /coi-sergipe-demo/)", () => {
  const css = ["styles.css", ...fs.readdirSync(path.join(RAIZ, "css")).map(f => "css/" + f)];
  assert.ok(!/\b(?:href|src)="\/(?!\/)/.test(html), "index.html");
  css.forEach(f => assert.ok(!/url\(\s*["']?\/(?!\/)/.test(fs.readFileSync(path.join(RAIZ, f), "utf8")), f));
  fs.readdirSync(path.join(RAIZ, "js"), { recursive: true }).filter(f => /\.js$/.test(f) && !/\.test\.js$/.test(f)).forEach(f => {
    const src = fs.readFileSync(path.join(RAIZ, "js", f), "utf8");
    assert.ok(!/fetch\(\s*[`'"]\/(?!api\/)/.test(src), "js/" + f + " (só /api/ é permitido: é simulado por js/demo-backend.js)");
  });
});
teste("tamanho de segurança dos ícones: estilo inline no <head>, ANTES dos CSS, com especificidade zero", () => {
  const i = html.indexOf(':where(svg[viewBox="0 0 24 24"]:not([width])){width:1.25em;height:1.25em}');
  assert.ok(i > 0, "regra ausente");
  assert.ok(i < html.indexOf('<link rel="stylesheet" href="styles.css'), "deve vir antes do styles.css");
  assert.ok(i < html.indexOf("</head>"));
});
teste("fundo natalino publicado: foto aprovada presente e referenciada por caminho relativo", () => {
  const foto = path.join(RAIZ, "assets", "natal", "fundo-coi-natal.png");
  assert.ok(fs.existsSync(foto) && fs.statSync(foto).size > 500 * 1024);
  assert.ok(fs.readFileSync(path.join(RAIZ, "css", "fundo-natal.css"), "utf8").includes('url("../assets/natal/fundo-coi-natal.png")'));
  assert.ok(referencias(html).some(r => r.rel === "js/fundo-natal.js") && referencias(html).some(r => r.rel === "css/fundo-natal.css"));
});

console.log(`\n${ok} testes ok`);
