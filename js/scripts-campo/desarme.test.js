/* Testes de regressão puros (sem framework, sem dependência nova) para
   js/scripts-campo/desarme.js — Script Desarme, terceiro módulo
   reintegrado do backup scriptdebloqueioslinhaviva-v2. Só exercita
   dsMontarTexto (pura, sem DOM); dsGerarRelatorio/dsLimparRelatorio
   dependem de document real (getElementById, navigator.clipboard) e só
   são verificáveis manualmente no navegador — mesmo padrão já
   estabelecido em bloqueios.test.js/sinergia.test.js.

   IMPORTANTE: este módulo tem uma correção intencional em relação ao
   original (ver comentário "CORREÇÃO: ds_obs" no topo de desarme.js) —
   o campo Observação (ds_obs), que o gerarDesarme() original nunca lia,
   agora É incluído no texto final. Por isso a saída NÃO é mais
   byte-a-byte idêntica ao backup; os testes abaixo cobrem exatamente
   essa diferença documentada.

   Roda com Node puro:
       node js/scripts-campo/desarme.test.js
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function fakeEl() {
  return { addEventListener() {}, appendChild() {}, querySelectorAll() { return []; }, value: "", style: {} };
}
const fakeDocument = { getElementById: () => null, querySelectorAll() { return []; } };

// desarme.js é script clássico (sem module/export, carregado via
// <script src> no navegador). Mesma técnica dos demais testes deste
// projeto: executa dentro de uma função real e devolve só o que é puro.
// getElementById precisa devolver null (não um fakeEl) pra que a IIFE
// dsOrdenarSubestacoes() rode seu "if (!select) return;" sem quebrar.
const codigo = fs.readFileSync(path.join(__dirname, "desarme.js"), "utf8");
const carregar = new Function("document", codigo + "\nreturn { dsMontarTexto };");
const { dsMontarTexto } = carregar(fakeDocument);

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

console.log("=== dsMontarTexto ===");

// ---- 1. campos preenchidos ----
teste("com todos os campos preenchidos, monta o texto no formato original + observação", () => {
  const texto = dsMontarTexto({
    ativoTipo: "RD",
    ativoNum: "180-548376",
    datahora: "2026-08-28T14:05:09",
    uc: "1.229",
    subestacao: "ARJ",
    alimentador: "01F5",
    clima: "Chuva",
    situacao: "Equipe(s) no local",
    obs: "Desarme sem sucesso no 1º ciclo de religamento.",
  });

  assert.equal(
    texto,
    `🚨 *Informação de Ocorrência* 🚨

💡 *Rede:*
RD 180-548376 | SUB: ARJ | ALIM: 01F5

🗓️ *Data | Hora da Ocorrência:*
28/ago. | 14h 05m 09s

🏠 *UC Atingidas:*
1.229

⏱️ *Situação Atual:*
Equipe(s) no local

📝 *Observação:*
Desarme sem sucesso no 1º ciclo de religamento.

🌤️ *Condições Climáticas:*
Chuva`
  );
});

// ---- 2. campos vazios ----
teste("campos vazios/ausentes: ativo vira '-', demais campos viram '-', data vira '-'", () => {
  const texto = dsMontarTexto({});
  assert.match(texto, /💡 \*Rede:\*\n- \| SUB: - \| ALIM: -/);
  assert.match(texto, /🗓️ \*Data \| Hora da Ocorrência:\*\n-/);
  assert.match(texto, /🏠 \*UC Atingidas:\*\n-/);
  assert.match(texto, /⏱️ \*Situação Atual:\*\n-/);
  assert.match(texto, /📝 \*Observação:\*\n-/);
  assert.match(texto, /🌤️ \*Condições Climáticas:\*\n-/);
});

teste("chamar sem nenhum argumento (undefined) não quebra — mesmo resultado de {}", () => {
  assert.equal(dsMontarTexto(undefined), dsMontarTexto({}));
});

// ---- 3. geração do relatório (estrutura completa) ----
teste("mantém as 6 seções do relatório, na mesma ordem/rótulo do original + Observação", () => {
  const texto = dsMontarTexto({});
  const secoes = [
    "🚨 *Informação de Ocorrência* 🚨",
    "💡 *Rede:*",
    "🗓️ *Data | Hora da Ocorrência:*",
    "🏠 *UC Atingidas:*",
    "⏱️ *Situação Atual:*",
    "📝 *Observação:*",
    "🌤️ *Condições Climáticas:*",
  ];
  let posAnterior = -1;
  secoes.forEach((rotulo) => {
    const pos = texto.indexOf(rotulo);
    assert.ok(pos !== -1, `seção "${rotulo}" deveria existir no texto`);
    assert.ok(pos > posAnterior, `seção "${rotulo}" deveria vir depois da anterior`);
    posAnterior = pos;
  });
});

// ---- 4 e 5. observação ds_obs + regra específica ----
teste("CORREÇÃO ds_obs: o valor selecionado em Observação aparece no texto final (bug do original corrigido)", () => {
  const texto = dsMontarTexto({ obs: "Abertura emergencial – árvore na rede." });
  assert.match(texto, /📝 \*Observação:\*\nAbertura emergencial – árvore na rede\./);
});

teste("CORREÇÃO ds_obs: Observação fica posicionada entre Situação Atual e Condições Climáticas", () => {
  const texto = dsMontarTexto({ situacao: "Equipe(s) no local", obs: "X", clima: "Normal" });
  const posSituacao = texto.indexOf("⏱️ *Situação Atual:*");
  const posObs = texto.indexOf("📝 *Observação:*");
  const posClima = texto.indexOf("🌤️ *Condições Climáticas:*");
  assert.ok(posSituacao < posObs && posObs < posClima, "ordem esperada: Situação -> Observação -> Clima");
});

// ---- 8. regra específica do original: ativo só aparece se tipo E número estiverem preenchidos ----
teste("regra do 'ativo': só monta 'TIPO NUM' se tipo E número estiverem preenchidos", () => {
  assert.match(dsMontarTexto({ ativoTipo: "RD", ativoNum: "123" }).split("\n")[3], /^RD 123 \|/);
  assert.match(dsMontarTexto({ ativoTipo: "RD" }).split("\n")[3], /^- \|/, "só tipo, sem número, deveria virar '-'");
  assert.match(dsMontarTexto({ ativoNum: "123" }).split("\n")[3], /^- \|/, "só número, sem tipo, deveria virar '-'");
});

teste("regra da data/hora: string vazia mantém '-' (mesmo algoritmo do original, não formata nada)", () => {
  const texto = dsMontarTexto({ datahora: "" });
  assert.match(texto, /🗓️ \*Data \| Hora da Ocorrência:\*\n-\n/);
});

teste("regra da data/hora: formata DD/MES. | HHhMMmSSs a partir do valor do datetime-local (mesmo algoritmo do original)", () => {
  const texto = dsMontarTexto({ datahora: "2026-01-05T08:03:07" });
  assert.match(texto, /🗓️ \*Data \| Hora da Ocorrência:\*\n05\/jan\. \| 08h 03m 07s\n/);
});

teste("preenchimento parcial: só os campos vazios viram '-', os preenchidos aparecem normalmente", () => {
  const texto = dsMontarTexto({ subestacao: "ITB", clima: "Nublado" });
  assert.match(texto, /SUB: ITB/);
  assert.match(texto, /🌤️ \*Condições Climáticas:\*\nNublado/);
  assert.match(texto, /🏠 \*UC Atingidas:\*\n-/);
});

if (passou > 0) {
  console.log(`\n${passou} teste(s) passaram.`);
}
if (process.exitCode === 1) {
  console.error("\nALGUM TESTE FALHOU.");
  process.exit(1);
}
