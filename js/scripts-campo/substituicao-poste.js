/* SUBSTITUIÇÃO DE POSTE (sp-*) — quinto módulo reintegrado do sistema
   antigo (backup scriptdebloqueioslinhaviva-v2, js/substituicao_poste.js).
   Cliente puro: lê campos do formulário, valida os obrigatórios, monta
   um texto padronizado (DUAS variantes — ver abaixo), copia pra área de
   transferência — sem fetch, sem localStorage, sem dependência de
   banco/API (módulo 100% client-side, mesmo comportamento do original;
   não precisou de nenhuma mudança de banco/migration).

   ===== DUAS SAÍDAS DISTINTAS (regra de negócio original, preservada) =====
   Igual ao Preenchimento de SS, o formulário tem DOIS botões de gerar —
   "Gerar texto WhatsApp" (gerarPosteWhats no original) e "Gerar texto SS"
   (gerarPosteSS no original) — que leem os MESMOS 35 campos mas
   produzem textos DIFERENTES:
   - a formatação (emojis/cabeçalho no Whats vs. "#..." + "- " no SS);
   - os RÓTULOS de vários campos (ex.: "ID Poste" vs "ID", "Chave Ref"
     vs "Chave", "Polícia/SAMU" vs "Polícia", "Doc condutor" vs
     "Documento Condutor", "End/Telefone" vs "Endereço/Telefone", "Foto
     danos" vs "Foto Danos", "Medidor UC" vs "Medidor");
   - e — a diferença mais fácil de simplificar por engano —
     a ORDEM dos campos: no Whats, "Acesso Caminhão" e "Cordoalha
     Telemar" aparecem DEPOIS de "Tipo/Altura/Esforço" e "Chave Ref";
     no SS, os MESMOS dois campos aparecem ANTES de "Regional". Essa
     ordem foi conferida linha a linha contra o original e replicada
     exatamente — não foi unificada.
   Nenhum campo usa fallback "-" quando vazio (diferente de bloqueios/
   sinergia/desarme/ss): o original usa a função universal v(id), que
   devolve string vazia "" para campo sem valor (`(el.value||"").trim()`),
   nunca "-". Mantido assim aqui também.

   ===== CAMPOS OBRIGATÓRIOS (validação real, bloqueia a geração) =====
   SP_OBRIGATORIOS = Operador, Nº Ocorrência, Tipo de Poste, ID do
   Poste, Tipo/Altura/Esforço — mesmos 5 campos do SP_OBRIGATORIOS_BASE
   original. Se algum estiver vazio: borda vermelha, foco no primeiro
   faltando, toast "Preencha: <rótulo>", e a geração é CANCELADA (nem
   Whats nem SS geram texto se a validação falhar) — comportamento
   idêntico ao original (`if(!validarPoste()) return;` em ambos os
   geradores).

   ===== REGRAS CONDICIONAIS REAIS (não simplificadas) =====
   1) Tipo de Poste (sp_tipo_poste: "POSTE MT" / "POSTE BT" / "POSTE
      BT/MT" / vazio) controla DUAS coisas em paralelo:
      a) visual: os campos de Rede MT ficam esmaecidos (opacity 0.5,
         pointer-events none) quando tipo === "POSTE BT", e os de Rede
         BT ficam esmaecidos quando tipo === "POSTE MT"; em qualquer
         outro caso (incluindo "POSTE BT/MT" e vazio/Selecione) AMBOS
         ficam com opacidade plena — os campos NUNCA são limpos por
         essa regra, só esmaecidos/reabilitados visualmente;
      b) texto gerado: a seção "Rede MT" só aparece se tipo !== "POSTE
         BT"; a seção "Rede BT" só aparece se tipo !== "POSTE MT". Por
         causa dessa comparação por desigualdade (não por igualdade),
         "POSTE BT/MT" e o valor vazio mostram AMBAS as seções — não é
         acidente, é assim que o original decide.
   2) Causado por veículo? (sp_veiculo === "SIM") controla um bloco de
      11 campos relacionados ao acidente (polícia, vítima, fotos,
      documento, endereço, câmeras, medidor, veículo, empresa,
      observação do condutor): esmaecidos/desabilitados visualmente
      quando a resposta não é "SIM", e a seção inteira só aparece no
      texto gerado quando causado === "SIM" — em ambos os formatos.
   3) "Chave Ref"/"Chave" e "Empresa" SEMPRE concatenam dois campos com
      um espaço (`${chaveRef} ${numChave}` e `${empresa} ${qual}`),
      SEM nenhuma condição de "só se ambos preenchidos" — diferente da
      regra de REF. ELÉTRICA do Preenchimento de SS. Confirmado lendo o
      original linha a linha; não presumido.

   ===== ADAPTAÇÕES DE ARQUITETURA (sem mudança de regra de negócio) =====
   - o original usava uma função universal `v(id)` compartilhada entre
     ESTE módulo e o de Substituição de Transformador (que ainda não
     foi reintegrado) — `document.querySelector("#trafo #"+id) ||
     document.querySelector("#substituicao_poste #"+id) ||
     document.getElementById(id)`. Como só este módulo está sendo
     reintegrado agora, e o pedido explícito é não criar dependência
     entre geradores, `v(id)` foi trocada por leitura direta via
     `document.getElementById(id).value` dentro de spLerCampos() —
     mesmo valor final, sem a lógica de fallback entre módulos que não
     existem ainda;
   - `v`/`toggle` (nomes genéricos de 1 palavra no escopo global do
     original) foram renomeadas com o prefixo "sp" (spToggle) —
     pedido explícito desta etapa: nada de variável/função global
     genérica;
   - funções renomeadas com o prefixo "sp" (gerarPosteWhats ->
     spGerarRelatorioWhats, gerarPosteSS -> spGerarRelatorioSS,
     limparPoste -> spLimparRelatorio, validarPoste ->
     spValidarObrigatorios, aplicarRegraPoste -> spAplicarRegraTipoPoste,
     aplicarRegraVeiculo -> spAplicarRegraVeiculo);
   - o listener de `DOMContentLoaded` do original foi removido: aqui o
     <script> é carregado no fim do <body>, depois de todo o HTML dos
     módulos já estar no DOM (mesmo padrão já usado na IIFE de
     ordenação de subestações do Desarme) — os elementos já existem no
     momento em que este arquivo roda, então o listener extra virou
     desnecessário;
   - `limparPoste()` original terminava com
     `if (typeof wizardIrPara === "function") wizardIrPara("sp", 1);`
     — um no-op guardado, já que este backup não tem nenhum HTML com
     `data-wizard` e `step-wizard.js` está fora da lista de módulos a
     reintegrar (ver auditoria). Esse call foi OMITIDO aqui: preservar
     uma chamada condicional para uma função que nunca vai existir não
     é "regra de negócio", é dependência morta do sistema antigo — e o
     pedido explícito desta etapa foi não reintroduzir o wizard;
   - a montagem do texto foi extraída pra uma função PURA
     (spMontarTexto(dados, formato)), testável em Node sem DOM — mesmo
     padrão de bloqueios.js/sinergia.js/desarme.js/preenchimento-ss.js.
     A checagem de "quais obrigatórios estão faltando" também foi
     extraída pra uma função pura (spCamposObrigatoriosFaltando) —
     a parte de borda/foco/toast (que depende de DOM real) ficou em
     spValidarObrigatorios(), só testável manualmente no navegador.

   ===== DUAS PECULIARIDADES DO ORIGINAL — OBSERVADAS E PRESERVADAS,
   NÃO "CORRIGIDAS" (nenhuma perde dado nem quebra o gerador; ver
   critério do Desarme/ds_obs para o que conta como bug real) =====
   1) gerarPosteWhats() e gerarPosteSS() NUNCA chamam showToast() em
      caso de sucesso (diferente de bloqueios/sinergia/desarme/ss, que
      sempre mostram um toast de confirmação) — só o CAMINHO DE FALHA
      da validação mostra toast ("Preencha: ..."). Não é bug (nenhum
      dado é perdido, o texto é gerado e copiado normalmente) — só uma
      inconsistência de UX do sistema antigo. Preservado como estava,
      por instrução explícita de não inventar regra nova.
   2) limparPoste()/spLimparRelatorio() reseta os VALORES dos campos
      (inputs/textareas/selects) mas NÃO reaplica a regra visual de
      esmaecimento (spAplicarRegraTipoPoste/spAplicarRegraVeiculo) —
      então, se um campo estava esmaecido antes do Limpar (ex.: você
      tinha selecionado "POSTE BT", esmaecendo os campos de Rede MT),
      ele continua esmaecido visualmente até você mudar o select de
      novo, mesmo com o valor já limpo. Comportamento idêntico ao
      original (limparPoste também não reaplica as regras) — mantido. */

