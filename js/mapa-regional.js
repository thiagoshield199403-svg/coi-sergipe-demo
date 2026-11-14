/* MAPA REGIONAL INTERATIVO — único módulo de mapas das regionais
   (#mapa_regional_interativo). O antigo "Mapas das Regionais" (Leaflet) foi
   removido; este módulo não depende do Mapa Operacional (js/mapa.js).
   Prefixo de classes: "mr-".

   Fontes (tudo estático e versionado, carregado por <script> — funciona em file://):
   - MAPA_REGIONAL_DADOS               (js/mapa-regional/dados.js)               — regionais/áreas, municípios, IBGE, código do polo
   - MAPA_REGIONAL_GEOMETRIA           (js/mapa-regional/geometria.js)           — 5 regionais aprovadas (58 municípios)
   - MAPA_REGIONAL_GEOMETRIA_EXPANSAO  (js/mapa-regional/geometria-expansao.js)  — Aracaju, São Cristóvão, Itaporanga: municípios, bairros, pontos
   - MAPA_REGIONAL_SUBDIVISOES         (js/mapa-regional/subdivisoes.js)         — metadados de bairros e localidades (sem código)
   A associação número ↔ território é sempre pelo código IBGE.

   Hierarquia (dois níveis):
   - NÍVEL 1 — município/polo: id = código IBGE. Selecionar destaca o território todo,
     incluindo os bairros dele (realce coordenado em ciano).
   - NÍVEL 2 — bairro (id "b<código IBGE do bairro>") ou localidade (id "l2010-<id>"):
     selecionar destaca só aquele polígono/ponto (realce em laranja).

   Apresentação:
   - MAPA: somente o número do polo (nunca nomes de municípios, bairros ou localidades).
   - LISTA, TOOLTIP: "número — nome" (municípios); nome (bairros/localidades).
   - PAINEL: identificação completa (número, nome, regional; bairro → município).

   Estado único { regional, hover, selecionado } — mapa e lista são desenhados a
   partir dele. Funções de estado e planejamento dos números são puras (testadas
   em js/mapa-regional.test.js). */

/* ===================== ESTADO (funções puras) ===================== */

const MR_REGIONAL_INICIAL = "itabaiana";

function mrEstadoInicial(regional) {
  return { regional: regional || MR_REGIONAL_INICIAL, hover: null, selecionado: null };
}
function mrAoPassar(estado, id) { return Object.assign({}, estado, { hover: id }); }
function mrAoSair(estado, id) {
  // só limpa se quem saiu é quem estava em hover (evita apagar o hover de outro elemento)
  return estado.hover === id ? Object.assign({}, estado, { hover: null }) : estado;
}
/** Clique seleciona; clicar de novo no que já está selecionado limpa a seleção. */
function mrAoClicar(estado, id) {
  return Object.assign({}, estado, { selecionado: estado.selecionado === id ? null : id });
}
function mrLimparSelecao(estado) { return Object.assign({}, estado, { selecionado: null }); }
function mrTrocarRegional(estado, regional) {
  return regional === estado.regional ? estado : mrEstadoInicial(regional);
}
/** Classes de um elemento (mapa ou lista). "pai" = município do bairro/localidade (ou null).
    municipioSelecionado/municipioHover = realce coordenado quando o MUNICÍPIO pai está em foco. */
function mrMarcacao(estado, id, pai) {
  return {
    hover: estado.hover === id,
    selecionado: estado.selecionado === id,
    municipioSelecionado: !!pai && estado.selecionado === pai,
    municipioHover: !!pai && estado.hover === pai,
  };
}
/** Expansão da lista (municípios abertos/fechados). Função pura: devolve um novo conjunto. */
function mrAlternarExpansao(abertos, id) {
  const novo = new Set(abertos);
  if (novo.has(id)) novo.delete(id); else novo.add(id);
  return novo;
}

/* ===================== DADOS ===================== */

function mrRegional(dados, id) {
  return dados.regionais.find(r => r.id === id) || null;
}
function mrMunicipio(dados, ibge) {
  for (const r of dados.regionais) {
    const m = r.municipios.find(x => x.ibge === ibge);
    if (m) return { municipio: m, regional: r };
  }
  return null;
}
/** "350 — Canindé de São Francisco"; município sem código confirmado → só o nome. */
function mrIdentificacao(m) { return m.codigo ? m.codigo + " — " + m.nome : m.nome; }
/** Municípios em ordem crescente de código do polo (sem código por último). */
function mrOrdenarPorCodigo(municipios) {
  const n = m => (m.codigo ? parseInt(m.codigo, 10) : Infinity);
  return municipios.slice().sort((a, b) => n(a) - n(b));
}
/** Bairros e localidades de um município, em ordem alfabética. Nomes repetidos no mesmo
    município (ex.: dois registros IBGE "Porto Grande") recebem "(1 de 2)", "(2 de 2)"
    só na exibição, pela ordem do código IBGE. Função pura. */
function mrSubdivisoesDe(sub, ibge) {
  const ordenar = lista => lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || String(a.codigoIbge || a.id).localeCompare(String(b.codigoIbge || b.id)));
  const rotular = lista => {
    const total = {};
    lista.forEach(x => { total[x.nome] = (total[x.nome] || 0) + 1; });
    const visto = {};
    return lista.map(x => Object.assign({}, x, {
      rotulo: total[x.nome] > 1 ? x.nome + " (" + (visto[x.nome] = (visto[x.nome] || 0) + 1) + " de " + total[x.nome] + ")" : x.nome,
    }));
  };
  if (!sub) return { bairros: [], localidades: [] };
  return {
    bairros: rotular(ordenar(Object.values(sub.bairros || {}).filter(b => b.municipio === ibge))),
    localidades: rotular(ordenar(Object.values(sub.localidades || {}).filter(l => l.municipio === ibge))),
  };
}
/** Descreve qualquer id do mapa: município (IBGE), bairro ("b…") ou localidade ("l…"). */
function mrDescrever(dados, sub, id) {
  if (!id) return null;
  const achado = mrMunicipio(dados, id);
  if (achado) return { tipo: "municipio", id, municipio: achado.municipio, regional: achado.regional, pai: null };
  const item = sub && ((sub.bairros || {})[id] || (sub.localidades || {})[id]);
  if (!item) return null;
  const pai = mrMunicipio(dados, item.municipio);
  const rotulo = (mrSubdivisoesDe(sub, item.municipio)[item.tipo === "bairro" ? "bairros" : "localidades"].find(x => x.id === id) || item).rotulo;
  return { tipo: item.tipo, id, item: Object.assign({}, item, { rotulo }), municipio: pai.municipio, regional: pai.regional, pai: item.municipio };
}
function mrNomeArea(r) { return (r.tipo === "area" ? "Área " : "Regional ") + r.nome; }

