/* SUBSTITUIÇÃO DE TRANSFORMADOR (tf-*) — sexto e último módulo
   reintegrado do sistema antigo (backup scriptdebloqueioslinhaviva-v2,
   js/trafo.js). Cliente puro: lê campos do formulário, valida os
   obrigatórios (incluindo os CONDICIONAIS por motivo — ver seção
   dedicada abaixo), monta um texto padronizado (DUAS variantes — ver
   abaixo), copia pra área de transferência — sem fetch, sem
   localStorage, sem dependência de banco/API (módulo 100% client-side,
   mesmo comportamento do original; não precisou de nenhuma mudança de
   banco/migration).

   ===== A REGRA MAIS IMPORTANTE DO MÓDULO: OBRIGATÓRIOS CONDICIONAIS
   POR MOTIVO (achado da auditoria, verificado linha a linha) =====
   O select "Motivo" (tf_motivo) tem 5 opções reais: "Falta de fase",
   "Sobrecarga", "Furto", "Trafo queimado", "Vazamento de óleo". Trocar
   o motivo dispara aplicarRegrasTrafo() no original, que:
   1) limpa TODOS os atributos "required" dinâmicos dentro de #trafo;
   2) reaplica "required" em campos ESPECÍFICOS, dependendo do motivo:
      - "Sobrecarga" OU "Falta de fase" -> exige tf_carregamento;
      - "Vazamento de óleo" -> exige tf_glv E tf_glv_extraido;
      - "Furto" -> exige tf_clientes_des;
      - "Trafo queimado" (e vazio/Selecione) -> NENHUM extra.
   Esses campos dinamicamente obrigatórios são validados por
   validarTrafo() JUNTO com os 6 obrigatórios fixos (TF_OBRIGATORIOS_BASE:
   operador, ocorrência, nº trafo, ID, motivo, causa) — se qualquer um
   estiver vazio, a geração é BLOQUEADA (nenhum dos dois formatos gera
   texto), com borda vermelha no primeiro campo faltando, foco nele, e
   toast "Preencha: <rótulo>". Reimplementado 1:1 aqui (tfObrigar/
   tfLimparObrigatoriosDinamicos/tfAplicarRegrasMotivo), inclusive
   mutando o atributo HTML "required" de verdade (não só uma checagem
   interna) — isso preserva também o efeito colateral visual do
   seletor CSS global `select:invalid` (já existente em styles.css)
   nesses campos condicionais.

   ===== DUAS SAÍDAS DISTINTAS (regra de negócio original, preservada) =====
   "Gerar WhatsApp" (gerarTrafoWhatsApp) e "Gerar SS" (gerarTrafoSGD) no
   original — AMBAS chamam a MESMA função geradora (montarTextoTrafo,
   aqui tfMontarTexto), com um parâmetro de formato, ao contrário de
   Bloqueio/Sinergia/Desarme/SS/Poste, que tinham funções de montagem
   separadas. Preservado como uma função só, parametrizada, igual ao
   original — não foi "desdobrada" em duas.
   - WhatsApp: cabeçalho, emojis, seções com títulos em negrito,
     linhas em branco entre seções.
   - SS: uma lista de linhas "- Rótulo: valor", TODAS com o mesmo
     prefixo "- ", SEM linhas em branco entre seções, e com RÓTULOS
     diferentes em vários campos (ex.: "Nº Trafo" vira "N° Transformador",
     "Cidade/Povoado" vira "Cidade", "Tensão Sec" vira "Tensão",
     "Corrosão Atmosférica" vira "Corrosão", "Total" (clientes) vira
     "Clientes Totais"). Nenhum rótulo foi unificado entre os formatos.
   Nenhum campo usa fallback "-" quando vazio (mesma função universal
   v(id) do Substituição de Poste, que devolve "" — não "-" — para
   campo sem valor). Mantido assim aqui também.

   ===== "BUG" ENCONTRADO, ANALISADO E NÃO CORRIGIDO (não perde dado,
   nunca é observável) =====
   No original, a montagem da variante SS usa
   `.map(l => l.trim() ? "- " + l : "")` — uma checagem de "linha vazia"
   que, na prática, NUNCA é falsa: toda linha é montada como
   `` `Rótulo: ${valor}` ``, e o rótulo (string fixa, nunca vazia) já
   garante que `l.trim()` seja sempre verdadeiro, mesmo com valor vazio
   (ex.: "Operador: ".trim() === "Operador:", que é truthy). Ou seja, é
   um branch morto — sempre cai no "- " + l, nunca no "". Reproduzido
   aqui exatamente do mesmo jeito (nenhuma linha unificada/simplificada),
   já que não há NENHUM cenário de entrada que produza um resultado
   diferente entre as duas versões — não atende ao critério de "bug
   real" (não há reprodução possível de comportamento observável
   diferente), então não foi alterado.

   ===== ADAPTAÇÕES DE ARQUITETURA (sem mudança de regra de negócio) =====
   - o original usava uma função universal `v(id)` compartilhada entre
     ESTE módulo e o de Substituição de Poste (já reintegrado
     separadamente, com sua própria leitura direta) —
     `document.querySelector("#trafo #"+id) || document.querySelector(
     "#substituicao_poste #"+id) || document.getElementById(id)`.
     Trocada por leitura direta via document.getElementById(id).value
     dentro de tfLerCampos(), sem a lógica de fallback entre módulos —
     mesmo valor final, sem criar dependência entre os dois geradores
     (pedido explícito desta e da etapa anterior);
   - `v`/`obrigar` (nomes genéricos de 1 palavra no escopo global do
     original) renomeadas com o prefixo "tf" (tfObrigar) — nada de
     variável/função global genérica;
   - funções renomeadas com o prefixo "tf" (gerarTrafoWhatsApp ->
     tfGerarRelatorioWhats, gerarTrafoSGD -> tfGerarRelatorioSS,
     limparTrafo -> tfLimparRelatorio, validarTrafo ->
     tfValidarObrigatorios, aplicarRegrasTrafo -> tfAplicarRegrasMotivo,
     montarTextoTrafo -> tfMontarTexto, copiarTexto -> tfCopiarTexto,
     limparObrigatoriosTrafo -> tfLimparObrigatoriosDinamicos);
   - módulo renomeado de "trafo" (apelido informal, fora de contexto)
     para "substituicao_transformador" (mesmo critério já usado em
     bloqueios_lv/preenchimento_ss) — todo seletor `#trafo ...` do
     original virou `#substituicao_transformador ...` aqui;
   - o listener de `DOMContentLoaded` do original foi removido: aqui o
     <script> é carregado no fim do <body>, depois de todo o HTML dos
     módulos já estar no DOM (mesmo padrão já usado nos 5 módulos
     anteriores) — os elementos já existem no momento em que este
     arquivo roda;
   - `limparTrafo()` original terminava com
     `if (typeof wizardIrPara === "function") wizardIrPara("tf", 1);`
     — mesmo no-op guardado já removido em Substituição de Poste (este
     backup não tem nenhum HTML com `data-wizard`, e step-wizard.js
     está fora do escopo de reintegração). Omitido aqui pelo mesmo
     motivo;
   - a montagem do texto foi extraída pra uma função PURA
     (tfMontarTexto(dados, formato)), a lista de obrigatórios
     condicionais pra uma função pura (tfObrigatoriosCondicionais), e a
     checagem dos 6 obrigatórios fixos pra outra função pura
     (tfCamposObrigatoriosFaltando) — todas testáveis em Node sem DOM,
     mesmo padrão dos 5 módulos anteriores. A parte que muta o DOM
     (borda/foco/toast/atributo required) ficou em tfValidarObrigatorios/
     tfAplicarRegrasMotivo, só verificável manualmente no navegador. */

