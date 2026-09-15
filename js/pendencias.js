/* PENDÊNCIAS (Fase 3, etapa 4) — frontend sobre a API já concluída na
   etapa 3 (backend/app/routers/pendencias.py). COMPARTILHADA por polo, ao
   contrário dos 6 Scripts (privados por operador) — este arquivo nunca lê
   nem grava nada em localStorage/sessionStorage para dados de pendência; a
   API é sempre a fonte de verdade (GET refeito após toda escrita).

   Convenções seguidas de js/equipes.js: authChamarApi()/authObterSessao()
   (js/auth.js) para toda chamada, headers só com Bearer token, escape
   manual de qualquer texto do usuário antes de innerHTML, mensagens de
   erro extraídas do corpo da resposta (nunca stack trace). */

/* ================= ESTADO ================= */

let pendenciasCachePolos = [];
let pendenciasCacheCategorias = [];
let pendenciasCacheSubmotivos = [];
let pendenciasListaAtual = [];
let pendenciasFiltroTipoAtivo = "TODAS"; // TODAS | COMERCIAL | TECNICA (subnav)
let pendenciasDetalheAtual = null;
let pendenciasAcaoConfirmar = null; // { tipo: "executar"|"cancelar", id }
let pendenciasCarregandoLista = false;

const PENDENCIAS_STATUS_ROTULO = {
  PENDENTE: "Pendente",
  EXECUTADA: "Executada",
  CANCELADA: "Cancelada",
};

const PENDENCIAS_TIPO_ROTULO = {
  TECNICA: "Técnica",
  COMERCIAL: "Comercial",
};

/* ================= FUNÇÕES PURAS (testadas em js/pendencias.test.js) ================= */

function pendenciasEscapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto === null || texto === undefined ? "" : String(texto);
  return div.innerHTML;
}

// Mesmo formato de equipesExtrairMensagemErro (js/equipes.js) — nunca deixa
// um array/objeto cru virar "[object Object]" num elemento de erro.
function pendenciasExtrairMensagemErro(corpo) {
  if (!corpo) return null;
  if (typeof corpo === "string") return corpo;

  const detail = corpo.detail;
  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const mensagens = detail
      .map(item => (item && typeof item === "object" && typeof item.msg === "string") ? item.msg : null)
      .filter(Boolean);
    if (mensagens.length > 0) return mensagens.join(" | ");
  }

  return null;
}

// null = sem indicador (sem data_vencimento OU pendência não está mais
// PENDENTE — "o status continua sendo PENDENTE até execução/cancelamento,
// só o indicador visual muda", item 15 da Etapa 4: uma pendência já
// executada/cancelada não deve mais aparecer como "vencida").
function pendenciasClassificarVencimento(dataVencimentoISO, status, hojeISO) {
  if (!dataVencimentoISO || status !== "PENDENTE") return null;
  if (dataVencimentoISO === hojeISO) return "vence_hoje";
  return dataVencimentoISO < hojeISO ? "vencida" : "normal";
}

function pendenciasUsuarioEhPrivilegiado(perfis) {
  if (!Array.isArray(perfis)) return false;
  return perfis.includes("SUPERVISOR") || perfis.includes("ADMINISTRADOR");
}

