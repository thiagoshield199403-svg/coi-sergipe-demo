/* HISTÓRICO E RELATÓRIO DE PASSAGEM DE TURNO (Fase 6) — admin/supervisor,
   somente leitura, sobre GET /api/passagens-turno/historico* (ver
   backend/app/routers/passagem_turno.py). Arquivo independente de
   js/passagem-turno.js (nenhuma função/estado compartilhado) — só reaproveita
   authChamarApi()/authObterSessao() de js/auth.js, mesma convenção do resto
   do projeto. Prefixo `pth` em tudo pra nunca colidir com js/historico.js
   (que é o histórico do Callback WhatsApp, módulo completamente diferente). */

const PTH_LIMITE_PADRAO = 20;

let pthEstado = { offset: 0, limit: PTH_LIMITE_PADRAO, total: 0 };
let pthCacheUsuarios = [];
let pthCarregado = false;

/* ================= VISIBILIDADE NO MENU (chamado de js/auth.js) ================= */

function pthUsuarioAutorizado(perfis) {
  if (!Array.isArray(perfis)) return false;
  return perfis.includes("SUPERVISOR") || perfis.includes("ADMINISTRADOR");
}

function pthAtualizarMenu(usuario) {
  const botao = document.getElementById("menu_item_pt_historico");
  if (!botao) return;
  const autorizado = !!(usuario && pthUsuarioAutorizado(usuario.perfis));
  botao.style.display = autorizado ? "" : "none";

  if (!autorizado) {
    const modulo = document.getElementById("passagem_turno_historico");
    if (modulo && modulo.classList.contains("active")) {
      document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
      document.querySelectorAll('.menu button').forEach(b => b.classList.remove('active'));
      const inicio = document.getElementById("inicio");
      if (inicio) inicio.classList.add("active");
    }
  }
}

/* ================= HELPERS ================= */

function pthHeaders() {
  const sessao = authObterSessao();
  return sessao && sessao.access_token ? { "Authorization": "Bearer " + sessao.access_token } : {};
}

function pthEscapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto === null || texto === undefined ? "" : String(texto);
  return div.innerHTML;
}

function pthFormatarData(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR");
}

function pthMensagemHttp(resposta) {
  if (resposta.status === 401) return "Sua sessão expirou. Faça login novamente.";
  if (resposta.status === 403) return "Você não tem permissão para acessar o histórico.";
  if (resposta.status === 404) return "Passagem não encontrada.";
  if (resposta.status === 0) return "Não foi possível contatar o servidor. Verifique sua conexão.";
  const doCorpo = resposta.corpo && resposta.corpo.detail;
  if (typeof doCorpo === "string") return doCorpo;
  if (resposta.status >= 500) return "Erro interno no servidor. Tente novamente em instantes.";
  return "Não foi possível concluir a operação.";
}

function pthQueryString(params) {
  const partes = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
  return partes.length ? "?" + partes.join("&") : "";
}

function pthMostrarErro(mensagem) {
  const el = document.getElementById("pth_erro_geral");
  if (!el) return;
  if (!mensagem) { el.style.display = "none"; el.textContent = ""; return; }
  el.textContent = mensagem;
  el.style.display = "block";
}

const PTH_ROTULO_STATUS_PASSAGEM = { ENVIADA: "Enviada", RASCUNHO: "Rascunho" };
const PTH_ROTULO_SITUACAO = { ENVIADO: "Enviado", FALHA: "Falha", PENDENTE: "Pendente" };
const PTH_ROTULO_CANAL = {
  receptor: "Receptor", administracao: "Administração", apoio_operacao: "Apoio Operação", remetente: "Remetente"
};

function pthBadgeSituacao(situacao) {
  const classe = situacao === "ENVIADO" ? "pth-badge-ok" : situacao === "FALHA" ? "pth-badge-falha" : "pth-badge-pendente";
  return `<span class="pth-badge ${classe}">${pthEscapar(PTH_ROTULO_SITUACAO[situacao] || situacao)}</span>`;
}

/* ================= ABERTURA DO MÓDULO ================= */

