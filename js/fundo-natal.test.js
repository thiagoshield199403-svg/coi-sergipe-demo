/* Testes puros (sem framework, sem dependência nova) do fundo natalino (js/fundo-natal.js):
   dados das luzes, ritmo do pisca-pisca e presença da fotografia referenciada pelo CSS.

   Roda com Node puro:
       node js/fundo-natal.test.js
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {fundoNatalRitmo, FUNDO_NATAL_LUZES} = require("./fundo-natal.js");

const RAIZ = path.join(__dirname, "..");
let ok = 0;
function teste(nome, fn) {
  fn();
  ok++;
  console.log("✓ " + nome);
}

teste("todas as luzes têm posição dentro da foto (0–100%) e cor válida", () => {
  assert.ok(FUNDO_NATAL_LUZES.length > 0);
  for (const [x, y, cor] of FUNDO_NATAL_LUZES) {
    assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 100, `${x},${y}`);
    assert.ok(["r", "g", "z", "a", "b"].includes(cor), cor);
  }
});
teste("as cinco cores do pisca-pisca aparecem (vermelho, verde, azul, amarelo, branco quente)", () => {
  const cores = new Set(FUNDO_NATAL_LUZES.map((l) => l[2]));
  for (const c of ["r", "g", "z", "a", "b"]) assert.ok(cores.has(c), c);
});
teste("ritmo suave: duração entre 2,4 s e 5,6 s (sem estroboscópio)", () => {
  for (let i = 0; i < FUNDO_NATAL_LUZES.length; i++) {
    const r = fundoNatalRitmo(i);
    assert.ok(r.dur >= 2.4 && r.dur <= 5.6, String(r.dur));
    assert.ok(r.atraso <= 0 && -r.atraso <= r.dur, String(r.atraso));
    assert.ok(r.min >= 0.03 && r.min <= 0.12 && r.pico >= 0.9 && r.pico <= 1, `${r.min}/${r.pico}`);
  }
});
teste("luzes piscam em momentos diferentes (ritmos variados)", () => {
  const duracoes = new Set(FUNDO_NATAL_LUZES.map((_, i) => fundoNatalRitmo(i).dur));
  assert.ok(duracoes.size > FUNDO_NATAL_LUZES.length / 2);
});
teste("ritmo é determinístico (mesmo resultado a cada carga)", () => {
  assert.deepEqual(fundoNatalRitmo(7), fundoNatalRitmo(7));
});
teste("a fotografia referenciada pelo CSS existe", () => {
  const css = fs.readFileSync(path.join(RAIZ, "css", "fundo-natal.css"), "utf8");
  const m = css.match(/url\("\.\.\/(assets\/natal\/[^"]+)"\)/);
  assert.ok(m, "url() da foto no CSS");
  assert.equal(m[1], "assets/natal/fundo-coi-natal.png");
  assert.ok(fs.statSync(path.join(RAIZ, m[1])).size > 0);
});
teste("o fundo antigo (vídeo/pôster) não é mais referenciado", () => {
  for (const f of ["index.html", "css/fundo-natal.css", "js/fundo-natal.js"]) {
    const txt = fs.readFileSync(path.join(RAIZ, f), "utf8");
    assert.ok(!/natal-coi-|\.webm|\.mp4/.test(txt), f);
  }
});

console.log(`\n${ok} testes ok`);