/* ===================== NÚMEROS SOBRE O MAPA (planejamento puro) =====================
   Tudo em unidades do viewBox; "k" = pixels de tela por unidade, para que o corpo
   do número seja pensado em PIXELS (legível em qualquer resolução).
   Itens: { ibge, x, y, raio, codigo } — (x, y) é o centro do maior círculo inscrito
   do município (a melhor área interna) e "raio" o raio desse círculo.
   - Cabe no círculo e não colide: número DENTRO do território (grandes e médios).
   - Senão: "chamada" — selo fora do território ligado ao ponto por uma linha
     indicadora discreta (pequenos). Nenhum número é ocultado.
   Resultado: [{ ibge, tipo: "interno"|"chamada", fs, x, y, caixa, linha? }] */

const MR_ROTULO = {
  minPx: 12.5, maxPx: 21, fator: 0.34,     // corpo do número: proporcional ao raio, com limites
  larguraDigito: 0.62,                     // largura média de um algarismo (em "em")
  folgaPx: 3, seloPadX: 5, seloAltura: 1.5,
  guiaPx: [14, 24, 36, 52, 72, 96],        // distâncias extras tentadas para a chamada
};

const mrLimitar = (v, min, max) => Math.max(min, Math.min(max, v));
function mrLarguraTexto(texto, fs) { return String(texto).length * fs * MR_ROTULO.larguraDigito; }
function mrCabeNoCirculo(w, h, raio) { return (w / 2) * (w / 2) + (h / 2) * (h / 2) <= raio * raio * 0.96; }
function mrCaixa(cx, cy, w, h) { return { x: cx - w / 2, y: cy - h / 2, width: w, height: h }; }
function mrDentro(c, lim) { return c.x >= lim[0] && c.y >= lim[1] && c.x + c.width <= lim[2] && c.y + c.height <= lim[3]; }
function mrSobrepoeFolga(a, b, f) {
  return a.x < b.x + b.width + f && b.x < a.x + a.width + f && a.y < b.y + b.height + f && b.y < a.y + a.height + f;
}
/** Segmento p→q cruza o retângulo? (amostragem — suficiente para linhas curtas) */
function mrSegmentoCruza(p, q, c) {
  for (let i = 1; i < 12; i++) {
    const t = i / 12, x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
    if (x > c.x && x < c.x + c.width && y > c.y && y < c.y + c.height) return true;
  }
  return false;
}
/** Ponto da borda da caixa na direção do ponto "a" (onde a linha indicadora encosta no selo). */
function mrBordaNaDirecao(c, a) {
  const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
  const dx = a[0] - cx, dy = a[1] - cy;
  if (!dx && !dy) return [cx, cy];
  const t = Math.min(dx ? (c.width / 2) / Math.abs(dx) : Infinity, dy ? (c.height / 2) / Math.abs(dy) : Infinity);
  return [cx + dx * t, cy + dy * t];
}

function mrPlanejarRotulos(itens, opcoes) {
  const k = opcoes.k, lim = opcoes.limites, R = MR_ROTULO;
  const u = px => px / k; // pixels → unidades
  const folga = u(R.folgaPx);
  const cx = itens.reduce((s, i) => s + i.x, 0) / (itens.length || 1);
  const cy = itens.reduce((s, i) => s + i.y, 0) / (itens.length || 1);
  const aceitos = [];
  const livre = c => aceitos.every(o => !mrSobrepoeFolga(c, o.caixa, folga));
  const plano = new Map();
  const chamadas = [];

  // 1) números internos — maiores primeiro (têm prioridade sobre o espaço)
  [...itens].sort((a, b) => b.raio - a.raio).forEach(it => {
    const fs = u(mrLimitar(it.raio * k * R.fator, R.minPx, R.maxPx));
    const w = mrLarguraTexto(it.codigo, fs), h = fs * 1.08;
    const c = mrCaixa(it.x, it.y, w, h);
    if (mrCabeNoCirculo(w, h, it.raio) && livre(c)) {
      plano.set(it.ibge, { ibge: it.ibge, tipo: "interno", fs, x: it.x, y: it.y, caixa: c });
      aceitos.push({ ibge: it.ibge, caixa: c });
    } else chamadas.push(it);
  });

  // o ponto de ancoragem de cada chamada também é "ocupado" (nenhum selo cobre o ponto de outro)
  chamadas.forEach(it => aceitos.push({ ibge: it.ibge, caixa: mrCaixa(it.x, it.y, u(6), u(6)) }));

  // 2) chamadas: selo fora do território + linha indicadora (menores escolhem primeiro)
  chamadas.sort((a, b) => a.raio - b.raio).forEach(it => {
    const fs = u(R.minPx);
    const w = mrLarguraTexto(it.codigo, fs) + u(R.seloPadX * 2), h = fs * R.seloAltura;
    let ang0 = Math.atan2(it.y - cy, it.x - cx);
    if (it.x === cx && it.y === cy) ang0 = -Math.PI / 2;
    const angulos = [0];
    for (let j = 1; j <= 8; j++) angulos.push(j * Math.PI / 8, -j * Math.PI / 8);
    let melhor = null, melhorPena = Infinity;
    for (const extra of R.guiaPx) {
      const d = it.raio * 0.85 + Math.hypot(w, h) / 2 + u(extra);
      for (const da of angulos) {
        const a = ang0 + da;
        const c = mrCaixa(it.x + Math.cos(a) * d, it.y + Math.sin(a) * d, w, h);
        const fora = !mrDentro(c, lim);
        const colisoes = aceitos.filter(o => o.ibge !== it.ibge && mrSobrepoeFolga(c, o.caixa, folga)).length;
        const borda = mrBordaNaDirecao(c, [it.x, it.y]);
        const cruzamentos = aceitos.filter(o => o.ibge !== it.ibge && mrSegmentoCruza([it.x, it.y], borda, o.caixa)).length;
        const pena = (fora ? 1000 : 0) + colisoes * 10 + cruzamentos;
        if (pena < melhorPena) { melhor = c; melhorPena = pena; }
        if (!pena) break;
      }
      if (!melhorPena) break;
    }
    const borda = mrBordaNaDirecao(melhor, [it.x, it.y]);
    plano.set(it.ibge, {
      ibge: it.ibge, tipo: "chamada", fs, x: melhor.x + melhor.width / 2, y: melhor.y + melhor.height / 2,
      caixa: melhor, linha: [it.x, it.y, borda[0], borda[1]],
    });
    aceitos.push({ ibge: it.ibge, caixa: melhor });
  });

  return itens.map(it => plano.get(it.ibge));
}