function pthAplicarPeriodoPadrao() {
  // Item 10 da Fase 6: período inicial padrão de 30 dias — só na primeira
  // abertura do módulo (não sobrescreve se o usuário já tiver mexido nos
  // campos); histórico mais antigo continua acessível limpando o filtro.
  const campoDe = document.getElementById("pth_filtro_periodo_de");
  if (!campoDe || campoDe.value) return;
  const hoje = new Date();
  const trintaDiasAtras = new Date(hoje);
  trintaDiasAtras.setDate(hoje.getDate() - 30);
  const paraISO = d => d.toISOString().slice(0, 10);
  campoDe.value = paraISO(trintaDiasAtras);
}

async function pthAoAbrir() {
  if (!pthCarregado) {
    await pthCarregarUsuarios();
    pthAplicarPeriodoPadrao();
    pthCarregado = true;
  }
  pthEstado.offset = 0;
  await pthBuscar();
}

async function pthCarregarUsuarios() {
  const r = await authChamarApi("/api/passagens-turno/destinatarios-possiveis", { headers: pthHeaders() });
  pthCacheUsuarios = r.ok ? r.corpo : [];
  ["pth_filtro_remetente", "pth_filtro_destinatario"].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">Todos</option>';
    pthCacheUsuarios.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.nome;
      select.appendChild(opt);
    });
  });
}

/* ================= FILTROS E BUSCA ================= */

function pthColetarFiltros() {
  return {
    polo: document.getElementById("pth_filtro_polo").value.trim(),
    turno: document.getElementById("pth_filtro_turno").value.trim(),
    status: document.getElementById("pth_filtro_status").value,
    remetente_id: document.getElementById("pth_filtro_remetente").value,
    destinatario_id: document.getElementById("pth_filtro_destinatario").value,
    periodo_de: document.getElementById("pth_filtro_periodo_de").value,
    periodo_ate: document.getElementById("pth_filtro_periodo_ate").value,
  };
}

function pthLimparFiltros() {
  document.getElementById("pth_filtro_polo").value = "";
  document.getElementById("pth_filtro_turno").value = "";
  document.getElementById("pth_filtro_status").value = "ENVIADA";
  document.getElementById("pth_filtro_remetente").value = "";
  document.getElementById("pth_filtro_destinatario").value = "";
  document.getElementById("pth_filtro_periodo_de").value = "";
  document.getElementById("pth_filtro_periodo_ate").value = "";
  pthEstado.offset = 0;
  pthBuscar();
}

async function pthBuscar() {
  pthMostrarErro("");
  const filtros = pthColetarFiltros();
  const query = pthQueryString({ ...filtros, limit: pthEstado.limit, offset: pthEstado.offset });

  const [listaResp, indicadoresResp] = await Promise.all([
    authChamarApi("/api/passagens-turno/historico" + query, { headers: pthHeaders() }),
    authChamarApi("/api/passagens-turno/historico/indicadores" + pthQueryString(filtros), { headers: pthHeaders() }),
  ]);

  if (!listaResp.ok) {
    pthMostrarErro(pthMensagemHttp(listaResp));
    document.getElementById("pth_lista").innerHTML = "";
    document.getElementById("pth_paginacao").innerHTML = "";
    document.getElementById("pth_lista_vazia").hidden = true;
    return;
  }

  pthEstado.total = listaResp.corpo.total;
  pthRenderizarLista(listaResp.corpo);
  pthRenderizarPaginacao(listaResp.corpo);
  if (indicadoresResp.ok) pthRenderizarIndicadores(indicadoresResp.corpo);
}

/* ================= RENDERIZAÇÃO — INDICADORES ================= */

function pthRenderizarIndicadores(dados) {
  const el = document.getElementById("pth_indicadores");
  if (!el) return;
  const turnos = Object.entries(dados.passagens_por_turno || {})
    .map(([turno, qtd]) => `${pthEscapar(turno)}: ${qtd}`)
    .join(" · ") || "—";

  el.innerHTML = `
    <div class="pth-indicador"><span class="pth-indicador-valor">${dados.total_passagens}</span><span class="pth-indicador-rotulo">Passagens</span></div>
    <div class="pth-indicador"><span class="pth-indicador-valor">${dados.total_polos}</span><span class="pth-indicador-rotulo">Polos</span></div>
    <div class="pth-indicador"><span class="pth-indicador-valor">${dados.passagens_com_contingencia}</span><span class="pth-indicador-rotulo">Em contingência</span></div>
    <div class="pth-indicador"><span class="pth-indicador-valor">${dados.passagens_com_falha_email}</span><span class="pth-indicador-rotulo">Falhas de e-mail</span></div>
    <div class="pth-indicador pth-indicador-largo"><span class="pth-indicador-valor">${turnos}</span><span class="pth-indicador-rotulo">Por turno</span></div>
  `;
}

