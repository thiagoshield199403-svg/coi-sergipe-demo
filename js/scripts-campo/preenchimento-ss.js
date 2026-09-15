/* PREENCHIMENTO DE SS (ss-*) — quarto módulo reintegrado do sistema
   antigo (backup scriptdebloqueioslinhaviva-v2, js/ss.js). Cliente puro:
   lê campos do formulário, monta um texto padronizado (DUAS variantes —
   ver abaixo), copia pra área de transferência — sem fetch, sem
   localStorage, sem dependência de banco/API (mesmo comportamento do
   original; módulo 100% client-side, não precisou de nenhuma mudança de
   banco/migration).

   DUAS SAÍDAS DISTINTAS (regra de negócio original, preservada):
   o formulário tem DOIS botões de gerar — "Gerar Relatório WhatsApp"
   (gerarSSWhats no original) e "Gerar Relatório SS" (gerarSSPadrao no
   original) — que leem os MESMOS campos mas produzem textos com
   formatação DIFERENTE:
   - WhatsApp: linhas sem "- " no início, cabeçalho "🧾 SS :", rótulo
     "REF. ELÉTRICA" (com espaço depois do ponto), linha de ID no
     formato "ID: <valor>" (com espaço depois dos dois-pontos).
   - SS/Padrão: linhas com "- " no início, sem cabeçalho, rótulo
     "REF.ELÉTRICA" (SEM espaço depois do ponto), linha de ID no formato
     "- ID:<valor>" (SEM espaço depois dos dois-pontos) — e quando o ID
     está vazio a linha vira "- -" (o "-" do id somado ao "- " do
     prefixo da linha). Essas diferenças de espaçamento são reais no
     original (não normalizadas aqui) — não são bug, são dois formatos
     de saída pensados pra dois destinos diferentes (WhatsApp vs. campo
     de texto do sistema de SS). Nenhuma das duas foi alterada.

   Campos do formulário (nenhum tem atributo "required" no HTML
   original — não existe validação client-side além do type="number"
   nativo em N° Chave e ID; todo campo vazio vira "-" no texto, nunca
   bloqueia a geração):
   - ss_regional (select, "POLO / REGIONAL") — 9 polos, sem value=""
     custom nas opções reais (value = próprio texto da opção).
   - ss_abrangencia (select, "ABRANGÊNCIA") — 3 opções com value
     CURTO ("T1"/"T2"/"T3"), diferente do texto exibido ("T1 -
     ALIMENTADOR" etc.) — .value devolve só o código curto, preservado
     assim (mesmo comportamento do original).
   - ss_equipe (select, "TIPO DE EQUIPE") — 3 opções, value = texto.
   - ss_acesso (select, "ACESSO PARA CAMINHÃO") — 2 opções, value = texto.
   - ss_ref (select, "CHAVE REFERÊNCIA") — 5 opções com value CURTO
     ("CF"/"CS"/"TD"/"RD"/"RT"), diferente do texto exibido — mesmo
     tratamento do ss_abrangencia.
   - ss_num (input type="number") — "N° CHAVE".
   - ss_id (input type="number") — "ID".
   - ss_servico (input texto) — "DESCRIÇÃO DO SERVIÇO".
   - ss_endereco (input texto) — "ENDEREÇO DO SERVIÇO".
   - ss_coord (input texto) — "COORDENADAS".
   - ss_obs (textarea) — "OBSERVAÇÕES RELEVANTES".
   - ss_resultado (textarea, readonly) — resultado gerado.

   Regras condicionais (idênticas ao original, nenhuma alterada):
   - "REF. ELÉTRICA"/"REF.ELÉTRICA" só monta "<ref> <num>" se AMBOS
     ss_ref.value E ss_num.value estiverem preenchidos; senão "-".
   - Linha de ID só aparece com o valor se ss_id.value estiver
     preenchido; senão "-" (que na variante SS/Padrão vira "- -" por
     causa do prefixo "- " de toda linha).

   Nenhum bug real foi encontrado neste módulo (diferente do Desarme,
   cujo ds_obs nunca era lido) — todos os campos do formulário são lidos
   e usados em ambos os geradores. Por isso a saída nova é IDÊNTICA
   byte-a-byte à original nos dois formatos (ver
   js/scripts-campo/preenchimento-ss.test.js e a comparação isolada).

   Adaptações de arquitetura (sem mudança de regra de negócio):
   - ids já vinham prefixados "ss_" desde o backup, mantidos como
     estavam;
   - toda leitura via document.getElementById explícito (o original já
     fazia isso dentro das próprias funções, então a lógica em si não
     mudou);
   - funções renomeadas com o prefixo "ss" (gerarSSWhats ->
     ssGerarRelatorioWhats, gerarSSPadrao -> ssGerarRelatorioPadrao,
     limparSS -> ssLimparRelatorio) pra seguir a mesma convenção dos
     outros três módulos;
   - o original duplicava o bloco inteiro de leitura de campos em cada
     uma das duas funções geradoras — aqui essa leitura foi extraída pra
     um único helper (ssLerCampos), e a montagem do texto pra uma única
     função PURA parametrizada por formato (ssMontarTexto(dados,
     formato)), evitando duplicar função sem necessidade (pedido
     explícito desta etapa) e mantendo tudo testável em Node sem DOM —
     mesmo padrão de bloqueios.js/sinergia.js/desarme.js. Isso é
     extração/DRY de código, não mudança de regra: as duas saídas
     continuam byte-a-byte iguais às do original. */