// Pura: recebe um objeto simples com os 35 valores já lidos do
// formulário (nunca elementos do DOM) e o formato desejado ("whats" ou
// "ss"), devolve o texto final — testável em Node puro (ver
// js/scripts-campo/substituicao-poste.test.js). Mesmo template/rótulos/
// ordem do original (js/substituicao_poste.js::gerarPosteWhats /
// gerarPosteSS), nenhuma linha alterada.
function spMontarTexto(dados, formato) {
  const d = dados || {};
  const g = (valor) => (valor || "").toString().trim();

  const operador = g(d.operador);
  const ocorrencia = g(d.ocorrencia);
  const idPoste = g(d.idPoste);
  const tipo = g(d.tipoPoste);
  const causa = g(d.causa);
  const regional = g(d.regional);
  const bairro = g(d.bairro);
  const referencia = g(d.referencia);
  const coord = g(d.coord);
  const altura = g(d.altura);
  const chaveRef = g(d.chaveRef);
  const numChave = g(d.numChave);
  const acesso = g(d.acesso);
  const cordoalha = g(d.cordoalha);
  const estMt = g(d.estMt);
  const redeMt = g(d.redeMt);
  const bitolaMt = g(d.bitolaMt);
  const estBt = g(d.estBt);
  const redeBt = g(d.redeBt);
  const bitolaBt = g(d.bitolaBt);
  const causado = g(d.veiculo);
  const policia = g(d.policia);
  const vitima = g(d.vitima);
  const fotoPlaca = g(d.fotoPlaca);
  const doc = g(d.doc);
  const end = g(d.end);
  const danos = g(d.danos);
  const camera = g(d.camera);
  const medidor = g(d.medidor);
  const veiculoDesc = g(d.veiculoDesc);
  const empresa = g(d.empresa);
  const qual = g(d.qual);
  const obsCondutor = g(d.obsCondutor);
  const materiais = g(d.materiais);
  const obsGerais = g(d.obsGerais);

  const mostrarMt = tipo !== "POSTE BT";
  const mostrarBt = tipo !== "POSTE MT";
  const mostrarAcidente = causado === "SIM";

  if (formato === "ss") {
    let texto = "#SUBSTITUIÇÃO DE POSTE\n\n";
    texto += `- Operador: ${operador}\n`;
    texto += `- Ocorrência: ${ocorrencia}\n`;
    texto += `- ID: ${idPoste}\n`;
    texto += `- Tipo: ${tipo}\n`;
    texto += `- Causa: ${causa}\n`;
    texto += `- Acesso: ${acesso}\n`;
    texto += `- Cordoalha Telemar: ${cordoalha}\n`;
    texto += `- Regional: ${regional}\n`;
    texto += `- Cidade/Bairro/Povoado: ${bairro}\n`;
    texto += `- Ponto Referência: ${referencia}\n`;
    texto += `- Coordenadas: ${coord}\n`;
    texto += `- Tipo/Altura/Esforço: ${altura}\n`;
    texto += `- Chave: ${chaveRef} ${numChave}\n`;

    if (mostrarMt) {
      texto += `- Estrutura MT: ${estMt}\n`;
      texto += `- Rede MT: ${redeMt}\n`;
      texto += `- Bitola MT: ${bitolaMt}\n`;
    }
    if (mostrarBt) {
      texto += `- Estrutura BT: ${estBt}\n`;
      texto += `- Rede BT: ${redeBt}\n`;
      texto += `- Bitola BT: ${bitolaBt}\n`;
    }

    texto += `- Causado por Veículo: ${causado}\n`;

    if (mostrarAcidente) {
      texto += `- Polícia: ${policia}\n`;
      texto += `- Vítima: ${vitima}\n`;
      texto += `- Foto Placa: ${fotoPlaca}\n`;
      texto += `- Documento Condutor: ${doc}\n`;
      texto += `- Endereço/Telefone: ${end}\n`;
      texto += `- Foto Danos: ${danos}\n`;
      texto += `- Câmeras: ${camera}\n`;
      texto += `- Medidor: ${medidor}\n`;
      texto += `- Veículo: ${veiculoDesc}\n`;
      texto += `- Empresa: ${empresa} ${qual}\n`;
      texto += `- Obs Condutor: ${obsCondutor}\n`;
    }

    texto += `- Materiais: ${materiais}\n`;
    texto += `- Observações: ${obsGerais}`;

    return texto;
  }

  // formato "whats" (default — única outra opção do original)
  let texto = `🛠️ *SUBSTITUIÇÃO DE POSTE*\n\n`;
  texto += `👤 Operador: ${operador}\n`;
  texto += `📄 Ocorrência: ${ocorrencia}\n`;
  texto += `🏷️ ID Poste: ${idPoste}\n`;
  texto += `⚡ Tipo: ${tipo}\n`;
  texto += `Causa: ${causa}\n\n`;

  texto += `📍 Regional: ${regional}\n`;
  texto += `Cidade/Bairro/Povoado: ${bairro}\n`;
  texto += `📌 Ponto Referência: ${referencia}\n`;
  texto += `🧭 Coordenadas: ${coord}\n\n`;

  texto += `Tipo/Altura/Esforço: ${altura}\n`;
  texto += `Chave Ref: ${chaveRef} ${numChave}\n`;
  texto += `🚛 Acesso Caminhão: ${acesso}\n`;
  texto += `Cordoalha Telemar: ${cordoalha}\n\n`;

  if (mostrarMt) {
    texto += `--- REDE MT ---\n`;
    texto += `Estrutura MT: ${estMt}\n`;
    texto += `Rede MT: ${redeMt}\n`;
    texto += `Bitola MT: ${bitolaMt}\n\n`;
  }
  if (mostrarBt) {
    texto += `--- REDE BT ---\n`;
    texto += `Estrutura BT: ${estBt}\n`;
    texto += `Rede BT: ${redeBt}\n`;
    texto += `Bitola BT: ${bitolaBt}\n\n`;
  }

  texto += `🚗 Causado por veículo: ${causado}\n`;

  if (mostrarAcidente) {
    texto += `Polícia/SAMU: ${policia}\n`;
    texto += `Vítima: ${vitima}\n`;
    texto += `Foto placa: ${fotoPlaca}\n`;
    texto += `Doc condutor: ${doc}\n`;
    texto += `End/Telefone: ${end}\n`;
    texto += `Foto danos: ${danos}\n`;
    texto += `Câmeras: ${camera}\n`;
    texto += `Medidor UC: ${medidor}\n`;
    texto += `Veículo: ${veiculoDesc}\n`;
    texto += `Empresa: ${empresa} ${qual}\n`;
    texto += `Obs Condutor: ${obsCondutor}\n\n`;
  }

  texto += `🧰 Materiais: ${materiais}\n`;
  texto += `📝 Observações: ${obsGerais}`;

  return texto;
}