/* ===================== APROXIMAÇÃO (câmera; funções puras) =====================
   Janela = retângulo do viewBox visível { x, y, w, h } em unidades do mapa.
   null = vista inteira (a vista aprovada). Limites: a vista inteira ("total"). */
const MR_ZOOM_MAX = 16;
function mrZoomJanela(janela, fator, cx, cy, total) {
  const j = janela || total;
  const w = j.w / fator, h = j.h / fator;
  if (w >= total.w * 0.999) return null; // voltou à vista inteira
  const wMin = total.w / MR_ZOOM_MAX;
  const f = w < wMin ? j.w / wMin : fator;
  const nw = j.w / f, nh = j.h / f;
  return mrPrenderJanela({ x: cx - (cx - j.x) / f, y: cy - (cy - j.y) / f, w: nw, h: nh }, total);
}
function mrMoverJanela(janela, dx, dy, total) {
  if (!janela) return null;
  return mrPrenderJanela({ x: janela.x + dx, y: janela.y + dy, w: janela.w, h: janela.h }, total);
}
function mrPrenderJanela(j, total) {
  return {
    x: Math.min(Math.max(j.x, total.x), total.x + total.w - j.w),
    y: Math.min(Math.max(j.y, total.y), total.y + total.h - j.h),
    w: j.w, h: j.h,
  };
}
/** Janela que enquadra uma caixa (com folga), mantendo a proporção da vista. */
function mrJanelaPara(caixa, total, folga) {
  const fo = folga === undefined ? 0.35 : folga;
  const prop = total.w / total.h;
  let w = caixa.width * (1 + 2 * fo), h = caixa.height * (1 + 2 * fo);
  if (w / h > prop) h = w / prop; else w = h * prop;
  w = Math.max(w, total.w / MR_ZOOM_MAX); h = w / prop;
  if (w >= total.w) return null;
  return mrPrenderJanela({ x: caixa.x + caixa.width / 2 - w / 2, y: caixa.y + caixa.height / 2 - h / 2, w, h }, total);
}

/* ===================== DOM ===================== */

const MR_SVG = "http://www.w3.org/2000/svg";
const MR_FONTE_PADRAO = "Fonte dos limites: IBGE — malha territorial oficial (geodata/).";
const MR_FONTE_IBGE_2022 = "Fontes: IBGE — Malha Municipal 2022 (limites municipais) · Malha de Bairros do Censo 2022 (bairros) · Cadastro de Localidades Selecionadas 2010 (pontos de localidades, sem limite). Áreas sem bairro delimitado aparecem no tom do município.";
let mrEstado = mrEstadoInicial();
let mrMontado = false;
let mrRefs = null;
let mrUltimoTamanho = "";
let mrExpandidos = new Set();
let mrExpansaoIniciada = {};
let mrCamera = null;          // janela aproximada (null = vista inteira)
let mrVistaTotal = null;      // limites da câmera na regional atual
let mrRegionalDesenhada = null;
let mrArrastou = false;

const mrSub = () => (typeof MAPA_REGIONAL_SUBDIVISOES !== "undefined" ? MAPA_REGIONAL_SUBDIVISOES : null);
function mrGeoDe(r) {
  if (typeof MAPA_REGIONAL_GEOMETRIA !== "undefined" && MAPA_REGIONAL_GEOMETRIA[r.geodata]) return MAPA_REGIONAL_GEOMETRIA[r.geodata];
  if (typeof MAPA_REGIONAL_GEOMETRIA_EXPANSAO !== "undefined" && MAPA_REGIONAL_GEOMETRIA_EXPANSAO[r.geodata]) return MAPA_REGIONAL_GEOMETRIA_EXPANSAO[r.geodata];
  return null;
}

function mrEl(tag, attrs, pai) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === "texto") e.textContent = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  if (pai) pai.appendChild(e);
  return e;
}
function mrSvgEl(tag, attrs, pai) {
  const e = document.createElementNS(MR_SVG, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (pai) pai.appendChild(e);
  return e;
}

function mapaRegionalAoAbrir() {
  const raiz = document.getElementById("mr_raiz");
  if (!raiz || typeof MAPA_REGIONAL_DADOS === "undefined" || typeof MAPA_REGIONAL_GEOMETRIA === "undefined") return;
  if (!mrMontado) { mrMontar(raiz); mrMontado = true; }
  mrDesenharRegional();
}

function mrMontar(raiz) {
  const abas = raiz.querySelector(".mr-abas");
  MAPA_REGIONAL_DADOS.regionais.forEach(r => {
    if (!mrGeoDe(r)) return; // área sem geometria carregada não ganha aba
    const b = mrEl("button", { type: "button", class: "mr-aba" + (r.fonte === "ibge-2022" ? " mr-aba-expansao" : ""), "data-regional": r.id, role: "tab", texto: r.nome }, abas);
    b.addEventListener("click", () => { mrDefinirEstado(mrTrocarRegional(mrEstado, r.id)); mrDesenharRegional(); });
  });
  // setas ←/→ (e Home/End) navegam entre as abas das regionais
  abas.addEventListener("keydown", ev => {
    const lista = Array.from(abas.querySelectorAll(".mr-aba"));
    const i = lista.indexOf(document.activeElement);
    if (i < 0) return;
    const alvo = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: lista.length - 1 }[ev.key];
    if (alvo === undefined) return;
    ev.preventDefault();
    const b = lista[(alvo + lista.length) % lista.length];
    b.click();
    b.focus();
  });
  const palco = raiz.querySelector(".mr-palco");
  mrRefs = {
    raiz,
    abas,
    palco,
    tooltip: raiz.querySelector(".mr-tooltip"),
    legenda: raiz.querySelector(".mr-legenda-lista"),
    contagem: raiz.querySelector(".mr-legenda-contagem"),
    ficha: raiz.querySelector(".mr-ficha"),
    fonte: raiz.querySelector(".mr-rodape-fonte"),
    aviso: mrEl("p", { class: "mr-aviso", hidden: "" }, palco),
  };
  // Esc limpa a seleção mesmo quando o foco não está dentro do módulo (ex.: clique num
  // bairro, que não recebe foco) — só enquanto o Mapa Regional é a tela ativa
  document.addEventListener("keydown", ev => {
    if (ev.key !== "Escape" || !mrEstado.selecionado || !raiz.closest(".module.active")) return;
    if (document.querySelector(".modal[style*='flex'], .modal.aberto")) return; // não interfere em modais abertos
    mrDefinirEstado(mrLimparSelecao(mrEstado));
  });
  mrRefs.ficha.addEventListener("click", ev => {
    if (ev.target.closest("[data-mr-limpar]")) mrDefinirEstado(mrLimparSelecao(mrEstado));
    if (ev.target.closest("[data-mr-aproximar]")) mrAproximarSelecao();
  });
  mrMontarZoom(palco);
  // números pensados em pixels: refaz o posicionamento quando o mapa muda de tamanho
  if (typeof ResizeObserver !== "undefined") {
    let quadro = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const svg = mrRefs.palco.querySelector("svg.mr-svg");
        if (!svg) return;
        const b = svg.getBoundingClientRect();
        if (b.width && Math.round(b.width) + "x" + Math.round(b.height) !== mrUltimoTamanho) mrDesenharRotulos();
      });
    }).observe(mrRefs.palco);
  }
}

