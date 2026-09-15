/* Menu lateral — categorias em acordeão (Fase 1 da reestruturação do menu).
   Responsabilidade única: alternar a classe .aberta em .menu-categoria.
   Não interfere em openModule()/estado de módulo ativo (js/core.js) — o
   botão do módulo dentro da categoria continua recebendo .active
   normalmente, esteja a categoria aberta ou fechada. */

function menuAlternarCategoria(botao) {
  const categoria = botao.closest('.menu-categoria');
  if (!categoria) return;

  const jaAberta = categoria.classList.contains('aberta');

  // Accordion: só uma categoria aberta por vez.
  document.querySelectorAll('.menu-categoria.aberta').forEach(function (outra) {
    outra.classList.remove('aberta');
    const outroBotao = outra.querySelector('.menu-categoria-toggle');
    if (outroBotao) outroBotao.setAttribute('aria-expanded', 'false');
  });

  if (!jaAberta) {
    categoria.classList.add('aberta');
    botao.setAttribute('aria-expanded', 'true');
  }
}