function pendenciasFormatarDataBR(isoData) {
  if (!isoData) return "";
  const [ano, mes, dia] = isoData.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Só inclui na querystring os filtros que GET /api/pendencias REALMENTE
// suporta (ver backend/app/routers/pendencias.py::listar_pendencias) — não
// inventa parâmetro novo (Etapa 4, item 8). "busca" (código/OS/INC/SS/
// descrição por substring) NÃO é filtro de servidor — a API só aceita
// os_numero/inc_numero/ss_numero por igualdade exata, e não tem filtro
// nenhum de "codigo" — por isso a busca é sempre local (ver
// pendenciasFiltrarListaLocal), nunca vira parâmetro aqui.
function pendenciasMontarQueryFiltros(filtros) {
  const params = {};
  const mapaSuportado = [
    "polo", "tipo", "categoria_id", "submotivo_id", "responsabilidade",
    "status", "os_numero", "inc_numero", "ss_numero", "entra_passagem_turno",
    "data_vencimento", "criado_em_de", "criado_em_ate",
  ];
  mapaSuportado.forEach(chave => {
    const valor = filtros ? filtros[chave] : undefined;
    if (valor !== undefined && valor !== null && valor !== "") {
      params[chave] = valor;
    }
  });
  return params;
}

// Busca client-side sobre a página já carregada — nunca fonte de verdade,
// só refina visualmente o que já veio da API (ver comentário acima).
function pendenciasFiltrarListaLocal(lista, textoBusca) {
  const alvo = (textoBusca || "").trim().toLowerCase();
  if (!alvo) return lista;
  return lista.filter(p => {
    const campos = [p.codigo, p.os_numero, p.inc_numero, p.ss_numero, p.descricao];
    return campos.some(c => c && String(c).toLowerCase().includes(alvo));
  });
}

function pendenciasResumo(lista, hojeISO) {
  const resumo = { total: lista.length, pendentes: 0, vencidas: 0, hoje: 0 };
  lista.forEach(p => {
    if (p.status !== "PENDENTE") return;
    resumo.pendentes++;
    const classe = pendenciasClassificarVencimento(p.data_vencimento, p.status, hojeISO);
    if (classe === "vencida") resumo.vencidas++;
    if (classe === "vence_hoje") resumo.hoje++;
  });
  return resumo;
}

function pendenciasRotuloStatus(status) {
  return PENDENCIAS_STATUS_ROTULO[status] || status || "";
}

function pendenciasRotuloTipo(tipo) {
  return PENDENCIAS_TIPO_ROTULO[tipo] || tipo || "";
}

/* ================= INTEGRAÇÃO COM API ================= */

function pendenciasHeaders() {
  const sessao = authObterSessao();
  return sessao && sessao.access_token ? { "Authorization": "Bearer " + sessao.access_token } : {};
}

function pendenciasSessaoUsuario() {
  const sessao = authObterSessao();
  return sessao && sessao.usuario ? sessao.usuario : null;
}

function pendenciasUsuarioAtualEhPrivilegiado() {
  const usuario = pendenciasSessaoUsuario();
  return usuario ? pendenciasUsuarioEhPrivilegiado(usuario.perfis) : false;
}

// Tratamento único de erro HTTP (Etapa 4, item 19) — nunca mostra o corpo
// cru/stack trace; 401 devolve pro login (mesma sessão inválida que
// authValidarSessaoAtual já trataria no próximo F5, só antecipamos aqui).
function pendenciasMensagemHttp(resposta) {
  if (resposta.status === 401) return "Sua sessão expirou. Faça login novamente.";
  if (resposta.status === 404) return "Pendência não encontrada — pode ter sido removida.";
  if (resposta.status === 0) return "Não foi possível contatar o servidor. Verifique sua conexão.";
  const doCorpo = pendenciasExtrairMensagemErro(resposta.corpo);
  if (doCorpo) return doCorpo;
  if (resposta.status === 403) return "Você não tem permissão para esta ação.";
  if (resposta.status === 409) return "Esta pendência já foi alterada por outro operador.";
  if (resposta.status >= 500) return "Erro interno no servidor. Tente novamente em instantes.";
  return "Não foi possível concluir a operação.";
}

async function pendenciasApi(caminho, opcoes) {
  const r = await authChamarApi(caminho, opcoes);
  if (r.status === 401) {
    // Mesma política do resto do sistema: sem redirecionamento mágico —
    // mostra a mensagem no contexto atual (modal/lista), o operador decide
    // quando recarregar/logar de novo.
  }
  return r;
}

function pendenciasQueryString(params) {
  const partes = Object.keys(params).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
  return partes.length ? "?" + partes.join("&") : "";
}

/* ================= CARGA DE LISTAS AUXILIARES ================= */

async function pendenciasCarregarPolos() {
  const r = await pendenciasApi("/api/teams/polos", { headers: pendenciasHeaders() });
  pendenciasCachePolos = r.ok ? r.corpo : [];
  const select = document.getElementById("pend_filtro_polo");
  if (!select) return;
  const valorAtual = select.value;
  select.innerHTML = '<option value="">Polo (todos)</option>';
  pendenciasCachePolos.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });
  select.value = valorAtual;

  const selectForm = document.getElementById("pend_form_polo");
  if (selectForm) {
    selectForm.innerHTML = '<option value="">Selecione</option>';
    pendenciasCachePolos.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      selectForm.appendChild(opt);
    });
  }
}

async function pendenciasCarregarCategorias() {
  const r = await pendenciasApi("/api/pendencias/categorias", { headers: pendenciasHeaders() });
  pendenciasCacheCategorias = r.ok ? r.corpo : [];
}

async function pendenciasCarregarSubmotivos() {
  const r = await pendenciasApi("/api/pendencias/submotivos", { headers: pendenciasHeaders() });
  pendenciasCacheSubmotivos = r.ok ? r.corpo : [];
}

function pendenciasTipoEfetivo() {
  // Subnav TODAS não filtra por tipo; COMERCIAL/TECNICA filtram tanto a
  // lista quanto o formulário de cadastro.
  return pendenciasFiltroTipoAtivo === "TODAS" ? null : pendenciasFiltroTipoAtivo;
}

