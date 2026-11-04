/* =========================================================
   CALLBACK WHATSAPP — controlador do módulo
   =========================================================
   Depende de: mensagens.js (carregado antes deste arquivo no
   index.html).

   Nomenclatura: todo id/função deste módulo usa o prefixo "cbw_"
   (Callback WhatsApp) para não colidir com ids de outros módulos
   da mesma página.

   Mensagens e abertura do WhatsApp seguem a Central Callback Web
   1.1.0 (referência oficial):
   - textos/assuntos/prioridade: js/modelos.js + nucleo.js
     (N.catalogoAgrupado, N.renderizar, N.comSaudacao);
   - link: nucleo.js N.linkWhatsappWeb
     -> https://web.whatsapp.com/send?phone=55<numero>&text=<texto>;
   - abertura: app.js abrirWhatsapp/envioManual — about:blank aberto
     no próprio clique (evita bloqueio de pop-up), opener = null e
     depois navega para o endereço final. Uma única aba por clique,
     sem wa.me/api.whatsapp.com (que mostravam a página intermediária
     "App ou WhatsApp Web" e abriam uma segunda aba).

   Este módulo NÃO grava nada: o antigo histórico local foi removido
   (ver cbwRemoverHistoricoAntigo).
   ========================================================= */

/* ---------- leitura de campos ---------- */

function cbwValor(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function cbwValorBruto(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function cbwModoAtual() {
  const marcado = document.querySelector('input[name="cbw_modo"]:checked');
  return marcado ? marcado.value : "padronizada";
}

/* ---------- seletor de mensagens (agrupado por assunto) ---------- */

/* Agrupa MENSAGENS_CALLBACK por assunto, na ordem em que estão em
   mensagens.js (já é a ordem alfabética da Central). */
function cbwMensagensAgrupadas() {
  const grupos = [];
  Object.keys(MENSAGENS_CALLBACK).forEach(codigo => {
    const m = MENSAGENS_CALLBACK[codigo];
    let g = grupos[grupos.length - 1];
    if (!g || g.grupo !== m.grupo) grupos.push(g = { grupo: m.grupo, mensagens: [] });
    g.mensagens.push({ codigo, label: m.label, prioridade: !!m.prioridade });
  });
  return grupos;
}

/* Mesmo formato do seletor da Central (app.js): <optgroup> com o
   assunto em MAIÚSCULAS e "⚠ PRIORIDADE" nos subtipos de risco. */
function cbwMontarSeletorMensagens() {
  const select = document.getElementById("cbw_tipo_ocorrencia");
  if (!select) return;
  select.querySelectorAll("optgroup").forEach(g => g.remove());
  cbwMensagensAgrupadas().forEach(g => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = g.grupo.toUpperCase();
    g.mensagens.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.codigo;
      opt.textContent = m.label + (m.prioridade ? "  ⚠ PRIORIDADE" : "");
      optgroup.appendChild(opt);
    });
    select.appendChild(optgroup);
  });
}

/* ---------- geração do texto da mensagem ---------- */

/* Igual a N.comSaudacao da Central: garante a saudação institucional
   no início, sem duplicar se o texto já começar com ela. */
