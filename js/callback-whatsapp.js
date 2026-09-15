/* =========================================================
   CALLBACK WHATSAPP — controlador do módulo
   =========================================================
   Depende de: mensagens.js, storage.js, historico.js
   (carregados antes deste arquivo no index.html)

   Nomenclatura: todo id/função deste módulo usa o prefixo "cbw_"
   (Callback WhatsApp) para não colidir com o formulário de
   Registro de Ocorrência que já existe na mesma tela (ele usa
   ids como "operador" e "telefone" — sem o prefixo haveria
   ids duplicados na página e os dois formulários quebrariam).
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

/* ---------- geração do texto da mensagem ---------- */

function cbwPreencherTemplate(texto, dados) {
  return texto.replace(/\{\{(\w+)\}\}/g, (match, chave) =>
    Object.prototype.hasOwnProperty.call(dados, chave) ? dados[chave] : match
  );
}

function cbwTextoAtual() {
  const operador = cbwValor("cbw_operador");

  if (cbwModoAtual() === "padronizada") {
    const chave = cbwValor("cbw_tipo_ocorrencia");
    const modelo = MENSAGENS_CALLBACK[chave];
    if (!modelo) return "";
    let texto = cbwPreencherTemplate(modelo.texto, { OPERADOR: operador || "____" });
    const ocorrencia = cbwValor("cbw_ocorrencia");
    if (ocorrencia) texto += `\n\nOcorrência nº ${ocorrencia}`;
    return texto;
  }

  // Personalizada: saudação fixa (gerada a partir do nome do operador) + corpo livre.
  const corpo = cbwValorBruto("cbw_texto_personalizado");
  return saudacaoPersonalizada(operador) + corpo;
}

/* ---------- telefone / link do WhatsApp ---------- */

function cbwNormalizarTelefone(numero) {
  let digitos = String(numero || "").replace(/\D/g, "");
  // Número informado sem DDI (DDD + telefone = 10 ou 11 dígitos) recebe
  // o 55 automaticamente — sem isso o link do WhatsApp não abre certo.
  if (digitos.length === 10 || digitos.length === 11) {
    digitos = "55" + digitos;
  }
  return digitos;
}

function cbwMontarLinkWhatsApp(numero, texto) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/* ---------- validação ---------- */

function cbwValidar() {
  const erros = [];
  if (!cbwValor("cbw_operador")) erros.push("Informe o nome do operador.");
  if (!cbwValor("cbw_telefone")) erros.push("Informe o telefone do cliente.");
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
  if (el) el.textContent = saudacaoPersonalizada(cbwValor("cbw_operador"));
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

function cbwEnviar() {
  const erros = cbwValidar();
  if (erros.length > 0) {
    if (typeof showToast === "function") showToast(erros[0]);
    cbwDestacarCamposObrigatorios();
    return;
  }

  const operador = cbwValor("cbw_operador");
  const ocorrencia = cbwValor("cbw_ocorrencia");
  const telefoneDigitado = cbwValor("cbw_telefone");
  const modo = cbwModoAtual();
  const chaveTipo = cbwValor("cbw_tipo_ocorrencia");
  const tipoLabel = modo === "padronizada"
    ? (MENSAGENS_CALLBACK[chaveTipo] ? MENSAGENS_CALLBACK[chaveTipo].label : "")
    : "Personalizada";

  const texto = cbwTextoAtual();
  const numero = cbwNormalizarTelefone(telefoneDigitado);
  const link = cbwMontarLinkWhatsApp(numero, texto);

  /* Reaproveitar aba do WhatsApp Web em vez de abrir uma nova a cada envio:
     window.open(url, "coiWhatsAppWeb") usa um nome fixo de destino — o
     próprio navegador reutiliza a mesma aba/janela enquanto ela existir,
     sem precisarmos guardar referência em variável.
     LIMITAÇÃO (documentada conforme pedido): por segurança do navegador,
     um site não tem acesso a abas de outros sites — não é possível
     detectar ou reaproveitar uma aba do WhatsApp Web que o operador já
     tivesse aberto manualmente antes de clicar em Enviar. Isso só
     funciona entre envios feitos a partir deste próprio módulo. */
  window.open(link, "coiWhatsAppWeb");

  const agora = new Date();
  CallbackStorage.salvar({
    data: agora.toLocaleDateString("pt-BR"),
    hora: agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    ocorrencia,
    telefone: telefoneDigitado,
    operador,
    tipoOcorrencia: tipoLabel,
    modo: modo === "padronizada" ? "Padronizada" : "Personalizada",
    // "Enviado" reflete que o WhatsApp foi aberto com a mensagem pronta —
    // não é uma confirmação de entrega/leitura. Isso só é possível com a
    // API oficial do WhatsApp (fora do escopo atual, ver comentário no
    // topo do arquivo mensagens.js sobre extensões futuras).
    status: "Enviado",
    mensagem: texto
  });

  historicoRenderizar();
  if (typeof showToast === "function") showToast("WhatsApp aberto com a mensagem pronta.");

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

  // Nome e matrícula do operador ficam preenchidos de propósito
  // (pedido explícito: agiliza o próximo atendimento).
  cbwAtualizarPreview();
}

/* ---------- inicialização ---------- */

function cbwInit() {
  const raiz = document.getElementById("callback");
  if (!raiz) return;

  document.querySelectorAll('input[name="cbw_modo"]').forEach(radio => {
    radio.addEventListener("change", () => {
      cbwAplicarModoVisual();
      cbwAtualizarPreview();
    });
  });

  const operadorEl = document.getElementById("cbw_operador");
  if (operadorEl) {
    operadorEl.addEventListener("input", () => {
      cbwAtualizarSaudacaoVisivel();
      cbwAtualizarPreview();
    });
  }

  const tipoEl = document.getElementById("cbw_tipo_ocorrencia");
  if (tipoEl) tipoEl.addEventListener("change", cbwAtualizarPreview);

  const textoLivreEl = document.getElementById("cbw_texto_personalizado");
  if (textoLivreEl) textoLivreEl.addEventListener("input", cbwAtualizarPreview);

  const enviarEl = document.getElementById("cbw_btn_enviar");
  if (enviarEl) enviarEl.addEventListener("click", cbwEnviar);

  const limparHistEl = document.getElementById("cbw_historico_limpar");
  if (limparHistEl) limparHistEl.addEventListener("click", historicoLimparTudo);

  cbwAplicarModoVisual();
  cbwAtualizarSaudacaoVisivel();
  cbwAtualizarPreview();
  historicoRenderizar();
}

document.addEventListener("DOMContentLoaded", cbwInit);
