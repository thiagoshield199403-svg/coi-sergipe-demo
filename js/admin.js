/* Painel administrativo (etapa 7) — usuários, perfis, solicitações de
   acesso, redefinições de senha e auditoria. Só fica visível/populado para
   quem tem o perfil ADMINISTRADOR; isso é só UX — o backend também bloqueia
   (403) qualquer chamada direta a /api/admin/* e às rotas administrativas
   de /api/auth/* feita por quem não tiver esse perfil. Depende das funções
   authObterSessao()/authChamarApi() definidas em js/auth.js (carregado antes). */

const ADMIN_PERFIS_DISPONIVEIS = ["OPERADOR", "SUPERVISOR", "ADMINISTRADOR"];

let adminUsuarioSelecionadoId = null;
let adminRejeitarTipo = null; // "acesso" | "redefinicao"
let adminRejeitarId = null;
let adminAprovarAcessoId = null;
let adminOrdemAuditoria = "desc";

function adminAtualizarMenu(usuario) {
  const categoria = document.getElementById("menu_categoria_admin");
  const ehAdmin = !!(usuario && Array.isArray(usuario.perfis) && usuario.perfis.includes("ADMINISTRADOR"));
  categoria.style.display = ehAdmin ? "" : "none";

  if (!ehAdmin) {
    const modulo = document.getElementById("administracao");
    if (modulo && modulo.classList.contains("active")) {
      // Não há mais nenhum botão de menu apontando pra "inicio" (removido —
      // ver reorganização do menu), então não existe um <button> pra marcar
      // como .active aqui. Replica só a parte segura de openModule() (troca
      // de módulo visível), sem o btn.classList.add('active') que exigiria
      // um botão inexistente — mesmo padrão usado em equipesVoltarMenu().
      document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
      document.querySelectorAll('.menu button').forEach(b => b.classList.remove('active'));
      document.getElementById('inicio').classList.add('active');
      document.body.classList.remove('modo-tela-ampla');
    }
  }
}

function adminHeaders() {
  const sessao = authObterSessao();
  return sessao && sessao.access_token ? { "Authorization": "Bearer " + sessao.access_token } : {};
}

function adminEscapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto === null || texto === undefined ? "" : String(texto);
  return div.innerHTML;
}

function adminFormatarData(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR");
}

function adminMostrarErro(elId, mensagem) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = mensagem || "";
  el.style.display = mensagem ? "block" : "none";
}

function adminBotaoAcao(rotulo, aoClicar) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = rotulo;
  btn.className = "admin-btn-acao";
  btn.addEventListener("click", aoClicar);
  return btn;
}

function adminMostrarAba(nome, btn) {
  document.querySelectorAll(".admin-aba").forEach(el => el.classList.remove("ativo"));
  document.querySelectorAll(".admin-tab-btn").forEach(el => el.classList.remove("ativo"));
  document.getElementById("admin-aba-" + nome).classList.add("ativo");
  if (btn) btn.classList.add("ativo");

  if (nome === "dashboard") adminCarregarDashboard();
  else if (nome === "usuarios") adminCarregarUsuarios();
  else if (nome === "solicitacoes") adminCarregarSolicitacoesAcesso();
  else if (nome === "redefinicoes") adminCarregarRedefinicoes();
  else if (nome === "auditoria") adminCarregarAuditoria();
}

/* ================= DASHBOARD ================= */

async function adminCarregarDashboard() {
  adminMostrarErro("admin_dashboard_erro", "");
  const r = await authChamarApi("/api/admin/dashboard", { headers: adminHeaders() });
  if (!r.ok) {
    adminMostrarErro("admin_dashboard_erro", (r.corpo && r.corpo.detail) || "Não foi possível carregar o dashboard.");
    return;
  }
  document.getElementById("admin_kpi_ativos").textContent = r.corpo.usuarios_ativos;
  document.getElementById("admin_kpi_pendentes").textContent = r.corpo.usuarios_pendentes;
  document.getElementById("admin_kpi_bloqueados").textContent = r.corpo.usuarios_bloqueados;
  document.getElementById("admin_kpi_solicitacoes").textContent = r.corpo.solicitacoes_acesso_pendentes;
  document.getElementById("admin_kpi_redefinicoes").textContent = r.corpo.redefinicoes_pendentes;
}

/* ================= USUÁRIOS ================= */