function pendenciasPopularFiltroCategoria() {
  const select = document.getElementById("pend_filtro_categoria");
  if (!select) return;
  const tipo = pendenciasTipoEfetivo();
  const valorAtual = select.value;
  select.innerHTML = '<option value="">Categoria (todas)</option>';
  pendenciasCacheCategorias
    .filter(c => !tipo || c.tipo === tipo)
    .forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.nome;
      select.appendChild(opt);
    });
  select.value = [...select.options].some(o => o.value === valorAtual) ? valorAtual : "";
  pendenciasPopularFiltroSubmotivo();
}

function pendenciasPopularFiltroSubmotivo() {
  const select = document.getElementById("pend_filtro_submotivo");
  if (!select) return;
  const categoriaId = document.getElementById("pend_filtro_categoria").value;
  const valorAtual = select.value;
  select.innerHTML = '<option value="">Submotivo (todos)</option>';
  pendenciasCacheSubmotivos
    .filter(s => !categoriaId || s.categoria_id === categoriaId)
    .forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.nome;
      select.appendChild(opt);
    });
  select.value = [...select.options].some(o => o.value === valorAtual) ? valorAtual : "";
}

/* ================= LISTAGEM ================= */

function pendenciasFiltrosAtivos() {
  return {
    polo: document.getElementById("pend_filtro_polo").value,
    tipo: pendenciasTipoEfetivo(),
    status: document.getElementById("pend_filtro_status").value,
    categoria_id: document.getElementById("pend_filtro_categoria").value,
    submotivo_id: document.getElementById("pend_filtro_submotivo").value,
    responsabilidade: document.getElementById("pend_filtro_responsabilidade").value.trim(),
  };
}

async function pendenciasCarregarLista() {
  if (pendenciasCarregandoLista) return; // evita chamadas duplicadas sobrepostas
  pendenciasCarregandoLista = true;
  pendenciasMostrarErroLista("");
  try {
    const query = pendenciasQueryString(pendenciasMontarQueryFiltros(pendenciasFiltrosAtivos()));
    const r = await pendenciasApi("/api/pendencias" + query, { headers: pendenciasHeaders() });
    if (!r.ok) {
      pendenciasListaAtual = [];
      pendenciasMostrarErroLista(pendenciasMensagemHttp(r));
      pendenciasRenderizarLista();
      return;
    }
    pendenciasListaAtual = r.corpo;
    pendenciasRenderizarLista();
  } finally {
    pendenciasCarregandoLista = false;
  }
}

function pendenciasMostrarErroLista(mensagem) {
  const el = document.getElementById("pend_erro_lista");
  if (!el) return;
  el.textContent = mensagem || "";
  el.style.display = mensagem ? "block" : "none";
}

function pendenciasHojeISO() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function pendenciasRenderizarLista() {
  const textoBusca = document.getElementById("pend_filtro_busca").value;
  const hojeISO = pendenciasHojeISO();
  const listaFiltrada = pendenciasFiltrarListaLocal(pendenciasListaAtual, textoBusca);

  const resumo = pendenciasResumo(pendenciasListaAtual, hojeISO);
  document.getElementById("pend_resumo_total").textContent = resumo.total;
  document.getElementById("pend_resumo_pendentes").textContent = resumo.pendentes;
  document.getElementById("pend_resumo_vencidas").textContent = resumo.vencidas;
  document.getElementById("pend_resumo_hoje").textContent = resumo.hoje;

  const container = document.getElementById("pend_lista");
  const vazio = document.getElementById("pend_vazio");
  container.innerHTML = "";

  if (listaFiltrada.length === 0) {
    vazio.style.display = "block";
    return;
  }
  vazio.style.display = "none";

  listaFiltrada.forEach(p => {
    container.appendChild(pendenciasConstruirCard(p, hojeISO));
  });
}

