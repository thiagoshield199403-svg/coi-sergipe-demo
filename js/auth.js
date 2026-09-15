/* Tela de login — VERSÃO DEMONSTRATIVA (sem backend).

   O projeto original usa um backend real (FastAPI) com JWT, refresh token
   em cookie HttpOnly, etc. Nesta demo pública não existe backend algum: o
   login abaixo é só uma checagem local de credencial fixa, verificada
   inteiramente no navegador. Não é segurança real, e não deveria ser
   tratada como tal (ver README.md/SECURITY.md) — o código é público, então
   qualquer credencial aqui é, por definição, visível a quem abrir os
   arquivos. Por isso a credencial NUNCA é citada em README/SECURITY/
   comentários/mensagens de erro deste arquivo — só existe aqui embaixo,
   nas duas constantes.

   authChamarApi() continua existindo porque js/equipes.js (Gestão de
   Equipes, funcional nesta demo com dados fictícios) chama fetch() através
   dela — a chamada de rede em si é interceptada por js/demo-backend.js
   (carregado antes deste arquivo em index.html), nunca sai do navegador. */

const COI_AUTH_STORAGE_KEY = "coi_auth_sessao_demo";

const DEMO_LOGIN = "coi";
const DEMO_SENHA = "coi2027";
const DEMO_USUARIO = {
  nome: "Operador Demonstração",
  login: "coi",
  perfis: ["ADMINISTRADOR", "SUPERVISOR", "OPERADOR"],
};

function authObterSessao() {
  try {
    const bruto = localStorage.getItem(COI_AUTH_STORAGE_KEY);
    return bruto ? JSON.parse(bruto) : null;
  } catch (e) {
    return null;
  }
}

function authSalvarSessao(sessao) {
  localStorage.setItem(COI_AUTH_STORAGE_KEY, JSON.stringify(sessao));
}

function authLimparSessao() {
  localStorage.removeItem(COI_AUTH_STORAGE_KEY);
}

function authMostrarView(nome) {
  document.querySelectorAll(".login-view").forEach(v => v.classList.remove("ativo"));
  const alvo = document.getElementById("login-view-" + nome);
  if (alvo) alvo.classList.add("ativo");
  document.querySelectorAll(".login-erro, .login-sucesso").forEach(el => el.classList.remove("mostrar"));
}

function authMostrarErro(elId, mensagem) {
  const el = document.getElementById(elId);
  el.textContent = mensagem;
  el.classList.add("mostrar");
}

function authMostrarSucesso(elId, mensagem) {
  const el = document.getElementById(elId);
  el.textContent = mensagem;
  el.classList.add("mostrar");
}

function authOcultar(elId) {
  document.getElementById(elId).classList.remove("mostrar");
}

function authMostrarApp(usuario) {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("auth_usuario_nome").textContent = usuario.nome;
  document.getElementById("auth_usuario_badge").classList.add("mostrar");
}

function authMostrarLogin() {
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("auth_usuario_badge").classList.remove("mostrar");
}

/* Usada só por js/equipes.js (módulo funcional nesta demo) para chamar
   /api/teams/* — o fetch() é respondido localmente por js/demo-backend.js,
   nunca chega à rede de verdade. Sem renovação/401/refresh: não existe
   sessão que expire nesta demo. */
async function authChamarApi(caminho, opcoes) {
  opcoes = opcoes || {};
  try {
    const resposta = await fetch(caminho, opcoes);
    let corpo = null;
    try { corpo = await resposta.json(); } catch (e) { /* sem corpo JSON (ex.: 204) */ }
    return { ok: resposta.ok, status: resposta.status, corpo };
  } catch (erroRede) {
    return { ok: false, status: 0, corpo: { detail: "Não foi possível contatar o servidor simulado." } };
  }
}

function authInicializar() {
  const sessao = authObterSessao();
  if (sessao && sessao.usuario) {
    authMostrarApp(sessao.usuario);
  } else {
    authMostrarLogin();
  }
}

function authConectarEventos() {
  document.getElementById("login_btn_entrar").addEventListener("click", () => {
    const login = document.getElementById("login_campo_login").value.trim();
    const senha = document.getElementById("login_campo_senha").value;
    authOcultar("login_erro");

    if (!login || !senha) {
      authMostrarErro("login_erro", "Preencha login e senha.");
      return;
    }
    if (login.toLowerCase() !== DEMO_LOGIN || senha !== DEMO_SENHA) {
      authMostrarErro("login_erro", "Login ou senha incorretos.");
      return;
    }

    authSalvarSessao({ usuario: DEMO_USUARIO, access_token: "demo-token" });
    document.getElementById("login_campo_senha").value = "";
    authMostrarApp(DEMO_USUARIO);
  });

  document.getElementById("auth_btn_sair").addEventListener("click", () => {
    authLimparSessao();
    authMostrarLogin();
    authMostrarView("login");
  });

  document.getElementById("acesso_btn_enviar").addEventListener("click", () => {
    authOcultar("acesso_sucesso");
    authMostrarErro("acesso_erro", "Solicitação de criação de acesso não está disponível nesta versão demonstrativa.");
  });

  document.getElementById("esqueci_btn_enviar").addEventListener("click", () => {
    authMostrarSucesso("esqueci_sucesso", "Recuperação de senha não está disponível nesta versão demonstrativa.");
  });

  document.getElementById("redefinir_btn_enviar").addEventListener("click", () => {
    authOcultar("redefinir_sucesso");
    authMostrarErro("redefinir_erro", "Redefinição de senha não está disponível nesta versão demonstrativa.");
  });

  document.getElementById("auth_btn_meu_perfil").addEventListener("click", perfilAbrirModalSenha);

  document.getElementById("perfil_senha_salvar").addEventListener("click", () => {
    authOcultar("perfil_senha_sucesso");
    authMostrarErro("perfil_senha_erro", "Alteração de senha não está disponível nesta versão demonstrativa.");
  });
}

function perfilAbrirModalSenha() {
  document.getElementById("perfil_senha_atual").value = "";
  document.getElementById("perfil_senha_nova").value = "";
  document.getElementById("perfil_senha_confirmar").value = "";
  authOcultar("perfil_senha_erro");
  authOcultar("perfil_senha_sucesso");
  document.getElementById("perfil_modal_senha").style.display = "flex";
}

function perfilFecharModalSenha() {
  document.getElementById("perfil_modal_senha").style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  authConectarEventos();
  authInicializar();
});