function cbwSemAcento(texto) {
  return String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function cbwComSaudacao(texto) {
  texto = String(texto || "").trim();
  const inicio = cbwSemAcento(texto.slice(0, 40)).toLowerCase()
    .replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  if (inicio.startsWith("ola aqui e a energisa")) return texto;
  return texto ? `${SAUDACAO_CALLBACK} ${texto}` : SAUDACAO_CALLBACK;
}

/* Igual a N.renderizar da Central para as mensagens manuais: texto do
   modelo + "Referência do atendimento: <incidente>" quando houver. */
function cbwRenderizarMensagem(chave, incidente) {
  const modelo = MENSAGENS_CALLBACK[chave];
  if (!modelo) return "";
  let texto = modelo.texto;
  if (incidente && !texto.includes(incidente)) texto += `\n\nReferência do atendimento: ${incidente}`;
  return texto;
}

function cbwTextoAtual() {
  if (cbwModoAtual() === "padronizada") {
    return cbwRenderizarMensagem(cbwValor("cbw_tipo_ocorrencia"), cbwValor("cbw_ocorrencia"));
  }

  // Personalizada: saudação institucional da Central + corpo livre.
  const corpo = cbwValorBruto("cbw_texto_personalizado");
  if (!corpo.trim()) return saudacaoPersonalizada() + " ";
  return cbwComSaudacao(corpo);
}

/* ---------- telefone / link do WhatsApp ---------- */

/* Só normaliza para montar o DDI 55 — não restringe o tipo de número
   (aceita os mesmos números que o módulo já aceitava).
   - remove tudo que não é dígito;
   - 12/13 dígitos começando com 55: já tem DDI, fica como está;
   - 11/12 dígitos começando com 0 (0 + DDD + número): tira o 0;
   - 10/11 dígitos (DDD + número): recebe o 55.
   Qualquer outro tamanho segue como digitado (comportamento anterior). */
function cbwNormalizarTelefone(numero) {
  let digitos = String(numero || "").replace(/\D/g, "");
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    return digitos;
  }
  if ((digitos.length === 11 || digitos.length === 12) && digitos.startsWith("0")) {
    digitos = digitos.slice(1);
  }
  if (digitos.length === 10 || digitos.length === 11) {
    digitos = "55" + digitos;
  }
  return digitos;
}

/* Mesmo endereço da Central (N.linkWhatsappWeb). O número já vem com
   o DDI 55 de cbwNormalizarTelefone(). */
function cbwMontarLinkWhatsApp(numero, texto) {
  return `https://web.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(texto)}`;
}

/* ---------- validação ---------- */

function cbwValidar() {
  const erros = [];
  if (!cbwValor("cbw_operador")) erros.push("Informe o nome do operador.");
  if (!cbwValor("cbw_telefone")) erros.push("Informe o telefone do cliente.");
  else if (!cbwNormalizarTelefone(cbwValor("cbw_telefone"))) erros.push("O telefone do cliente não tem números.");
  if (cbwModoAtual() === "padronizada" && !cbwValor("cbw_tipo_ocorrencia")) {
    erros.push("Selecione o tipo de ocorrência.");
  }
  return erros;
}

/* ---------- visual: alternância de modo ---------- */

function cbwAplicarModoVisual() {
  const modo = cbwModoAtual();
  const blocoPadrao = document.getElementById("cbw_bloco_padronizada");
  const blocoLivre = document.getElementById("cbw_bloco_personalizada");
  if (blocoPadrao) blocoPadrao.hidden = modo !== "padronizada";
  if (blocoLivre) blocoLivre.hidden = modo !== "personalizada";
}

function cbwAtualizarSaudacaoVisivel() {
  const el = document.getElementById("cbw_saudacao_auto");
  if (el) el.textContent = saudacaoPersonalizada();
}

/* ---------- pré-visualização (smartphone) ---------- */

function cbwHoraCurta() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function cbwAtualizarPreview() {
  const bolha = document.getElementById("cbw_preview_texto");
  if (!bolha) return;

  const texto = cbwTextoAtual();
  const temTexto = texto.trim().length > 0;

  bolha.textContent = temTexto
    ? texto
    : "A mensagem aparece aqui conforme você preenche os campos ao lado.";
  bolha.classList.toggle("cbw-preview-vazio", !temTexto);

  const horaEl = document.getElementById("cbw_preview_hora");
  const bolhaWrap = document.getElementById("cbw_preview_bolha");
  if (horaEl) horaEl.textContent = temTexto ? cbwHoraCurta() : "";
  if (bolhaWrap) bolhaWrap.classList.toggle("cbw-bolha-vazia", !temTexto);
}

/* ---------- envio ---------- */

/* Abre o WhatsApp Web exatamente como a Central (app.js): a aba é
   aberta em branco DENTRO do clique (o navegador não bloqueia como
   pop-up), o vínculo com esta página é cortado (opener = null) e só
   então a aba navega para o endereço final. Resultado: uma única aba,
   direto na conversa, sem página intermediária e sem WhatsApp Desktop.
   Retorna false se o navegador bloqueou a janela. */
