// Testes das funções puras de js/layout-ui.js e das garantias estruturais da
// modernização visual (ids que js/auth.js usa, rodapé só com a assinatura,
// fundo natalino intacto). Rodar: node js/layout-ui.test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { layoutIniciais, layoutTituloModulo } = require("./layout-ui.js");

const RAIZ = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
let ok = 0;
function teste(nome, fn) {
  try { fn(); ok++; console.log("✓ " + nome); }
  catch (e) { console.error("✗ " + nome + "\n  " + e.message); process.exitCode = 1; }
}

teste("iniciais: nome composto usa primeira e última palavra", () => {
  assert.equal(layoutIniciais("Operador Demonstração"), "OD");
  assert.equal(layoutIniciais("thiago dos santos araujo"), "TA");
});
teste("iniciais: um nome só e vazio", () => {
  assert.equal(layoutIniciais("Thiago"), "T");
  assert.equal(layoutIniciais("   "), "");
  assert.equal(layoutIniciais(null), "");
});
teste("título: sem item ativo volta para Início", () => {
  assert.deepEqual(layoutTituloModulo("", ""), { trilha: "COI Sergipe", modulo: "Início" });
});
teste("título: usa item e categoria", () => {
  assert.deepEqual(layoutTituloModulo("Callback WhatsApp", "Atendimento"), { trilha: "Atendimento", modulo: "Callback WhatsApp" });
});

teste("ids usados por js/auth.js continuam existindo (uma vez cada)", () => {
  for (const id of ["auth_usuario_badge", "auth_usuario_nome", "auth_btn_meu_perfil", "auth_btn_sair", "login-screen", "perfil_modal_senha"]) {
    const n = html.split('id="' + id + '"').length - 1;
    assert.equal(n, 1, id + " aparece " + n + " vez(es)");
  }
});
teste("usuário (nome, Meu Perfil, Sair) fica na barra superior, não no rodapé", () => {
  const topbar = html.slice(html.indexOf('<header class="topbar">'), html.indexOf("</header>"));
  assert.ok(topbar.includes('id="auth_usuario_badge"'));
  assert.ok(topbar.includes('id="auth_btn_sair"'));
  assert.ok(topbar.includes('id="auth_btn_meu_perfil"'));
});
teste("rodapé contém só a assinatura (sem ONLINE, relógio, usuário ou botões)", () => {
  const ini = html.indexOf('<footer class="footer-global">');
  const rodape = html.slice(ini, html.indexOf("</footer>", ini));
  assert.ok(rodape.includes("Desenvolvido por <strong>Thiago Araújo</strong>"));
  assert.ok(rodape.includes('class="footer-marca">COI SERGIPE<'));
  assert.ok(!/ONLINE|<button|dataHoraSistema|auth_/.test(rodape));
});
teste("relógio antigo removido e core.js tolera a ausência dele", () => {
  assert.ok(!html.includes('id="dataHoraSistema"'));
  const core = fs.readFileSync(path.join(RAIZ, "js", "core.js"), "utf8");
  assert.ok(/getElementById\("dataHoraSistema"\)[\s\S]{0,80}if\s*\(!/.test(core), "atualizarRodape precisa checar null");
});
teste("fundo natalino continua carregado e posicionado pela altura do rodapé", () => {
  assert.ok(html.includes('<script src="js/fundo-natal.js"></script>'));
  assert.ok(html.includes('href="css/fundo-natal.css"'));
  const css = fs.readFileSync(path.join(RAIZ, "css", "fundo-natal.css"), "utf8");
  assert.ok(css.includes("var(--footer-height"), "bottom do fundo deve seguir --footer-height");
});
teste("todo atalho do Início aponta para um item existente do menu", () => {
  const atalhos = [...html.matchAll(/data-atalho="([^"]+)"/g)].map(m => m[1].replace(/&#39;/g, "'"));
  assert.ok(atalhos.length >= 4);
  for (const a of atalhos) assert.ok(html.includes('onclick="' + a), "sem item de menu para " + a);
});

console.log(`\n${ok} testes ok`);
