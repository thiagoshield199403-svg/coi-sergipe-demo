/* Testes de regressão puros (sem framework, sem dependência nova) para
   o Callback WhatsApp (js/mensagens.js + js/callback-whatsapp.js).
   Exercita só funções puras e a abertura do WhatsApp com window.open
   simulado — nada é aberto nem enviado de verdade.

   Roda com Node puro:
       node js/callback-whatsapp.test.js
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function criarContexto() {
  const armazenado = new Map();
  const localStorage = {
    getItem: (k) => (armazenado.has(k) ? armazenado.get(k) : null),
    setItem: (k, v) => armazenado.set(k, String(v)),
    removeItem: (k) => armazenado.delete(k),
    clear: () => armazenado.clear(),
    _mapa: armazenado
  };
  const aberturas = [];
  const ctx = {
    console,
    localStorage,
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
    window: {
      bloquear: false,
      open(url, alvo, recursos) {
        const janela = { opener: "COI", location: { href: url }, closed: false };
        aberturas.push({ url, alvo, recursos, janela });
        return this.bloquear ? null : janela;
      }
    },
    aberturas
  };
  vm.createContext(ctx);
  for (const arq of ["mensagens.js", "callback-whatsapp.js"]) {
    // const/function de nível superior viram globais do contexto
    vm.runInContext(fs.readFileSync(path.join(__dirname, arq), "utf8"), ctx, { filename: arq });
  }
  vm.runInContext("this.MENSAGENS_CALLBACK = MENSAGENS_CALLBACK; this.SAUDACAO_CALLBACK = SAUDACAO_CALLBACK; this.CBW_CHAVE_HISTORICO_ANTIGO = CBW_CHAVE_HISTORICO_ANTIGO;", ctx);
  return ctx;
}

let falhas = 0;
function teste(nome, fn) {
  try { fn(); console.log("ok   -", nome); }
  catch (e) { falhas++; console.log("FALHA-", nome, "\n      ", e.message); }
}

const C = criarContexto();

/* ---------- mensagens (Central Callback Web 1.1.0) ---------- */

teste("23 mensagens de seleção manual (sem as 4 automáticas)", () => {
  const codigos = Object.keys(C.MENSAGENS_CALLBACK);
  assert.equal(codigos.length, 23);
  for (const auto of ["abertura_padrao", "abertura_risco_de_vida", "previsao_padrao", "encerramento_padrao"]) {
    assert.ok(!codigos.includes(auto), `mensagem automática ${auto} não deveria estar na lista`);
  }
  assert.ok(codigos.every((c) => c.startsWith("manual_")));
});

teste("todas as mensagens começam com a saudação exata da Central e não têm nome do operador", () => {
  assert.equal(C.SAUDACAO_CALLBACK, "Olá, aqui é a Energisa.");
  for (const [codigo, m] of Object.entries(C.MENSAGENS_CALLBACK)) {
    assert.ok(m.texto.startsWith("Olá, aqui é a Energisa. "), codigo);
    assert.ok(!/OPERADOR|Meu nome é|\{/.test(m.texto), `${codigo} tem placeholder/nome`);
    assert.ok(m.grupo && m.label, codigo);
  }
});

teste("8 assuntos, em ordem alfabética pt-BR, títulos em ordem dentro de cada assunto", () => {
  const grupos = JSON.parse(JSON.stringify(C.cbwMensagensAgrupadas())); // arrays do vm são de outro realm
  assert.deepEqual(grupos.map((g) => g.grupo), [
    "Choque, faíscas e incêndio", "Falta de energia", "Geral", "Poste",
    "Ramal, medição e disjuntor", "Rede e condutores", "Tensão e oscilação", "Transformador"
  ]);
  const alfa = (a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });
  for (const g of grupos) {
    const nomes = g.mensagens.map((m) => m.label);
    assert.deepEqual(nomes, [...nomes].sort(alfa), g.grupo);
  }
  assert.equal(grupos.reduce((n, g) => n + g.mensagens.length, 0), 23);
});

teste("marcação de prioridade só nos 6 subtipos de risco da Central", () => {
  const prioridade = Object.values(C.MENSAGENS_CALLBACK).filter((m) => m.prioridade).map((m) => m.label).sort();
  assert.deepEqual(prioridade, ["Choque elétrico", "Condutor partido", "Faíscas na rede",
    "Faíscas no ramal de serviço", "Incêndio", "Poste abalroado"]);
});

