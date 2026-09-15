/* Testes de regressão puros (sem framework, sem dependência nova) para as
   funções puras de js/passagem-turno.js (Fase 4, etapa 4) — mesma técnica
   de js/pendencias.test.js: carrega o arquivo original via new Function()
   com um `document` mínimo e testa só o que não depende de DOM real/fetch.

   Roda com Node puro:
       node js/passagem-turno.test.js
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

const codigo = fs.readFileSync(path.join(__dirname, "passagem-turno.js"), "utf8");
const carregar = new Function(
  "document",
  codigo + "\nreturn { ptExtrairMensagemErro, ptRotuloTipoItem, PT_TIPO_ITEM_ROTULO, ptFormatarDataHoraBR, " +
    "ptFormatarDataBR, ptStorageKey, ptSerializarRascunho, ptDesserializarRascunho, ptEstadoInicial, " +
    "ptValidarSelecaoCompleta, ptAdicionarPoloNaSelecao, ptRemoverPoloDaSelecao, ptDefinirDestinatarioNaSelecao, " +
    "ptAplicarDestinatarioEmMassa, ptDuplicarConfigPolo, ptNomeDestinatario, ptFormatarRemetente, " +
    "ptContarPendenciasAtivas, ptContarItens, ptMontarResumoRevisao, ptMensagemHttp, " +
    "ptAgruparItensPorTipo, PT_PERGUNTAS, ptConfigPergunta };"
);
const {
  ptExtrairMensagemErro, ptRotuloTipoItem, PT_TIPO_ITEM_ROTULO, ptFormatarDataHoraBR,
  ptFormatarDataBR, ptStorageKey, ptSerializarRascunho, ptDesserializarRascunho, ptEstadoInicial,
  ptValidarSelecaoCompleta, ptAdicionarPoloNaSelecao, ptRemoverPoloDaSelecao, ptDefinirDestinatarioNaSelecao,
  ptAplicarDestinatarioEmMassa, ptDuplicarConfigPolo, ptNomeDestinatario, ptFormatarRemetente,
  ptContarPendenciasAtivas, ptContarItens, ptMontarResumoRevisao, ptMensagemHttp,
  ptAgruparItensPorTipo, PT_PERGUNTAS, ptConfigPergunta,
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

console.log("=== ptExtrairMensagemErro ===");
teste("corpo nulo/undefined -> null", () => {
  assert.equal(ptExtrairMensagemErro(null), null);
  assert.equal(ptExtrairMensagemErro(undefined), null);
});
teste("detail string -> devolve o detail", () => {
  assert.equal(ptExtrairMensagemErro({ detail: "Passagem já foi enviada" }), "Passagem já foi enviada");
});
teste("detail array (422 Pydantic) -> junta as mensagens", () => {
  const corpo = { detail: [{ msg: "campo obrigatório" }, { msg: "outro erro" }] };
  assert.equal(ptExtrairMensagemErro(corpo), "campo obrigatório | outro erro");
});
teste("nunca devolve [object Object]", () => {
  assert.notEqual(ptExtrairMensagemErro({ detail: [{ x: 1 }] }), "[object Object]");
});

console.log("=== ptRotuloTipoItem (só os 9 valores reais do enum TipoItemPassagemTurno) ===");
teste("todos os 9 tipos reais têm rótulo amigável", () => {
  const tipos = [
    "OCORRENCIA", "REMANEJAMENTO", "OS_COMERCIAL", "RELIGACAO_PRIORITARIA",
    "EQUIPAMENTO_RELIGAMENTO_BLOQUEADO", "MANUTENCAO_ACIONADA", "EQUIPAMENTO_REMOTO",
    "DESLIGAMENTO_PROGRAMADO", "CONTINGENCIA",
  ];
  assert.equal(Object.keys(PT_TIPO_ITEM_ROTULO).length, 9);
  tipos.forEach(t => {
    assert.equal(typeof ptRotuloTipoItem(t), "string");
    assert.notEqual(ptRotuloTipoItem(t), t);
    assert.ok(ptRotuloTipoItem(t).length > 0);
  });
});
teste("tipo desconhecido cai no fallback = o próprio valor", () => {
  assert.equal(ptRotuloTipoItem("TIPO_INEXISTENTE"), "TIPO_INEXISTENTE");
});
teste("vazio/undefined -> string vazia", () => {
  assert.equal(ptRotuloTipoItem(""), "");
  assert.equal(ptRotuloTipoItem(undefined), "");
});

console.log("=== ptFormatarDataBR / ptFormatarDataHoraBR ===");
teste("data ISO -> DD/MM/AAAA", () => {
  assert.equal(ptFormatarDataBR("2026-08-31"), "31/08/2026");
});
teste("data vazia/null -> string vazia", () => {
  assert.equal(ptFormatarDataBR(""), "");
  assert.equal(ptFormatarDataBR(null), "");
});
teste("data-hora vazia/null -> string vazia", () => {
  assert.equal(ptFormatarDataHoraBR(""), "");
  assert.equal(ptFormatarDataHoraBR(null), "");
});
teste("data-hora ISO -> string não vazia", () => {
  assert.ok(ptFormatarDataHoraBR("2026-08-31T14:30:00Z").length > 0);
});

console.log("=== ptStorageKey (nunca compartilhado entre usuários) ===");
teste("inclui o usuario_id na chave", () => {
  const k1 = ptStorageKey("uuid-operador-1");
  const k2 = ptStorageKey("uuid-operador-2");
  assert.notEqual(k1, k2);
  assert.ok(k1.includes("uuid-operador-1"));
  assert.ok(k1.startsWith("coi_passagem_turno_rascunho"));
});

console.log("=== ptSerializarRascunho / ptDesserializarRascunho ===");
teste("round-trip preserva os campos estruturais", () => {
  const estado = {
    versao: 1, turno: "06h-14h", etapa: "itens", poloAtivo: "ITABAIANA",
    selecao: [{ polo: "ITABAIANA", destinatarioId: "u1" }],
    loteId: "lote-1",
    passagens: [{ polo: "ITABAIANA", destinatarioId: "u1", passagemId: "p1" }],
  };
  const bruto = ptSerializarRascunho(estado);
  const de_volta = ptDesserializarRascunho(bruto);
  assert.deepEqual(de_volta, estado);
});
teste("nunca inclui texto do termo ou qualquer campo fora da lista estrutural", () => {
  const estado = { ...ptEstadoInicial(), termoTexto: "não deveria persistir isto" };
  const bruto = ptSerializarRascunho(estado);
  assert.equal(bruto.includes("termoTexto"), false);
  assert.equal(bruto.includes("não deveria"), false);
});
teste("bruto nulo/vazio -> null", () => {
  assert.equal(ptDesserializarRascunho(null), null);
  assert.equal(ptDesserializarRascunho(""), null);
});
teste("JSON corrompido -> null (nunca lança, nunca trava o módulo)", () => {
  assert.equal(ptDesserializarRascunho("{isso nao e json"), null);
});
teste("formato inválido (selecao não é array) -> null", () => {
  assert.equal(ptDesserializarRascunho(JSON.stringify({ etapa: "turno", selecao: "x", passagens: [] })), null);
});
teste("etapa desconhecida (versão futura/corrompida) -> null", () => {
  assert.equal(ptDesserializarRascunho(JSON.stringify({ etapa: "etapa_que_nao_existe", selecao: [], passagens: [] })), null);
});

console.log("=== ptValidarSelecaoCompleta ===");
teste("lista vazia -> inválido", () => {
  const r = ptValidarSelecaoCompleta([]);
  assert.equal(r.valido, false);
});
teste("polo sem destinatário -> inválido, cita o polo", () => {
  const r = ptValidarSelecaoCompleta([{ polo: "ITABAIANA", destinatarioId: null }]);
  assert.equal(r.valido, false);
  assert.ok(r.mensagem.includes("ITABAIANA"));
});
teste("todos com destinatário -> válido", () => {
  const r = ptValidarSelecaoCompleta([{ polo: "ITABAIANA", destinatarioId: "u1" }, { polo: "MARUIM", destinatarioId: "u2" }]);
  assert.equal(r.valido, true);
  assert.equal(r.mensagem, null);
});

console.log("=== seleção de polos/destinatários (funções puras, imutáveis) ===");
teste("ptAdicionarPoloNaSelecao: adiciona com destinatarioId null", () => {
  const r = ptAdicionarPoloNaSelecao([], "ITABAIANA");
  assert.deepEqual(r, [{ polo: "ITABAIANA", destinatarioId: null }]);
});
teste("ptAdicionarPoloNaSelecao: idempotente (não duplica)", () => {
  const s = [{ polo: "ITABAIANA", destinatarioId: "u1" }];
  const r = ptAdicionarPoloNaSelecao(s, "ITABAIANA");
  assert.equal(r.length, 1);
  assert.equal(r[0].destinatarioId, "u1"); // não reseta o que já existia
});
teste("ptRemoverPoloDaSelecao", () => {
  const s = [{ polo: "ITABAIANA", destinatarioId: "u1" }, { polo: "MARUIM", destinatarioId: "u2" }];
  const r = ptRemoverPoloDaSelecao(s, "ITABAIANA");
  assert.deepEqual(r, [{ polo: "MARUIM", destinatarioId: "u2" }]);
});
teste("ptDefinirDestinatarioNaSelecao: só altera o polo alvo", () => {
  const s = [{ polo: "ITABAIANA", destinatarioId: null }, { polo: "MARUIM", destinatarioId: "u2" }];
  const r = ptDefinirDestinatarioNaSelecao(s, "ITABAIANA", "u1");
  assert.deepEqual(r, [{ polo: "ITABAIANA", destinatarioId: "u1" }, { polo: "MARUIM", destinatarioId: "u2" }]);
});
teste("ptAplicarDestinatarioEmMassa: aplica a todos", () => {
  const s = [{ polo: "ITABAIANA", destinatarioId: null }, { polo: "MARUIM", destinatarioId: "u_antigo" }];
  const r = ptAplicarDestinatarioEmMassa(s, "u_novo");
  assert.ok(r.every(x => x.destinatarioId === "u_novo"));
});
teste("ptDuplicarConfigPolo: copia destinatário pra um polo novo", () => {
  const s = [{ polo: "ITABAIANA", destinatarioId: "u1" }, { polo: "MARUIM", destinatarioId: null }];
  const r = ptDuplicarConfigPolo(s, "ITABAIANA", "MARUIM");
  assert.equal(r.find(x => x.polo === "MARUIM").destinatarioId, "u1");
});
teste("ptDuplicarConfigPolo: origem inexistente -> lista inalterada", () => {
  const s = [{ polo: "ITABAIANA", destinatarioId: "u1" }];
  const r = ptDuplicarConfigPolo(s, "NAO_EXISTE", "MARUIM");
  assert.deepEqual(r, s);
});

console.log("=== ptNomeDestinatario / ptFormatarRemetente ===");
const destinatarios = [{ id: "u1", nome: "João" }, { id: "u2", nome: "Carlos" }];
teste("acha pelo id", () => {
  assert.equal(ptNomeDestinatario(destinatarios, "u1"), "João");
});
teste("id não encontrado -> devolve o próprio id (nunca inventa nome)", () => {
  assert.equal(ptNomeDestinatario(destinatarios, "id-desconhecido"), "id-desconhecido");
});
teste("ptFormatarRemetente: usuário logado -> 'Você (nome)'", () => {
  assert.equal(ptFormatarRemetente("u1", "u1", "João"), "Você (João)");
});
teste("ptFormatarRemetente: outro usuário -> devolve o id cru", () => {
  assert.equal(ptFormatarRemetente("u2", "u1", "João"), "u2");
});

console.log("=== ptContarPendenciasAtivas / ptContarItens ===");
teste("conta MANTIDA e ADICIONADA, não conta REMOVIDA nem null", () => {
  const lista = [
    { situacao_atual: "MANTIDA" }, { situacao_atual: "ADICIONADA" },
    { situacao_atual: "REMOVIDA" }, { situacao_atual: null },
  ];
  assert.equal(ptContarPendenciasAtivas(lista), 2);
});
teste("não-array -> 0, nunca lança", () => {
  assert.equal(ptContarPendenciasAtivas(undefined), 0);
  assert.equal(ptContarPendenciasAtivas(null), 0);
});
teste("ptContarItens: tamanho da lista, ou 0 se não-array", () => {
  assert.equal(ptContarItens([1, 2, 3]), 3);
  assert.equal(ptContarItens([]), 0);
  assert.equal(ptContarItens(undefined), 0);
});

console.log("=== ptMontarResumoRevisao (Polo / Destinatário / Qtd pendências / Qtd itens) ===");
teste("monta uma linha por passagem, com contagens corretas", () => {
  const passagens = [
    { polo: "ITABAIANA", destinatarioId: "u1", passagemId: "p1" },
    { polo: "MARUIM", destinatarioId: "u2", passagemId: "p2" },
  ];
  const pendenciasPorPassagem = {
    p1: [{ situacao_atual: "MANTIDA" }, { situacao_atual: "REMOVIDA" }],
    p2: [],
  };
  const itensPorPassagem = { p1: [{}, {}], p2: [{}] };
  const resumo = ptMontarResumoRevisao(passagens, destinatarios, pendenciasPorPassagem, itensPorPassagem);
  assert.deepEqual(resumo, [
    { polo: "ITABAIANA", destinatarioNome: "João", qtdPendencias: 1, qtdItens: 2 },
    { polo: "MARUIM", destinatarioNome: "Carlos", qtdPendencias: 0, qtdItens: 1 },
  ]);
});

console.log("=== ptMensagemHttp (nunca expõe erro técnico cru) ===");
teste("401 -> sessão expirada", () => {
  assert.equal(ptMensagemHttp({ status: 401 }), "Sua sessão expirou. Faça login novamente.");
});
teste("403 -> mensagem de permissão (dono do rascunho)", () => {
  assert.ok(ptMensagemHttp({ status: 403, corpo: null }).toLowerCase().includes("remetente"));
});
teste("404 -> não encontrado", () => {
  assert.ok(ptMensagemHttp({ status: 404 }).length > 0);
});
teste("409 -> conflito de concorrência", () => {
  assert.ok(ptMensagemHttp({ status: 409, corpo: null }).length > 0);
});
teste("422 sem detail -> termo de responsabilidade", () => {
  assert.ok(ptMensagemHttp({ status: 422, corpo: null }).toLowerCase().includes("termo"));
});
teste("corpo com detail sempre tem prioridade sobre o mapeamento genérico", () => {
  assert.equal(ptMensagemHttp({ status: 409, corpo: { detail: "mensagem específica da API" } }), "mensagem específica da API");
});
teste("status 0 -> falha de rede", () => {
  assert.ok(ptMensagemHttp({ status: 0 }).length > 0);
});
teste("5xx -> erro interno", () => {
  assert.ok(ptMensagemHttp({ status: 500, corpo: null }).length > 0);
});

console.log("=== ptAgruparItensPorTipo (alimenta os 9 cards do painel operacional) ===");
teste("agrupa itens por tipo_item, preservando ordem dentro de cada grupo", () => {
  const itens = [
    { id: "1", tipo_item: "OCORRENCIA", descricao: "a" },
    { id: "2", tipo_item: "EQUIPAMENTO_REMOTO", descricao: "b" },
    { id: "3", tipo_item: "OCORRENCIA", descricao: "c" },
  ];
  const mapa = ptAgruparItensPorTipo(itens);
  assert.equal(mapa.OCORRENCIA.length, 2);
  assert.deepEqual(mapa.OCORRENCIA.map(i => i.id), ["1", "3"]);
  assert.equal(mapa.EQUIPAMENTO_REMOTO.length, 1);
});
teste("lista vazia/ausente -> objeto vazio, nunca lança", () => {
  assert.deepEqual(ptAgruparItensPorTipo([]), {});
  assert.deepEqual(ptAgruparItensPorTipo(undefined), {});
  assert.deepEqual(ptAgruparItensPorTipo(null), {});
});

console.log("=== PT_PERGUNTAS / ptConfigPergunta (perguntas de LISTA do painel, 1 card cada) ===");
teste("exatamente 8 perguntas de lista — CONTINGENCIA fica de fora de propósito (Etapa 4A: campo próprio, não item)", () => {
  assert.equal(PT_PERGUNTAS.length, 8);
  const tipos = PT_PERGUNTAS.map(p => p.tipo).sort();
  const tiposDoEnumSemContingencia = Object.keys(PT_TIPO_ITEM_ROTULO).filter(t => t !== "CONTINGENCIA").sort();
  assert.deepEqual(tipos, tiposDoEnumSemContingencia);
  assert.ok(!tipos.includes("CONTINGENCIA"));
});
teste("cada pergunta tem os campos usados pelo card e pelo modal genérico", () => {
  PT_PERGUNTAS.forEach(cfg => {
    assert.equal(typeof cfg.pergunta, "string");
    assert.ok(cfg.pergunta.length > 0);
    assert.equal(typeof cfg.exemplo, "string");
    assert.equal(typeof cfg.botao, "string");
    assert.ok(cfg.botao.startsWith("+ Adicionar"));
    assert.equal(typeof cfg.idLabel, "string");
    assert.equal(typeof cfg.descLabel, "string");
  });
});
teste("ptConfigPergunta acha pelo tipo; tipo inexistente -> null", () => {
  assert.equal(ptConfigPergunta("EQUIPAMENTO_REMOTO").tipo, "EQUIPAMENTO_REMOTO");
  assert.equal(ptConfigPergunta("TIPO_INEXISTENTE"), null);
});

console.log(`\n${passou} teste(s) passaram.`);
if (process.exitCode) {
  console.log("Alguns testes FALHARAM.");
} else {
  console.log("Todos os testes passaram.");
}