// Pura: recebe um objeto simples com os valores já lidos do formulário
// (nunca elementos do DOM) e o formato desejado ("whats" ou "padrao"),
// devolve o texto final — testável em Node puro (ver
// js/scripts-campo/preenchimento-ss.test.js). Mesmo template/rótulos do
// original (js/ss.js::gerarSSWhats / gerarSSPadrao), nenhuma linha
// alterada.
function ssMontarTexto(dados, formato) {
  const d = dados || {};

  const regional = d.regional || "-";
  const abrangencia = d.abrangencia || "-";
  const equipe = d.equipe || "-";
  const acesso = d.acesso || "-";
  const servico = d.servico || "-";
  const endereco = d.endereco || "-";
  const coord = d.coord || "-";
  const obs = d.obs || "-";

  const ref = (d.ref && d.num) ? `${d.ref} ${d.num}` : "-";

  if (formato === "padrao") {
    const id = d.id ? `ID:${d.id}` : "-";
    return (
`- SERVIÇO: ${servico}
- REGIONAL: ${regional}
- ABRANGÊNCIA: ${abrangencia}
- EQUIPE: ${equipe}
- ACESSO: ${acesso}
- REF.ELÉTRICA: ${ref}
- ${id}
- ENDEREÇO: ${endereco}
- COORDENADAS: ${coord}
- OBS: ${obs}`
    );
  }

  // formato "whats" (default — mesmo comportamento do original quando
  // nenhum formato reconhecido é passado, já que gerarSSWhats era a
  // única outra opção)
  const id = d.id ? `ID: ${d.id}` : "-";
  return (
`🧾 SS :
SERVIÇO: ${servico}
REGIONAL: ${regional}
ABRANGÊNCIA: ${abrangencia}
EQUIPE: ${equipe}
ACESSO: ${acesso}
REF. ELÉTRICA: ${ref}
${id}
ENDEREÇO: ${endereco}
COORDENADAS: ${coord}
OBS: ${obs}`
  );
}

function ssLerCampos() {
  return {
    regional: document.getElementById("ss_regional").value,
    abrangencia: document.getElementById("ss_abrangencia").value,
    equipe: document.getElementById("ss_equipe").value,
    acesso: document.getElementById("ss_acesso").value,
    ref: document.getElementById("ss_ref").value,
    num: document.getElementById("ss_num").value,
    id: document.getElementById("ss_id").value,
    servico: document.getElementById("ss_servico").value,
    endereco: document.getElementById("ss_endereco").value,
    coord: document.getElementById("ss_coord").value,
    obs: document.getElementById("ss_obs").value,
  };
}

function ssGerarRelatorioWhats() {
  const texto = ssMontarTexto(ssLerCampos(), "whats");

  document.getElementById("ss_resultado").value = texto;

  navigator.clipboard.writeText(texto);

  if (typeof showToast === "function") {
    showToast("Relatório WhatsApp copiado 📲");
  }
}

function ssGerarRelatorioPadrao() {
  const texto = ssMontarTexto(ssLerCampos(), "padrao");

  document.getElementById("ss_resultado").value = texto;

  navigator.clipboard.writeText(texto);

  if (typeof showToast === "function") {
    showToast("Relatório SS copiado 🧾");
  }
}

// Mesmo comportamento do original (js/ss.js::limparSS): limpa
// input/textarea, reseta os <select> pro primeiro option.
function ssLimparRelatorio() {
  document.querySelectorAll("#preenchimento_ss input, #preenchimento_ss textarea")
    .forEach(el => { el.value = ""; });

  document.querySelectorAll("#preenchimento_ss select")
    .forEach(el => { el.selectedIndex = 0; });

  document.getElementById("ss_resultado").value = "";
}