function adminStatusClasse(status) {
  return {
    ATIVO: "admin-badge-ok",
    PENDENTE: "admin-badge-pendente",
    BLOQUEADO: "admin-badge-bloqueado",
    INATIVO: "admin-badge-inativo",
    APROVADA: "admin-badge-ok",
    REJEITADA: "admin-badge-bloqueado"
  }[status] || "";
}

async function adminCarregarUsuarios() {
  adminMostrarErro("admin_users_erro", "");
  const params = new URLSearchParams();
  const nome = document.getElementById("admin_users_filtro_nome").value.trim();
  const login = document.getElementById("admin_users_filtro_login").value.trim();
  const perfil = document.getElementById("admin_users_filtro_perfil").value;
  const status = document.getElementById("admin_users_filtro_status").value;
  if (nome) params.set("nome", nome);
  if (login) params.set("login", login);
  if (perfil) params.set("perfil", perfil);
  if (status) params.set("status", status);

  const r = await authChamarApi("/api/admin/users?" + params.toString(), { headers: adminHeaders() });
  if (!r.ok) {
    adminMostrarErro("admin_users_erro", (r.corpo && r.corpo.detail) || "Não foi possível listar usuários.");
    return;
  }

  const sessao = authObterSessao();
  const meuId = sessao && sessao.usuario ? sessao.usuario.id : null;

  const tbody = document.getElementById("admin_users_tbody");
  tbody.innerHTML = "";

  if (r.corpo.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6'>Nenhum usuário encontrado.</td></tr>";
    return;
  }

  r.corpo.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + adminEscapar(u.nome) + "</td>" +
      "<td>" + adminEscapar(u.login) + "</td>" +
      "<td>" + adminEscapar(u.perfis.join(", ")) + "</td>" +
      "<td><span class=\"admin-badge " + adminStatusClasse(u.status) + "\">" + adminEscapar(u.status) + "</span></td>" +
      "<td>" + adminFormatarData(u.ultimo_login) + "</td>" +
      "<td class=\"admin-acoes\"></td>";

    const tdAcoes = tr.querySelector(".admin-acoes");
    const ehEuMesmo = u.id === meuId;

    if (u.status !== "ATIVO") {
      tdAcoes.appendChild(adminBotaoAcao("Ativar", () => adminMudarStatus(u.id, "activate")));
    }
    if (u.status === "ATIVO" && !ehEuMesmo) {
      tdAcoes.appendChild(adminBotaoAcao("Bloquear", () => adminMudarStatus(u.id, "block")));
      tdAcoes.appendChild(adminBotaoAcao("Inativar", () => adminMudarStatus(u.id, "deactivate")));
    }
    tdAcoes.appendChild(adminBotaoAcao("Perfis", () => adminAbrirModalPerfis(u)));
    tdAcoes.appendChild(adminBotaoAcao("Editar", () => adminAbrirModalEditarUsuario(u)));
    tdAcoes.appendChild(adminBotaoAcao("Redefinir senha", () => adminRedefinirSenhaUsuario(u)));
    tdAcoes.appendChild(adminBotaoAcao("Auditoria", () => adminAbrirModalAuditoriaUsuario(u)));
    if (!ehEuMesmo) {
      tdAcoes.appendChild(adminBotaoAcao("Excluir", () => adminExcluirUsuario(u)));
    }

    tbody.appendChild(tr);
  });
}

async function adminMudarStatus(usuarioId, acao) {
  const r = await authChamarApi("/api/admin/users/" + usuarioId + "/" + acao, {
    method: "PATCH",
    headers: adminHeaders()
  });
  if (!r.ok) {
    adminMostrarErro("admin_users_erro", (r.corpo && r.corpo.detail) || "Não foi possível concluir a ação.");
    return;
  }
  adminCarregarUsuarios();
  adminCarregarDashboard();
}

/* ---- modal: alterar perfis ---- */

