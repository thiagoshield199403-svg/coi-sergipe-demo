/* Testes de regressão puros (sem framework, sem dependência nova) para as
   funções puras de js/pendencias.js (Fase 3, etapa 4) — mesma técnica de
   js/equipes.test.js: carrega o arquivo original via new Function() com um
   `document` mínimo e testa só o que não depende de DOM real/fetch.

   Roda com Node puro:
       node js/pendencias.test.js
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function fakeEl() {
  return { addEventListener() {}, appendChild() {}, querySelectorAll() { return []; }, options: [{}], innerHTML: "", style: {}, value: "" };
}
const fakeDocument = {
  getElementById: () => fakeEl(),
  addEventListener() {},
  querySelectorAll() { return []; },
  querySelector() { return null; },
};

const codigo = fs.readFileSync(path.join(__dirname, "pendencias.js"), "utf8");
const carregar = new Function(
  "document",
  codigo + "\nreturn { pendenciasExtrairMensagemErro, pendenciasClassificarVencimento, " +
    "pendenciasUsuarioEhPrivilegiado, pendenciasFormatarDataBR, pendenciasMontarQueryFiltros, " +
    "pendenciasFiltrarListaLocal, pendenciasResumo, pendenciasRotuloStatus, pendenciasRotuloTipo };"
);
const {
  pendenciasExtrairMensagemErro, pendenciasClassificarVencimento, pendenciasUsuarioEhPrivilegiado,
  pendenciasFormatarDataBR, pendenciasMontarQueryFiltros, pendenciasFiltrarListaLocal,
  pendenciasResumo, pendenciasRotuloStatus, pendenciasRotuloTipo,
} = carregar(fakeDocument);

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

console.log("=== pendenciasExtrairMensagemErro ===");
teste("corpo nulo/undefined -> null", () => {
  assert.equal(pendenciasExtrairMensagemErro(null), null);
  assert.equal(pendenciasExtrairMensagemErro(undefined), null);
});
teste("corpo string -> devolve a própria string", () => {
  assert.equal(pendenciasExtrairMensagemErro("erro cru"), "erro cru");
});
teste("detail string -> devolve o detail", () => {
  assert.equal(pendenciasExtrairMensagemErro({ detail: "Categoria inválida" }), "Categoria inválida");
});
teste("detail string vazia -> null (quem chama usa fallback)", () => {
  assert.equal(pendenciasExtrairMensagemErro({ detail: "   " }), null);
});
teste("detail array (422 Pydantic) -> junta as mensagens com ' | '", () => {
  const corpo = { detail: [{ loc: ["body", "descricao"], msg: "campo obrigatório" }, { msg: "outro erro" }] };
  assert.equal(pendenciasExtrairMensagemErro(corpo), "campo obrigatório | outro erro");
});
teste("detail array sem 'msg' em nenhum item -> null", () => {
  assert.equal(pendenciasExtrairMensagemErro({ detail: [{ loc: ["x"] }] }), null);
});
teste("nunca devolve [object Object] (array/objeto cru)", () => {
  const resultado = pendenciasExtrairMensagemErro({ detail: [{ x: 1 }] });
  assert.notEqual(resultado, "[object Object]");
});

console.log("=== pendenciasClassificarVencimento ===");
teste("sem data_vencimento -> null", () => {
  assert.equal(pendenciasClassificarVencimento(null, "PENDENTE", "2026-08-31"), null);
});
teste("status != PENDENTE -> null mesmo com data no passado (não reclassifica após execução/cancelamento)", () => {
  assert.equal(pendenciasClassificarVencimento("2026-01-01", "EXECUTADA", "2026-08-31"), null);
  assert.equal(pendenciasClassificarVencimento("2026-01-01", "CANCELADA", "2026-08-31"), null);
});
teste("data == hoje -> vence_hoje", () => {
  assert.equal(pendenciasClassificarVencimento("2026-08-31", "PENDENTE", "2026-08-31"), "vence_hoje");
});
teste("data no passado -> vencida", () => {
  assert.equal(pendenciasClassificarVencimento("2026-08-30", "PENDENTE", "2026-08-31"), "vencida");
});
teste("data no futuro -> normal", () => {
  assert.equal(pendenciasClassificarVencimento("2026-09-15", "PENDENTE", "2026-08-31"), "normal");
});

console.log("=== pendenciasUsuarioEhPrivilegiado ===");
teste("OPERADOR sozinho -> false", () => {
  assert.equal(pendenciasUsuarioEhPrivilegiado(["OPERADOR"]), false);
});
teste("SUPERVISOR -> true", () => {
  assert.equal(pendenciasUsuarioEhPrivilegiado(["SUPERVISOR"]), true);
});
teste("ADMINISTRADOR -> true", () => {
  assert.equal(pendenciasUsuarioEhPrivilegiado(["ADMINISTRADOR"]), true);
});
teste("OPERADOR + SUPERVISOR (múltiplos perfis) -> true", () => {
  assert.equal(pendenciasUsuarioEhPrivilegiado(["OPERADOR", "SUPERVISOR"]), true);
});
teste("lista vazia -> false", () => {
  assert.equal(pendenciasUsuarioEhPrivilegiado([]), false);
});
teste("não-array (undefined/null) -> false, nunca lança", () => {
  assert.equal(pendenciasUsuarioEhPrivilegiado(undefined), false);
  assert.equal(pendenciasUsuarioEhPrivilegiado(null), false);
});

console.log("=== pendenciasFormatarDataBR ===");
teste("ISO -> DD/MM/AAAA", () => {
  assert.equal(pendenciasFormatarDataBR("2026-08-31"), "31/08/2026");
});
teste("vazio/null -> string vazia", () => {
  assert.equal(pendenciasFormatarDataBR(""), "");
  assert.equal(pendenciasFormatarDataBR(null), "");
});

console.log("=== pendenciasMontarQueryFiltros (nunca inventa parâmetro não suportado pela API) ===");
teste("só inclui chaves com valor não-vazio", () => {
  const q = pendenciasMontarQueryFiltros({ polo: "ARACAJU", tipo: "", status: null, responsabilidade: undefined });
  assert.deepEqual(q, { polo: "ARACAJU" });
});
teste("todas as chaves suportadas passam quando preenchidas", () => {
  const filtros = {
    polo: "ARACAJU", tipo: "TECNICA", categoria_id: "c1", submotivo_id: "s1",
    responsabilidade: "MANUTENCAO", status: "PENDENTE", os_numero: "123",
    inc_numero: "456", ss_numero: "789", entra_passagem_turno: true,
    data_vencimento: "2026-08-31", criado_em_de: "2026-08-01", criado_em_ate: "2026-08-31",
  };
  assert.deepEqual(pendenciasMontarQueryFiltros(filtros), filtros);
});
teste("chave desconhecida (ex.: 'codigo', 'busca') é ignorada mesmo se vier no objeto", () => {
  const q = pendenciasMontarQueryFiltros({ polo: "ARACAJU", codigo: "PD-2026-000001", busca: "abelhas" });
  assert.deepEqual(q, { polo: "ARACAJU" });
  assert.equal("codigo" in q, false);
  assert.equal("busca" in q, false);
});
teste("entra_passagem_turno=false é incluído (não é 'vazio')", () => {
  const q = pendenciasMontarQueryFiltros({ entra_passagem_turno: false });
  assert.equal(q.entra_passagem_turno, false);
});
teste("objeto vazio/undefined -> {}", () => {
  assert.deepEqual(pendenciasMontarQueryFiltros({}), {});
});

console.log("=== pendenciasFiltrarListaLocal (busca client-side — API não tem filtro de texto/codigo) ===");
const lista = [
  { codigo: "PD-2026-000001", os_numero: "1514564611", inc_numero: null, ss_numero: null, descricao: "Levar cabo 35mm" },
  { codigo: "PD-2026-000002", os_numero: null, inc_numero: "123456", ss_numero: "987654", descricao: "Trafo queimado BT" },
];
teste("texto vazio -> devolve a lista inteira", () => {
  assert.equal(pendenciasFiltrarListaLocal(lista, "").length, 2);
  assert.equal(pendenciasFiltrarListaLocal(lista, "   ").length, 2);
});
teste("busca por código", () => {
  const r = pendenciasFiltrarListaLocal(lista, "000002");
  assert.equal(r.length, 1);
  assert.equal(r[0].codigo, "PD-2026-000002");
});
teste("busca por OS", () => {
  assert.equal(pendenciasFiltrarListaLocal(lista, "1514564611").length, 1);
});
teste("busca por INC", () => {
  assert.equal(pendenciasFiltrarListaLocal(lista, "123456").length, 1);
});
teste("busca por SS", () => {
  assert.equal(pendenciasFiltrarListaLocal(lista, "987654").length, 1);
});
teste("busca por trecho da descrição, case-insensitive", () => {
  assert.equal(pendenciasFiltrarListaLocal(lista, "TRAFO").length, 1);
});
teste("sem correspondência -> lista vazia", () => {
  assert.equal(pendenciasFiltrarListaLocal(lista, "nao existe nada assim").length, 0);
});

console.log("=== pendenciasResumo ===");
teste("total conta tudo, pendentes/vencidas/hoje só entre as PENDENTE", () => {
  const l = [
    { status: "PENDENTE", data_vencimento: "2026-08-30" }, // vencida (hoje=31)
    { status: "PENDENTE", data_vencimento: "2026-08-31" }, // vence hoje
    { status: "PENDENTE", data_vencimento: "2026-09-15" }, // normal
    { status: "PENDENTE", data_vencimento: null },          // sem vencimento
    { status: "EXECUTADA", data_vencimento: "2026-01-01" }, // não conta em vencidas
    { status: "CANCELADA", data_vencimento: "2026-08-31" }, // não conta em hoje
  ];
  const r = pendenciasResumo(l, "2026-08-31");
  assert.equal(r.total, 6);
  assert.equal(r.pendentes, 4);
  assert.equal(r.vencidas, 1);
  assert.equal(r.hoje, 1);
});
teste("lista vazia -> tudo zero", () => {
  assert.deepEqual(pendenciasResumo([], "2026-08-31"), { total: 0, pendentes: 0, vencidas: 0, hoje: 0 });
});

console.log("=== pendenciasRotuloStatus / pendenciasRotuloTipo (só os 3 status atuais — Etapa 2) ===");
teste("PENDENTE/EXECUTADA/CANCELADA têm rótulo", () => {
  assert.equal(pendenciasRotuloStatus("PENDENTE"), "Pendente");
  assert.equal(pendenciasRotuloStatus("EXECUTADA"), "Executada");
  assert.equal(pendenciasRotuloStatus("CANCELADA"), "Cancelada");
});
teste("valores antigos removidos na Etapa 2 não têm rótulo mapeado (cai no fallback = o próprio valor)", () => {
  assert.equal(pendenciasRotuloStatus("ABERTA"), "ABERTA");
  assert.equal(pendenciasRotuloStatus("EM_ANDAMENTO"), "EM_ANDAMENTO");
  assert.equal(pendenciasRotuloStatus("AGUARDANDO"), "AGUARDANDO");
  assert.equal(pendenciasRotuloStatus("RESOLVIDA"), "RESOLVIDA");
});
teste("tipo TECNICA/COMERCIAL", () => {
  assert.equal(pendenciasRotuloTipo("TECNICA"), "Técnica");
  assert.equal(pendenciasRotuloTipo("COMERCIAL"), "Comercial");
});

console.log(`\n${passou} teste(s) passaram.`);
if (process.exitCode) {
  console.log("Alguns testes FALHARAM.");
} else {
  console.log("Todos os testes passaram.");
}
