/* Testes de regressão puros (sem framework, sem dependência nova) para
   js/scripts-campo/preenchimento-ss.js — Preenchimento de SS, quarto
   módulo reintegrado do backup scriptdebloqueioslinhaviva-v2. Só
   exercita ssMontarTexto (pura, sem DOM); ssGerarRelatorioWhats/
   ssGerarRelatorioPadrao/ssLimparRelatorio dependem de document real
   (getElementById, navigator.clipboard) e só são verificáveis
   manualmente no navegador — mesmo padrão já estabelecido em
   bloqueios.test.js/sinergia.test.js/desarme.test.js.

   Cobertura decidida pelos comportamentos REAIS encontrados no backup
   (não testes artificiais): duas variantes de formato (whats/padrao),
   a regra condicional de REF. ELÉTRICA, a regra condicional de ID (e
   sua diferença de espaçamento entre variantes), campos vazios,
   nenhum campo obrigatório bloqueando a geração, e a diferença exata
   de rótulo/whitespace entre as duas variantes.

   Roda com Node puro:
       node js/scripts-campo/preenchimento-ss.test.js
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const codigo = fs.readFileSync(path.join(__dirname, "preenchimento-ss.js"), "utf8");
const carregar = new Function("document", codigo + "\nreturn { ssMontarTexto };");
const { ssMontarTexto } = carregar({});

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

console.log("=== ssMontarTexto ===");

const dadosCompletos = {
  regional: "ARACAJU",
  abrangencia: "T1",
  equipe: "LINHA VIVA",
  acesso: "COM ACESSO",
  ref: "CF",
  num: "123",
  id: "9876",
  servico: "Troca de chave fusível",
  endereco: "Av. Central, 100",
  coord: "-10.9, -37.0",
  obs: "Sem observações",
};

// ---- 1. preenchimento completo (variante WhatsApp) ----
teste("formato 'whats': com todos os campos preenchidos, monta o texto exatamente no formato original", () => {
  const texto = ssMontarTexto(dadosCompletos, "whats");
  assert.equal(
    texto,
    `🧾 SS :
SERVIÇO: Troca de chave fusível
REGIONAL: ARACAJU
ABRANGÊNCIA: T1
EQUIPE: LINHA VIVA
ACESSO: COM ACESSO
REF. ELÉTRICA: CF 123
ID: 9876
ENDEREÇO: Av. Central, 100
COORDENADAS: -10.9, -37.0
OBS: Sem observações`
  );
});

// ---- 1. preenchimento completo (variante SS/Padrão) ----
teste("formato 'padrao': com todos os campos preenchidos, monta o texto exatamente no formato original", () => {
  const texto = ssMontarTexto(dadosCompletos, "padrao");
  assert.equal(
    texto,
    `- SERVIÇO: Troca de chave fusível
- REGIONAL: ARACAJU
- ABRANGÊNCIA: T1
- EQUIPE: LINHA VIVA
- ACESSO: COM ACESSO
- REF.ELÉTRICA: CF 123
- ID:9876
- ENDEREÇO: Av. Central, 100
- COORDENADAS: -10.9, -37.0
- OBS: Sem observações`
  );
});

// ---- 2. campos vazios ----
teste("formato 'whats': campos vazios/ausentes viram '-' em todas as linhas, sem travar", () => {
  const texto = ssMontarTexto({}, "whats");
  assert.equal(
    texto,
    `🧾 SS :
SERVIÇO: -
REGIONAL: -
ABRANGÊNCIA: -
EQUIPE: -
ACESSO: -
REF. ELÉTRICA: -
-
ENDEREÇO: -
COORDENADAS: -
OBS: -`
  );
});

teste("formato 'padrao': campos vazios viram '-' e a linha de ID vazio vira '- -' (prefixo + id vazio)", () => {
  const texto = ssMontarTexto({}, "padrao");
  assert.equal(
    texto,
    `- SERVIÇO: -
- REGIONAL: -
- ABRANGÊNCIA: -
- EQUIPE: -
- ACESSO: -
- REF.ELÉTRICA: -
- -
- ENDEREÇO: -
- COORDENADAS: -
- OBS: -`
  );
});

teste("chamar sem nenhum argumento (undefined) não quebra — mesmo resultado de {}", () => {
  assert.equal(ssMontarTexto(undefined, "whats"), ssMontarTexto({}, "whats"));
  assert.equal(ssMontarTexto(undefined, "padrao"), ssMontarTexto({}, "padrao"));
});

// ---- 3. campos obrigatórios: NENHUM no original — geração nunca é bloqueada ----
teste("nenhum campo é obrigatório (mesmo comportamento do original): geração funciona com objeto totalmente vazio", () => {
  assert.doesNotThrow(() => ssMontarTexto({}, "whats"));
  assert.doesNotThrow(() => ssMontarTexto({}, "padrao"));
});

// ---- 4. campos opcionais / preenchimento parcial ----
teste("preenchimento parcial: só os campos vazios viram '-', os preenchidos aparecem normalmente", () => {
  const texto = ssMontarTexto({ servico: "Poda de árvore", coord: "-10.9,-37.0" }, "whats");
  assert.match(texto, /SERVIÇO: Poda de árvore/);
  assert.match(texto, /COORDENADAS: -10\.9,-37\.0/);
  assert.match(texto, /REGIONAL: -/);
});

// ---- 5. e 6. regras condicionais + selects: REF. ELÉTRICA só monta se ref E num estiverem preenchidos ----
teste("REF. ELÉTRICA: monta '<ref> <num>' só quando AMBOS ref e num estão preenchidos", () => {
  assert.match(ssMontarTexto({ ref: "CF", num: "10" }, "whats"), /REF\. ELÉTRICA: CF 10/);
  assert.match(ssMontarTexto({ ref: "CF" }, "whats"), /REF\. ELÉTRICA: -/, "só ref, sem num, deveria virar '-'");
  assert.match(ssMontarTexto({ num: "10" }, "whats"), /REF\. ELÉTRICA: -/, "só num, sem ref, deveria virar '-'");
});

teste("selects com value curto (abrangencia/ref): o texto usa o CÓDIGO curto (ex: 'T1'), não o rótulo completo da option", () => {
  // reproduz o comportamento real do <select>: option value="T1" com texto visível
  // "T1 - ALIMENTADOR" faz .value devolver só "T1" — o gerador nunca viu o rótulo
  // completo, nem no original nem aqui.
  const texto = ssMontarTexto({ abrangencia: "T1", ref: "CF", num: "5" }, "whats");
  assert.match(texto, /ABRANGÊNCIA: T1\n/);
  assert.match(texto, /REF\. ELÉTRICA: CF 5/);
});

// ---- 5. regra condicional do ID, e sua diferença de espaçamento entre formatos ----
teste("ID (whats): 'ID: <valor>' com espaço após os dois-pontos quando preenchido", () => {
  assert.match(ssMontarTexto({ id: "42" }, "whats"), /\nID: 42\n/);
});

teste("ID (padrao): '- ID:<valor>' SEM espaço após os dois-pontos quando preenchido (diferença real do original)", () => {
  assert.match(ssMontarTexto({ id: "42" }, "padrao"), /\n- ID:42\n/);
});

teste("ID vazio: '-' na variante whats, '- -' na variante padrao (mesmo comportamento do original)", () => {
  assert.match(ssMontarTexto({}, "whats"), /\n-\n/);
  assert.match(ssMontarTexto({}, "padrao"), /\n- -\n/);
});

// ---- 9. formatação: diferenças exatas de rótulo entre os dois formatos ----
teste("rótulo de referência elétrica difere entre formatos: 'REF. ELÉTRICA' (whats) vs 'REF.ELÉTRICA' (padrao)", () => {
  assert.match(ssMontarTexto({}, "whats"), /REF\. ELÉTRICA:/);
  assert.match(ssMontarTexto({}, "padrao"), /REF\.ELÉTRICA:/);
  assert.doesNotMatch(ssMontarTexto({}, "padrao"), /REF\. ELÉTRICA:/);
});

teste("cabeçalho '🧾 SS :' só existe na variante whats; a variante padrao não tem cabeçalho", () => {
  assert.match(ssMontarTexto({}, "whats"), /^🧾 SS :\n/);
  assert.doesNotMatch(ssMontarTexto({}, "padrao"), /🧾 SS :/);
});

teste("variante padrao: toda linha começa com '- ' (mesmo comportamento do original)", () => {
  const linhas = ssMontarTexto(dadosCompletos, "padrao").split("\n");
  assert.equal(linhas.length, 10);
  linhas.forEach((linha) => {
    assert.ok(linha.startsWith("- "), `linha "${linha}" deveria começar com "- "`);
  });
});

// ---- 12. caso especial: formato desconhecido/ausente cai no comportamento "whats" (default do original) ----
teste("formato ausente ou desconhecido cai no formato 'whats' (única outra opção do original)", () => {
  assert.equal(ssMontarTexto(dadosCompletos), ssMontarTexto(dadosCompletos, "whats"));
  assert.equal(ssMontarTexto(dadosCompletos, "outracoisa"), ssMontarTexto(dadosCompletos, "whats"));
});

if (passou > 0) {
  console.log(`\n${passou} teste(s) passaram.`);
}
if (process.exitCode === 1) {
  console.error("\nALGUM TESTE FALHOU.");
  process.exit(1);
}
