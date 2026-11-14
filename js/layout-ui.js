/* INTERFACE (modernização visual) — só apresentação, nenhuma regra de negócio.

   1. Menu lateral recolhível: alterna html.sidebar-recolhida (a largura vira
      --sidebar-width-recolhida; o fundo natalino e o rodapé acompanham pela
      mesma variável). Preferência guardada em localStorage numa chave própria
      (nunca limpa nada além dela). Com o menu recolhido, clicar numa categoria
      expande o menu antes de abrir a categoria (menuAlternarCategoria continua
      sendo quem abre/fecha).
   2. Barra superior: mostra o módulo aberto, lido do item .active do menu
      (marcado por openModule() em js/core.js) e da categoria dele. Observa só
      mudanças de classe — não intercepta nem redefine openModule().
   3. Atalhos do Início: cada [data-atalho] clica no item do menu cujo onclick
      contém aquele trecho — a abertura do módulo é sempre a do próprio menu.
   4. Avatar do usuário: iniciais de #auth_usuario_nome (preenchido por js/auth.js). */

const LAYOUT_UI_CHAVE_RECOLHIDO = "coi_ui_menu_recolhido";

/** Iniciais para o avatar (função pura — testada em js/layout-ui.test.js). */
function layoutIniciais(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

/** Título/trilha do módulo a partir dos textos do item ativo (função pura). */
function layoutTituloModulo(rotuloItem, rotuloCategoria) {
  if (!rotuloItem) return { trilha: "COI Sergipe", modulo: "Início" };
  return { trilha: rotuloCategoria || "COI Sergipe", modulo: rotuloItem };
}

function layoutLerPreferencia() {
  try { return localStorage.getItem(LAYOUT_UI_CHAVE_RECOLHIDO) === "1"; } catch (e) { return false; }
}

function layoutSalvarPreferencia(recolhido) {
  try { localStorage.setItem(LAYOUT_UI_CHAVE_RECOLHIDO, recolhido ? "1" : "0"); } catch (e) { /* sem storage: só não lembra */ }
}

function layoutAplicarRecolhido(recolhido) {
  document.documentElement.classList.toggle("sidebar-recolhida", recolhido);
  const btn = document.getElementById("sidebar_btn_recolher");
  if (btn) {
    const rotulo = recolhido ? "Expandir menu" : "Recolher menu";
    btn.setAttribute("aria-expanded", recolhido ? "false" : "true");
    btn.setAttribute("aria-label", rotulo);
    btn.title = rotulo;
    const span = btn.querySelector(".sidebar-recolher-label");
    if (span) span.textContent = rotulo;
  }
}

function layoutAlternarMenu() {
  const recolher = !document.documentElement.classList.contains("sidebar-recolhida");
  layoutAplicarRecolhido(recolher);
  layoutSalvarPreferencia(recolher);
}

/* Dicas (title) para o menu recolhido — só onde ainda não existe um title. */
function layoutDicasMenu() {
  document.querySelectorAll(".menu-categoria-toggle").forEach(function (b) {
    const r = b.querySelector(".menu-cat-label");
    if (r && !b.title) b.title = r.textContent.trim();
  });
}

function layoutAtualizarTitulo() {
  const ativo = document.querySelector(".menu-categoria-itens button.active");
  let item = "";
  let categoria = "";
  if (ativo) {
    const r = ativo.querySelector(".menu-label");
    item = r ? r.textContent.trim() : "";
    const cat = ativo.closest(".menu-categoria");
    const rc = cat && cat.querySelector(".menu-cat-label");
    categoria = rc ? rc.textContent.trim() : "";
  }
  const t = layoutTituloModulo(item, categoria);
  const trilha = document.getElementById("topbar_trilha");
  const modulo = document.getElementById("topbar_modulo");
  if (trilha) trilha.textContent = t.trilha;
  if (modulo) modulo.textContent = t.modulo;
}

function layoutAtualizarAvatar() {
  const nome = document.getElementById("auth_usuario_nome");
  const avatar = document.getElementById("auth_usuario_avatar");
  if (nome && avatar) avatar.textContent = layoutIniciais(nome.textContent);
}

function layoutAbrirAtalho(trecho) {
  const alvo = Array.prototype.find.call(
    document.querySelectorAll(".menu-categoria-itens button"),
    function (b) { return (b.getAttribute("onclick") || "").indexOf(trecho) !== -1; }
  );
  if (!alvo) return;
  const cat = alvo.closest(".menu-categoria");
  if (cat && !cat.classList.contains("aberta")) {
    const toggle = cat.querySelector(".menu-categoria-toggle");
    if (toggle && typeof menuAlternarCategoria === "function") menuAlternarCategoria(toggle);
  }
  alvo.click();
}

function layoutIniciar() {
  layoutAplicarRecolhido(layoutLerPreferencia());
  layoutDicasMenu();

  const btn = document.getElementById("sidebar_btn_recolher");
  if (btn) btn.addEventListener("click", layoutAlternarMenu);

  const menu = document.querySelector(".menu");
  if (menu) {
    // fase de captura: expande ANTES do onclick da categoria rodar
    menu.addEventListener("click", function (ev) {
      if (!document.documentElement.classList.contains("sidebar-recolhida")) return;
      if (ev.target.closest(".menu-categoria-toggle")) {
        layoutAplicarRecolhido(false);
        layoutSalvarPreferencia(false);
      }
    }, true);
    new MutationObserver(layoutAtualizarTitulo).observe(menu, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }
  document.querySelectorAll(".module").forEach(function (m) {
    new MutationObserver(layoutAtualizarTitulo).observe(m, { attributes: true, attributeFilter: ["class"] });
  });
  layoutAtualizarTitulo();

  const nome = document.getElementById("auth_usuario_nome");
  if (nome) new MutationObserver(layoutAtualizarAvatar).observe(nome, { childList: true, characterData: true, subtree: true });
  layoutAtualizarAvatar();

  document.querySelectorAll("[data-atalho]").forEach(function (a) {
    a.addEventListener("click", function () { layoutAbrirAtalho(a.getAttribute("data-atalho")); });
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", layoutIniciar);
  else layoutIniciar();
}

if (typeof module !== "undefined") module.exports = { layoutIniciais, layoutTituloModulo };