/* ---- aproximação: botões, roda do mouse e arrasto ---- */
const MR_ICONES_ZOOM = {
  mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="12" y1="6" x2="12" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/></svg>',
  menos: '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="6" y1="12" x2="18" y2="12"/></svg>',
  ajustar: '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="4 9 4 4 9 4"/><polyline points="20 9 20 4 15 4"/><polyline points="4 15 4 20 9 20"/><polyline points="20 15 20 20 15 20"/></svg>',
};
function mrMontarZoom(palco) {
  const caixa = mrEl("div", { class: "mr-zoom", role: "group", "aria-label": "Aproximação do mapa" }, palco);
  const botao = (acao, rotulo) => {
    const b = mrEl("button", { type: "button", class: "mr-zoom-btn", "data-mr-zoom": acao, "aria-label": rotulo, title: rotulo }, caixa);
    b.innerHTML = MR_ICONES_ZOOM[acao];
    return b;
  };
  botao("mais", "Aproximar");
  botao("menos", "Afastar");
  botao("ajustar", "Ver a área inteira");
  caixa.addEventListener("click", ev => {
    const b = ev.target.closest("[data-mr-zoom]");
    if (!b || !mrVistaTotal) return;
    const acao = b.getAttribute("data-mr-zoom");
    if (acao === "ajustar") return mrAplicarCamera(null);
    const j = mrCamera || mrVistaTotal;
    mrAplicarCamera(mrZoomJanela(mrCamera, acao === "mais" ? 1.6 : 1 / 1.6, j.x + j.w / 2, j.y + j.h / 2, mrVistaTotal));
  });
  const pontoSvg = ev => {
    const svg = palco.querySelector("svg.mr-svg");
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  palco.addEventListener("wheel", ev => {
    if (!mrVistaTotal || !palco.querySelector("svg.mr-svg") || ev.target.closest(".mr-zoom")) return;
    ev.preventDefault();
    const p = pontoSvg(ev);
    mrAplicarCamera(mrZoomJanela(mrCamera, ev.deltaY < 0 ? 1.25 : 1 / 1.25, p.x, p.y, mrVistaTotal));
  }, { passive: false });
  // arrastar para mover (só quando aproximado); um arrasto não vira clique
  let inicio = null;
  palco.addEventListener("pointerdown", ev => {
    if (ev.button !== 0 || !mrCamera || ev.target.closest(".mr-zoom")) return;
    inicio = { x: ev.clientX, y: ev.clientY, camera: mrCamera, porUnidade: palco.querySelector("svg.mr-svg").getScreenCTM().a };
    mrArrastou = false;
  });
  palco.addEventListener("pointermove", ev => {
    if (!inicio || !(ev.buttons & 1)) return;
    const dx = ev.clientX - inicio.x, dy = ev.clientY - inicio.y;
    if (!mrArrastou && Math.hypot(dx, dy) < 5) return;
    mrArrastou = true;
    palco.classList.add("mr-arrastando");
    mrCamera = mrMoverJanela(inicio.camera, -dx / inicio.porUnidade, -dy / inicio.porUnidade, mrVistaTotal);
    palco.querySelector("svg.mr-svg").setAttribute("viewBox", [mrCamera.x, mrCamera.y, mrCamera.w, mrCamera.h].map(v => +v.toFixed(1)).join(" "));
  });
  const soltar = () => {
    if (!inicio) return;
    inicio = null;
    palco.classList.remove("mr-arrastando");
    if (mrArrastou) mrDesenharRotulos();
  };
  palco.addEventListener("pointerup", soltar);
  palco.addEventListener("pointercancel", soltar);
  palco.addEventListener("click", ev => { if (mrArrastou) { ev.stopPropagation(); ev.preventDefault(); mrArrastou = false; } }, true);
}
function mrAplicarCamera(nova) {
  mrCamera = nova;
  // a classe muda o tamanho do SVG (aproximado = palco inteiro): aplicar ANTES de medir
  if (mrRefs) mrRefs.palco.classList.toggle("mr-aproximado", !!mrCamera);
  mrDesenharRotulos();
}
/** Aproxima o mapa no item selecionado (município, bairro ou localidade). */
function mrAproximarSelecao() {
  const svg = mrRefs.palco.querySelector("svg.mr-svg");
  const id = mrEstado.selecionado;
  if (!svg || !id || !mrVistaTotal) return;
  const el = svg.querySelector('.mr-municipio[data-id="' + id + '"], .mr-bairro[data-id="' + id + '"], .mr-localidade[data-id="' + id + '"] .mr-localidade-ponto');
  if (!el) return;
  const b = el.getBBox();
  const minimo = mrVistaTotal.w / 30; // localidade (ponto): enquadra o entorno
  const caixa = { x: b.x - Math.max(0, minimo - b.width) / 2, y: b.y - Math.max(0, minimo - b.height) / 2, width: Math.max(b.width, minimo), height: Math.max(b.height, minimo) };
  // município já ocupa boa parte da área: folga pequena; bairro/ponto: mostra o entorno
  mrAplicarCamera(mrJanelaPara(caixa, mrVistaTotal, el.classList.contains("mr-municipio") ? 0.04 : 0.35));
}

/** Redesenha mapa e lista da regional atual (troca de aba). */
function mrDesenharRegional() {
  const r = mrRegional(MAPA_REGIONAL_DADOS, mrEstado.regional);
  const geo = mrGeoDe(r);
  const sub = mrSub();
  if (mrRegionalDesenhada !== r.id) { mrCamera = null; mrRegionalDesenhada = r.id; mrRefs.palco.classList.remove("mr-aproximado"); }
  mrRefs.abas.querySelectorAll(".mr-aba").forEach(b => {
    const ativa = b.getAttribute("data-regional") === r.id;
    b.classList.toggle("mr-aba-ativa", ativa);
    b.setAttribute("aria-selected", ativa ? "true" : "false");
    b.tabIndex = ativa ? 0 : -1;
  });
  mrRefs.aviso.textContent = r.aviso || "";
  mrRefs.aviso.hidden = !r.aviso;
  if (mrRefs.fonte) mrRefs.fonte.textContent = r.fonte === "ibge-2022" ? MR_FONTE_IBGE_2022 : MR_FONTE_PADRAO;
  // área de um município só: a lista já abre expandida (as subdivisões são o conteúdo)
  if (!mrExpansaoIniciada[r.id]) {
    mrExpansaoIniciada[r.id] = true;
    if (r.municipios.length === 1) mrExpandidos = mrAlternarExpansao(mrExpandidos, r.municipios[0].ibge);
  }

  // ---- mapa SVG ----
  const antigo = mrRefs.palco.querySelector("svg.mr-svg");
  if (antigo) antigo.remove();
  const svg = mrSvgEl("svg", {
    class: "mr-svg", viewBox: geo.viewBox.join(" "), role: "group",
    "aria-label": "Mapa — " + mrNomeArea(r), preserveAspectRatio: "xMidYMid meet",
  });
  const camadaBase = mrSvgEl("g", { class: "mr-camada-base" }, svg);
  const camadaBairros = mrSvgEl("g", { class: "mr-camada-bairros" }, svg);
  const camadaContornos = mrSvgEl("g", { class: "mr-camada-contornos", "aria-hidden": "true" }, svg);
  // destaque ABAIXO dos números: o número do município em hover/selecionado continua visível
  mrSvgEl("g", { class: "mr-camada-destaque", "aria-hidden": "true" }, svg);
  mrSvgEl("g", { class: "mr-camada-rotulos", "aria-hidden": "true" }, svg);

  r.municipios.forEach((m, i) => {
    const g = geo.municipios[m.ibge];
    if (!g) return;
    const comSub = !!(geo.bairros && Object.keys(geo.bairros).some(id => sub && sub.bairros[id] && sub.bairros[id].municipio === m.ibge));
    const p = mrSvgEl("path", {
      d: g.d, class: "mr-municipio" + (comSub ? " mr-municipio-com-bairros" : ""), "data-ibge": m.ibge, "data-id": m.ibge, "data-tom": String(i % 4),
      tabindex: "0", role: "button", "aria-label": mrIdentificacao(m),
    }, camadaBase);
    mrLigarInteracao(p, m.ibge, true);
    if (geo.bairros) mrSvgEl("path", { d: g.d, class: "mr-contorno", "data-contorno": m.ibge }, camadaContornos);
  });
  // bairros (nível 2): polígonos sem rótulo; identificação só no tooltip, na lista e no painel
  if (geo.bairros && sub) {
    Object.keys(geo.bairros).forEach(id => {
      const meta = sub.bairros[id];
      if (!meta) return;
      const p = mrSvgEl("path", { d: geo.bairros[id].d, class: "mr-bairro", "data-id": id, "data-pai": meta.municipio }, camadaBairros);
      mrLigarInteracao(p, id, false);
    });
  }
  mrRefs.palco.insertBefore(svg, mrRefs.tooltip);
  mrDesenharRotulos();

  // ---- lista lateral ----
  mrRefs.legenda.textContent = "";
  let nb = 0, nl = 0;
  mrOrdenarPorCodigo(r.municipios).forEach(m => {
    const s = mrSubdivisoesDe(sub, m.ibge);
    nb += s.bairros.length; nl += s.localidades.length;
    const temSub = s.bairros.length + s.localidades.length > 0;
    const li = mrEl("li", { class: temSub ? "mr-arvore-municipio" : null }, mrRefs.legenda);
    const linha = temSub ? mrEl("div", { class: "mr-legenda-linha" }, li) : li;
    const b = mrEl("button", { type: "button", class: "mr-legenda-item", "data-ibge": m.ibge, "data-id": m.ibge, "aria-label": mrIdentificacao(m) }, linha);
    if (m.codigo) {
      mrEl("span", { class: "mr-legenda-num", texto: m.codigo }, b);
      // espaços reais entre as partes: o texto copiado/lido fica "350 — Nome" (o espaçamento visual vem do CSS)
      b.appendChild(document.createTextNode(" "));
      mrEl("span", { class: "mr-legenda-sep", "aria-hidden": "true", texto: "—" }, b);
      b.appendChild(document.createTextNode(" "));
    } else mrEl("span", { class: "mr-legenda-num mr-legenda-num-vazio", title: "Código do polo a confirmar", "aria-hidden": "true", texto: "···" }, b);
    mrEl("span", { class: "mr-legenda-nome", texto: m.nome }, b);
    mrLigarLista(b, m.ibge);
    if (!temSub) return;

    const aberto = mrExpandidos.has(m.ibge);
    const idSub = "mr_sub_" + m.ibge;
    const resumo = [s.bairros.length ? s.bairros.length + " bairros" : "", s.localidades.length ? s.localidades.length + " localidades" : ""].filter(Boolean).join(" e ");
    const exp = mrEl("button", {
      type: "button", class: "mr-expandir", "aria-expanded": aberto ? "true" : "false", "aria-controls": idSub,
      "aria-label": (aberto ? "Recolher " : "Mostrar ") + resumo + " de " + m.nome, title: resumo,
    }, linha);
    mrEl("span", { class: "mr-expandir-qtd", texto: String(s.bairros.length + s.localidades.length) }, exp);
    exp.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>');
    exp.addEventListener("click", () => {
      mrExpandidos = mrAlternarExpansao(mrExpandidos, m.ibge);
      const abre = mrExpandidos.has(m.ibge);
      exp.setAttribute("aria-expanded", abre ? "true" : "false");
      exp.setAttribute("aria-label", (abre ? "Recolher " : "Mostrar ") + resumo + " de " + m.nome);
      ul.hidden = !abre;
    });
    const ul = mrEl("ul", { class: "mr-legenda-sub", id: idSub }, li);
    ul.hidden = !aberto;
    [["Bairros · IBGE Censo 2022", s.bairros], ["Localidades · IBGE 2010 (pontos)", s.localidades]].forEach(([titulo, lista]) => {
      if (!lista.length) return;
      mrEl("li", { class: "mr-legenda-grupo", texto: titulo }, ul);
      lista.forEach(x => {
        const sli = mrEl("li", null, ul);
        const sb = mrEl("button", { type: "button", class: "mr-legenda-item mr-legenda-subitem mr-legenda-" + x.tipo, "data-id": x.id, "data-pai": m.ibge }, sli);
        mrEl("span", { class: "mr-legenda-marca-sub", "aria-hidden": "true" }, sb);
        mrEl("span", { class: "mr-legenda-nome", texto: x.rotulo }, sb);
        if (x.tipo === "localidade") mrEl("span", { class: "mr-legenda-cat", texto: x.categoria }, sb);
        mrLigarLista(sb, x.id);
      });
    });
  });
  mrRefs.contagem.textContent = r.municipios.length + (r.municipios.length === 1 ? " município" : " municípios") +
    (nb ? " · " + nb + " bairros" : "") + (nl ? " · " + nl + " localidades" : "");

  mrAplicar(null, mrEstado);
}

/** Interação de um item da lista (município, bairro ou localidade). */
function mrLigarLista(b, id) {
  // vindo da lista, o tooltip aparece sobre o próprio elemento do mapa (não na última posição do mouse)
  b.addEventListener("pointerenter", () => { mrDefinirEstado(mrAoPassar(mrEstado, id)); mrPosicionarTooltip(null, id); });
  b.addEventListener("pointerleave", () => mrDefinirEstado(mrAoSair(mrEstado, id)));
  b.addEventListener("focus", () => { mrDefinirEstado(mrAoPassar(mrEstado, id)); mrPosicionarTooltip(null, id); });
  b.addEventListener("blur", () => mrDefinirEstado(mrAoSair(mrEstado, id)));
  b.addEventListener("click", () => mrDefinirEstado(mrAoClicar(mrEstado, id)));
}

/** Hover/foco/clique de um elemento do mapa (território, bairro, ponto, número ou selo). */
function mrLigarInteracao(el, id, teclado) {
  el.addEventListener("pointerenter", ev => { mrDefinirEstado(mrAoPassar(mrEstado, id)); mrPosicionarTooltip(ev); });
  el.addEventListener("pointermove", mrPosicionarTooltip);
  el.addEventListener("pointerleave", ev => {
    // passar do território para o próprio número (ou vice-versa) não é "sair" do município
    const destino = ev.relatedTarget && ev.relatedTarget.closest ? ev.relatedTarget.closest("[data-id]") : null;
    if (destino && destino.getAttribute("data-id") === id) return;
    mrDefinirEstado(mrAoSair(mrEstado, id));
  });
  el.addEventListener("click", () => mrDefinirEstado(mrAoClicar(mrEstado, id)));
  if (!teclado) return;
  el.addEventListener("focus", () => { mrDefinirEstado(mrAoPassar(mrEstado, id)); mrPosicionarTooltip(null, id); });
  el.addEventListener("blur", () => mrDefinirEstado(mrAoSair(mrEstado, id)));
  el.addEventListener("keydown", ev => {
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); mrDefinirEstado(mrAoClicar(mrEstado, id)); }
  });
}

