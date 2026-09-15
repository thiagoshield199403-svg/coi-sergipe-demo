/* Testes de regressão puros (sem framework, sem dependência nova) para
   js/scripts-campo/bloqueios.js — Bloqueio Linha Viva, primeiro módulo
   reintegrado do backup scriptdebloqueioslinhaviva-v2. Só exercita
   blvMontarTexto (pura, sem DOM/Leaflet/fetch); blvGerarRelatorio/
   blvLimparRelatorio dependem de document real (getElementById,
   navigator.clipboard) e só são verificáveis manualmente no navegador —
   mesmo padrão já estabelecido em js/mapa.test.js/js/mapas-regionais.test.js.

   Roda com Node puro:
       node js/scripts-campo/bloqueios.test.js
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function fakeEl() {
  return { addEventListener() {}, appendChild() {}, querySelectorAll() { return []; }, value: "", style: {} };
}
const fakeDocument = { getElementById: () => fakeEl(), querySelectorAll() { return []; } };

// bloqueios.js é script clássico (sem module/export, carregado via
// <script src> no navegador). Mesma técnica dos demais testes deste
// projeto: executa dentro de uma função real e devolve só o que é puro.
const codigo = fs.readFileSync(path.join(__dirname, "bloqueios.js"), "utf8");
const carregar = new Function("document", codigo + "\nreturn { blvMontarTexto };");
const { blvMontarTexto } = carregar(fakeDocument);

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

console.log("=== blvMontarTexto ===");

teste("com todos os campos preenchidos, monta o texto exatamente no formato original", () => {
  const texto = blvMontarTexto({
    responsavel: "João",
    equipe: "arj-ps01",
    contato: "79999999999",
    viatura: "VTR-12",
    radio: "Sim",
    testeRadio: "Sim",
    referencia: "Poste 123",
    tipoCondutor: "336",
    maresia: "Não",
    selfhealing: "Sim",
    desativou: "Não",
    servico: "Poda",
    obs: "Sem observações",
  });

  assert.equal(
    texto,
    `-Responsável: João
-Equipe: ARJ-PS01
-Contato: 79999999999
-Viatura: VTR-12
-Rádio: Sim
-Teste Rádio: Sim
-Ref.Elétrica: Poste 123
-Tipo Condutor: 336
-Área de maresia?: Não
-Self/Healing: Sim
-Desativou Self/Healing? Não
-serviço: Poda
-OBS: Sem observações`
  );
});

teste("equipe é sempre convertida pra maiúsculas (mesma regra do original)", () => {
  const texto = blvMontarTexto({ equipe: "aju-ps02" });
  assert.match(texto, /-Equipe: AJU-PS02/);
});

teste("campo vazio/ausente vira '-' (mesmo comportamento do original — nunca inventa valor)", () => {
  const texto = blvMontarTexto({});
  assert.match(texto, /-Responsável: -/);
  assert.match(texto, /-Equipe: -/);
  assert.match(texto, /-Contato: -/);
  assert.match(texto, /-Viatura: -/);
  assert.match(texto, /-Rádio: -/);
  assert.match(texto, /-Teste Rádio: -/);
  assert.match(texto, /-Ref\.Elétrica: -/);
  assert.match(texto, /-Tipo Condutor: -/);
  assert.match(texto, /-Área de maresia\?: -/);
  assert.match(texto, /-Self\/Healing: -/);
  assert.match(texto, /-Desativou Self\/Healing\? -/);
  assert.match(texto, /-serviço: -/);
  assert.match(texto, /-OBS: -/);
});

teste("chamar sem nenhum argumento (undefined) não quebra — mesmo resultado de {}", () => {
  assert.equal(blvMontarTexto(undefined), blvMontarTexto({}));
});

teste("preenchimento parcial: só os campos vazios viram '-', os preenchidos aparecem normalmente", () => {
  const texto = blvMontarTexto({ responsavel: "Maria", viatura: "VTR-05" });
  assert.match(texto, /-Responsável: Maria/);
  assert.match(texto, /-Viatura: VTR-05/);
  assert.match(texto, /-Equipe: -/);
  assert.match(texto, /-Contato: -/);
});

teste("mantém exatamente as 13 linhas do relatório, na mesma ordem/rótulo do original", () => {
  const texto = blvMontarTexto({});
  const linhas = texto.split("\n");
  assert.equal(linhas.length, 13);
  // startsWith (não split por ":") porque a linha "Desativou Self/Healing"
  // usa "?" em vez de ":" no original — mesma pontuação, preservada aqui.
  const prefixosEsperados = [
    "-Responsável:", "-Equipe:", "-Contato:", "-Viatura:", "-Rádio:",
    "-Teste Rádio:", "-Ref.Elétrica:", "-Tipo Condutor:", "-Área de maresia?:",
    "-Self/Healing:", "-Desativou Self/Healing?", "-serviço:", "-OBS:",
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