// Mesmos 5 campos do SP_OBRIGATORIOS_BASE original.
const SP_OBRIGATORIOS = [
  { chave: "operador", id: "sp_operador" },
  { chave: "ocorrencia", id: "sp_ocorrencia" },
  { chave: "tipoPoste", id: "sp_tipo_poste" },
  { chave: "idPoste", id: "sp_id_poste" },
  { chave: "altura", id: "sp_altura" },
];

// Pura: recebe {operador, ocorrencia, tipoPoste, idPoste, altura} (só os
// 5 valores obrigatórios, já lidos) e devolve as chaves que estão
// faltando — mesma checagem de truthiness do original (`if(!c.value)`),
// sem tocar em borda/foco/toast (isso é spValidarObrigatorios, abaixo).
function spCamposObrigatoriosFaltando(valores) {
  const v = valores || {};
  return SP_OBRIGATORIOS
    .map((c) => c.chave)
    .filter((chave) => !v[chave]);
}

function spValidarObrigatorios() {
  let primeiroFaltando = null;

  SP_OBRIGATORIOS.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (!el) return;

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

function spLerCampos() {
  return {
    operador: document.getElementById("sp_operador").value,
    ocorrencia: document.getElementById("sp_ocorrencia").value,
    idPoste: document.getElementById("sp_id_poste").value,
    tipoPoste: document.getElementById("sp_tipo_poste").value,
    causa: document.getElementById("sp_causa").value,
    regional: document.getElementById("sp_regional").value,
    bairro: document.getElementById("sp_bairro").value,
    referencia: document.getElementById("sp_referencia").value,
    coord: document.getElementById("sp_coord").value,
    altura: document.getElementById("sp_altura").value,
    chaveRef: document.getElementById("sp_chave_ref").value,
    numChave: document.getElementById("sp_num_chave").value,
    acesso: document.getElementById("sp_acesso").value,
    cordoalha: document.getElementById("sp_cordoalha").value,
    estMt: document.getElementById("sp_est_mt").value,
    redeMt: document.getElementById("sp_rede_mt").value,
    bitolaMt: document.getElementById("sp_bitola_mt").value,
    estBt: document.getElementById("sp_est_bt").value,
    redeBt: document.getElementById("sp_rede_bt").value,
    bitolaBt: document.getElementById("sp_bitola_bt").value,
    veiculo: document.getElementById("sp_veiculo").value,
    policia: document.getElementById("sp_policia").value,
    vitima: document.getElementById("sp_vitima").value,
    fotoPlaca: document.getElementById("sp_foto_placa").value,
    doc: document.getElementById("sp_doc").value,
    end: document.getElementById("sp_end").value,
    danos: document.getElementById("sp_danos").value,
    camera: document.getElementById("sp_camera").value,
    medidor: document.getElementById("sp_medidor").value,
    veiculoDesc: document.getElementById("sp_veiculo_desc").value,
    empresa: document.getElementById("sp_empresa").value,
    qual: document.getElementById("sp_qual").value,
    obsCondutor: document.getElementById("sp_obs_condutor").value,
    materiais: document.getElementById("sp_materiais").value,
    obsGerais: document.getElementById("sp_obs_gerais").value,
  };
}

function spGerarRelatorioWhats() {
  if (!spValidarObrigatorios()) return;

  const texto = spMontarTexto(spLerCampos(), "whats");

  document.getElementById("sp_resultado").value = texto;
  navigator.clipboard.writeText(texto);
}

function spGerarRelatorioSS() {
  if (!spValidarObrigatorios()) return;

  const texto = spMontarTexto(spLerCampos(), "ss");

  document.getElementById("sp_resultado").value = texto;
  navigator.clipboard.writeText(texto);
}

// Mesmo comportamento do original (js/substituicao_poste.js::limparPoste,
// sem a chamada morta a wizardIrPara — ver nota no topo do arquivo):
// limpa input/textarea, reseta os <select> pro primeiro option.
function spLimparRelatorio() {
  document.querySelectorAll("#substituicao_poste input, #substituicao_poste textarea")
    .forEach((el) => { el.value = ""; });

  document.querySelectorAll("#substituicao_poste select")
    .forEach((el) => { el.selectedIndex = 0; });

  document.getElementById("sp_resultado").value = "";
}

function spToggle(ids, ativo) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.opacity = ativo ? "1" : "0.5";
      el.style.pointerEvents = ativo ? "auto" : "none";
    }
  });
}