/* Números dependem do tamanho real do mapa na tela (corpo pensado em pixels):
   são refeitos ao trocar de regional e ao redimensionar. A seleção NUNCA os move. */
function mrDesenharRotulos() {
  const svg = mrRefs && mrRefs.palco.querySelector("svg.mr-svg");
  if (!svg) return;
  const r = mrRegional(MAPA_REGIONAL_DADOS, mrEstado.regional);
  const geo = mrGeoDe(r);
  const [, , W, H] = geo.viewBox;
  const caixaTela = svg.getBoundingClientRect();
  if (!caixaTela.width || !caixaTela.height) return; // módulo oculto: refaz ao abrir
  mrUltimoTamanho = Math.round(caixaTela.width) + "x" + Math.round(caixaTela.height);

  // margem reservada para os selos fora do território; depois o viewBox é
  // recortado ao que foi realmente usado, para o mapa ocupar o máximo da tela
  const P = Math.max(W, H) * 0.07;
  mrVistaTotal = { x: -P, y: -P, w: W + 2 * P, h: H + 2 * P };
  const cam = mrCamera;
  // aproximado: k e limites vêm da janela da câmera (os números continuam em pixels)
  const k = cam ? Math.min(caixaTela.width / cam.w, caixaTela.height / cam.h)
    : Math.min(caixaTela.width / (W + 2 * P), caixaTela.height / (H + 2 * P));
  const limites = cam ? [cam.x, cam.y, cam.x + cam.w, cam.y + cam.h] : [-P, -P, W + P, H + P];
  const itens = r.municipios.filter(m => geo.municipios[m.ibge] && m.codigo).map(m => {
    const g = geo.municipios[m.ibge];
    return { ibge: m.ibge, x: g.rotulo[0], y: g.rotulo[1], raio: g.raio, codigo: m.codigo };
  });
  const plano = mrPlanejarRotulos(itens, { k, limites });

  const camada = svg.querySelector(".mr-camada-rotulos");
  camada.textContent = "";
  camada.style.setProperty("--mr-halo", (3 / k).toFixed(2) + "px");
  mrDesenharLocalidades(camada, geo, k); // pontos ficam ABAIXO dos números
  let x0 = 0, y0 = 0, x1 = W, y1 = H;
  plano.forEach((p, i) => {
    const g = mrSvgEl("g", { class: "mr-marca mr-marca-" + p.tipo, "data-ibge": p.ibge, "data-id": p.ibge }, camada);
    if (p.tipo === "chamada") {
      mrSvgEl("line", { class: "mr-guia", x1: p.linha[0], y1: p.linha[1], x2: p.linha[2], y2: p.linha[3] }, g);
      mrSvgEl("circle", { class: "mr-ancora", cx: p.linha[0], cy: p.linha[1], r: (2.6 / k).toFixed(2) }, g);
      mrSvgEl("rect", { class: "mr-selo", x: p.caixa.x, y: p.caixa.y, width: p.caixa.width, height: p.caixa.height, rx: (5 / k).toFixed(2) }, g);
    }
    mrLigarInteracao(g, p.ibge, false); // clicar/passar sobre o NÚMERO = sobre o município
    const t = mrSvgEl("text", { class: "mr-rotulo-num", x: p.x, y: p.y, "font-size": p.fs.toFixed(2) }, g);
    t.textContent = itens[i].codigo;
    x0 = Math.min(x0, p.caixa.x); y0 = Math.min(y0, p.caixa.y);
    x1 = Math.max(x1, p.caixa.x + p.caixa.width); y1 = Math.max(y1, p.caixa.y + p.caixa.height);
  });
  const m = 4 / k;
  const vb = cam ? [cam.x, cam.y, cam.w, cam.h] : [x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m];
  svg.setAttribute("viewBox", vb.map(v => +v.toFixed(1)).join(" "));
  mrMarcarClasses(mrEstado);
}

