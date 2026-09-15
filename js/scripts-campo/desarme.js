/* SCRIPT DESARME (ds-*) — terceiro módulo reintegrado do sistema antigo
   (backup scriptdebloqueioslinhaviva-v2, js/desarme.js). Cliente puro: lê
   campos do formulário, monta um texto padronizado (formato WhatsApp,
   com emojis), copia pra área de transferência — sem fetch, sem
   localStorage, sem dependência de banco/API (mesmo comportamento do
   original).

   Mantida a MESMA regra de negócio/formato de saída do original — com
   UMA correção isolada e documentada (ver bloco "CORREÇÃO: ds_obs"
   abaixo) — e as seguintes adaptações de integração:
   - ids já vinham prefixados "ds_" desde o backup (sem colisão, mantidos
     como estavam);
   - o original usava BINDING GLOBAL IMPLÍCITO (ex.: "ds_ativo_tipo.value"
     em vez de "document.getElementById('ds_ativo_tipo').value",
     dependendo do navegador expor elementos com id como propriedade
     global de window) — trocado por document.getElementById explícito
     em toda leitura/escrita, exatamente como já foi feito em
     bloqueios.js e sinergia.js;
   - funções renomeadas com o prefixo "ds" (gerarDesarme -> dsGerarRelatorio,
     limparDesarme -> dsLimparRelatorio) pra seguir a mesma convenção dos
     outros dois módulos e nunca colidir com nomes genéricos de outro
     módulo, mesmo escopo global de sempre;
   - a IIFE que ordena as opções de Subestação (A-Z) foi mantida com o
     mesmo comportamento, só renomeada (dsOrdenarSubestacoes) por
     consistência — continua anônima/isolada, não vira função global;
   - showToast() é a mesma função já existente em js/core.js, reaproveitada
     sem nenhuma cópia;
   - montagem do texto extraída pra uma função PURA (dsMontarTexto),
     testável em Node sem DOM — mesmo padrão usado em blvMontarTexto/
     sgMontarTexto. A formatação de data/hora (que só depende do valor
     string do campo, não de um elemento do DOM) foi movida pra dentro
     da função pura também, preservando o mesmo algoritmo.

   ===== CORREÇÃO: ds_obs =====
   Achado da auditoria: o formulário original tem um campo "Observação"
   (select #ds_obs, com 11 opções de causa/situação de desarme) montado
   lado a lado com "Situação Atual" na mesma linha do formulário — mas a
   função gerarDesarme() original NUNCA lê ds_obs.value em lugar nenhum.
   O operador podia selecionar uma observação e ela desaparecia: nunca
   entrava no texto copiado/enviado. Comportamento original (bug):
   campo existe na tela, mas é descartado silenciosamente. Comportamento
   esperado: um campo chamado "Observação", ao lado de "Situação Atual"
   e alimentado com opções de texto reais (não um simples "Selecione"
   vazio), claramente deveria compor o relatório final, do mesmo jeito
   que Situação Atual e Condições Climáticas compõem.
   Correção aplicada (isolada): dsMontarTexto agora inclui uma seção
   "📝 *Observação:*" com o valor de ds_obs, posicionada logo após
   "Situação Atual" (mesmo par visual do formulário) e antes de
   "Condições Climáticas". Nenhuma outra linha/regra do texto original
   foi alterada. Ver comparação em js/scripts-campo/desarme.test.js e no
   relatório desta etapa — a saída NÃO é mais byte-a-byte idêntica ao
   backup por causa desta linha a mais, intencionalmente. */

// Pura: recebe um objeto simples com os valores já lidos do formulário
// (nunca elementos do DOM) e devolve o texto final — testável em Node
// puro (ver js/scripts-campo/desarme.test.js). Mesmo template/rótulos/
// algoritmo de data do original (js/desarme.js::gerarDesarme), só com a
// seção de Observação adicionada (ver CORREÇÃO: ds_obs acima).
function dsMontarTexto(dados) {
  const d = dados || {};

  const tipoAtivo = d.ativoTipo || "";
  const numAtivo = d.ativoNum || "";
  const ativo = (tipoAtivo && numAtivo) ? `${tipoAtivo} ${numAtivo}` : "-";

  const subestacao = d.subestacao || "-";
  const alimentador = d.alimentador || "-";
  const uc = d.uc || "-";
  const clima = d.clima || "-";
  const situacao = d.situacao || "-";
  const obs = d.obs || "-";

  let dataHoraFormatada = "-";
  if (d.datahora) {
    const dt = new Date(d.datahora);
    const dia = dt.getDate().toString().padStart(2, "0");
    const mes = dt.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
    const h = dt.getHours().toString().padStart(2, "0");
    const m = dt.getMinutes().toString().padStart(2, "0");
    const s = dt.getSeconds().toString().padStart(2, "0");
    dataHoraFormatada = `${dia}/${mes}. | ${h}h ${m}m ${s}s`;
  }

  return (
`🚨 *Informação de Ocorrência* 🚨

💡 *Rede:*
${ativo} | SUB: ${subestacao} | ALIM: ${alimentador}

🗓️ *Data | Hora da Ocorrência:*
${dataHoraFormatada}

🏠 *UC Atingidas:*
${uc}

⏱️ *Situação Atual:*
${situacao}

📝 *Observação:*
${obs}

🌤️ *Condições Climáticas:*
${clima}`
  );
}

function dsGerarRelatorio() {
  const dados = {
    ativoTipo: document.getElementById("ds_ativo_tipo").value,
    ativoNum: document.getElementById("ds_ativo_num").value,
    datahora: document.getElementById("ds_datahora").value,
    uc: document.getElementById("ds_uc").value,
    subestacao: document.getElementById("ds_subestacao").value,
    alimentador: document.getElementById("ds_alimentador").value,
    clima: document.getElementById("ds_clima").value,
    situacao: document.getElementById("ds_situacao").value,
    obs: document.getElementById("ds_obs").value,
  };

  const texto = dsMontarTexto(dados);

  document.getElementById("ds_resultado").value = texto;

  navigator.clipboard.writeText(texto);

  if (typeof showToast === "function") {
    showToast("Script Desarme copiado 🚨");
  }
}

// Mesmo comportamento do original (js/desarme.js::limparDesarme): limpa
// input/textarea, reseta os <select> pro primeiro option.
function dsLimparRelatorio() {
  document.querySelectorAll("#desarme input, #desarme textarea")
    .forEach(el => { el.value = ""; });

  document.querySelectorAll("#desarme select")
    .forEach(el => { el.selectedIndex = 0; });

  document.getElementById("ds_resultado").value = "";
}

// Mesmo comportamento do original (js/desarme.js::ordenarSubestacoes):
// reordena as opções do select de Subestação em ordem alfabética (A-Z),
// rodando uma vez quando o script carrega. IIFE isolada, não vira função
// global — só renomeada por consistência com o resto deste arquivo.
(function dsOrdenarSubestacoes() {
  const select = document.getElementById("ds_subestacao");
  if (!select) return;

  const opcoes = Array.from(select.options)
    .filter(opt => opt.value !== "");

  opcoes.sort((a, b) =>
    a.text.localeCompare(b.text, "pt-BR")
  );

  select.innerHTML = '<option value="">Selecione</option>';
  opcoes.forEach(opt => select.appendChild(opt));
})();
