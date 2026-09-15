/* Testes de regressão puros (sem framework, sem dependência nova) para
   js/scripts-campo/substituicao-poste.js — Substituição de Poste,
   quinto módulo reintegrado do backup scriptdebloqueioslinhaviva-v2.
   Exercita spMontarTexto e spCamposObrigatoriosFaltando (puras, sem
   DOM); spGerarRelatorioWhats/spGerarRelatorioSS/spLimparRelatorio/
   spAplicarRegraTipoPoste/spAplicarRegraVeiculo dependem de document
   real e só são verificáveis manualmente no navegador — mesmo padrão
   já estabelecido nos quatro módulos anteriores.

   Cobertura decidida pelos comportamentos REAIS encontrados no backup
   (não testes artificiais): duas variantes de formato com ORDEM de
   campos diferente entre elas, a regra condicional de Tipo de Poste
   (MT/BT/BT-MT/vazio) sobre as seções de rede, a regra condicional de
   "Causado por veículo" sobre o bloco de acidente, a concatenação
   incondicional de Chave/Empresa, os 5 campos obrigatórios, e a
   ausência de fallback "-" (usa string vazia, diferente dos outros
   quatro módulos).

   Roda com Node puro:
       node js/scripts-campo/substituicao-poste.test.js
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function fakeEl() {
  return { addEventListener() {}, style: {} };
}
const fakeDocument = { getElementById: () => fakeEl() };

const codigo = fs.readFileSync(path.join(__dirname, "substituicao-poste.js"), "utf8");
const carregar = new Function(
  "document",
  codigo + "\nreturn { spMontarTexto, spCamposObrigatoriosFaltando };"
);
const { spMontarTexto, spCamposObrigatoriosFaltando } = carregar(fakeDocument);

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

console.log("=== spMontarTexto ===");

const dadosCompletosMt = {
  operador: "João",
  ocorrencia: "12345",
  idPoste: "PST-001",
  tipoPoste: "POSTE MT",
  causa: "Quebrado",
  regional: "ARACAJU",
  bairro: "Centro",
  referencia: "Praça principal",
  coord: "-10.9, -37.0",
  altura: "Duplo T / 11m / Médio",
  chaveRef: "CF",
  numChave: "42",
  acesso: "BOM",
  cordoalha: "SIM",
  estMt: "Beco",
  redeMt: "Convencional",
  bitolaMt: "336",
  estBt: "-",
  redeBt: "-",
  bitolaBt: "-",
  veiculo: "NÃO",
  materiais: "3 postes, cruzeta",
  obsGerais: "Sem observações",
};

// ---- 1. preenchimento completo (whats, tipo MT) ----
teste("formato 'whats': tipo POSTE MT — mostra só a seção Rede MT, oculta Rede BT", () => {
  const texto = spMontarTexto(dadosCompletosMt, "whats");
  assert.equal(
    texto,
    `🛠️ *SUBSTITUIÇÃO DE POSTE*

👤 Operador: João
📄 N° Incidente: 12345
🏷️ ID Poste: PST-001
⚡ Tipo: POSTE MT
Causa: Quebrado

📍 Regional: ARACAJU
Cidade/Bairro/Povoado: Centro
📌 Ponto Referência: Praça principal
🧭 Coordenadas: -10.9, -37.0

Tipo/Altura/Esforço: Duplo T / 11m / Médio
Chave Ref: CF 42
🚛 Acesso Caminhão: BOM
Cordoalha Telemar: SIM

--- REDE MT ---
Estrutura MT: Beco
Rede MT: Convencional
Bitola MT: 336

🚗 Causado por veículo: NÃO
🧰 Materiais: 3 postes, cruzeta
📝 Observações: Sem observações`
  );
});

// ---- 1. preenchimento completo (ss, tipo MT) — confirma ORDEM diferente do whats ----
teste("formato 'ss': tipo POSTE MT — mesmos dados, rótulos e ORDEM diferentes do whats (Acesso/Cordoalha antes de Regional)", () => {
  const texto = spMontarTexto(dadosCompletosMt, "ss");
  assert.equal(
    texto,
    `#SUBSTITUIÇÃO DE POSTE

- Operador: João
- N° Incidente: 12345
- ID: PST-001
- Tipo: POSTE MT
- Causa: Quebrado
- Acesso: BOM
- Cordoalha Telemar: SIM
- Regional: ARACAJU
- Cidade/Bairro/Povoado: Centro
- Ponto Referência: Praça principal
- Coordenadas: -10.9, -37.0
- Tipo/Altura/Esforço: Duplo T / 11m / Médio
- Chave: CF 42
- Estrutura MT: Beco
- Rede MT: Convencional
- Bitola MT: 336
- Causado por Veículo: NÃO
- Materiais: 3 postes, cruzeta
- Observações: Sem observações`
  );
});

// ---- 4. cada tipo de poste relevante (regra condicional das seções de rede) ----
teste("tipo POSTE BT: oculta a seção Rede MT, mostra só Rede BT", () => {
  const texto = spMontarTexto({ tipoPoste: "POSTE BT", estBt: "Simples", redeBt: "Multiplex", bitolaBt: "4 AWG" }, "whats");
  assert.doesNotMatch(texto, /--- REDE MT ---/);
  assert.match(texto, /--- REDE BT ---\nEstrutura BT: Simples\nRede BT: Multiplex\nBitola BT: 4 AWG/);
});

teste("tipo POSTE MT: oculta a seção Rede BT, mostra só Rede MT", () => {
  const texto = spMontarTexto({ tipoPoste: "POSTE MT", estMt: "Beco", redeMt: "Compacta", bitolaMt: "2/0" }, "whats");
  assert.doesNotMatch(texto, /--- REDE BT ---/);
  assert.match(texto, /--- REDE MT ---\nEstrutura MT: Beco\nRede MT: Compacta\nBitola MT: 2\/0/);
});

teste("tipo POSTE BT/MT: mostra AMBAS as seções (comparação por desigualdade, não por igualdade)", () => {
  const texto = spMontarTexto({ tipoPoste: "POSTE BT/MT" }, "whats");
  assert.match(texto, /--- REDE MT ---/);
  assert.match(texto, /--- REDE BT ---/);
});

teste("tipo vazio/não selecionado: mostra AMBAS as seções (mesmo comportamento do 'else' original)", () => {
  const texto = spMontarTexto({ tipoPoste: "" }, "whats");
  assert.match(texto, /--- REDE MT ---/);
  assert.match(texto, /--- REDE BT ---/);
});

teste("formato 'ss' segue a mesma regra condicional de tipo (sem os separadores '--- REDE ---', que só existem no whats)", () => {
  const textoBt = spMontarTexto({ tipoPoste: "POSTE BT", estBt: "X" }, "ss");
  assert.doesNotMatch(textoBt, /Estrutura MT:/);
  assert.match(textoBt, /Estrutura BT: X/);
  assert.doesNotMatch(textoBt, /---/, "variante ss não usa os separadores '--- REDE ... ---'");
});

// ---- 3. e 4. regra condicional de "Causado por veículo" ----
teste("Causado por veículo = SIM: mostra o bloco inteiro de 11 campos do acidente (whats)", () => {
  const texto = spMontarTexto({
    veiculo: "SIM", policia: "SIM", vitima: "NÃO", fotoPlaca: "SIM", doc: "SIM",
    end: "SIM", danos: "SIM", camera: "NÃO", medidor: "12345", veiculoDesc: "Gol branco",
    empresa: "NÃO", qual: "", obsCondutor: "Condutor evadiu",
  }, "whats");
  assert.match(texto, /Polícia\/SAMU: SIM/);
  assert.match(texto, /Vítima: NÃO/);
  assert.match(texto, /Medidor UC: 12345/);
  assert.match(texto, /Empresa: NÃO \n/, "Empresa e Qual sempre concatenam com espaço, mesmo com Qual vazio");
  assert.match(texto, /Obs Condutor: Condutor evadiu/);
});

teste("Causado por veículo = NÃO: oculta totalmente o bloco de acidente (whats e ss)", () => {
  const textoWhats = spMontarTexto({ veiculo: "NÃO", policia: "SIM" }, "whats");
  assert.doesNotMatch(textoWhats, /Polícia\/SAMU:/);
  const textoSs = spMontarTexto({ veiculo: "NÃO", policia: "SIM" }, "ss");
  assert.doesNotMatch(textoSs, /- Polícia:/);
});

teste("Causado por veículo vazio (não respondido): oculta o bloco (só 'SIM' exato mostra, mesma comparação estrita do original)", () => {
  const texto = spMontarTexto({ veiculo: "" }, "whats");
  assert.doesNotMatch(texto, /Polícia\/SAMU:/);
});

teste("rótulos do bloco de acidente diferem entre formatos (ex: 'Doc condutor' whats vs 'Documento Condutor' ss)", () => {
  const dados = { veiculo: "SIM", doc: "SIM", end: "SIM" };
  assert.match(spMontarTexto(dados, "whats"), /Doc condutor: SIM/);
  assert.match(spMontarTexto(dados, "whats"), /End\/Telefone: SIM/);
  assert.match(spMontarTexto(dados, "ss"), /Documento Condutor: SIM/);
  assert.match(spMontarTexto(dados, "ss"), /Endereço\/Telefone: SIM/);
});

// ---- concatenação incondicional (Chave Ref/Chave, Empresa) ----
teste("Chave Ref/Chave: SEMPRE concatena ref+num com espaço, mesmo com um dos dois vazio (sem condição, diferente do Preenchimento de SS)", () => {
  assert.match(spMontarTexto({ chaveRef: "CF", numChave: "" }, "whats"), /Chave Ref: CF \n/);
  assert.match(spMontarTexto({ chaveRef: "", numChave: "10" }, "whats"), /Chave Ref:  10\n/);
  assert.match(spMontarTexto({ chaveRef: "", numChave: "" }, "ss"), /- Chave:  \n/);
});

// ---- 2. campos vazios: sem fallback "-", usa string vazia (diferente dos outros 4 módulos) ----
teste("campos totalmente vazios: NÃO usa '-' como placeholder, usa string vazia (mesmo comportamento de v() no original)", () => {
  const texto = spMontarTexto({}, "whats");
  assert.match(texto, /👤 Operador: \n/);
  assert.doesNotMatch(texto, /Operador: -/);
  assert.match(texto, /🧰 Materiais: \n/);
});

teste("chamar sem nenhum argumento (undefined) não quebra — mesmo resultado de {}", () => {
  assert.equal(spMontarTexto(undefined, "whats"), spMontarTexto({}, "whats"));
  assert.equal(spMontarTexto(undefined, "ss"), spMontarTexto({}, "ss"));
});

teste("valores com espaços nas pontas são aparados (trim), mesmo comportamento de v() (.trim())", () => {
  const texto = spMontarTexto({ operador: "  Maria  " }, "whats");
  assert.match(texto, /Operador: Maria\n/);
});

teste("formato ausente ou desconhecido cai no formato 'whats' (única outra opção do original)", () => {
  assert.equal(spMontarTexto(dadosCompletosMt), spMontarTexto(dadosCompletosMt, "whats"));
  assert.equal(spMontarTexto(dadosCompletosMt, "outracoisa"), spMontarTexto(dadosCompletosMt, "whats"));
});

console.log("\n=== spCamposObrigatoriosFaltando ===");

// ---- 3. campos obrigatórios ----
teste("com os 5 obrigatórios preenchidos, não falta nada", () => {
  const faltando = spCamposObrigatoriosFaltando({
    operador: "João", ocorrencia: "1", tipoPoste: "POSTE MT", idPoste: "PST-1", altura: "11m",
  });
  assert.deepEqual(faltando, []);
});

teste("objeto vazio: faltam exatamente os 5 obrigatórios, na ordem do original (SP_OBRIGATORIOS_BASE)", () => {
  const faltando = spCamposObrigatoriosFaltando({});
  assert.deepEqual(faltando, ["operador", "ocorrencia", "tipoPoste", "idPoste", "altura"]);
});

teste("falta só um campo obrigatório: retorna só ele", () => {
  const faltando = spCamposObrigatoriosFaltando({
    operador: "João", ocorrencia: "1", tipoPoste: "POSTE MT", idPoste: "PST-1", altura: "",
  });
  assert.deepEqual(faltando, ["altura"]);
});

teste("campos NÃO obrigatórios (ex: causa, regional, materiais) vazios não entram na lista de faltantes", () => {
  const faltando = spCamposObrigatoriosFaltando({
    operador: "João", ocorrencia: "1", tipoPoste: "POSTE MT", idPoste: "PST-1", altura: "11m",
    causa: "", regional: "", materiais: "",
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