/** Retângulos que se sobrepõem (com folga de 2 unidades). Função pura. */
function mrSobrepoe(a, b) { return mrSobrepoeFolga(a, b, 2); }

/** Pontos de localidades (IBGE 2010): marcadores discretos, sem nome escrito no mapa. */
function mrDesenharLocalidades(camada, geo, k) {
  const sub = mrSub();
  if (!geo.localidades || !sub) return;
  Object.keys(geo.localidades).forEach(id => {
    const meta = sub.localidades[id];
    if (!meta) return;
    const [x, y] = geo.localidades[id].ponto;
    const sede = /Sede/.test(meta.categoria);
    const g = mrSvgEl("g", { class: "mr-localidade" + (sede ? " mr-localidade-sede" : ""), "data-id": id, "data-pai": meta.municipio }, camada);
    mrSvgEl("circle", { class: "mr-localidade-alvo", cx: x, cy: y, r: (9 / k).toFixed(2) }, g); // área de toque maior
    mrSvgEl("circle", { class: "mr-localidade-ponto", cx: x, cy: y, r: ((sede ? 5 : 3.6) / k).toFixed(2) }, g);
    mrLigarInteracao(g, id, false);
  });
}

function mrDefinirEstado(novo) {
  const anterior = mrEstado;
  mrEstado = novo;
  if (anterior !== novo) mrAplicar(anterior, novo);
}

