/* Testes de regressão puros (sem framework, sem dependência nova) para
   js/scripts-campo/substituicao-transformador.js — Substituição de
   Transformador, sexto e último módulo reintegrado do backup
   scriptdebloqueioslinhaviva-v2. Exercita tfMontarTexto,
   tfObrigatoriosCondicionais e tfCamposObrigatoriosFaltando (puras,
   sem DOM); tfGerarRelatorioWhats/tfGerarRelatorioSS/tfLimparRelatorio/
   tfAplicarRegrasMotivo dependem de document real e só são
   verificáveis manualmente no navegador — mesmo padrão dos 5 módulos
   anteriores.

   Cobertura decidida pelos comportamentos REAIS encontrados no backup:
   duas variantes de formato geradas pela MESMA função (parametrizada),
   a regra condicional de obrigatórios por Motivo (a mais importante do
   módulo — testada individualmente pros 5 motivos reais + vazio), os
   6 campos obrigatórios fixos, e a ausência de fallback "-" (mesma
   função v() do Substituição de Poste).

   Roda com Node puro:
       node js/scripts-campo/substituicao-transformador.test.js
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function fakeEl() {
  return { addEventListener() {}, style: {} };
}
const fakeDocument = { getElementById: () => fakeEl() };

const codigo = fs.readFileSync(path.join(__dirname, "substituicao-transformador.js"), "utf8");
const carregar = new Function(
  "document",
  codigo + "\nreturn { tfMontarTexto, tfObrigatoriosCondicionais, tfCamposObrigatoriosFaltando };"
);
const { tfMontarTexto, tfObrigatoriosCondicionais, tfCamposObrigatoriosFaltando } = carregar(fakeDocument);

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

console.log("=== tfMontarTexto ===");

const dadosCompletos = {
  operador: "João", ocorrencia: "12345", trafo: "TR-01", id: "T-999",
  motivo: "Sobrecarga", causa: "Queimado por sobrecarga",
  regional: "ARACAJU", cidade: "Centro", endereco: "Rua A, 100",
  referencia: "Praça principal", coord: "-10.9, -37.0", acesso: "BOM",
  classe: "Trifásico", potencia: "75 kVA", proprietario: "Companhia",
  tensaoSec: "127/220v", carregamento: "120%", totalClientes: "45",
  corrosao: "NÃO", clientesDes: "SIM", totalDes: "10", transferido: "SIM",
  bitolaMt: "336", glv: "SIM", glvExtraido: "NÃO", aterramento: "SIM",
  prBt: "NÃO", prMt: "SIM", materiais: "1 trafo 75kVA, conectores",
  obs: "Sem observações",
};

// ---- 1. preenchimento completo (whats) ----
teste("formato 'whats': com todos os campos preenchidos, monta o texto exatamente no formato original", () => {
  const texto = tfMontarTexto(dadosCompletos, "whats");
  assert.equal(
    texto,
    `⚡ Substituição de Transformador

👨‍💻 *Operador:* João
*Ocorrência:* 12345
*Nº Trafo:* TR-01
*ID:* T-999

⚠️ *Motivo:* Sobrecarga
📌 *Causa:* Queimado por sobrecarga

📍 *Localização*
- Regional: ARACAJU
- Cidade/Povoado: Centro
- Endereço: Rua A, 100
- Referência: Praça principal
- Coordenadas: -10.9, -37.0
- Acesso Caminhão: BOM

🔧 *Dados do Transformador*
- Classe: Trifásico
- Potência: 75 kVA
- Proprietário: Companhia
- Tensão Sec: 127/220v
- Carregamento: 120%
- Corrosão Atmosférica: NÃO
- Aterramento: SIM
- PRBT: NÃO
- PRMT: SIM

👥 *Clientes*
- Total: 45
- Desenergizados: SIM
- Total Desenergizados: 10
- Circuito Transferido: SIM

🛢️ *Rede*
- Bitola MT: 336
- GLV: SIM
- GLV Extraído: NÃO

📦 Materiais:
1 trafo 75kVA, conectores

📝 Observações:
Sem observações`
  );
});

// ---- 1. preenchimento completo (ss) — confirma rótulos e ausência de linhas em branco ----
teste("formato 'ss': mesmos dados, rótulos DIFERENTES do whats, todas as linhas com prefixo '- ', sem linhas em branco", () => {
  const texto = tfMontarTexto(dadosCompletos, "ss");
  assert.equal(
    texto,
    `- Operador: João
- Ocorrência: 12345
- N° Transformador: TR-01
- ID: T-999
- Motivo: Sobrecarga
- Causa: Queimado por sobrecarga
- Regional: ARACAJU
- Cidade: Centro
- Endereço: Rua A, 100
- Referência: Praça principal
- Coordenadas: -10.9, -37.0
- Acesso: BOM
- Classe: Trifásico
- Potência: 75 kVA
- Proprietário: Companhia
- Tensão: 127/220v
- Carregamento: 120%
- Corrosão: NÃO
- Aterramento: SIM
- PRBT: NÃO
- PRMT: SIM
- Clientes Totais: 45
- Desenergizados: SIM
- Total Desenergizados: 10
- Circuito Transferido: SIM
- Bitola MT: 336
- GLV: SIM
- GLV Extraído: NÃO
- Materiais: 1 trafo 75kVA, conectores
- Observações: Sem observações`
  );
});

// ---- 2. campos vazios: sem fallback "-" ----
teste("campos totalmente vazios (whats): NÃO usa '-' como placeholder, usa string vazia", () => {
  const texto = tfMontarTexto({}, "whats");
  assert.match(texto, /\*Operador:\* \n/);
  assert.doesNotMatch(texto, /Operador:\* -/);
  assert.match(texto, /📦 Materiais:\n\n/);
});

teste("campos totalmente vazios (ss): toda linha ainda aparece com '- Rótulo: ' (branch 'linha vazia' nunca é alcançado, preservado do original)", () => {
  const texto = tfMontarTexto({}, "ss");
  const linhas = texto.split("\n");
  assert.equal(linhas.length, 30, "as 30 linhas devem aparecer mesmo com tudo vazio");
  linhas.forEach((linha) => {
    assert.ok(linha.startsWith("- "), `linha "${linha}" deveria começar com "- ", mesmo vazia`);
  });
});

teste("chamar sem nenhum argumento (undefined) não quebra — mesmo resultado de {}", () => {
  assert.equal(tfMontarTexto(undefined, "whats"), tfMontarTexto({}, "whats"));
  assert.equal(tfMontarTexto(undefined, "ss"), tfMontarTexto({}, "ss"));
});

teste("valores com espaços nas pontas são aparados (trim), mesmo comportamento de v() (.trim())", () => {
  const texto = tfMontarTexto({ operador: "  Maria  " }, "whats");
  assert.match(texto, /\*Operador:\* Maria\n/);
});

teste("formato ausente ou desconhecido cai no formato 'whats' (única outra opção do original)", () => {
  assert.equal(tfMontarTexto(dadosCompletos), tfMontarTexto(dadosCompletos, "whats"));
  assert.equal(tfMontarTexto(dadosCompletos, "outracoisa"), tfMontarTexto(dadosCompletos, "whats"));
});

console.log("\n=== tfObrigatoriosCondicionais (regra do MOTIVO — a mais importante do módulo) ===");

// ---- 3, 4 e 5. cada motivo de substituição relevante + regra de Sobrecarga ----
teste("Motivo = Sobrecarga: exige Carregamento (tf_carregamento)", () => {
  assert.deepEqual(tfObrigatoriosCondicionais("Sobrecarga"), ["tf_carregamento"]);
});

teste("Motivo = Falta de fase: exige Carregamento também (mesma regra de Sobrecarga)", () => {
  assert.deepEqual(tfObrigatoriosCondicionais("Falta de fase"), ["tf_carregamento"]);
});

teste("Motivo = Vazamento de óleo: exige GLV e GLV Extraído (dois campos)", () => {
  assert.deepEqual(tfObrigatoriosCondicionais("Vazamento de óleo"), ["tf_glv", "tf_glv_extraido"]);
});

teste("Motivo = Furto: exige Clientes Desenergizados (tf_clientes_des)", () => {
  assert.deepEqual(tfObrigatoriosCondicionais("Furto"), ["tf_clientes_des"]);
});

teste("Motivo = Trafo queimado: NENHUM campo extra obrigatório (único motivo real sem regra condicional)", () => {
  assert.deepEqual(tfObrigatoriosCondicionais("Trafo queimado"), []);
});

teste("Motivo vazio/não selecionado: NENHUM campo extra obrigatório", () => {
  assert.deepEqual(tfObrigatoriosCondicionais(""), []);
  assert.deepEqual(tfObrigatoriosCondicionais(undefined), []);
});

teste("Motivo com espaços nas pontas ainda casa a regra (trim aplicado antes da comparação)", () => {
  assert.deepEqual(tfObrigatoriosCondicionais("  Sobrecarga  "), ["tf_carregamento"]);
});

console.log("\n=== tfCamposObrigatoriosFaltando ===");

// ---- 6. campos obrigatórios (fixos) ----
teste("com os 6 obrigatórios fixos preenchidos, não falta nada", () => {
  const faltando = tfCamposObrigatoriosFaltando({
    operador: "João", ocorrencia: "1", trafo: "T1", id: "ID1", motivo: "Furto", causa: "X",
  });
  assert.deepEqual(faltando, []);
});

teste("objeto vazio: faltam exatamente os 6 obrigatórios, na ordem do original (TF_OBRIGATORIOS_BASE)", () => {
  const faltando = tfCamposObrigatoriosFaltando({});
  assert.deepEqual(faltando, ["operador", "ocorrencia", "trafo", "id", "motivo", "causa"]);
});

teste("falta só 'causa' (obrigatório fixo, mesmo sem regra condicional própria): retorna só ele", () => {
  const faltando = tfCamposObrigatoriosFaltando({
    operador: "João", ocorrencia: "1", trafo: "T1", id: "ID1", motivo: "Furto", causa: "",
  });
  assert.deepEqual(faltando, ["causa"]);
});

teste("campos NÃO obrigatórios (ex: regional, potencia, materiais) vazios não entram na lista de faltantes", () => {
  const faltando = tfCamposObrigatoriosFaltando({
    operador: "João", ocorrencia: "1", trafo: "T1", id: "ID1", motivo: "Furto", causa: "X",
    regional: "", potencia: "", materiais: "",
  });
  assert.deepEqual(faltando, []);
});

if (passou > 0) {
  console.log(`\n${passou} teste(s) passaram.`);
}
if (process.exitCode === 1) {
  console.error("\nALGUM TESTE FALHOU.");
  process.exit(1);
}