function cbwAbrirWhatsAppWeb(link) {
  const janela = window.open("about:blank", "_blank");
  if (!janela) return false;
  janela.opener = null;
  janela.location.href = link;
  return true;
}

function cbwEnviar() {
  const erros = cbwValidar();
  if (erros.length > 0) {
    if (typeof showToast === "function") showToast(erros[0]);
    cbwDestacarCamposObrigatorios();
    return;
  }

  const texto = cbwTextoAtual();
  const numero = cbwNormalizarTelefone(cbwValor("cbw_telefone"));
  const link = cbwMontarLinkWhatsApp(numero, texto);

  if (!cbwAbrirWhatsAppWeb(link)) {
    if (typeof showToast === "function") {
      showToast("O navegador bloqueou a nova janela. Permita pop-ups para o COI Operacional.");
    }
    return; // mantém os campos preenchidos para tentar de novo
  }

  // Abrir a conversa NÃO envia nada: o operador confere e envia no WhatsApp Web.
  if (typeof showToast === "function") showToast("WhatsApp Web aberto com a mensagem pronta. Confira e envie.");

  cbwResetParaNovoAtendimento();
}

function cbwDestacarCamposObrigatorios() {
  ["cbw_operador", "cbw_telefone"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!el.value.trim()) {
      el.classList.add("cbw-campo-erro");
      el.addEventListener("input", () => el.classList.remove("cbw-campo-erro"), { once: true });
    }
  });
}

function cbwResetParaNovoAtendimento() {
  ["cbw_ocorrencia", "cbw_telefone"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const tipo = document.getElementById("cbw_tipo_ocorrencia");
  if (tipo) tipo.selectedIndex = 0;

  const textoLivre = document.getElementById("cbw_texto_personalizado");
  if (textoLivre) textoLivre.value = "";

  // Nome do operador fica preenchido de propósito
  // (pedido explícito: agiliza o próximo atendimento).
  cbwAtualizarPreview();
}

/* ---------- remoção do histórico antigo ---------- */

/* O módulo tinha um histórico local de mensagens (telefone, incidente,
   texto enviado) gravado SOMENTE nesta chave. O histórico foi removido;
   aqui apagamos apenas essa chave — nenhuma outra chave do
   localStorage é lida, alterada ou apagada. */
const CBW_CHAVE_HISTORICO_ANTIGO = "coi_callback_whatsapp_historico";

function cbwRemoverHistoricoAntigo() {
  try {
    localStorage.removeItem(CBW_CHAVE_HISTORICO_ANTIGO);
  } catch (erro) {
    // localStorage indisponível (ex.: bloqueado pelo navegador): nada a remover.
  }
}

/* ---------- inicialização ---------- */

function cbwInit() {
  const raiz = document.getElementById("callback");
  if (!raiz) return;

  cbwRemoverHistoricoAntigo();
  cbwMontarSeletorMensagens();

  document.querySelectorAll('input[name="cbw_modo"]').forEach(radio => {
    radio.addEventListener("change", () => {
      cbwAplicarModoVisual();
      cbwAtualizarPreview();
    });
  });

  const ocorrenciaEl = document.getElementById("cbw_ocorrencia");
  if (ocorrenciaEl) ocorrenciaEl.addEventListener("input", cbwAtualizarPreview);

  const tipoEl = document.getElementById("cbw_tipo_ocorrencia");
  if (tipoEl) tipoEl.addEventListener("change", cbwAtualizarPreview);

  const textoLivreEl = document.getElementById("cbw_texto_personalizado");
  if (textoLivreEl) textoLivreEl.addEventListener("input", cbwAtualizarPreview);

  const enviarEl = document.getElementById("cbw_btn_enviar");
  if (enviarEl) enviarEl.addEventListener("click", cbwEnviar);

  cbwAplicarModoVisual();
  cbwAtualizarSaudacaoVisivel();
  cbwAtualizarPreview();
}

document.addEventListener("DOMContentLoaded", cbwInit);