function pendenciasConstruirCard(p, hojeISO) {
  const div = document.createElement("div");
  div.className = "pendencias-card pendencias-card-" + p.status.toLowerCase();
  div.dataset.pendenciaId = p.id;

  const classeVencimento = pendenciasClassificarVencimento(p.data_vencimento, p.status, hojeISO);
  const vencimentoHtml = p.data_vencimento
    ? `<span class="pendencias-vencimento pendencias-vencimento-${classeVencimento || "normal"}">
         Vencimento: ${pendenciasEscapar(pendenciasFormatarDataBR(p.data_vencimento))}
         ${classeVencimento === "vencida" ? " — VENCIDA" : ""}
         ${classeVencimento === "vence_hoje" ? " — VENCE HOJE" : ""}
       </span>`
    : "";

  // causa/subcausa (modo texto livre) ficam ausentes em pendências criadas
  // pelo modo catálogo — mesma regra de "só mostrar o que existir" do
  // detalhe (ver PENDENCIAS_CAMPOS_DETALHE).
  const causaSubcausaHtml = (p.causa || p.subcausa)
    ? `<div class="pendencias-card-linha"><strong>Causa/Subcausa:</strong> ${pendenciasEscapar([p.causa, p.subcausa].filter(Boolean).join(" / "))}</div>`
    : "";

  div.innerHTML = `
    <div class="pendencias-card-topo">
      <span class="pendencias-card-codigo">${pendenciasEscapar(p.codigo)}</span>
      <span class="pendencias-badge pendencias-badge-${p.status.toLowerCase()}">${pendenciasEscapar(pendenciasRotuloStatus(p.status))}</span>
    </div>
    <div class="pendencias-card-linha"><strong>Polo:</strong> ${pendenciasEscapar(p.polo)}</div>
    <div class="pendencias-card-linha"><strong>Tipo:</strong> ${pendenciasEscapar(pendenciasRotuloTipo(p.tipo))}</div>
    ${causaSubcausaHtml}
    <div class="pendencias-card-linha pendencias-card-descricao">${pendenciasEscapar(p.descricao)}</div>
    <div class="pendencias-card-linha"><strong>Responsabilidade:</strong> ${pendenciasEscapar(p.responsabilidade)}</div>
    <div class="pendencias-card-linha">
      <strong>Passagem de turno:</strong> ${p.entra_passagem_turno ? "SIM" : "NÃO"}
    </div>
    ${vencimentoHtml}
    <button type="button" class="sec pendencias-btn-detalhes">Ver detalhes</button>
  `;
  div.querySelector(".pendencias-btn-detalhes").addEventListener("click", () => pendenciasAbrirDetalhe(p.id));
  return div;
}

/* ================= SUBNAV (Todas / Comerciais / Técnicas) ================= */

function pendenciasSelecionarSubnav(tipo) {
  pendenciasFiltroTipoAtivo = tipo;
  document.querySelectorAll(".pendencias-subnav-btn").forEach(btn => {
    btn.classList.toggle("ativo", btn.dataset.tipo === tipo);
  });
  pendenciasPopularFiltroCategoria();
  pendenciasCarregarLista();
}

/* ================= ABERTURA DO MÓDULO (chamada pelo menu) ================= */

async function pendenciasAoAbrir(tipoInicial) {
  document.getElementById("pend_filtro_status").value = "";
  document.getElementById("pend_filtro_busca").value = "";
  document.getElementById("pend_filtro_responsabilidade").value = "";

  if (pendenciasCacheCategorias.length === 0) await pendenciasCarregarCategorias();
  if (pendenciasCacheSubmotivos.length === 0) await pendenciasCarregarSubmotivos();
  if (pendenciasCachePolos.length === 0) await pendenciasCarregarPolos();

  pendenciasSelecionarSubnav(tipoInicial || "TODAS");
}

/* ================= NOVA PENDÊNCIA ================= */

function pendenciasAbrirModalNovo() {
  document.getElementById("pend_form_erro").style.display = "none";
  document.getElementById("pend_form_descricao").value = "";
  document.getElementById("pend_form_observacao").value = "";
  document.getElementById("pend_form_vencimento").value = "";
  document.getElementById("pend_form_os").value = "";
  document.getElementById("pend_form_inc").value = "";
  document.getElementById("pend_form_ss_comercial").value = "";
  document.getElementById("pend_form_ss_tecnica").value = "";
  document.getElementById("pend_form_responsabilidade").value = "";
  document.getElementById("pend_form_passagem_turno").checked = false;
  document.getElementById("pend_form_causa").value = "";
  document.getElementById("pend_form_subcausa").value = "";
  pendenciasDefinirCamposPrivilegiados(true); // cadastro atual é sempre texto livre, sem submotivo pré-cadastrado

  const tipoInicial = pendenciasFiltroTipoAtivo === "COMERCIAL" ? "COMERCIAL" : "TECNICA";
  pendenciasSelecionarTipoForm(tipoInicial);
  document.getElementById("pend_modal_novo").style.display = "flex";
}

function pendenciasFecharModalNovo() {
  document.getElementById("pend_modal_novo").style.display = "none";
}