function mrMarcarClasses(estado) {
  mrRefs.raiz.querySelectorAll(".mr-municipio, .mr-legenda-item, .mr-marca, .mr-bairro, .mr-localidade, .mr-contorno").forEach(el => {
    const id = el.getAttribute("data-id") || el.getAttribute("data-contorno");
    const m = mrMarcacao(estado, id, el.getAttribute("data-pai"));
    el.classList.toggle("mr-hover", m.hover);
    el.classList.toggle("mr-selecionado", m.selecionado);
    el.classList.toggle("mr-municipio-sel", m.municipioSelecionado);
    el.classList.toggle("mr-municipio-hover", m.municipioHover);
  });
}

/** Aplica o estado ao DOM: classes no mapa e na lista, camada de destaque, tooltip e painel. */
function mrAplicar(anterior, estado) {
  if (!mrRefs) return;
  const svg = mrRefs.palco.querySelector("svg.mr-svg");
  mrMarcarClasses(estado);

  // camada de destaque: cópias do contorno por cima dos vizinhos (o original não sai do lugar,
  // então o hover não "pula" de elemento). Selecionado embaixo, hover em cima.
  if (svg) {
    const camada = svg.querySelector(".mr-camada-destaque");
    if (!anterior || anterior.selecionado !== estado.selecionado) mrTrocarDestaque(camada, "mr-destaque-sel", estado.selecionado, true);
    if (!anterior || anterior.hover !== estado.hover) mrTrocarDestaque(camada, "mr-destaque-hover", estado.hover !== estado.selecionado ? estado.hover : null, false);
  }

  if (!estado.hover) mrRefs.tooltip.classList.remove("mr-tooltip-visivel");
  else mrPreencherTooltip(estado.hover);

  if (!anterior || anterior.selecionado !== estado.selecionado) {
    mrPreencherFicha(estado.selecionado);
    const d = estado.selecionado && mrDescrever(MAPA_REGIONAL_DADOS, mrSub(), estado.selecionado);
    // bairro/localidade selecionado no mapa: abre o município dele na lista
    if (d && d.pai && !mrExpandidos.has(d.pai)) {
      const exp = mrRefs.legenda.querySelector('.mr-expandir[aria-controls="mr_sub_' + d.pai + '"]');
      if (exp) exp.click();
    }
    const item = estado.selecionado && mrRefs.legenda.querySelector('.mr-legenda-item[data-id="' + estado.selecionado + '"]');
    if (anterior && item && item.scrollIntoView) item.scrollIntoView({ block: "nearest" });
  }
}

function mrTrocarDestaque(camada, classe, id, selecionado) {
  camada.querySelectorAll("." + classe).forEach(antigo => {
    antigo.classList.add("mr-destaque-saindo");
    setTimeout(() => antigo.remove(), 180);
  });
  if (!id) return;
  const base = camada.ownerSVGElement.querySelector('.mr-municipio[data-id="' + id + '"], .mr-bairro[data-id="' + id + '"]');
  if (!base) return; // localidade: o próprio ponto muda de estilo (classes), sem cópia
  const copia = base.cloneNode(false);
  ["tabindex", "role", "aria-label", "data-id", "data-ibge", "data-pai"].forEach(a => copia.removeAttribute(a));
  const tipo = base.classList.contains("mr-bairro") ? " mr-destaque-bairro"
    : base.classList.contains("mr-municipio-com-bairros") ? " mr-destaque-com-bairros" : "";
  copia.setAttribute("class", "mr-destaque " + classe + tipo + " mr-destaque-entrando");
  if (selecionado) camada.insertBefore(copia, camada.firstChild); else camada.appendChild(copia);
  requestAnimationFrame(() => requestAnimationFrame(() => copia.classList.remove("mr-destaque-entrando")));
}