/* ================= RENDERIZAÇÃO — LISTA ================= */

function pthRenderizarLista(dados) {
  const lista = document.getElementById("pth_lista");
  const vazio = document.getElementById("pth_lista_vazia");
  if (!dados.items.length) {
    lista.innerHTML = "";
    vazio.hidden = false;
    return;
  }
  vazio.hidden = true;

  lista.innerHTML = dados.items.map(item => `
    <button type="button" class="pth-linha" onclick="pthAbrirDetalhe('${item.id}')">
      <div class="pth-linha-principal">
        <span class="pth-linha-polo">${pthEscapar(item.polo)}</span>
        <span class="pth-linha-turno">${pthEscapar(item.turno)}</span>
        ${item.em_contingencia ? '<span class="pth-badge pth-badge-contingencia">Contingência</span>' : ""}
      </div>
      <div class="pth-linha-fluxo">${pthEscapar(item.remetente_nome)} <span class="pth-linha-seta">&rarr;</span> ${pthEscapar(item.destinatario_nome)}</div>
      <div class="pth-linha-meta">
        <span title="${pthEscapar(item.id)}">#${pthEscapar(item.id.slice(0, 8))}</span>
        <span>${pthFormatarData(item.enviada_em || item.criado_em)}</span>
        <span>${PTH_ROTULO_STATUS_PASSAGEM[item.status] || pthEscapar(item.status)}</span>
        <span>${item.quantidade_pendencias} pendência(s)</span>
        <span>${item.quantidade_itens} item(ns)</span>
        ${pthBadgeSituacao(item.email_situacao)}
      </div>
    </button>
  `).join("");
}

function pthRenderizarPaginacao(dados) {
  const el = document.getElementById("pth_paginacao");
  if (!el) return;
  if (dados.total === 0) { el.innerHTML = ""; return; }

  const inicio = dados.offset + 1;
  const fim = Math.min(dados.offset + dados.items.length, dados.total);
  el.innerHTML = `
    <button type="button" class="sec" id="pth_btn_pag_anterior" ${dados.offset === 0 ? "disabled" : ""}>Anterior</button>
    <span class="pth-paginacao-texto">${inicio}–${fim} de ${dados.total}</span>
    <button type="button" class="sec" id="pth_btn_pag_proxima" ${fim >= dados.total ? "disabled" : ""}>Próxima</button>
  `;
  const btnAnterior = document.getElementById("pth_btn_pag_anterior");
  const btnProxima = document.getElementById("pth_btn_pag_proxima");
  if (btnAnterior) btnAnterior.onclick = () => { pthEstado.offset = Math.max(0, pthEstado.offset - pthEstado.limit); pthBuscar(); };
  if (btnProxima) btnProxima.onclick = () => { pthEstado.offset += pthEstado.limit; pthBuscar(); };
}

/* ================= DETALHE (MODAL) ================= */

const PTH_ROTULO_SITUACAO_PENDENCIA = { MANTIDA: "Mantida", ADICIONADA: "Adicionada", REMOVIDA: "Removida" };
const PTH_ROTULO_TIPO_ITEM = {
  OCORRENCIA: "Ocorrência",
  REMANEJAMENTO: "Remanejamento",
  OS_COMERCIAL: "OS Comercial",
  RELIGACAO_PRIORITARIA: "Religação Prioritária",
  EQUIPAMENTO_RELIGAMENTO_BLOQUEADO: "Equipamento c/ Religamento Bloqueado",
  MANUTENCAO_ACIONADA: "Manutenção Acionada",
  EQUIPAMENTO_REMOTO: "Equipamento Remoto",
  DESLIGAMENTO_PROGRAMADO: "Desligamento Programado",
  CONTINGENCIA: "Contingência",
};

async function pthAbrirDetalhe(passagemId) {
  const modal = document.getElementById("pth_modal_detalhe");
  const conteudo = document.getElementById("pth_detalhe_conteudo");
  document.getElementById("pth_detalhe_titulo").textContent = "Carregando...";
  conteudo.innerHTML = "";
  modal.style.display = "flex";

  const r = await authChamarApi("/api/passagens-turno/historico/" + passagemId, { headers: pthHeaders() });
  if (!r.ok) {
    document.getElementById("pth_detalhe_titulo").textContent = "Erro";
    conteudo.innerHTML = `<p class="pendencias-erro" style="display:block;">${pthEscapar(pthMensagemHttp(r))}</p>`;
    return;
  }
  pthRenderizarDetalhe(r.corpo);
}