function pendenciasSelecionarTipoForm(tipo) {
  document.querySelectorAll(".pendencias-tipo-btn").forEach(btn => {
    btn.classList.toggle("ativo", btn.dataset.tipo === tipo);
  });
  // Não usar a propriedade `hidden` sozinha: `.linha-2{display:grid}`
  // (styles.css) empata em especificidade com o `[hidden]{display:none}`
  // do user-agent, e estilo de autor sempre vence UA nesse empate — o
  // hidden é ignorado silenciosamente. `.pendencias-oculto` (com
  // !important em css/pendencias.css) resolve isso.
  document.getElementById("pend_form_linha_comercial").classList.toggle("pendencias-oculto", tipo !== "COMERCIAL");
  document.getElementById("pend_form_linha_tecnica").classList.toggle("pendencias-oculto", tipo !== "TECNICA");
}

function pendenciasFormTipoAtual() {
  const ativo = document.querySelector(".pendencias-tipo-btn.ativo");
  return ativo ? ativo.dataset.tipo : "TECNICA";
}

// Campos responsabilidade/passagem: travados (readonly/disabled) quando há
// submotivo selecionado e o usuário não é SUPERVISOR/ADMINISTRADOR — mesma
// regra da API (Etapa 3, item 13): sem privilégio, o padrão do submotivo é
// só exibido, nunca sobrescrito por quem não pode. Cadastro atual é sempre
// em modo texto livre (causa/subcausa, sem submotivo pré-cadastrado), então
// o campo fica sempre livre pra qualquer autenticado (ver
// pendenciasAbrirModalNovo) — mantido como função separada (em vez de
// inline) só pra reduzir o diff se o modo catálogo (select de submotivo)
// voltar no futuro.
function pendenciasDefinirCamposPrivilegiados(liberado) {
  const inputResp = document.getElementById("pend_form_responsabilidade");
  const inputPassagem = document.getElementById("pend_form_passagem_turno");
  inputResp.readOnly = !liberado;
  inputPassagem.disabled = !liberado;
}

function pendenciasMostrarErroForm(mensagem) {
  const el = document.getElementById("pend_form_erro");
  el.textContent = mensagem || "";
  el.style.display = mensagem ? "block" : "none";
}