function mrPreencherTooltip(id) {
  const d = mrDescrever(MAPA_REGIONAL_DADOS, mrSub(), id);
  if (!d) return;
  const t = mrRefs.tooltip;
  t.textContent = "";
  const topo = mrEl("div", { class: "mr-tooltip-topo" }, t);
  if (d.tipo === "municipio") {
    if (d.municipio.codigo) {
      mrEl("span", { class: "mr-tooltip-num", texto: d.municipio.codigo }, topo);
      topo.appendChild(document.createTextNode(" "));
      mrEl("span", { class: "mr-tooltip-sep", "aria-hidden": "true", texto: "—" }, topo);
      topo.appendChild(document.createTextNode(" "));
    }
    mrEl("strong", { texto: d.municipio.nome }, topo);
    mrEl("span", { class: "mr-tooltip-regional", texto: mrNomeArea(d.regional) + (d.municipio.codigo ? "" : " · código do polo a confirmar") }, t);
    t.setAttribute("aria-label", mrIdentificacao(d.municipio));
  } else {
    mrEl("strong", { texto: d.item.rotulo }, topo);
    mrEl("span", { class: "mr-tooltip-regional", texto: (d.tipo === "bairro" ? "Bairro" : d.item.categoria) + " · " + mrIdentificacao(d.municipio) }, t);
    t.setAttribute("aria-label", d.item.rotulo + ", " + mrIdentificacao(d.municipio));
  }
  t.classList.add("mr-tooltip-visivel");
}

function mrPosicionarTooltip(ev, idTeclado) {
  const palco = mrRefs.palco.getBoundingClientRect();
  let x, y;
  if (ev) { x = ev.clientX - palco.left; y = ev.clientY - palco.top; }
  else {
    const p = mrRefs.palco.querySelector('.mr-municipio[data-id="' + idTeclado + '"], .mr-bairro[data-id="' + idTeclado + '"], .mr-localidade[data-id="' + idTeclado + '"] .mr-localidade-ponto');
    if (!p) return;
    const b = p.getBoundingClientRect();
    x = b.left + b.width / 2 - palco.left; y = b.top + b.height / 2 - palco.top;
  }
  const t = mrRefs.tooltip;
  const dx = x + 16 + t.offsetWidth > palco.width ? -t.offsetWidth - 14 : 16;
  const dy = y + 14 + t.offsetHeight > palco.height ? -t.offsetHeight - 12 : 14;
  t.style.transform = "translate(" + Math.round(Math.max(4, x + dx)) + "px," + Math.round(Math.max(4, y + dy)) + "px)";
}

function mrPreencherFicha(id) {
  const f = mrRefs.ficha;
  f.textContent = "";
  f.classList.remove("mr-ficha-bairro");
  const d = id && mrDescrever(MAPA_REGIONAL_DADOS, mrSub(), id);
  if (!d) {
    f.classList.add("mr-ficha-vazia");
    const r = mrRegional(MAPA_REGIONAL_DADOS, mrEstado.regional);
    const temSub = r && r.fonte === "ibge-2022";
    mrEl("p", { class: "mr-ficha-dica", texto: temSub
      ? "Selecione um município (número) ou abra a lista para escolher um bairro ou localidade. Clique de novo ou Esc limpa a seleção."
      : "Selecione um município no mapa ou na lista para ver a identificação. Esc limpa a seleção." }, f);
    return;
  }
  f.classList.remove("mr-ficha-vazia");
  const topo = mrEl("div", { class: "mr-ficha-topo" }, f);
  const rotulos = { municipio: "Município selecionado", bairro: "Bairro selecionado", localidade: "Localidade selecionada" };
  mrEl("span", { class: "mr-ficha-rotulo", texto: rotulos[d.tipo] }, topo);
  mrEl("button", { type: "button", class: "mr-ficha-limpar", "data-mr-limpar": "", "aria-label": "Limpar seleção", title: "Limpar seleção (Esc)", texto: "×" }, topo);
  const titulo = mrEl("h3", { class: "mr-ficha-nome" }, f);
  const dados = [];
  if (d.tipo === "municipio") {
    const m = d.municipio;
    if (m.codigo) {
      mrEl("span", { class: "mr-ficha-num", texto: m.codigo }, titulo);
      mrEl("span", { class: "mr-ficha-sep", "aria-hidden": "true", texto: " — " }, titulo);
    }
    mrEl("span", { class: "mr-ficha-municipio", texto: m.nome }, titulo);
    dados.push([d.regional.tipo === "area" ? "Área" : "Regional", d.regional.nome], ["Código do polo", m.codigo || "A confirmar"], ["Código IBGE", m.ibge]);
    const sub = mrSub();
    const resumo = sub && sub.municipios && sub.municipios[m.ibge];
    if (resumo) {
      if (resumo.bairros) dados.push(["Bairros (IBGE 2022)", resumo.bairros + " · " + String(resumo.coberturaBairros).replace(".", ",") + "% do território"]);
      if (resumo.localidades) dados.push(["Localidades (IBGE 2010)", String(resumo.localidades)]);
    }
  } else {
    f.classList.add("mr-ficha-bairro");
    mrEl("span", { class: "mr-ficha-municipio", texto: d.item.rotulo }, titulo);
    dados.push(["Município", mrIdentificacao(d.municipio)], [d.regional.tipo === "area" ? "Área" : "Regional", d.regional.nome]);
    if (d.tipo === "bairro") dados.push(["Delimitação", "Oficial (IBGE)"], ["Código IBGE do bairro", d.item.codigoIbge]);
    else dados.push(["Categoria", d.item.categoria], ["Delimitação", "Ponto — sem limite"]);
    dados.push(["Fonte", d.tipo === "bairro" ? "IBGE · Censo 2022" : "IBGE · Localidades 2010"]);
  }
  const dl = mrEl("dl", { class: "mr-ficha-dados" }, f);
  dados.forEach(([k, v]) => { mrEl("dt", { texto: k }, dl); mrEl("dd", { texto: v }, dl); });
  if (d.tipo === "municipio" && d.regional.aviso) mrEl("p", { class: "mr-ficha-aviso", texto: d.regional.aviso }, f);
  mrEl("button", { type: "button", class: "mr-ficha-aproximar", "data-mr-aproximar": "", texto: "Aproximar no mapa" }, f);
}

if (typeof module !== "undefined") {
  module.exports = {
    mrEstadoInicial, mrAoPassar, mrAoSair, mrAoClicar, mrLimparSelecao, mrTrocarRegional, mrMarcacao, mrAlternarExpansao,
    mrRegional, mrMunicipio, mrIdentificacao, mrOrdenarPorCodigo, mrSubdivisoesDe, mrDescrever, mrSobrepoe, mrSobrepoeFolga,
    mrPlanejarRotulos, MR_ROTULO, mrZoomJanela, mrMoverJanela, mrJanelaPara, MR_ZOOM_MAX,
  };
}