// Pura: recebe um objeto simples com os 30 valores já lidos do
// formulário (nunca elementos do DOM) e o formato desejado ("whats" ou
// "ss"), devolve o texto final — testável em Node puro (ver
// js/scripts-campo/substituicao-transformador.test.js). Mesmo
// template/rótulos/ordem do original (js/trafo.js::montarTextoTrafo),
// nenhuma linha alterada.
function tfMontarTexto(dados, formato) {
  const d = dados || {};
  const g = (valor) => (valor || "").toString().trim();

  const operador = g(d.operador);
  const ocorrencia = g(d.ocorrencia);
  const trafo = g(d.trafo);
  const id = g(d.id);
  const motivo = g(d.motivo);
  const causa = g(d.causa);
  const regional = g(d.regional);
  const cidade = g(d.cidade);
  const endereco = g(d.endereco);
  const referencia = g(d.referencia);
  const coord = g(d.coord);
  const acesso = g(d.acesso);
  const classe = g(d.classe);
  const potencia = g(d.potencia);
  const proprietario = g(d.proprietario);
  const tensaoSec = g(d.tensaoSec);
  const carregamento = g(d.carregamento);
  const totalClientes = g(d.totalClientes);
  const corrosao = g(d.corrosao);
  const clientesDes = g(d.clientesDes);
  const totalDes = g(d.totalDes);
  const transferido = g(d.transferido);
  const bitolaMt = g(d.bitolaMt);
  const glv = g(d.glv);
  const glvExtraido = g(d.glvExtraido);
  const aterramento = g(d.aterramento);
  const prBt = g(d.prBt);
  const prMt = g(d.prMt);
  const materiais = g(d.materiais);
  const obs = g(d.obs);

  if (formato === "ss") {
    const linhas = [
      `Operador: ${operador}`,
      `N° Incidente: ${ocorrencia}`,
      `N° Transformador: ${trafo}`,
      `ID: ${id}`,
      `Motivo: ${motivo}`,
      `Causa: ${causa}`,
      `Regional: ${regional}`,
      `Cidade: ${cidade}`,
      `Endereço: ${endereco}`,
      `Referência: ${referencia}`,
      `Coordenadas: ${coord}`,
      `Acesso: ${acesso}`,
      `Classe: ${classe}`,
      `Potência: ${potencia}`,
      `Proprietário: ${proprietario}`,
      `Tensão: ${tensaoSec}`,
      `Carregamento: ${carregamento}`,
      `Corrosão: ${corrosao}`,
      `Aterramento: ${aterramento}`,
      `PRBT: ${prBt}`,
      `PRMT: ${prMt}`,
      `Clientes Totais: ${totalClientes}`,
      `Desenergizados: ${clientesDes}`,
      `Total Desenergizados: ${totalDes}`,
      `Circuito Transferido: ${transferido}`,
      `Bitola MT: ${bitolaMt}`,
      `GLV: ${glv}`,
      `GLV Extraído: ${glvExtraido}`,
      `Materiais: ${materiais}`,
      `Observações: ${obs}`,
    ];

    return linhas
      .map((l) => (l.trim() ? "- " + l : ""))
      .join("\n");
  }

  // formato "whats" (default — única outra opção do original)
  return `⚡ Substituição de Transformador

👨‍💻 *Operador:* ${operador}
*N° Incidente:* ${ocorrencia}
*Nº Trafo:* ${trafo}
*ID:* ${id}

⚠️ *Motivo:* ${motivo}
📌 *Causa:* ${causa}

📍 *Localização*
- Regional: ${regional}
- Cidade/Povoado: ${cidade}
- Endereço: ${endereco}
- Referência: ${referencia}
- Coordenadas: ${coord}
- Acesso Caminhão: ${acesso}

🔧 *Dados do Transformador*
- Classe: ${classe}
- Potência: ${potencia}
- Proprietário: ${proprietario}
- Tensão Sec: ${tensaoSec}
- Carregamento: ${carregamento}
- Corrosão Atmosférica: ${corrosao}
- Aterramento: ${aterramento}
- PRBT: ${prBt}
- PRMT: ${prMt}

👥 *Clientes*
- Total: ${totalClientes}
- Desenergizados: ${clientesDes}
- Total Desenergizados: ${totalDes}
- Circuito Transferido: ${transferido}

🛢️ *Rede*
- Bitola MT: ${bitolaMt}
- GLV: ${glv}
- GLV Extraído: ${glvExtraido}

📦 Materiais:
${materiais}

📝 Observações:
${obs}`;
}

