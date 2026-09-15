/* SCRIPT MAIS SINERGIA (sg-*) — segundo módulo reintegrado do sistema
   antigo (backup scriptdebloqueioslinhaviva-v2, js/sinergia.js). Cliente
   puro: lê campos do formulário, monta um texto padronizado, copia pra
   área de transferência — sem fetch, sem localStorage, sem dependência
   de banco/API (mesmo comportamento do original).

   Mantida a MESMA regra de negócio/formato de saída do original — só
   adaptações de integração com o sistema atual:
   - ids já vinham prefixados "sg_" no original (sem colisão, mantidos
     como estavam — só sg_resultado é novo em relação ao original, que já
     tinha esse mesmo nome);
   - funções renomeadas com o prefixo "sg" (gerarSinergia ->
     sgGerarRelatorio, limparSinergia -> sgLimparRelatorio) pra seguir a
     mesma convenção do módulo Bloqueio – Linha Viva (js/scripts-campo/
     bloqueios.js) e nunca colidir com nomes genéricos de outro módulo,
     mesmo escopo global de sempre (index.html carrega todo js/*.js como
     <script src> clássico);
   - toda leitura via document.getElementById explícito (o original já
     fazia isso dentro de gerarSinergia(), então a lógica em si não
     mudou);
   - showToast() é a mesma função já existente em js/core.js, reaproveitada
     sem nenhuma cópia;
   - montagem do texto extraída pra uma função PURA (sgMontarTexto),
     testável em Node sem DOM — mesmo padrão usado em blvMontarTexto;
     extração de função, não mudança de regra de negócio (o texto gerado
     é byte-a-byte o mesmo). */

// Pura: recebe um objeto simples com os valores já lidos do formulário
// (nunca elementos do DOM) e devolve o texto final — testável em Node
// puro (ver js/scripts-campo/sinergia.test.js). Mesmo template/rótulos
// do original (js/sinergia.js::gerarSinergia), nenhuma linha alterada.
function sgMontarTexto(dados) {
  const d = dados || {};
  const rd = d.rd ? `RD ${d.rd}` : "RD -";
  const bateria = d.bateria ? d.bateria + "V" : "-";

  return (
`${rd}
TP/BT: ${d.tpbt || "-"}
Ramal/Conexões: ${d.ramal || "-"}
DPS: ${d.dps || "-"}
Tensão CA no disjuntor: ${d.tensaoCa || "-"}
Disjuntor armado: ${d.disj || "-"}
Alarme bateria antes da perda: ${d.alarme || "-"}
Tensão bateria: ${bateria}
Painel religador: ${d.painel || "-"}
Modem/Rádio: ${d.modem || "-"}
Antena: ${d.antena || "-"}
Sinais de curto: ${d.curto || "-"}
Tanque: ${d.tanque || "-"}
Cubículo: ${d.cubiculo || "-"}
Cordão umbilical: ${d.cordao || "-"}`
  );
}

function sgGerarRelatorio() {
  const dados = {
    rd: document.getElementById("sg_rd").value,
    tpbt: document.getElementById("sg_tpbt").value,
    ramal: document.getElementById("sg_ramal").value,
    dps: document.getElementById("sg_dps").value,
    tensaoCa: document.getElementById("sg_tensao_ca").value,
    disj: document.getElementById("sg_disj").value,
    alarme: document.getElementById("sg_alarme").value,
    bateria: document.getElementById("sg_bateria").value,
    painel: document.getElementById("sg_painel").value,
    modem: document.getElementById("sg_modem").value,
    antena: document.getElementById("sg_antena").value,
    curto: document.getElementById("sg_curto").value,
    tanque: document.getElementById("sg_tanque").value,
    cubiculo: document.getElementById("sg_cubiculo").value,
    cordao: document.getElementById("sg_cordao").value,
  };

  const texto = sgMontarTexto(dados);

  document.getElementById("sg_resultado").value = texto;

  navigator.clipboard.writeText(texto);

  if (typeof showToast === "function") {
    showToast("Script Mais Sinergia copiado ⚙️");
  }
}

// Mesmo comportamento do original (js/sinergia.js::limparSinergia): limpa
// input/textarea E reseta os <select> pro primeiro option (diferente do
// Bloqueio – Linha Viva, cujo original não resetava selects — cada
// módulo preserva a regra do seu próprio original, sem uniformizar).
function sgLimparRelatorio() {
  document.querySelectorAll("#sinergia input, #sinergia textarea")
    .forEach(el => { el.value = ""; });

  document.querySelectorAll("#sinergia select")
    .forEach(el => { el.selectedIndex = 0; });

  document.getElementById("sg_resultado").value = "";
}