async function pendenciasSalvarNova() {
  const tipo = pendenciasFormTipoAtual();
  const polo = document.getElementById("pend_form_polo").value;
  const causa = document.getElementById("pend_form_causa").value.trim();
  const subcausa = document.getElementById("pend_form_subcausa").value.trim();
  const descricao = document.getElementById("pend_form_descricao").value.trim();

  if (!polo || !causa || !subcausa || !descricao) {
    pendenciasMostrarErroForm("Preencha polo, causa, subcausa e descrição.");
    return;
  }

  // categoria_id/submotivo_id (modo catálogo) ficam de fora do payload de
  // propósito — cadastro atual é sempre modo texto livre (causa/subcausa),
  // já que pendencia_categorias/submotivos ainda não têm carga de dados
  // (ver PendenciaCreate no backend). A API continua aceitando o modo
  // catálogo pra quando esse cadastro existir.
  const payload = {
    polo,
    tipo,
    causa,
    subcausa,
    descricao,
    observacao: document.getElementById("pend_form_observacao").value.trim() || null,
    data_vencimento: document.getElementById("pend_form_vencimento").value || null,
  };

  if (tipo === "COMERCIAL") {
    payload.os_numero = document.getElementById("pend_form_os").value.trim() || null;
    payload.ss_numero = document.getElementById("pend_form_ss_comercial").value.trim() || null;
  } else {
    payload.inc_numero = document.getElementById("pend_form_inc").value.trim() || null;
    payload.ss_numero = document.getElementById("pend_form_ss_tecnica").value.trim() || null;
  }

  // responsabilidade/entra_passagem_turno só vão explicitamente no payload
  // quando o campo está liberado (sem submotivo, ou privilegiado
  // sobrescrevendo) — do contrário deixamos a API copiar o padrão do
  // submotivo sozinha (nunca reenviamos um valor só de exibição).
  const inputResp = document.getElementById("pend_form_responsabilidade");
  const inputPassagem = document.getElementById("pend_form_passagem_turno");
  if (!inputResp.readOnly) {
    const valor = inputResp.value.trim();
    if (valor) payload.responsabilidade = valor;
  }
  if (!inputPassagem.disabled) {
    payload.entra_passagem_turno = inputPassagem.checked;
  }
  if (!payload.responsabilidade) {
    pendenciasMostrarErroForm("Informe a responsabilidade manualmente.");
    return;
  }

  pendenciasMostrarErroForm("");
  const botao = document.getElementById("pend_btn_salvar_novo");
  botao.disabled = true;
  try {
    const r = await pendenciasApi("/api/pendencias", {
      method: "POST",
      headers: { ...pendenciasHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      pendenciasMostrarErroForm(pendenciasMensagemHttp(r));
      return;
    }
    pendenciasFecharModalNovo();
    showToast("Pendência " + r.corpo.codigo + " criada com sucesso!");
    await pendenciasCarregarLista();
  } finally {
    botao.disabled = false;
  }
}

/* ================= DETALHE ================= */

// A API só devolve o UUID de quem criou/alterou/executou/cancelou (nunca
// nome — não há join com usuários no endpoint, e criar um endpoint novo pra
// resolver isso está fora do escopo desta etapa/backend protegido). "Você"
// quando bate com o usuário logado; senão o UUID cru mesmo — nunca inventa
// um nome que a API não devolveu.
function pendenciasFormatarUsuario(idUsuario) {
  const sessaoUsuario = pendenciasSessaoUsuario();
  if (sessaoUsuario && idUsuario === sessaoUsuario.id) return "Você";
  return idUsuario;
}

const PENDENCIAS_CAMPOS_DETALHE = [
  ["codigo", "Código PD"],
  ["polo", "Polo"],
  ["tipo", "Tipo", pendenciasRotuloTipo],
  ["causa", "Causa/Motivo"],
  ["subcausa", "Subcausa/Submotivo"],
  ["os_numero", "Nº OS"],
  ["inc_numero", "Nº INC"],
  ["ss_numero", "Nº SS"],
  ["descricao", "Descrição"],
  ["responsabilidade", "Responsabilidade"],
  ["entra_passagem_turno", "Passagem de Turno", v => (v ? "SIM" : "NÃO")],
  ["data_vencimento", "Vencimento", pendenciasFormatarDataBR],
  ["status", "Status", pendenciasRotuloStatus],
  ["criado_por", "Criado por", pendenciasFormatarUsuario],
  ["criado_em", "Criado em", v => new Date(v).toLocaleString("pt-BR")],
  ["atualizado_por", "Atualizado por", pendenciasFormatarUsuario],
  ["atualizado_em", "Atualizado em", v => new Date(v).toLocaleString("pt-BR")],
  ["executado_por", "Executado por", pendenciasFormatarUsuario],
  ["executado_em", "Executado em", v => new Date(v).toLocaleString("pt-BR")],
  ["cancelado_por", "Cancelado por", pendenciasFormatarUsuario],
  ["cancelado_em", "Cancelado em", v => new Date(v).toLocaleString("pt-BR")],
  ["observacao", "Observação"],
];

async function pendenciasAbrirDetalhe(id) {
  const r = await pendenciasApi("/api/pendencias/" + id, { headers: pendenciasHeaders() });
  if (!r.ok) {
    showToast(pendenciasMensagemHttp(r));
    return;
  }
  pendenciasDetalheAtual = r.corpo;
  pendenciasRenderizarDetalhe();
  document.getElementById("pend_modal_detalhe").style.display = "flex";
}

function pendenciasFecharModalDetalhe() {
  document.getElementById("pend_modal_detalhe").style.display = "none";
  document.getElementById("pend_detalhe_editar").innerHTML = "";
  pendenciasDetalheAtual = null;
}

// "Mostrar somente os campos que realmente existirem. Não inventar
// informações." (Etapa 4, item 16) — pula null/undefined/"" na exibição.
function pendenciasRenderizarDetalhe() {
  const p = pendenciasDetalheAtual;
  document.getElementById("pend_detalhe_codigo").textContent = p.codigo;

  const linhas = PENDENCIAS_CAMPOS_DETALHE
    .filter(([campo]) => p[campo] !== null && p[campo] !== undefined && p[campo] !== "")
    .map(([campo, rotulo, formatar]) => {
      const valor = formatar ? formatar(p[campo]) : p[campo];
      return `<div class="pendencias-detalhe-linha"><strong>${pendenciasEscapar(rotulo)}:</strong> ${pendenciasEscapar(valor)}</div>`;
    });

  // Categoria/submotivo — a API devolve só o id; mostramos o nome se já
  // estiver no cache carregado (categorias/submotivos), senão omitimos
  // (nunca inventamos um nome).
  const categoria = pendenciasCacheCategorias.find(c => c.id === p.categoria_id);
  if (categoria) {
    linhas.splice(1, 0, `<div class="pendencias-detalhe-linha"><strong>Categoria:</strong> ${pendenciasEscapar(categoria.nome)}</div>`);
  }
  const submotivo = p.submotivo_id ? pendenciasCacheSubmotivos.find(s => s.id === p.submotivo_id) : null;
  if (submotivo) {
    linhas.splice(2, 0, `<div class="pendencias-detalhe-linha"><strong>Submotivo:</strong> ${pendenciasEscapar(submotivo.nome)}</div>`);
  }

  document.getElementById("pend_detalhe_corpo").innerHTML = linhas.join("");

  const btnExecutar = document.getElementById("pend_btn_executar");
  const btnCancelar = document.getElementById("pend_btn_cancelar");
  const btnEditar = document.getElementById("pend_btn_editar_detalhe");
  const podeAgir = p.status === "PENDENTE";
  btnExecutar.style.display = podeAgir ? "" : "none";
  btnEditar.style.display = podeAgir ? "" : "none";
  // Cancelar: só exibido pra quem tem perfil (mesma UX de admin.js — esconder
  // é só conforto, o backend segue sendo a autoridade e devolve 403 mesmo
  // que o botão apareça por algum motivo).
  btnCancelar.style.display = (podeAgir && pendenciasUsuarioAtualEhPrivilegiado()) ? "" : "none";

  document.getElementById("pend_detalhe_editar").innerHTML = "";
}

/* ================= EDITAR (PATCH) ================= */

// Só os campos que o PATCH da API realmente aceita (Etapa 3:
// PendenciaUpdate) — nunca tipo/polo/categoria/submotivo/status/codigo.
function pendenciasAlternarEdicaoDetalhe() {
  const container = document.getElementById("pend_detalhe_editar");
  if (container.innerHTML) {
    container.innerHTML = "";
    return;
  }
  const p = pendenciasDetalheAtual;
  const privilegiado = pendenciasUsuarioAtualEhPrivilegiado();
  container.innerHTML = `
    <h3>Editar</h3>
    <label for="pend_edit_descricao">Descrição</label>
    <textarea id="pend_edit_descricao">${pendenciasEscapar(p.descricao)}</textarea>
    <div class="linha-2">
      <div>
        <label for="pend_edit_vencimento">Vencimento</label>
        <input type="date" id="pend_edit_vencimento" value="${p.data_vencimento || ""}">
      </div>
      <div>
        <label for="pend_edit_ss">Nº SS</label>
        <input id="pend_edit_ss" value="${pendenciasEscapar(p.ss_numero || "")}">
      </div>
    </div>
    <div class="linha-2">
      <div>
        <label for="pend_edit_os">Nº OS</label>
        <input id="pend_edit_os" value="${pendenciasEscapar(p.os_numero || "")}" ${p.tipo !== "COMERCIAL" ? "disabled" : ""}>
      </div>
      <div>
        <label for="pend_edit_inc">Nº INC</label>
        <input id="pend_edit_inc" value="${pendenciasEscapar(p.inc_numero || "")}" ${p.tipo !== "TECNICA" ? "disabled" : ""}>
      </div>
    </div>
    <label for="pend_edit_observacao">Observação</label>
    <textarea id="pend_edit_observacao">${pendenciasEscapar(p.observacao || "")}</textarea>
    ${privilegiado ? `
    <div class="linha-2">
      <div>
        <label for="pend_edit_responsabilidade">Responsabilidade</label>
        <input id="pend_edit_responsabilidade" value="${pendenciasEscapar(p.responsabilidade)}">
      </div>
      <div class="pendencias-checkbox-linha">
        <label class="pendencias-checkbox-label">
          <input type="checkbox" id="pend_edit_passagem_turno" ${p.entra_passagem_turno ? "checked" : ""}>
          Entra na Passagem de Turno
        </label>
      </div>
    </div>` : ""}
    <div id="pend_edit_erro" class="pendencias-erro" style="display:none;"></div>
    <div class="linha-2">
      <button type="button" class="sec" onclick="pendenciasAlternarEdicaoDetalhe()">Cancelar edição</button>
      <button type="button" id="pend_btn_salvar_edicao">Salvar alterações</button>
    </div>
  `;
  document.getElementById("pend_btn_salvar_edicao").addEventListener("click", pendenciasSalvarEdicao);
}

async function pendenciasSalvarEdicao() {
  const p = pendenciasDetalheAtual;
  const payload = {
    descricao: document.getElementById("pend_edit_descricao").value.trim(),
    data_vencimento: document.getElementById("pend_edit_vencimento").value || null,
    ss_numero: document.getElementById("pend_edit_ss").value.trim() || null,
    observacao: document.getElementById("pend_edit_observacao").value.trim() || null,
  };
  if (p.tipo === "COMERCIAL") payload.os_numero = document.getElementById("pend_edit_os").value.trim() || null;
  if (p.tipo === "TECNICA") payload.inc_numero = document.getElementById("pend_edit_inc").value.trim() || null;

  const inputResp = document.getElementById("pend_edit_responsabilidade");
  const inputPassagem = document.getElementById("pend_edit_passagem_turno");
  if (inputResp) payload.responsabilidade = inputResp.value.trim();
  if (inputPassagem) payload.entra_passagem_turno = inputPassagem.checked;

  const erroEl = document.getElementById("pend_edit_erro");
  const botao = document.getElementById("pend_btn_salvar_edicao");
  botao.disabled = true;
  try {
    const r = await pendenciasApi("/api/pendencias/" + p.id, {
      method: "PATCH",
      headers: { ...pendenciasHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      erroEl.textContent = pendenciasMensagemHttp(r);
      erroEl.style.display = "block";
      return;
    }
    pendenciasDetalheAtual = r.corpo;
    pendenciasRenderizarDetalhe();
    showToast("Pendência atualizada.");
    await pendenciasCarregarLista();
  } finally {
    botao.disabled = false;
  }
}

/* ================= EXECUTAR / CANCELAR ================= */

function pendenciasConfirmarExecutar() {
  const p = pendenciasDetalheAtual;
  pendenciasAcaoConfirmar = { tipo: "executar", id: p.id };
  document.getElementById("pend_confirmar_texto").textContent =
    `Confirmar execução da pendência ${p.codigo}? Esta ação não pode ser desfeita.`;
  document.getElementById("pend_confirmar_erro").style.display = "none";
  document.getElementById("pend_modal_confirmar").style.display = "flex";
}

function pendenciasConfirmarCancelar() {
  const p = pendenciasDetalheAtual;
  pendenciasAcaoConfirmar = { tipo: "cancelar", id: p.id };
  document.getElementById("pend_confirmar_texto").textContent =
    `Confirmar cancelamento da pendência ${p.codigo}? Esta ação não pode ser desfeita.`;
  document.getElementById("pend_confirmar_erro").style.display = "none";
  document.getElementById("pend_modal_confirmar").style.display = "flex";
}

function pendenciasFecharModalConfirmar() {
  document.getElementById("pend_modal_confirmar").style.display = "none";
  pendenciasAcaoConfirmar = null;
}

async function pendenciasExecutarAcaoConfirmada() {
  if (!pendenciasAcaoConfirmar) return;
  const { tipo, id } = pendenciasAcaoConfirmar;
  const caminho = `/api/pendencias/${id}/${tipo === "executar" ? "executar" : "cancelar"}`;
  const erroEl = document.getElementById("pend_confirmar_erro");
  const botao = document.getElementById("pend_btn_confirmar_acao");
  botao.disabled = true;
  try {
    const r = await pendenciasApi(caminho, { method: "POST", headers: pendenciasHeaders() });
    if (!r.ok) {
      // 409 é o caso central do item 10/11 — nunca mascarar concorrência.
      erroEl.textContent = pendenciasMensagemHttp(r);
      erroEl.style.display = "block";
      return;
    }
    pendenciasFecharModalConfirmar();
    pendenciasDetalheAtual = r.corpo;
    pendenciasRenderizarDetalhe();
    showToast(tipo === "executar" ? "Pendência executada." : "Pendência cancelada.");
    await pendenciasCarregarLista();
  } finally {
    botao.disabled = false;
  }
}

/* ================= EVENTOS ================= */

function pendenciasConectarEventos() {
  document.getElementById("pend_btn_nova").addEventListener("click", pendenciasAbrirModalNovo);
  document.getElementById("pend_btn_salvar_novo").addEventListener("click", pendenciasSalvarNova);

  document.querySelectorAll(".pendencias-subnav-btn").forEach(btn => {
    btn.addEventListener("click", () => pendenciasSelecionarSubnav(btn.dataset.tipo));
  });
  document.querySelectorAll(".pendencias-tipo-btn").forEach(btn => {
    btn.addEventListener("click", () => pendenciasSelecionarTipoForm(btn.dataset.tipo));
  });

  document.getElementById("pend_filtro_polo").addEventListener("change", pendenciasCarregarLista);
  document.getElementById("pend_filtro_status").addEventListener("change", pendenciasCarregarLista);
  document.getElementById("pend_filtro_categoria").addEventListener("change", () => {
    pendenciasPopularFiltroSubmotivo();
    pendenciasCarregarLista();
  });
  document.getElementById("pend_filtro_submotivo").addEventListener("change", pendenciasCarregarLista);
  document.getElementById("pend_filtro_responsabilidade").addEventListener("change", pendenciasCarregarLista);
  // Busca é local (ver pendenciasFiltrarListaLocal) — só re-renderiza, nunca refaz fetch.
  document.getElementById("pend_filtro_busca").addEventListener("input", pendenciasRenderizarLista);

  document.getElementById("pend_btn_editar_detalhe").addEventListener("click", pendenciasAlternarEdicaoDetalhe);
  document.getElementById("pend_btn_confirmar_acao").addEventListener("click", pendenciasExecutarAcaoConfirmada);
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", pendenciasConectarEventos);
}