// Mesmo comportamento do original (aplicarRegraPoste): nunca apaga
// valor, só esmaece/reabilita visualmente.
function spAplicarRegraTipoPoste() {
  const tipo = document.getElementById("sp_tipo_poste").value;

  const camposMt = ["sp_est_mt", "sp_rede_mt", "sp_bitola_mt"];
  const camposBt = ["sp_est_bt", "sp_rede_bt", "sp_bitola_bt"];

  if (tipo === "POSTE MT") {
    spToggle(camposMt, true);
    spToggle(camposBt, false);
  } else if (tipo === "POSTE BT") {
    spToggle(camposMt, false);
    spToggle(camposBt, true);
  } else {
    spToggle(camposMt, true);
    spToggle(camposBt, true);
  }
}

// Mesmo comportamento do original (aplicarRegraVeiculo).
function spAplicarRegraVeiculo() {
  const causado = document.getElementById("sp_veiculo").value;

  const campos = [
    "sp_policia", "sp_vitima", "sp_foto_placa", "sp_doc",
    "sp_end", "sp_danos", "sp_camera", "sp_medidor",
    "sp_veiculo_desc", "sp_empresa", "sp_qual", "sp_obs_condutor",
  ];

  spToggle(campos, causado === "SIM");
}

(function spInicializarRegras() {
  const tipoPoste = document.getElementById("sp_tipo_poste");
  const veiculo = document.getElementById("sp_veiculo");

  if (tipoPoste) tipoPoste.addEventListener("change", spAplicarRegraTipoPoste);
  if (veiculo) veiculo.addEventListener("change", spAplicarRegraVeiculo);
})();