teste("texto padronizado: sem incidente fica igual ao modelo; com incidente acrescenta a referência", () => {
  const modelo = C.MENSAGENS_CALLBACK.manual_tensao_alta.texto;
  assert.equal(C.cbwRenderizarMensagem("manual_tensao_alta", ""), modelo);
  assert.equal(C.cbwRenderizarMensagem("manual_tensao_alta", "456987"), modelo + "\n\nReferência do atendimento: 456987");
  assert.equal(C.cbwRenderizarMensagem("inexistente", "1"), "");
});

teste("mensagem personalizada recebe a saudação da Central sem duplicar", () => {
  assert.equal(C.cbwComSaudacao("Tudo bem?"), "Olá, aqui é a Energisa. Tudo bem?");
  assert.equal(C.cbwComSaudacao("Olá, aqui é a Energisa. Tudo bem?"), "Olá, aqui é a Energisa. Tudo bem?");
  assert.equal(C.cbwComSaudacao("ola aqui e a energisa, tudo bem?"), "ola aqui e a energisa, tudo bem?");
  assert.equal(C.cbwComSaudacao(""), "Olá, aqui é a Energisa.");
  assert.equal(C.saudacaoPersonalizada("Thiago"), "Olá, aqui é a Energisa.");
});

/* ---------- telefone ---------- */

teste("normalização com DDI 55 (mesmos números aceitos antes, sem restringir a celular)", () => {
  const casos = {
    "79999991234": "5579999991234",        // celular com DDD
    "(79) 99999-1234": "5579999991234",    // com máscara
    "7932111234": "557932111234",          // fixo continua aceito
    "7988881234": "557988881234",          // 10 dígitos sem o 9 continua aceito
    "+55 79 99999-1234": "5579999991234",  // já com DDI
    "5579999991234": "5579999991234",
    "557932111234": "557932111234",
    "079999991234": "5579999991234",       // 0 + DDD + número
    "07932111234": "557932111234",
    "999991234": "999991234",              // sem DDD: segue como digitado (comportamento anterior)
    "": ""
  };
  for (const [entrada, esperado] of Object.entries(casos)) {
    assert.equal(C.cbwNormalizarTelefone(entrada), esperado, entrada);
  }
});

/* ---------- link e abertura do WhatsApp Web ---------- */

teste("link direto do WhatsApp Web, sem wa.me/api.whatsapp.com, mensagem codificada", () => {
  const texto = "Olá, aqui é a Energisa. Teste & 100% #1?\n\nReferência do atendimento: 123";
  const link = C.cbwMontarLinkWhatsApp("5579999991234", texto);
  assert.ok(link.startsWith("https://web.whatsapp.com/send?phone=5579999991234&text="));
  assert.ok(!/wa\.me|api\.whatsapp\.com/.test(link));
  const url = new URL(link);
  assert.equal(url.searchParams.get("phone"), "5579999991234");
  assert.equal(url.searchParams.get("text"), texto);
});

teste("abre UMA única aba: about:blank no clique, opener = null, depois o endereço final", () => {
  C.aberturas.length = 0;
  C.window.bloquear = false;
  const link = C.cbwMontarLinkWhatsApp("5579999991234", "Olá, aqui é a Energisa.");
  assert.equal(C.cbwAbrirWhatsAppWeb(link), true);
  assert.equal(C.aberturas.length, 1);
  assert.equal(C.aberturas[0].url, "about:blank");
  assert.equal(C.aberturas[0].alvo, "_blank");
  assert.equal(C.aberturas[0].janela.opener, null);
  assert.equal(C.aberturas[0].janela.location.href, link);
});

teste("pop-up bloqueado: retorna false e não tenta abrir de novo", () => {
  C.aberturas.length = 0;
  C.window.bloquear = true;
  assert.equal(C.cbwAbrirWhatsAppWeb("https://web.whatsapp.com/send?phone=1&text=x"), false);
  assert.equal(C.aberturas.length, 1);
  C.window.bloquear = false;
});

/* ---------- remoção do histórico antigo ---------- */

teste("remove SOMENTE a chave do histórico antigo e preserva as demais", () => {
  const ls = C.localStorage;
  ls.setItem("coi_callback_whatsapp_historico", "[{\"telefone\":\"79900000001\"}]");
  ls.setItem("coi_demo_db", "{\"equipes\":[]}");
  ls.setItem("outra_chave", "x");
  C.cbwRemoverHistoricoAntigo();
  assert.equal(C.CBW_CHAVE_HISTORICO_ANTIGO, "coi_callback_whatsapp_historico");
  assert.equal(ls.getItem("coi_callback_whatsapp_historico"), null);
  assert.equal(ls.getItem("coi_demo_db"), "{\"equipes\":[]}");
  assert.equal(ls.getItem("outra_chave"), "x");
});

console.log(falhas ? `\n${falhas} teste(s) falharam.` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