function adminAbrirModalPerfis(usuario) {
  adminUsuarioSelecionadoId = usuario.id;
  document.getElementById("admin_modal_perfis_usuario").textContent = usuario.nome + " (" + usuario.login + ")";

  const lista = document.getElementById("admin_modal_perfis_lista");
  lista.innerHTML = "";
  ADMIN_PERFIS_DISPONIVEIS.forEach(nomePerfil => {
    const idCampo = "admin_perfil_chk_" + nomePerfil;
    const marcado = usuario.perfis.includes(nomePerfil);
    const label = document.createElement("label");
    label.className = "admin-checkbox-item";
    label.innerHTML =
      "<input type=\"checkbox\" id=\"" + idCampo + "\" value=\"" + nomePerfil + "\"" + (marcado ? " checked" : "") + "> " + nomePerfil;
    lista.appendChild(label);
  });

  adminMostrarErro("admin_modal_perfis_erro", "");
  document.getElementById("admin_modal_perfis").style.display = "flex";
}

function adminFecharModalPerfis() {
  document.getElementById("admin_modal_perfis").style.display = "none";
  adminUsuarioSelecionadoId = null;
}

async function adminSalvarPerfis() {
  const marcados = ADMIN_PERFIS_DISPONIVEIS.filter(
    nomePerfil => document.getElementById("admin_perfil_chk_" + nomePerfil).checked
  );
  if (marcados.length === 0) {
    adminMostrarErro("admin_modal_perfis_erro", "Selecione ao menos um perfil.");
    return;
  }

  const r = await authChamarApi("/api/admin/users/" + adminUsuarioSelecionadoId + "/roles", {
    method: "PATCH",
    headers: Object.assign({ "Content-Type": "application/json" }, adminHeaders()),
    body: JSON.stringify({ perfis: marcados })
  });

  if (!r.ok) {
    adminMostrarErro("admin_modal_perfis_erro", (r.corpo && r.corpo.detail) || "Não foi possível salvar os perfis.");
    return;
  }

  adminFecharModalPerfis();
  adminCarregarUsuarios();
}

/* ---- modal: editar cadastro do usuário (nome/login/e-mail/whatsapp/matrícula) ---- */

function adminAbrirModalEditarUsuario(usuario) {
  adminUsuarioSelecionadoId = usuario.id;
  document.getElementById("admin_modal_editar_nome").value = usuario.nome || "";
  document.getElementById("admin_modal_editar_login").value = usuario.login || "";
  document.getElementById("admin_modal_editar_email").value = usuario.email || "";
  document.getElementById("admin_modal_editar_whatsapp").value = usuario.whatsapp || "";
  document.getElementById("admin_modal_editar_matricula").value = usuario.matricula || "";
  adminMostrarErro("admin_modal_editar_erro", "");
  document.getElementById("admin_modal_editar").style.display = "flex";
}

function adminFecharModalEditarUsuario() {
  document.getElementById("admin_modal_editar").style.display = "none";
  adminUsuarioSelecionadoId = null;
}

async function adminSalvarEdicaoUsuario() {
  const corpo = {
    nome: document.getElementById("admin_modal_editar_nome").value.trim(),
    login: document.getElementById("admin_modal_editar_login").value.trim(),
    email: document.getElementById("admin_modal_editar_email").value.trim(),
    whatsapp: document.getElementById("admin_modal_editar_whatsapp").value.trim() || null,
    matricula: document.getElementById("admin_modal_editar_matricula").value.trim() || null
  };
  if (!corpo.nome || !corpo.login || !corpo.email) {
    adminMostrarErro("admin_modal_editar_erro", "Nome, login e e-mail são obrigatórios.");
    return;
  }

  const r = await authChamarApi("/api/admin/users/" + adminUsuarioSelecionadoId, {
    method: "PATCH",
    headers: Object.assign({ "Content-Type": "application/json" }, adminHeaders()),
    body: JSON.stringify(corpo)
  });

  if (!r.ok) {
    adminMostrarErro("admin_modal_editar_erro", (r.corpo && r.corpo.detail) || "Não foi possível salvar as alterações.");
    return;
  }

  adminFecharModalEditarUsuario();
  adminCarregarUsuarios();
}

/* ---- redefinir senha de usuário (envia e-mail, nunca mostra o token) ---- */

async function adminRedefinirSenhaUsuario(usuario) {
  if (!confirm("Enviar e-mail de redefinição de senha para " + usuario.nome + " (" + usuario.login + ")?")) {
    return;
  }
  const r = await authChamarApi("/api/admin/users/" + usuario.id + "/reset-password", {
    method: "POST",
    headers: adminHeaders()
  });
  if (!r.ok) {
    alert((r.corpo && r.corpo.detail) || "Não foi possível redefinir a senha — verifique se o usuário tem e-mail cadastrado.");
    return;
  }
  alert("E-mail de redefinição enviado para " + usuario.nome + ".");
}

