/* Testes de regressão puros (sem framework, sem dependência nova) para
   js/scripts-campo/sinergia.js — Script Mais Sinergia, segundo módulo
   reintegrado do backup scriptdebloqueioslinhaviva-v2. Só exercita
   sgMontarTexto (pura, sem DOM); sgGerarRelatorio/sgLimparRelatorio
   dependem de document real (getElementById, navigator.clipboard) e só
   são verificáveis manualmente no navegador — mesmo padrão já
   estabelecido em js/scripts-campo/bloqueios.test.js.

   Roda com Node puro:
       node js/scripts-campo/sinergia.test.js
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function fakeEl() {
  return { addEventListener() {}, appendChild() {}, querySelectorAll() { return []; }, value: "", style: {} };
}
const fakeDocument = { getElementById: () => fakeEl(), querySelectorAll() { return []; } };

// sinergia.js é script clássico (sem module/export, carregado via
// <script src> no navegador). Mesma técnica dos demais testes deste
// projeto: executa dentro de uma função real e devolve só o que é puro.
const codigo = fs.readFileSync(path.join(__dirname, "sinergia.js"), "utf8");
const carregar = new Function("document", codigo + "\nreturn { sgMontarTexto };");
const { sgMontarTexto } = carregar(fakeDocument);

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

console.log("=== sgMontarTexto ===");

teste("com todos os campos preenchidos, monta o texto exatamente no formato original", () => {
  const texto = sgMontarTexto({
    rd: "001013587",
    tpbt: "TP",
    ramal: "OK",
    dps: "ÍNTEGRO",
    tensaoCa: "OK",
    disj: "SIM",
    alarme: "NÃO",
    bateria: "12.4",
    painel: "FUNCIONANDO",
    modem: "LIGADO",
    antena: "INSTALADA",
    curto: "NÃO",
    tanque: "OK",
    cubiculo: "OK",
    cordao: "OK",
  });

  assert.equal(
    texto,
    `RD 001013587
TP/BT: TP
Ramal/Conexões: OK
DPS: ÍNTEGRO
Tensão CA no disjuntor: OK
Disjuntor armado: SIM
Alarme bateria antes da perda: NÃO
Tensão bateria: 12.4V
Painel religador: FUNCIONANDO
Modem/Rádio: LIGADO
Antena: INSTALADA
Sinais de curto: NÃO
Tanque: OK
Cubículo: OK
Cordão umbilical: OK`
  );
});

teste("RD vazio vira 'RD -' (regra especial: sem RD nao ganha ':', mesma do original)", () => {
  const texto = sgMontarTexto({});
  assert.match(texto, /^RD -\n/);
});

teste("RD preenchido vira 'RD <valor>' sem dois-pontos", () => {
  const texto = sgMontarTexto({ rd: "12345" });
  assert.match(texto, /^RD 12345\n/);
});

teste("tensão da bateria vazia vira '-' (nao '0V' nem 'V' sozinho)", () => {
  const texto = sgMontarTexto({});
  assert.match(texto, /Tensão bateria: -\n/);
});

teste("tensão da bateria preenchida ganha sufixo 'V'", () => {
  const texto = sgMontarTexto({ bateria: "13.2" });
  assert.match(texto, /Tensão bateria: 13\.2V\n/);
});

teste("demais campos vazios/ausentes viram '-' (mesmo comportamento do original — nunca inventa valor)", () => {
  const texto = sgMontarTexto({});
  assert.match(texto, /TP\/BT: -/);
  assert.match(texto, /Ramal\/Conexões: -/);
  assert.match(texto, /DPS: -/);
  assert.match(texto, /Tensão CA no disjuntor: -/);
  assert.match(texto, /Disjuntor armado: -/);
  assert.match(texto, /Alarme bateria antes da perda: -/);
  assert.match(texto, /Painel religador: -/);
  assert.match(texto, /Modem\/Rádio: -/);
  assert.match(texto, /Antena: -/);
  assert.match(texto, /Sinais de curto: -/);
  assert.match(texto, /Tanque: -/);
  assert.match(texto, /Cubículo: -/);
  assert.match(texto, /Cordão umbilical: -/);
});

teste("chamar sem nenhum argumento (undefined) não quebra — mesmo resultado de {}", () => {
  assert.equal(sgMontarTexto(undefined), sgMontarTexto({}));
});

teste("preenchimento parcial: só os campos vazios viram '-', os preenchidos aparecem normalmente", () => {
  const texto = sgMontarTexto({ tpbt: "BT", tanque: "DETERIORADO" });
  assert.match(texto, /TP\/BT: BT/);
  assert.match(texto, /Tanque: DETERIORADO/);
  assert.match(texto, /DPS: -/);
});

teste("mantém exatamente as 15 linhas do relatório, na mesma ordem/rótulo do original", () => {
  const texto = sgMontarTexto({});
  const linhas = texto.split("\n");
  assert.equal(linhas.length, 15);
  const prefixosEsperados = [
    "RD -", "TP/BT:", "Ramal/Conexões:", "DPS:", "Tensão CA no disjuntor:",
    "Disjuntor armado:", "Alarme bateria antes da perda:", "Tensão bateria:",
    "Painel religador:", "Modem/Rádio:", "Antena:", "Sinais de curto:",
    "Tanque:", "Cubículo:", "Cordão umbilical:",
  ];
  prefixosEsperados.forEach((prefixo, i) => {
    assert.ok(linhas[i].startsWith(prefixo), `linha ${i + 1} deveria começar com "${prefixo}", veio "${linhas[i]}"`);
  });
});

if (passou > 0) {
  console.log(`\n${passou} teste(s) passaram.`);
}
if (process.exitCode === 1) {
  console.error("\nALGUM TESTE FALHOU.");
  process.exit(1);
}