// Pura: recebe o valor atual de Motivo e devolve a lista de ids que
// devem ficar obrigatórios — a regra condicional mais importante deste
// módulo (ver nota no topo do arquivo). Mesma lógica de
// aplicarRegrasTrafo() original, sem tocar em DOM.
function tfObrigatoriosCondicionais(motivo) {
  const m = (motivo || "").toString().trim();

  if (m === "Sobrecarga" || m === "Falta de fase") return ["tf_carregamento"];
  if (m === "Vazamento de óleo") return ["tf_glv", "tf_glv_extraido"];
  if (m === "Furto") return ["tf_clientes_des"];

  return [];
}

// Mesmos 6 campos do TF_OBRIGATORIOS_BASE original.
const TF_OBRIGATORIOS_BASE = [
  { chave: "operador", id: "tf_operador" },
  { chave: "ocorrencia", id: "tf_ocorrencia" },
  { chave: "trafo", id: "tf_trafo" },
  { chave: "id", id: "tf_id" },
  { chave: "motivo", id: "tf_motivo" },
  { chave: "causa", id: "tf_causa" },
];

// Pura: recebe {operador, ocorrencia, trafo, id, motivo, causa} (só os
// 6 valores obrigatórios fixos, já lidos) e devolve as chaves que estão
// faltando — mesma checagem de truthiness do original (`if(!c.value)`).
// Não cobre os obrigatórios CONDICIONAIS (ver tfObrigatoriosCondicionais)
// nem toca em borda/foco/toast (isso é tfValidarObrigatorios, abaixo).
function tfCamposObrigatoriosFaltando(valores) {
  const v = valores || {};
  return TF_OBRIGATORIOS_BASE
    .map((c) => c.chave)
    .filter((chave) => !v[chave]);
}