/* ---- excluir usuário (bloqueado pelo backend quando há histórico) ---- */

async function adminExcluirUsuario(usuario) {
  if (!confirm("Excluir o usuário " + usuario.nome + " (" + usuario.login + ")? Esta ação não pode ser desfeita.")) {
    return;
  }
  const r = await authChamarApi("/api/admin/users/" + usuario.id, {
    method: "DELETE",
    headers: adminHeaders()
  });
  if (!r.ok) {
    alert((r.corpo && r.corpo.detail) || "Não foi possível excluir o usuário.");
    return;
  }
  adminCarregarUsuarios();
}

/* ---- modal: auditoria de um usuário ---- */

async function adminAbrirModalAuditoriaUsuario(usuario) {
  document.getElementById("admin_modal_auditoria_usuario_titulo").textContent =
    "Auditoria — " + usuario.nome + " (" + usuario.login + ")";
  const tbody = document.getElementById("admin_modal_auditoria_usuario_tbody");
  tbody.innerHTML = "<tr><td colspan='5'>Carregando...</td></tr>";
  document.getElementById("admin_modal_auditoria_usuario").style.display = "flex";

  const r = await authChamarApi("/api/admin/users/" + usuario.id + "/audit", { headers: adminHeaders() });
  if (!r.ok) {
    tbody.innerHTML = "<tr><td colspan='5'>" + adminEscapar((r.corpo && r.corpo.detail) || "Erro ao carregar.") + "</td></tr>";
    return;
  }

  tbody.innerHTML = "";
  if (r.corpo.length === 0) {
    tbody.innerHTML = "<tr><td colspan='5'>Nenhum registro encontrado.</td></tr>";
    return;
  }
  r.corpo.forEach(reg => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + adminFormatarData(reg.criado_em) + "</td>" +
      "<td>" + adminEscapar(reg.acao) + "</td>" +
      "<td>" + adminEscapar(reg.entidade) + "</td>" +
      "<td>" + adminEscapar(reg.detalhes ? JSON.stringify(reg.detalhes) : "-") + "</td>" +
      "<td>" + adminEscapar(reg.ip || "-") + "</td>";
    tbody.appendChild(tr);
  });
}

function adminFecharModalAuditoriaUsuario() {
  document.getElementById("admin_modal_auditoria_usuario").style.display = "none";
}

/* ================= SOLICITAÇÕES DE ACESSO ================= */

async function adminCarregarSolicitacoesAcesso() {
  adminMostrarErro("admin_solic_erro", "");
  const r = await authChamarApi("/api/auth/access-requests", { headers: adminHeaders() });
  if (!r.ok) {
    adminMostrarErro("admin_solic_erro", (r.corpo && r.corpo.detail) || "Não foi possível listar solicitações.");
    return;
  }

  const tbody = document.getElementById("admin_solic_tbody");
  tbody.innerHTML = "";
  if (r.corpo.length === 0) {
    tbody.innerHTML = "<tr><td colspan='8'>Nenhuma solicitação encontrada.</td></tr>";
    return;
  }

  r.corpo.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + adminEscapar(s.nome_solicitante) + "</td>" +
      "<td>" + adminEscapar(s.matricula || "-") + "</td>" +
      "<td>" + adminEscapar(s.login_solicitado) + "</td>" +
      "<td>" + adminEscapar(s.email || "-") + "</td>" +
      "<td>" + adminEscapar(s.whatsapp || "-") + "</td>" +
      "<td>" + adminFormatarData(s.solicitado_em) + "</td>" +
      "<td><span class=\"admin-badge " + adminStatusClasse(s.status) + "\">" + adminEscapar(s.status) + "</span></td>" +
      "<td class=\"admin-acoes\"></td>";

    const tdAcoes = tr.querySelector(".admin-acoes");
    if (s.status === "PENDENTE") {
      tdAcoes.appendChild(adminBotaoAcao("Aprovar", () => adminAbrirModalAprovarAcesso(s.id)));
      tdAcoes.appendChild(adminBotaoAcao("Rejeitar", () => adminAbrirModalRejeitar("acesso", s.id)));
    } else if (s.motivo_rejeicao) {
      const span = document.createElement("span");
      span.className = "admin-motivo";
      span.textContent = s.motivo_rejeicao;
      tdAcoes.appendChild(span);
    }
    tbody.appendChild(tr);
  });
}

