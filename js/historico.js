/* =========================================================
   HISTÓRICO — CALLBACK WHATSAPP
   =========================================================
   Só cuida de renderizar o que está em CallbackStorage.
   Não sabe nada sobre o formulário — recebe o registro pronto
   na hora de salvar (isso é feito em callback-whatsapp.js).
   ========================================================= */

function historicoRenderizar() {
  const lista = document.getElementById("cbw_historico_lista");
  const vazio = document.getElementById("cbw_historico_vazio");
  if (!lista) return;

  const registros = CallbackStorage.listarTodos();

  lista.innerHTML = "";

  if (registros.length === 0) {
    if (vazio) vazio.style.display = "block";
    return;
  }
  if (vazio) vazio.style.display = "none";

  registros.forEach((r, indice) => {
    lista.appendChild(historicoCriarItem(r, indice));
  });
}

function historicoCriarItem(registro, indice) {
  const item = document.createElement("div");
  item.className = "cbw-hist-item";

  const statusClasse = registro.status === "Enviado" ? "cbw-badge-ok" : "cbw-badge-pendente";

  item.innerHTML = `
    <div class="cbw-hist-linha-topo">
      <span class="cbw-hist-datahora">${historicoEscapar(registro.data)} • ${historicoEscapar(registro.hora)}</span>
      <span class="cbw-badge ${statusClasse}">${historicoEscapar(registro.status)}</span>
    </div>
    <div class="cbw-hist-linha-meta">
      <span><strong>N° Incidente:</strong> ${historicoEscapar(registro.ocorrencia || "—")}</span>
      <span><strong>Cliente:</strong> ${historicoEscapar(registro.telefone || "—")}</span>
      <span><strong>Operador:</strong> ${historicoEscapar(registro.operador || "—")}</span>
    </div>
    <div class="cbw-hist-linha-meta">
      <span><strong>Tipo:</strong> ${historicoEscapar(registro.tipoOcorrencia || "—")}</span>
      <span><strong>Modo:</strong> ${historicoEscapar(registro.modo || "—")}</span>
    </div>
    <button type="button" class="cbw-hist-ver" data-indice="${indice}">Ver mensagem enviada ▾</button>
    <pre class="cbw-hist-mensagem" hidden></pre>
  `;

  const botaoVer = item.querySelector(".cbw-hist-ver");
  const blocoMensagem = item.querySelector(".cbw-hist-mensagem");
  botaoVer.addEventListener("click", () => {
    const aberto = !blocoMensagem.hidden;
    blocoMensagem.hidden = aberto;
    blocoMensagem.textContent = registro.mensagem || "";
    botaoVer.textContent = aberto ? "Ver mensagem enviada ▾" : "Ocultar mensagem ▴";
  });

  return item;
}

// Escapamento simples — os dados vêm de campos de formulário, não de HTML de terceiros,
// mas isso evita que qualquer caractere < > vire marcação por engano.
function historicoEscapar(texto) {
  const div = document.createElement("div");
  div.textContent = String(texto ?? "");
  return div.innerHTML;
}

function historicoLimparTudo() {
  if (!confirm("Isso vai apagar todo o histórico de mensagens salvas neste navegador. Confirmar?")) {
    return;
  }
  CallbackStorage.limparTudo();
  historicoRenderizar();
  if (typeof showToast === "function") showToast("Histórico limpo.");
}
