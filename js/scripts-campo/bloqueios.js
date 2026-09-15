/* BLOQUEIO – LINHA VIVA (blv-*) — módulo novo, isolado, reintegrado do
   sistema antigo (backup scriptdebloqueioslinhaviva-v2, js/bloqueios.js).
   Cliente puro: lê campos do formulário, monta um texto padronizado,
   copia pra área de transferência — sem fetch, sem localStorage, sem
   dependência de banco/API (mesmo comportamento do original).

   Mantida a MESMA regra de negócio/formato de saída do original — só
   adaptações de integração com o sistema atual:
   - todo id de campo prefixado com "blv_" (o original usava ids soltos
     como "radio"/"viatura"/"resultado", frágeis por dependerem de
     binding implícito do navegador — ver auditoria);
   - toda leitura via document.getElementById explícito (o original já
     fazia isso dentro de gerarRelatorio(), então a lógica em si não
     mudou, só os nomes dos ids);
   - funções renomeadas com o prefixo "blv" (gerarRelatorio ->
     blvGerarRelatorio, limparRelatorio -> blvLimparRelatorio) para nunca
     colidir com nomes genéricos de outro módulo, mesmo escopo global de
     sempre (index.html carrega todo js/*.js como <script src> clássico);
   - showToast() é a mesma função já existente em js/core.js, reaproveitada
     sem nenhuma cópia;
   - montagem do texto extraída pra uma função PURA (blvMontarTexto),
     testável em Node sem DOM — mesmo padrão que o próprio backup já usava
     em montarTextoTrafo(), só que o original de bloqueios.js não separava
     isso; extração de função, não mudança de regra de negócio (o texto
     gerado é byte-a-byte o mesmo). */

// Pura: recebe um objeto simples com os valores já lidos do formulário
// (nunca elementos do DOM) e devolve o texto final — testável em Node
// puro (ver js/scripts-campo/bloqueios.test.js). Mesmo template/rótulos
// do original (js/bloqueios.js::gerarRelatorio), nenhuma linha alterada.
function blvMontarTexto(dados) {
  const d = dados || {};
  const resp = d.responsavel || "-";
  const eq = (d.equipe || "").toUpperCase() || "-";
  const tel = d.contato || "-";
  const viatura = d.viatura || "-";
  const radio = d.radio || "-";
  const testeRadio = d.testeRadio || "-";
  const referencia = d.referencia || "-";
  const tipoCondutor = d.tipoCondutor || "-";
  const maresia = d.maresia || "-";
  const self = d.selfhealing || "-";
  const desativou = d.desativou || "-";
  const servico = d.servico || "-";
  const obs = d.obs || "-";

  return (
`-Responsável: ${resp}
-Equipe: ${eq}
-Contato: ${tel}
-Viatura: ${viatura}
-Rádio: ${radio}
-Teste Rádio: ${testeRadio}
-Ref.Elétrica: ${referencia}
-Tipo Condutor: ${tipoCondutor}
-Área de maresia?: ${maresia}
-Self/Healing: ${self}
-Desativou Self/Healing? ${desativou}
-serviço: ${servico}
-OBS: ${obs}`
  );
}

function blvGerarRelatorio() {
  const dados = {
    responsavel: document.getElementById("blv_responsavel").value,
    equipe: document.getElementById("blv_equipe").value,
    contato: document.getElementById("blv_contato").value,
    viatura: document.getElementById("blv_viatura").value,
    radio: document.getElementById("blv_radio").value,
    testeRadio: document.getElementById("blv_teste_radio").value,
    referencia: document.getElementById("blv_referencia").value,
    tipoCondutor: document.getElementById("blv_tipo_condutor").value,
    maresia: document.getElementById("blv_maresia").value,
    selfhealing: document.getElementById("blv_selfhealing").value,
    desativou: document.getElementById("blv_desativou").value,
    servico: document.getElementById("blv_servico").value,
    obs: document.getElementById("blv_obs").value,
  };

  const texto = blvMontarTexto(dados);

  document.getElementById("blv_resultado").value = texto;

  navigator.clipboard.writeText(texto);

  if (typeof showToast === "function") {
    showToast("Relatório copiado");
  }
}

// Mesmo comportamento do original (js/bloqueios.js::limparRelatorio): só
// limpa input/textarea — os <select> (Rádio, Teste Rádio, etc.) não eram
// resetados no original, então não mudamos isso aqui (ver nota da
// auditoria: adaptação mínima, sem alterar regra de negócio sem necessidade).
function blvLimparRelatorio() {
  document.querySelectorAll("#bloqueios_lv input, #bloqueios_lv textarea")
    .forEach(e => { e.value = ""; });
}