function adminAbrirModalAprovarAcesso(solicitacaoId) {
  adminAprovarAcessoId = solicitacaoId;
  document.getElementById("admin_modal_aprovar_perfil").value = "OPERADOR";
  adminMostrarErro("admin_modal_aprovar_erro", "");
  document.getElementById("admin_modal_aprovar_acesso").style.display = "flex";
}

function adminFecharModalAprovarAcesso() {
  document.getElementById("admin_modal_aprovar_acesso").style.display = "none";
  adminAprovarAcessoId = null;
}

async function adminConfirmarAprovarAcesso() {
  const perfil = document.getElementById("admin_modal_aprovar_perfil").value;
  const r = await authChamarApi("/api/auth/access-requests/" + adminAprovarAcessoId + "/approve", {
    method: "PATCH",
    headers: Object.assign({ "Content-Type": "application/json" }, adminHeaders()),
    body: JSON.stringify({ perfil })
  });

  if (!r.ok) {
    adminMostrarErro("admin_modal_aprovar_erro", (r.corpo && r.corpo.detail) || "Não foi possível aprovar.");
    return;
  }

  adminFecharModalAprovarAcesso();
  adminCarregarSolicitacoesAcesso();
  adminCarregarDashboard();
}

/* ================= REDEFINIÇÕES DE SENHA ================= */

async function adminCarregarRedefinicoes() {
  adminMostrarErro("admin_redef_erro", "");
  const r = await authChamarApi("/api/auth/password-reset-requests", { headers: adminHeaders() });
  if (!r.ok) {
    adminMostrarErro("admin_redef_erro", (r.corpo && r.corpo.detail) || "Não foi possível listar redefinições.");
    return;
  }

  const tbody = document.getElementById("admin_redef_tbody");
  tbody.innerHTML = "";
  if (r.corpo.length === 0) {
    tbody.innerHTML = "<tr><td colspan='5'>Nenhuma solicitação encontrada.</td></tr>";
    return;
  }

  r.corpo.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + adminEscapar(s.usuario_nome) + "</td>" +
      "<td>" + adminEscapar(s.usuario_login) + "</td>" +
      "<td>" + adminFormatarData(s.solicitado_em) + "</td>" +
      "<td><span class=\"admin-badge " + adminStatusClasse(s.status) + "\">" + adminEscapar(s.status) + "</span></td>" +
      "<td class=\"admin-acoes\"></td>";

    const tdAcoes = tr.querySelector(".admin-acoes");
    if (s.status === "PENDENTE") {
      tdAcoes.appendChild(adminBotaoAcao("Aprovar", () => adminAprovarRedefinicao(s.id)));
      tdAcoes.appendChild(adminBotaoAcao("Rejeitar", () => adminAbrirModalRejeitar("redefinicao", s.id)));
    } else if (s.motivo_rejeicao) {
      const span = document.createElement("span");
      span.className = "admin-motivo";
      span.textContent = s.motivo_rejeicao;
      tdAcoes.appendChild(span);
    }
    tbody.appendChild(tr);
  });
}

async function adminAprovarRedefinicao(solicitacaoId) {
  const r = await authChamarApi("/api/auth/password-reset-requests/" + solicitacaoId + "/approve", {
    method: "PATCH",
    headers: adminHeaders()
  });

  if (!r.ok) {
    adminMostrarErro("admin_redef_erro", (r.corpo && r.corpo.detail) || "Não foi possível aprovar.");
    return;
  }

  document.getElementById("admin_modal_token_valor").textContent = r.corpo.token;
  document.getElementById("admin_modal_token").style.display = "flex";
  adminCarregarRedefinicoes();
  adminCarregarDashboard();
}

function adminFecharModalToken() {
  document.getElementById("admin_modal_token").style.display = "none";
  document.getElementById("admin_modal_token_valor").textContent = "";
}

/* ---- modal genérico de motivo de rejeição (acesso ou redefinição) ---- */

function adminAbrirModalRejeitar(tipo, id) {
  adminRejeitarTipo = tipo;
  adminRejeitarId = id;
  document.getElementById("admin_modal_rejeitar_motivo").value = "";
  adminMostrarErro("admin_modal_rejeitar_erro", "");
  document.getElementById("admin_modal_rejeitar").style.display = "flex";
}