function tfLimparObrigatoriosDinamicos() {
  document.querySelectorAll("#substituicao_transformador [required]")
    .forEach((c) => c.removeAttribute("required"));
}

function tfObrigar(lista) {
  lista.forEach((id) => {
    const campo = document.getElementById(id);
    if (campo) campo.setAttribute("required", "true");
  });
}

// Mesmo comportamento do original (aplicarRegrasTrafo): limpa os
// obrigatórios dinâmicos e reaplica de acordo com o motivo atual.
function tfAplicarRegrasMotivo() {
  tfLimparObrigatoriosDinamicos();
  const motivo = document.getElementById("tf_motivo").value;
  tfObrigar(tfObrigatoriosCondicionais(motivo));
}

function tfValidarObrigatorios() {
  let primeiroFaltando = null;

  TF_OBRIGATORIOS_BASE.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (!el) return;

    if (!el.value) {
      el.style.border = "2px solid red";
      if (!primeiroFaltando) primeiroFaltando = el;
    } else {
      el.style.border = "";
    }
  });

  document.querySelectorAll("#substituicao_transformador [required]").forEach((el) => {
    if (!el.value) {
      el.style.border = "2px solid red";
      if (!primeiroFaltando) primeiroFaltando = el;
    } else {
      el.style.border = "";
    }
  });

  if (primeiroFaltando) {
    const rotulo = primeiroFaltando.closest("div")?.querySelector("label")?.textContent.replace(":", "").trim() || "campo obrigatório";
    primeiroFaltando.focus();
    if (typeof showToast === "function") {
      showToast(`Preencha: ${rotulo}`);
    }
    return false;
  }

  return true;
}