function pthFecharDetalhe() {
  document.getElementById("pth_modal_detalhe").style.display = "none";
}

function pthRenderizarDetalhe(p) {
  document.getElementById("pth_detalhe_titulo").textContent = `${p.polo} — ${p.turno}`;

  const comunicacaoHtml = p.comunicacao.map(c => `
    <div class="pth-comunicacao-item">
      <span>${pthEscapar(PTH_ROTULO_CANAL[c.canal] || c.canal)}</span>
      ${pthBadgeSituacao(c.situacao)}
    </div>
  `).join("");

  const pendenciasHtml = p.pendencias.length
    ? p.pendencias.map(v => `
        <li>
          <strong>${pthEscapar(PTH_ROTULO_SITUACAO_PENDENCIA[v.situacao] || v.situacao)}</strong> —
          ${pthEscapar(v.pendencia.descricao)}
        </li>
      `).join("")
    : "<li>Nenhuma pendência vinculada.</li>";

  const itensHtml = p.itens.length
    ? p.itens.map(i => `
        <li>
          <strong>${pthEscapar(PTH_ROTULO_TIPO_ITEM[i.tipo_item] || i.tipo_item)}</strong>
          ${i.identificador ? " — " + pthEscapar(i.identificador) : ""}<br>
          ${pthEscapar(i.descricao)}
        </li>
      `).join("")
    : "<li>Nenhum item registrado.</li>";

  const auditoriaHtml = p.auditoria.length
    ? `<table class="admin-tabela"><thead><tr><th>Data/Hora</th><th>Ação</th><th>Usuário</th></tr></thead><tbody>
        ${p.auditoria.map(a => `<tr><td>${pthFormatarData(a.criado_em)}</td><td>${pthEscapar(a.acao)}</td><td>${pthEscapar(a.usuario_nome || "—")}</td></tr>`).join("")}
      </tbody></table>`
    : "<p>Nenhum evento de auditoria encontrado.</p>";

  document.getElementById("pth_detalhe_conteudo").innerHTML = `
    <div class="pth-detalhe-cabecalho">
      <div><strong>ID:</strong> ${pthEscapar(p.id)}</div>
      ${p.lote_id ? `<div><strong>Lote:</strong> ${pthEscapar(p.lote_id)}</div>` : ""}
      <div><strong>Remetente:</strong> ${pthEscapar(p.remetente_nome)}</div>
      <div><strong>Destinatário:</strong> ${pthEscapar(p.destinatario_nome)}</div>
      <div><strong>Status:</strong> ${PTH_ROTULO_STATUS_PASSAGEM[p.status] || pthEscapar(p.status)}</div>
      <div><strong>Enviada em:</strong> ${pthFormatarData(p.enviada_em)}</div>
      <div><strong>Termo aceito em:</strong> ${pthFormatarData(p.termo_responsabilidade_aceito_em)}</div>
      ${p.em_contingencia ? `<div><strong>Contingência:</strong> ${pthEscapar(p.contingencia_descricao || "")}</div>` : ""}
    </div>

    <h3 class="pth-detalhe-subtitulo">Comunicação</h3>
    <div class="pth-comunicacao-lista">${comunicacaoHtml}</div>

    <h3 class="pth-detalhe-subtitulo">Pendências (${p.pendencias.length})</h3>
    <ul class="pth-detalhe-lista">${pendenciasHtml}</ul>

    <h3 class="pth-detalhe-subtitulo">Itens operacionais (${p.itens.length})</h3>
    <ul class="pth-detalhe-lista">${itensHtml}</ul>

    <h3 class="pth-detalhe-subtitulo">Auditoria</h3>
    <div class="admin-tabela-wrap">${auditoriaHtml}</div>
  `;
}

/* ================= EVENTOS ================= */

document.addEventListener("DOMContentLoaded", () => {
  const btnBuscar = document.getElementById("pth_btn_buscar");
  const btnLimpar = document.getElementById("pth_btn_limpar_filtros");
  if (btnBuscar) btnBuscar.addEventListener("click", () => { pthEstado.offset = 0; pthBuscar(); });
  if (btnLimpar) btnLimpar.addEventListener("click", pthLimparFiltros);
});