function adminFecharModalRejeitar() {
  document.getElementById("admin_modal_rejeitar").style.display = "none";
  adminRejeitarTipo = null;
  adminRejeitarId = null;
}

async function adminConfirmarRejeitar() {
  const motivo = document.getElementById("admin_modal_rejeitar_motivo").value.trim() || null;
  const caminho = adminRejeitarTipo === "acesso"
    ? "/api/auth/access-requests/" + adminRejeitarId + "/reject"
    : "/api/auth/password-reset-requests/" + adminRejeitarId + "/reject";

  const r = await authChamarApi(caminho, {
    method: "PATCH",
    headers: Object.assign({ "Content-Type": "application/json" }, adminHeaders()),
    body: JSON.stringify({ motivo_rejeicao: motivo })
  });

  if (!r.ok) {
    adminMostrarErro("admin_modal_rejeitar_erro", (r.corpo && r.corpo.detail) || "Não foi possível rejeitar.");
    return;
  }

  const tipoFechado = adminRejeitarTipo;
  adminFecharModalRejeitar();
  if (tipoFechado === "acesso") adminCarregarSolicitacoesAcesso();
  else adminCarregarRedefinicoes();
  adminCarregarDashboard();
}

/* ================= AUDITORIA (somente leitura) ================= */

async function adminCarregarAuditoria() {
  adminMostrarErro("admin_audit_erro", "");
  const params = new URLSearchParams();
  const acao = document.getElementById("admin_audit_filtro_acao").value.trim();
  const entidade = document.getElementById("admin_audit_filtro_entidade").value.trim();
  if (acao) params.set("acao", acao);
  if (entidade) params.set("entidade", entidade);
  params.set("ordem", adminOrdemAuditoria);

  const r = await authChamarApi("/api/admin/audit?" + params.toString(), { headers: adminHeaders() });
  if (!r.ok) {
    adminMostrarErro("admin_audit_erro", (r.corpo && r.corpo.detail) || "Não foi possível listar a auditoria.");
    return;
  }

  const tbody = document.getElementById("admin_audit_tbody");
  tbody.innerHTML = "";
  if (r.corpo.length === 0) {
    tbody.innerHTML = "<tr><td colspan='7'>Nenhum registro encontrado.</td></tr>";
    return;
  }

  r.corpo.forEach(reg => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + adminFormatarData(reg.criado_em) + "</td>" +
      "<td>" + adminEscapar(reg.usuario_nome || "-") + "</td>" +
      "<td>" + adminEscapar(reg.acao) + "</td>" +
      "<td>" + adminEscapar(reg.entidade) + "</td>" +
      "<td>" + adminEscapar(reg.entidade_id || "-") + "</td>" +
      "<td>" + adminEscapar(reg.detalhes ? JSON.stringify(reg.detalhes) : "-") + "</td>" +
      "<td>" + adminEscapar(reg.ip || "-") + "</td>";
    tbody.appendChild(tr);
  });
}

function adminAlternarOrdemAuditoria() {
  adminOrdemAuditoria = adminOrdemAuditoria === "desc" ? "asc" : "desc";
  document.getElementById("admin_audit_btn_ordem").textContent =
    adminOrdemAuditoria === "desc" ? "Ordem: mais recentes primeiro" : "Ordem: mais antigos primeiro";
  adminCarregarAuditoria();
}

/* ================= EVENTOS ================= */

function adminConectarEventos() {
  document.getElementById("admin_users_btn_filtrar").addEventListener("click", adminCarregarUsuarios);
  document.getElementById("admin_modal_perfis_salvar").addEventListener("click", adminSalvarPerfis);
  document.getElementById("admin_modal_editar_salvar").addEventListener("click", adminSalvarEdicaoUsuario);
  document.getElementById("admin_modal_rejeitar_confirmar").addEventListener("click", adminConfirmarRejeitar);
  document.getElementById("admin_modal_aprovar_confirmar").addEventListener("click", adminConfirmarAprovarAcesso);
  document.getElementById("admin_audit_btn_filtrar").addEventListener("click", adminCarregarAuditoria);
  document.getElementById("admin_audit_btn_ordem").addEventListener("click", adminAlternarOrdemAuditoria);
}

document.addEventListener("DOMContentLoaded", adminConectarEventos);