function tfLerCampos() {
  return {
    operador: document.getElementById("tf_operador").value,
    ocorrencia: document.getElementById("tf_ocorrencia").value,
    trafo: document.getElementById("tf_trafo").value,
    id: document.getElementById("tf_id").value,
    motivo: document.getElementById("tf_motivo").value,
    causa: document.getElementById("tf_causa").value,
    regional: document.getElementById("tf_regional").value,
    cidade: document.getElementById("tf_cidade").value,
    endereco: document.getElementById("tf_endereco").value,
    referencia: document.getElementById("tf_referencia").value,
    coord: document.getElementById("tf_coord").value,
    acesso: document.getElementById("tf_acesso").value,
    classe: document.getElementById("tf_classe").value,
    potencia: document.getElementById("tf_potencia").value,
    proprietario: document.getElementById("tf_proprietario").value,
    tensaoSec: document.getElementById("tf_tensao_sec").value,
    carregamento: document.getElementById("tf_carregamento").value,
    totalClientes: document.getElementById("tf_total_clientes").value,
    corrosao: document.getElementById("tf_corrosao").value,
    clientesDes: document.getElementById("tf_clientes_des").value,
    totalDes: document.getElementById("tf_total_des").value,
    transferido: document.getElementById("tf_transferido").value,
    bitolaMt: document.getElementById("tf_bitola_mt").value,
    glv: document.getElementById("tf_glv").value,
    glvExtraido: document.getElementById("tf_glv_extraido").value,
    aterramento: document.getElementById("tf_aterramento").value,
    prBt: document.getElementById("tf_pr_bt").value,
    prMt: document.getElementById("tf_pr_mt").value,
    materiais: document.getElementById("tf_materiais").value,
    obs: document.getElementById("tf_obs").value,
  };
}

function tfCopiarTexto(texto) {
  navigator.clipboard.writeText(texto).catch(() => {
    if (typeof showToast === "function") {
      showToast("Erro ao copiar");
    }
  });
}

function tfGerarRelatorioWhats() {
  if (!tfValidarObrigatorios()) return;

  const texto = tfMontarTexto(tfLerCampos(), "whats");

  tfCopiarTexto(texto);
  document.getElementById("tf_resultado").value = texto;

  if (typeof showToast === "function") {
    showToast("WhatsApp gerado e copiado!");
  }
}

function tfGerarRelatorioSS() {
  if (!tfValidarObrigatorios()) return;

  const texto = tfMontarTexto(tfLerCampos(), "ss");

  tfCopiarTexto(texto);
  document.getElementById("tf_resultado").value = texto;

  if (typeof showToast === "function") {
    showToast("SS gerado e copiado!");
  }
}

// Mesmo comportamento do original (limparTrafo, sem a chamada morta a
// wizardIrPara — ver nota no topo do arquivo): reseta inputs/textareas
// pra vazio, selects pro primeiro option, limpa toda borda vermelha, e
// remove os obrigatórios dinâmicos.
function tfLimparRelatorio() {
  document.querySelectorAll(
    "#substituicao_transformador input, #substituicao_transformador select, #substituicao_transformador textarea"
  ).forEach((c) => {
    if (c.tagName === "SELECT") {
      c.selectedIndex = 0;
    } else {
      c.value = "";
    }
    c.style.border = "";
  });

  document.getElementById("tf_resultado").value = "";

  tfLimparObrigatoriosDinamicos();
}

(function tfInicializarRegras() {
  const motivo = document.getElementById("tf_motivo");
  if (motivo) {
    motivo.addEventListener("change", tfAplicarRegrasMotivo);
  }
})();
