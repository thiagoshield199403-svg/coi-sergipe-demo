/* Gestão de Equipes + MAPA OPERACIONAL (integrados na mesma tela — ver
   especificação do MAPA OPERACIONAL). Sem WebSocket/tempo real, sem
   Pendências, sem IA nesta etapa. Depende de authObterSessao()/
   authChamarApi() (js/auth.js, carregado antes) e, para a aba de mapa, de
   js/mapa.js (carregado depois deste arquivo em index.html) — este arquivo
   é a fonte única dos dados (fetch), js/mapa.js só desenha.

   POSIÇÃO ATUAL x ÁREAS DE ATUAÇÃO: uma operação tem UMA posição (o que
   posiciona o marcador no mapa) e N áreas de atuação (o que aparece no
   detalhe, não move o marcador). A posição sempre é incluída nas áreas de
   atuação automaticamente — replicado aqui no front só para exibição
   imediata; a garantia definitiva é do backend (schemas/equipes.py). */

const EQUIPES_STATUS = {
  DISPONIVEL: { emoji: "🟢", label: "Disponível" },
  DESLOCAMENTO: { emoji: "🔵", label: "Em deslocamento" },
  EM_ATENDIMENTO: { emoji: "🟡", label: "Em atendimento" },
  NO_LOCAL: { emoji: "🟣", label: "No local" },
  INDISPONIVEL: { emoji: "⚫", label: "Indisponível" },
  FINALIZADA: { emoji: "🔴", label: "Turno encerrado" },
};

/* ================= HORÁRIO: fonte única (cadastro rápido em linha + modo avançado) =================
   EQUIPES_HORARIOS_PRESET NÃO é uma lista escrita aqui — é lida uma única
   vez do DOM (os botões já existentes em #equipes_horario_presets, ver
   index.html), em equipesCarregarHorariosPresetDoDOM(). Isso evita uma
   segunda estrutura de horários "hardcoded" duplicada em JS: a lista de
   presets continua tendo uma única fonte editável (os botões no HTML), só
   passou a alimentar TAMBÉM o <select> da linha rápida e do modo avançado
   (equipesPopularSelectHorario), além dos botões do modal "Adicionar
   Equipe" (que continuam funcionando exatamente como antes,
   equipesSelecionarHorarioPreset inalterado). */
let EQUIPES_HORARIOS_PRESET = [];
const EQUIPES_HORARIO_PERSONALIZADO = "personalizado";

function equipesCarregarHorariosPresetDoDOM() {
  EQUIPES_HORARIOS_PRESET = Array.from(
    document.querySelectorAll("#equipes_horario_presets .equipes-horario-btn:not([data-outro])")
  ).map(botao => ({ inicio: botao.dataset.inicio, fim: botao.dataset.fim }));
}

function equipesRotuloHorario(inicio, fim) {
  return inicio + "–" + fim;
}

function equipesHorarioValor(inicio, fim) {
  return inicio + "|" + fim;
}

function equipesPopularSelectHorario(selectEl) {
  selectEl.innerHTML = '<option value="">Horário…</option>';
  EQUIPES_HORARIOS_PRESET.forEach(p => {
    const opt = document.createElement("option");
    opt.value = equipesHorarioValor(p.inicio, p.fim);
    opt.textContent = equipesRotuloHorario(p.inicio, p.fim);
    selectEl.appendChild(opt);
  });
  const optPersonalizado = document.createElement("option");
  optPersonalizado.value = EQUIPES_HORARIO_PERSONALIZADO;
  optPersonalizado.textContent = "Personalizado…";
  selectEl.appendChild(optPersonalizado);
}

// Monta [select + par de <input type=time> só visível em "Personalizado"]
// pronto pra uma linha rápida — sem lógica de salvar (quem chama decide o
// que fazer quando o horário muda, via listener em .select/.inputInicio/
// .inputFim, mesmo padrão de equipesConstruirLocalidadeControles abaixo).
function equipesConstruirHorarioControles() {
  const wrap = document.createElement("div");
  wrap.className = "equipe-linha-horario";

  const select = document.createElement("select");
  select.className = "equipe-linha-horario-select";
  equipesPopularSelectHorario(select);

  const customWrap = document.createElement("span");
  customWrap.className = "equipe-linha-horario-custom";
  customWrap.hidden = true;
  const inputInicio = document.createElement("input");
  inputInicio.type = "time";
  inputInicio.className = "equipe-linha-horario-custom-input";
  const inputFim = document.createElement("input");
  inputFim.type = "time";
  inputFim.className = "equipe-linha-horario-custom-input";
  customWrap.appendChild(inputInicio);
  customWrap.appendChild(document.createTextNode("–"));
  customWrap.appendChild(inputFim);

  select.addEventListener("change", () => {
    customWrap.hidden = select.value !== EQUIPES_HORARIO_PERSONALIZADO;
  });

  wrap.appendChild(select);
  wrap.appendChild(customWrap);

  return { wrap, select, customWrap, inputInicio, inputFim };
}

// null quando o horário ainda está incompleto (ex.: "Personalizado"
// escolhido mas só um dos dois campos preenchido) — quem chama trata como
// "ainda não dá pra salvar", nunca envia hora_inicio/hora_fim pela metade
// (o backend também rejeita isso, ver EquipeOperacaoUpdate).
function equipesLerHorarioControles(controles) {
  if (controles.select.value === EQUIPES_HORARIO_PERSONALIZADO) {
    const inicio = controles.inputInicio.value;
    const fim = controles.inputFim.value;
    return inicio && fim ? { inicio, fim } : null;
  }
  if (!controles.select.value) return null;
  const [inicio, fim] = controles.select.value.split("|");
  return { inicio, fim };
}

// Reflete um horário já existente nos controles — casa com um preset se
// houver um idêntico, senão cai em "Personalizado" com os valores exatos
// (nunca perde precisão arredondando pro preset mais próximo).
function equipesPreencherHorarioControles(controles, inicio, fim) {
  const valor = equipesHorarioValor(inicio, fim);
  const bateComPreset = Array.from(controles.select.options).some(o => o.value === valor);
  if (bateComPreset) {
    controles.select.value = valor;
    controles.customWrap.hidden = true;
  } else {
    controles.select.value = EQUIPES_HORARIO_PERSONALIZADO;
    controles.customWrap.hidden = false;
    controles.inputInicio.value = inicio;
    controles.inputFim.value = fim;
  }
}

/* ================= CENTRAL OPERACIONAL: classificação em blocos =================
   Duas camadas, nesta ordem (confirmado pelo usuário — planilha
   operacional real):

   1) REGRAS GLOBAIS DE TIPO (EQUIPES_REGRAS_TIPO_GLOBAL) — vencem SEMPRE,
      não importa o prefixo/polo: qualquer "-CR" é "Equipes Corte", "-CX" é
      "Equipes/CX", "-SB" é "Sobreaviso", junte ARJ, CTN, ITB, DOR ou
      qualquer outro prefixo no MESMO bloco. Isto é intencionalmente
      diferente da etapa anterior (que mantinha "ARJ-CR" e "CTN-CR" em
      blocos separados) — mudança de regra de negócio confirmada, não bug.

   2) CATÁLOGO TERRITORIAL POR POLO (EQUIPES_GRUPOS_POR_POLO) — só entra em
      jogo quando o tipo NÃO bateu em nenhuma regra global acima (tipicamente
      PS/SN). Cada prefixo pertence a UM bloco territorial fixo dentro do
      polo, extraído da planilha de referência:
        Aracaju: ARJ->Aracaju Norte, CTN->Aracaju Sul, NSS->Socorro,
                 BCQ->Barra, MSQ->Mosqueiro (AJU só aparece como AJU-CX na
                 planilha, então cai inteiro na regra global CX acima —
                 nenhuma entrada territorial própria necessária pra ele).
      Comparação de prefixo é sem acento (equipesNormalizarPrefixo) —
      "BÇQ" (como gravado hoje em produção) e "BCQ" (como na planilha)
      batem no mesmo bloco.

   Prefixo/polo que não bate em NADA acima (polo sem catálogo territorial
   próprio, ex. os polos do interior) cai num bloco com o nome do próprio
   polo (ver equipesChavePoloPrincipal) — nunca "Especiais / Outros" pra um
   polo inteiro; "Especiais / Outros" é reservado só pra identificador fora
   do padrão PREFIXO-TIPOnn (equipesExtrairFamilia não conseguiu nem
   separar prefixo/tipo). Adicionar um polo novo = uma entrada nova em
   EQUIPES_GRUPOS_POR_POLO, nunca um "if polo === ..." no meio do código.

   INTERIOR (etapa "correção de estrutura dos blocos"): sem catálogo
   territorial próprio ainda (ao contrário de Aracaju), cada polo do
   interior tem sempre 3 blocos pré-escalados — [NOME DO POLO] (bloco
   principal, sentinela "POLO_PRINCIPAL" abaixo — resolve pro mesmo
   fallback "<nome do polo>" que equipesClassificarLinha já usa, nunca uma
   subdivisão territorial inventada) + EQUIPES CORTE + SOBREAVISO (as
   mesmas 2 regras globais de Aracaju, mesma chave — CR/SB de qualquer polo
   sempre no mesmo bloco quando a visão é "Todos"; quando um polo específico
   está selecionado, `equipesUltimaListaOperacoes` já vem filtrada por polo
   pelo backend, então só as equipes CR/SB DAQUELE polo aparecem dentro). */

const EQUIPES_REGRAS_TIPO_GLOBAL = [
  { tipo: "CR", chave: "GLOBAL_CR", rotulo: "Equipes Corte" },
  { tipo: "SB", chave: "GLOBAL_SB", rotulo: "Sobreaviso" },
  { tipo: "CX", chave: "GLOBAL_CX", rotulo: "Equipes/CX" },
];

// Fallback "<nome do polo>" — mesma fórmula usada em DOIS lugares (nunca
// duplicada): equipesClassificarLinha (quando uma equipe real cai aqui) e
// equipesGruposEsperadosParaPolo (pra pré-escalar o bloco mesmo vazio, via
// sentinela "POLO_PRINCIPAL" na config).
function equipesChavePoloPrincipal(polo) {
  return { chave: "POLO_" + polo.toUpperCase(), rotulo: polo };
}

// Cada entrada do polo é UMA destas três:
//   - territorial: {chave, rotulo, prefixos} (só Aracaju usa isso hoje);
//   - referência a regra global, só pra fixar a POSIÇÃO na ordem de
//     exibição ({chave: "GLOBAL_CR"}, sem rotulo/prefixos — o rótulo/regra
//     real vêm de EQUIPES_REGRAS_TIPO_GLOBAL, nunca duplicados aqui);
//   - sentinela do bloco principal do próprio polo ({chave: "POLO_PRINCIPAL"},
//     resolvido por equipesChavePoloPrincipal — ver EQUIPES_BLOCOS_INTERIOR).
// Um polo pode omitir uma regra global da lista (ela continua classificando
// normalmente, só não ganha bloco fixo pré-escalado pra aquele polo — vira
// bloco só quando a primeira equipe cair nela).
const EQUIPES_GRUPOS_POR_POLO = {
  Aracaju: [
    { chave: "ARACAJU_NORTE", rotulo: "Aracaju Norte", prefixos: ["ARJ"] },
    { chave: "ARACAJU_SUL", rotulo: "Aracaju Sul", prefixos: ["CTN"] },
    { chave: "GLOBAL_CR" },
    { chave: "GLOBAL_SB" },
    { chave: "SOCORRO", rotulo: "Socorro", prefixos: ["NSS"] },
    { chave: "BARRA", rotulo: "Barra", prefixos: ["BCQ"] },
    { chave: "MOSQUEIRO", rotulo: "Mosqueiro", prefixos: ["MSQ"] },
    { chave: "GLOBAL_CX" },
  ],
};

// Estrutura padrão de qualquer polo do interior (sem catálogo territorial
// próprio, ao contrário de Aracaju) — [NOME DO POLO] + EQUIPES CORTE +
// SOBREAVISO, sempre nesta ordem, sempre pré-escalados mesmo vazios. Um
// único array reaproveitado (nunca mutado) pra todos os polos abaixo —
// dado de configuração, não lógica condicional por polo.
const EQUIPES_BLOCOS_INTERIOR = [
  { chave: "POLO_PRINCIPAL" },
  { chave: "GLOBAL_CR" },
  { chave: "GLOBAL_SB" },
];
[
  "Dores", "Itabaiana", "Lagarto", "Maruim", "Propriá", "São Cristóvão",
].forEach(polo => { EQUIPES_GRUPOS_POR_POLO[polo] = EQUIPES_BLOCOS_INTERIOR; });

const EQUIPES_CHAVE_ESPECIAIS = "ESPECIAIS_OUTROS";

// "AJU-PS01" -> {prefixo:"AJU", tipo:"PS", numero:"01"}; identificador fora
// do padrão PREFIXO-TIPOnn (sem hífen ou sem dígito final) -> prefixo/tipo
// nulos, cai em "Especiais / Outros" — nunca descartado da lista.
function equipesExtrairFamilia(identificador) {
  const m = /^([A-ZÀ-Ú0-9]+)-([A-ZÀ-Ú]+)(\d+)$/.exec((identificador || "").toUpperCase());
  if (!m) return { prefixo: null, tipo: null, numero: null };
  return { prefixo: m[1], tipo: m[2], numero: m[3] };
}

// Remove acentos pra comparar prefixo — "BÇQ" (como gravado hoje) e "BCQ"
// (como na planilha/config) precisam bater no mesmo bloco.
function equipesNormalizarPrefixo(prefixo) {
  return (prefixo || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

function equipesRegraGlobalPorTipo(tipo) {
  return EQUIPES_REGRAS_TIPO_GLOBAL.find(r => r.tipo === tipo) || null;
}

function equipesRegraGlobalPorChave(chave) {
  return EQUIPES_REGRAS_TIPO_GLOBAL.find(r => r.chave === chave) || null;
}

// Classifica UMA linha (identidade de equipe + polo dela — nunca só o
// identificador sozinho, já que o catálogo territorial é por polo).
// `linha` é {identificador, polo}, formato comum tanto a uma EquipeOut
// quanto a uma EquipeOperacaoOut (ver equipesMontarLinhasParaPolo).
function equipesClassificarLinha(linha) {
  const { prefixo, tipo } = equipesExtrairFamilia(linha.identificador);
  if (!prefixo || !tipo) return { chave: EQUIPES_CHAVE_ESPECIAIS, rotulo: "Especiais / Outros" };

  const regraGlobal = equipesRegraGlobalPorTipo(tipo);
  if (regraGlobal) return { chave: regraGlobal.chave, rotulo: regraGlobal.rotulo };

  const prefixoNorm = equipesNormalizarPrefixo(prefixo);
  const configPolo = EQUIPES_GRUPOS_POR_POLO[linha.polo] || [];
  const grupoTerritorial = configPolo.find(
    g => g.prefixos && g.prefixos.some(p => equipesNormalizarPrefixo(p) === prefixoNorm)
  );
  if (grupoTerritorial) return { chave: grupoTerritorial.chave, rotulo: grupoTerritorial.rotulo };

  return linha.polo
    ? equipesChavePoloPrincipal(linha.polo)
    : { chave: EQUIPES_CHAVE_ESPECIAIS, rotulo: "Especiais / Outros" };
}

// Blocos que devem aparecer JÁ ESCALADOS (mesmo vazios) quando um polo
// específico está selecionado — território configurado + regras globais
// que aquele polo optou por fixar na lista (ver comentário de
// EQUIPES_GRUPOS_POR_POLO). Preserva a ORDEM declarada na config; nada de
// ordenação alfabética aqui — quem decide a ordem visual é a config.
function equipesGruposEsperadosParaPolo(polo) {
  const config = EQUIPES_GRUPOS_POR_POLO[polo] || [];
  return config
    .map(entrada => {
      if (entrada.prefixos) return { chave: entrada.chave, rotulo: entrada.rotulo };
      if (entrada.chave === "POLO_PRINCIPAL") return equipesChavePoloPrincipal(polo);
      const regra = equipesRegraGlobalPorChave(entrada.chave);
      return regra ? { chave: regra.chave, rotulo: regra.rotulo } : null;
    })
    .filter(Boolean);
}

// União dos blocos de TODOS os polos configurados — usada quando o filtro
// Polo está em "Todos" (ver equipesAgruparLinhas: poloParaEscalar === true).
// Blocos globais (Equipes Corte/CX/Sobreaviso) aparecem em mais de um polo
// na config — dedup por chave, mantém só a primeira ocorrência.
function equipesGruposEsperadosTodosOsPolos() {
  const vistos = new Set();
  const resultado = [];
  Object.keys(EQUIPES_GRUPOS_POR_POLO).forEach(polo => {
    equipesGruposEsperadosParaPolo(polo).forEach(g => {
      if (vistos.has(g.chave)) return;
      vistos.add(g.chave);
      resultado.push(g);
    });
  });
  return resultado;
}

// Agrupa uma lista de "linhas" (ver equipesListaFiltradaPorBusca) em blocos.
// `poloParaEscalar`:
//   - string (um polo específico) -> escala os blocos configurados PRA
//     AQUELE polo, mesmo com 0 itens;
//   - `true` (Polo = "Todos") -> escala a UNIÃO dos blocos de TODOS os
//     polos configurados, mesmo com 0 itens — sem isto, "Todos" sem
//     nenhuma operação hoje caía no "Nenhuma equipe encontrada" genérico
//     em vez de mostrar a estrutura de blocos (bug corrigido nesta etapa);
//   - falsy (null/false) -> não escala nada, só mostra o que existir
//     (modo busca filtrada / histórico, ver equipesListaFiltradaPorBusca).
// Blocos que emergem da classificação mas não estavam pré-escalados
// (fallback "<polo>" ou "Especiais / Outros") vão pro final, ordenados por
// rótulo — nunca embaralhados com a ordem oficial configurada.
function equipesAgruparLinhas(linhas, poloParaEscalar) {
  const grupos = new Map();
  const ordem = [];

  function garantirGrupo(chave, rotulo) {
    if (!grupos.has(chave)) {
      grupos.set(chave, { rotulo, itens: [] });
      ordem.push(chave);
    }
    return grupos.get(chave);
  }

  const chavesOficiais = new Set();
  if (poloParaEscalar) {
    const gruposEsperados = poloParaEscalar === true
      ? equipesGruposEsperadosTodosOsPolos()
      : equipesGruposEsperadosParaPolo(poloParaEscalar);
    gruposEsperados.forEach(g => {
      garantirGrupo(g.chave, g.rotulo);
      chavesOficiais.add(g.chave);
    });
  }

  linhas.forEach(linha => {
    const { chave, rotulo } = equipesClassificarLinha(linha);
    garantirGrupo(chave, rotulo).itens.push(linha);
  });

  const oficiais = ordem.filter(c => chavesOficiais.has(c));
  const extras = ordem
    .filter(c => !chavesOficiais.has(c))
    .sort((a, b) => grupos.get(a).rotulo.localeCompare(grupos.get(b).rotulo, "pt-BR"));

  return [...oficiais, ...extras].map(chave => ({
    chave, rotulo: grupos.get(chave).rotulo, itens: grupos.get(chave).itens,
  }));
}

let equipesListasCarregadas = false;
let equipesCachePolos = [];
let equipesCacheLocalidades = []; // hierarquia POLO -> MUNICIPIO -> LOCALIDADE completa
let equipesCacheEquipes = []; // catálogo de IDENTIDADES (GET /teams/equipes) — só usado pra autocomplete (equipesConstruirEquipeControles) e pelo modo avançado; NUNCA usado pra pré-popular a lista do dia, ver etapa "operação diária" abaixo.
// Operadores saíram do cadastro rápido (linha só pede equipe/telefone/
// localidade/horário) mas continuam vinculáveis via modal avançado — ver
// equipesAlterarOperadoresSelecionados abaixo.
let equipesCacheOperadores = [];
let equipesUltimaListaOperacoes = []; // última resposta de GET /operations — fonte também do mapa

// ================= ETAPA "OPERAÇÃO DIÁRIA": só EquipeOperacao aparece =================
// Decisão desta etapa (revertendo a etapa anterior): a lista do dia é
// SEMPRE só o que já tem EquipeOperacao hoje (equipesUltimaListaOperacoes).
// Uma identidade (Equipe) cadastrada no catálogo NUNCA aparece sozinha só
// por existir — ela só vira uma linha quando o operador clica "+ Adicionar
// equipe" ou usa "↻ Recuperar equipes do dia anterior" (ambos criam uma
// EquipeOperacao de verdade via POST, nunca uma linha fantasma). Os BLOCOS
// (títulos/contadores vazios) continuam aparecendo sempre pro polo
// selecionado — isso é decidido em equipesAgruparLinhas/equipesRenderizarListaEMapa,
// função de configuração (EQUIPES_GRUPOS_POR_POLO), não de dados.

// Estado do formulário "Adicionar Equipe" — UMA lista ordenada de
// localidades: a primeira (índice 0) É a posição atual, as demais são
// áreas de atuação. Nunca dois campos separados aqui (cadastro rápido).
let equipesLocalidadesSelecionadas = [];

// Estado do modal "Alterar Posição" (edição de uma operação já existente)
let equipesAlterarOperacaoId = null;
let equipesAlterarPosicaoSelecionada = null;
let equipesAlterarAreasSelecionadas = [];
let equipesAlterarOperadoresSelecionados = [];

// Estado do modal "Excluir equipe" (confirmação — nunca exclui direto no clique)
let equipesExcluirOperacaoId = null;

function equipesHeaders() {
  const sessao = authObterSessao();
  return sessao && sessao.access_token ? { "Authorization": "Bearer " + sessao.access_token } : {};
}

function equipesEscapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto === null || texto === undefined ? "" : String(texto);
  return div.innerHTML;
}

function equipesMostrarErro(elId, mensagem) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = mensagem || "";
  el.style.display = mensagem ? "block" : "none";
}

// Extrai uma mensagem de texto legível do corpo de erro da API. Nunca deve
// devolver um objeto/array pra `equipesMostrarErro` — atribuir um array de
// objetos a `.textContent` vira "[object Object],[object Object]" (cada
// item usa o toString() padrão de Object), que é exatamente o bug desta
// correção. Cobre os formatos reais que a API já pode devolver:
//   - FastAPI/Pydantic 422: {"detail": [{"loc": [...], "msg": "..."}]}
//   - HTTPException do backend: {"detail": "mensagem"}
//   - qualquer outra coisa -> null, quem chama usa seu próprio fallback.
function equipesExtrairMensagemErro(corpo) {
  if (!corpo) return null;
  if (typeof corpo === "string") return corpo;

  const detail = corpo.detail;
  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const mensagens = detail
      .map(item => (item && typeof item === "object" && typeof item.msg === "string") ? item.msg : null)
      .filter(Boolean);
    if (mensagens.length > 0) return mensagens.join(" | ");
  }

  return null;
}

function equipesVoltarMenu() {
  // Não há mais nenhum botão de menu apontando pra "inicio" (removido —
  // ver reorganização do menu), então não existe um <button> pra marcar
  // como .active aqui. Replica só a parte segura de openModule() (troca
  // de módulo visível + saída do modo-tela-ampla), sem o
  // btn.classList.add('active') que exigiria um botão inexistente.
  document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
  document.querySelectorAll('.menu button').forEach(b => b.classList.remove('active'));
  document.getElementById('inicio').classList.add('active');
  document.body.classList.remove('modo-tela-ampla');
}

function equipesAtualizarDataOperacao() {
  const rotulo = equipesFiltroDiaEhHoje()
    ? new Date().toLocaleDateString("pt-BR")
    : equipesFormatarDataBR(document.getElementById("equipes_filtro_dia").value);
  document.getElementById("equipes_data_hoje").textContent = rotulo;
  document.getElementById("equipes_data_label").textContent = equipesFiltroDiaEhHoje()
    ? "OPERAÇÃO DO DIA"
    : "HISTÓRICO — SOMENTE LEITURA";
}

function equipesFiltrarTexto(lista, texto, obterRotulo) {
  const alvo = texto.trim().toLowerCase();
  if (!alvo) return lista;
  return lista.filter(item => obterRotulo(item).toLowerCase().includes(alvo));
}

function equipesFormatarDataBR(isoData) {
  const [ano, mes, dia] = isoData.split("-");
  return `${dia}/${mes}/${ano}`;
}

function equipesFiltroDiaEhHoje() {
  const valor = document.getElementById("equipes_filtro_dia").value;
  return !valor;
}

// Data de ontem em ISO (YYYY-MM-DD) — mesmo cálculo em fuso local usado por
// equipesPreencherFiltroDia (new Date() + setDate), nunca UTC puro (evitar
// virar o dia errado perto da meia-noite em fusos negativos).
function equipesDataOntemISO() {
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const ano = ontem.getFullYear();
  const mes = String(ontem.getMonth() + 1).padStart(2, "0");
  const dia = String(ontem.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/* ================= LISTAS AUXILIARES (polos / localidades / equipes) ================= */

async function equipesCarregarPolos() {
  const r = await authChamarApi("/api/teams/polos", { headers: equipesHeaders() });
  equipesCachePolos = r.ok ? r.corpo : [];

  [
    document.getElementById("equipes_filtro_polo"),
    document.getElementById("equipes_alterar_posicao_polo"),
  ].forEach(select => {
    if (!select) return;
    const valorAtual = select.value;
    const primeiraOpcao = select.options[0];
    select.innerHTML = "";
    select.appendChild(primeiraOpcao);
    equipesCachePolos.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      select.appendChild(opt);
    });
    select.value = valorAtual;
  });
}

async function equipesCarregarLocalidades() {
  const r = await authChamarApi("/api/teams/localidades", { headers: equipesHeaders() });
  equipesCacheLocalidades = r.ok ? r.corpo : [];
}

async function equipesCarregarOperadoresCache() {
  const r = await authChamarApi("/api/teams/operators", { headers: equipesHeaders() });
  equipesCacheOperadores = r.ok ? r.corpo : [];
}

async function equipesCarregarEquipesCache() {
  const r = await authChamarApi("/api/teams/equipes", { headers: equipesHeaders() });
  equipesCacheEquipes = r.ok ? r.corpo : [];
}

async function equipesCarregarListasAuxiliares() {
  if (equipesListasCarregadas) return;
  await Promise.all([
    equipesCarregarPolos(),
    equipesCarregarLocalidades(),
    equipesCarregarEquipesCache(),
    equipesCarregarCursosCache(),
    equipesCarregarOperadoresCache(),
  ]);
  equipesListasCarregadas = true;
}

function equipesMunicipiosDoPolo(polo) {
  const nomes = equipesCacheLocalidades
    .filter(l => l.polo === polo)
    .map(l => l.municipio);
  return Array.from(new Set(nomes)).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function equipesLocalidadesDoPoloMunicipio(polo, municipio) {
  return equipesCacheLocalidades.filter(l => l.polo === polo && (!municipio || l.municipio === municipio));
}

// Busca considera também aliases territoriais (ex.: "Dezoito do Forte" para
// "18 do Forte") — hoje toda localidade tem aliases:[] (nenhum foi
// cadastrado ainda), mas a busca já funciona assim que existirem.
function equipesTextoBuscavelLocalidade(l) {
  return [l.rotulo_exibicao, l.nome, ...(l.aliases || [])].join(" | ");
}

/* ================= FILTRO "MUNICÍPIO" (deriva das localidades já carregadas) ================= */

function equipesAtualizarFiltroMunicipio() {
  const poloFiltro = document.getElementById("equipes_filtro_polo").value;
  const select = document.getElementById("equipes_filtro_municipio");
  const valorAtual = select.value;
  const municipios = poloFiltro
    ? equipesMunicipiosDoPolo(poloFiltro)
    : Array.from(new Set(equipesCacheLocalidades.map(l => l.municipio))).sort((a, b) => a.localeCompare(b, "pt-BR"));

  select.innerHTML = '<option value="">Todos</option>';
  municipios.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    select.appendChild(opt);
  });
  if (municipios.includes(valorAtual)) select.value = valorAtual;
}

/* ================= FILTRO "DIA" (últimos 7 dias — histórico, ver especificação) ================= */

function equipesPreencherFiltroDia() {
  const select = document.getElementById("equipes_filtro_dia");
  select.innerHTML = "";
  const hoje = new Date();
  for (let i = 0; i <= 6; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const opt = document.createElement("option");
    opt.value = i === 0 ? "" : iso;
    opt.textContent = i === 0 ? "Hoje" : (i === 1 ? `Ontem (${equipesFormatarDataBR(iso)})` : equipesFormatarDataBR(iso));
    select.appendChild(opt);
  }
}

/* ================= COMBOBOX: POLO / EQUIPE (identidade da equipe — livre) ================= */

function equipesRenderizarComboOpcoes(opcoesElId, itens, obterRotulo, obterSub, mensagemVazia, aoSelecionar) {
  const el = document.getElementById(opcoesElId);
  el.innerHTML = "";

  if (itens.length === 0) {
    el.innerHTML = '<div class="equipes-combo-opcao-vazia">' + equipesEscapar(mensagemVazia) + "</div>";
    el.hidden = false;
    return;
  }

  itens.slice(0, 30).forEach(item => {
    const div = document.createElement("div");
    div.className = "equipes-combo-opcao";
    const sub = obterSub(item);
    div.innerHTML = equipesEscapar(obterRotulo(item)) +
      (sub ? '<span class="equipes-combo-opcao-sub">' + equipesEscapar(sub) + "</span>" : "");
    div.addEventListener("mousedown", e => {
      e.preventDefault();
      aoSelecionar(item);
      el.hidden = true;
    });
    el.appendChild(div);
  });
  el.hidden = false;
}

function equipesPoloAoDigitar() {
  const texto = document.getElementById("equipes_form_polo").value;
  const filtrados = equipesFiltrarTexto(equipesCachePolos, texto, p => p);
  equipesRenderizarComboOpcoes(
    "equipes_polo_opcoes", filtrados, p => p, () => "",
    "Nenhum polo encontrado — digite para usar um novo",
    polo => { document.getElementById("equipes_form_polo").value = polo; }
  );
}

function equipesEquipeAoDigitar() {
  const texto = document.getElementById("equipes_form_identificador").value;
  const filtrados = equipesFiltrarTexto(equipesCacheEquipes, texto, e => e.identificador);
  equipesRenderizarComboOpcoes(
    "equipes_equipe_opcoes", filtrados, e => e.identificador, e => e.polo || "",
    "Nenhuma equipe encontrada — digite para criar uma nova",
    equipe => {
      document.getElementById("equipes_form_identificador").value = equipe.identificador;
      if (equipe.polo) document.getElementById("equipes_form_polo").value = equipe.polo;
    }
  );
}

/* ================= POSIÇÃO ATUAL: Polo -> Município -> Localidade (combo único) ================= */

function equipesConfigurarCascataPosicao(prefixo, aoSelecionarPosicao) {
  const poloSelect = document.getElementById(prefixo + "_polo");
  const municipioSelect = document.getElementById(prefixo + "_municipio");
  const buscaInput = document.getElementById(prefixo + "_busca");

  function atualizarMunicipios() {
    const polo = poloSelect.value;
    municipioSelect.innerHTML = polo
      ? '<option value="">Todos os municípios do polo</option>'
      : '<option value="">Selecione o polo primeiro…</option>';
    municipioSelect.disabled = !polo;
    buscaInput.disabled = !polo;
    buscaInput.value = "";
    if (polo) {
      equipesMunicipiosDoPolo(polo).forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        municipioSelect.appendChild(opt);
      });
    }
  }

  function aoDigitarBusca() {
    const polo = poloSelect.value;
    const municipio = municipioSelect.value;
    if (!polo) return;
    const disponiveis = equipesLocalidadesDoPoloMunicipio(polo, municipio);
    const filtrados = equipesFiltrarTexto(disponiveis, buscaInput.value, equipesTextoBuscavelLocalidade);
    equipesRenderizarComboOpcoes(
      prefixo + "_opcoes", filtrados, l => l.rotulo_exibicao, l => l.municipio,
      "Nenhuma localidade encontrada",
      localidade => {
        aoSelecionarPosicao(localidade);
        buscaInput.value = "";
      }
    );
  }

  poloSelect.addEventListener("change", atualizarMunicipios);
  municipioSelect.addEventListener("change", () => { buscaInput.value = ""; });
  buscaInput.addEventListener("focus", aoDigitarBusca);
  buscaInput.addEventListener("input", aoDigitarBusca);
  buscaInput.addEventListener("blur", () => { document.getElementById(prefixo + "_opcoes").hidden = true; });

  return { atualizarMunicipios };
}

function equipesRenderizarChipPosicao(chipElId, localidade, aoRemover) {
  const cont = document.getElementById(chipElId);
  cont.innerHTML = "";
  if (!localidade) return;
  const chip = document.createElement("span");
  chip.className = "equipes-chip";
  chip.innerHTML = equipesEscapar(localidade.rotulo_exibicao) + " (" + equipesEscapar(localidade.municipio) + ")" +
    '<button type="button" class="equipes-chip-remover" aria-label="Trocar posição">&times;</button>';
  chip.querySelector(".equipes-chip-remover").addEventListener("click", aoRemover);
  cont.appendChild(chip);
}

/* ================= CADASTRO RÁPIDO: LOCALIDADES DE ATUAÇÃO (1ª = posição) ================= */

// Filtra pela "Polo da equipe" já digitada — sem cascata Polo/Município
// separada (item 5/19 da especificação): a localidade já carrega seu
// próprio polo/município, o operador só pesquisa pelo nome/código.
// Um polo só ganha o passo "Município" quando os dados mostrarem que faz
// sentido (algum município daquele polo tem mais de 1 localidade) — não é
// um hardcode "se polo === Aracaju"; qualquer polo futuro nessa situação
// ganha o mesmo comportamento automaticamente.
function equipesPoloTemMunicipiosAgrupados(polo) {
  const porMunicipio = {};
  equipesCacheLocalidades.filter(l => l.polo === polo).forEach(l => {
    porMunicipio[l.municipio] = (porMunicipio[l.municipio] || 0) + 1;
  });
  return Object.values(porMunicipio).some(qtd => qtd > 1);
}

function equipesAtualizarCampoMunicipio() {
  const polo = document.getElementById("equipes_form_polo").value.trim();
  const campo = document.getElementById("equipes_campo_municipio");
  const select = document.getElementById("equipes_form_municipio");
  const mostrar = Boolean(polo) && equipesPoloTemMunicipiosAgrupados(polo);
  campo.hidden = !mostrar;
  if (!mostrar) {
    select.value = "";
    return;
  }
  const municipios = equipesMunicipiosDoPolo(polo);
  const valorAtual = select.value;
  select.innerHTML = '<option value="">Todos os municípios do polo</option>';
  municipios.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    select.appendChild(opt);
  });
  if (municipios.includes(valorAtual)) select.value = valorAtual;
}

function equipesLocalidadesAoDigitar() {
  const polo = document.getElementById("equipes_form_polo").value.trim();
  const municipio = document.getElementById("equipes_form_municipio").value || null;
  const idsSelecionados = equipesLocalidadesSelecionadas.map(l => l.id);
  const disponiveis = polo
    ? equipesLocalidadesDoPoloMunicipio(polo, municipio).filter(l => !idsSelecionados.includes(l.id))
    : [];
  const texto = document.getElementById("equipes_localidades_busca").value;
  const filtrados = equipesFiltrarTexto(disponiveis, texto, equipesTextoBuscavelLocalidade);
  const el = document.getElementById("equipes_localidades_opcoes");
  el.innerHTML = "";

  if (!polo) {
    el.innerHTML = '<div class="equipes-multi-opcao-vazia">Informe o polo da equipe primeiro</div>';
    el.hidden = false;
    return;
  }
  if (filtrados.length === 0) {
    el.innerHTML = '<div class="equipes-multi-opcao-vazia">Nenhuma localidade encontrada no polo ' + equipesEscapar(polo) + '</div>';
    el.hidden = false;
    return;
  }

  filtrados.slice(0, 30).forEach(localidade => {
    const div = document.createElement("div");
    div.className = "equipes-multi-opcao";
    div.textContent = localidade.rotulo_exibicao + " — " + localidade.municipio;
    div.addEventListener("mousedown", e => {
      e.preventDefault();
      equipesLocalidadesSelecionadas = [...equipesLocalidadesSelecionadas, localidade];
      document.getElementById("equipes_localidades_busca").value = "";
      equipesRenderizarLocalidadesSelecionadas();
      equipesLocalidadesAoDigitar();
    });
    el.appendChild(div);
  });
  el.hidden = false;
}

function equipesRenderizarLocalidadesSelecionadas() {
  const cont = document.getElementById("equipes_localidades_chips");
  cont.innerHTML = "";

  equipesLocalidadesSelecionadas.forEach((localidade, indice) => {
    const chip = document.createElement("span");
    chip.className = "equipes-chip";
    chip.innerHTML = equipesEscapar(localidade.rotulo_exibicao) +
      (indice === 0 ? ' <span class="equipes-hint">(posição)</span>' : "") +
      '<button type="button" class="equipes-chip-remover" aria-label="Remover ' + equipesEscapar(localidade.rotulo_exibicao) + '">&times;</button>';
    chip.querySelector(".equipes-chip-remover").addEventListener("click", () => {
      const eraPosicao = indice === 0;
      equipesLocalidadesSelecionadas = equipesLocalidadesSelecionadas.filter(l => l.id !== localidade.id);
      equipesRenderizarLocalidadesSelecionadas();
      // Remover a 1ª localidade troca a posição para a próxima da lista —
      // nunca silenciosamente: avisa qual é a nova posição (item 9).
      if (eraPosicao && equipesLocalidadesSelecionadas.length > 0) {
        showToast("Posição atual passou a ser: " + equipesLocalidadesSelecionadas[0].rotulo_exibicao);
      }
    });
    cont.appendChild(chip);
  });

  document.getElementById("equipes_posicao_derivada_nome").textContent =
    equipesLocalidadesSelecionadas.length > 0
      ? equipesLocalidadesSelecionadas[0].rotulo_exibicao
      : "Sem posição definida";
}

/* ================= CURSOS ADICIONAIS (etapa 3, item 13) =================
   Catálogo compartilhado pelos dois modais (Adicionar Equipe e Alterar) —
   pertencem à IDENTIDADE da equipe, não à operação do dia (ver
   app/models/equipe.py::Curso). Multi-seleção com busca + chips, mesmo
   padrão de Localidades, com um extra: digitar um nome que não existe no
   catálogo oferece "➕ Criar curso" — é assim que o catálogo cresce sem
   precisar de migration nem de tela de administração separada. */

let equipesCacheCursos = [];

async function equipesCarregarCursosCache() {
  const r = await authChamarApi("/api/teams/cursos", { headers: equipesHeaders() });
  equipesCacheCursos = r.ok ? r.corpo : [];
}

async function equipesCriarCursoNovo(nome) {
  const r = await authChamarApi("/api/teams/cursos", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, equipesHeaders()),
    body: JSON.stringify({ nome }),
  });
  if (!r.ok) return null;
  equipesCacheCursos = [...equipesCacheCursos, r.corpo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return r.corpo;
}

// `obterSelecionados`/`definirSelecionados` são getters/setters da lista
// selecionada de CADA modal (fecho sobre o `let` correspondente) — o mesmo
// componente serve os dois formulários sem duplicar a lógica de busca.
function equipesConfigurarMultiCursos(buscaId, opcoesId, chipsId, obterSelecionados, definirSelecionados) {
  const buscaInput = document.getElementById(buscaId);

  function renderizarChips() {
    const cont = document.getElementById(chipsId);
    cont.innerHTML = "";
    obterSelecionados().forEach(curso => {
      const chip = document.createElement("span");
      chip.className = "equipes-chip";
      chip.innerHTML = equipesEscapar(curso.nome) +
        '<button type="button" class="equipes-chip-remover" aria-label="Remover ' + equipesEscapar(curso.nome) + '">&times;</button>';
      chip.querySelector(".equipes-chip-remover").addEventListener("click", () => {
        definirSelecionados(obterSelecionados().filter(c => c.id !== curso.id));
        renderizarChips();
      });
      cont.appendChild(chip);
    });
  }

  function aoDigitar() {
    const idsSelecionados = obterSelecionados().map(c => c.id);
    const disponiveis = equipesCacheCursos.filter(c => !idsSelecionados.includes(c.id));
    const texto = buscaInput.value.trim();
    const filtrados = equipesFiltrarTexto(disponiveis, texto, c => c.nome);
    const el = document.getElementById(opcoesId);
    el.innerHTML = "";

    const jaExisteExato = equipesCacheCursos.some(c => c.nome.toLowerCase() === texto.toLowerCase());
    if (texto && !jaExisteExato) {
      const criar = document.createElement("div");
      criar.className = "equipes-multi-opcao";
      criar.textContent = '➕ Criar curso "' + texto + '"';
      criar.addEventListener("mousedown", async e => {
        e.preventDefault();
        const novo = await equipesCriarCursoNovo(texto);
        if (!novo) {
          showToast("Não foi possível criar o curso");
          return;
        }
        definirSelecionados([...obterSelecionados(), novo]);
        buscaInput.value = "";
        renderizarChips();
        aoDigitar();
      });
      el.appendChild(criar);
    }

    if (filtrados.length === 0 && !texto && !jaExisteExato) {
      const vazio = document.createElement("div");
      vazio.className = "equipes-multi-opcao-vazia";
      vazio.textContent = "Nenhum curso cadastrado ainda — digite para criar um";
      el.appendChild(vazio);
    }

    filtrados.slice(0, 30).forEach(curso => {
      const div = document.createElement("div");
      div.className = "equipes-multi-opcao";
      div.textContent = curso.nome;
      div.addEventListener("mousedown", e => {
        e.preventDefault();
        definirSelecionados([...obterSelecionados(), curso]);
        buscaInput.value = "";
        renderizarChips();
        aoDigitar();
      });
      el.appendChild(div);
    });
    el.hidden = false;
  }

  buscaInput.addEventListener("focus", aoDigitar);
  buscaInput.addEventListener("input", aoDigitar);
  buscaInput.addEventListener("blur", () => { document.getElementById(opcoesId).hidden = true; });

  return { renderizarChips };
}

let equipesCursosSelecionados = [];
const _equipesMultiCursos = equipesConfigurarMultiCursos(
  "equipes_cursos_busca", "equipes_cursos_opcoes", "equipes_cursos_chips",
  () => equipesCursosSelecionados, lista => { equipesCursosSelecionados = lista; }
);

let equipesAlterarCursosSelecionados = [];
const _equipesMultiCursosAlterar = equipesConfigurarMultiCursos(
  "equipes_alterar_cursos_busca", "equipes_alterar_cursos_opcoes", "equipes_alterar_cursos_chips",
  () => equipesAlterarCursosSelecionados, lista => { equipesAlterarCursosSelecionados = lista; }
);

const _equipesCascataAlterarPosicao = equipesConfigurarCascataPosicao("equipes_alterar_posicao", localidade => {
  equipesAlterarPosicaoSelecionada = localidade;
  equipesRenderizarChipPosicao("equipes_alterar_posicao_chip", localidade, () => {
    equipesAlterarPosicaoSelecionada = null;
    equipesRenderizarChipPosicao("equipes_alterar_posicao_chip", null, () => {});
    equipesRenderizarChipsAreasAlterar();
  });
  if (!equipesAlterarAreasSelecionadas.some(l => l.id === localidade.id)) {
    equipesAlterarAreasSelecionadas = [...equipesAlterarAreasSelecionadas, localidade];
  }
  equipesRenderizarChipsAreasAlterar();
  equipesAtualizarDisponibilidadeAreasAlterar();
});

/* ================= ALTERAR POSIÇÃO: áreas de atuação (multi-seleção com chips) ================= */

function equipesAtualizarDisponibilidadeAreasAlterar() {
  const busca = document.getElementById("equipes_alterar_areas_busca");
  busca.disabled = !document.getElementById("equipes_alterar_posicao_polo").value;
}

function equipesRenderizarChipsAreas(chipsElId, selecionadas, posicaoAtual, onRemover) {
  const cont = document.getElementById(chipsElId);
  cont.innerHTML = "";
  selecionadas.forEach(localidade => {
    const ehPosicao = posicaoAtual && localidade.id === posicaoAtual.id;
    const chip = document.createElement("span");
    chip.className = "equipes-chip";
    chip.innerHTML = equipesEscapar(localidade.rotulo_exibicao) +
      (ehPosicao ? ' <span class="equipes-hint">(posição)</span>' : "") +
      (ehPosicao ? "" : '<button type="button" class="equipes-chip-remover" aria-label="Remover">&times;</button>');
    if (!ehPosicao) {
      chip.querySelector(".equipes-chip-remover").addEventListener("click", () => onRemover(localidade));
    }
    cont.appendChild(chip);
  });
}

function equipesConfigurarBuscaAreas(prefixoPolo, buscaId, opcoesId, obterSelecionadas, definirSelecionadas, renderizar) {
  const buscaInput = document.getElementById(buscaId);
  function aoDigitar() {
    const polo = document.getElementById(prefixoPolo).value;
    if (!polo) return;
    const idsSelecionados = obterSelecionadas().map(l => l.id);
    const disponiveis = equipesLocalidadesDoPoloMunicipio(polo, null).filter(l => !idsSelecionados.includes(l.id));
    const filtrados = equipesFiltrarTexto(disponiveis, buscaInput.value, equipesTextoBuscavelLocalidade);
    const el = document.getElementById(opcoesId);
    el.innerHTML = "";
    if (filtrados.length === 0) {
      el.innerHTML = '<div class="equipes-multi-opcao-vazia">Nenhuma localidade disponível</div>';
      el.hidden = false;
      return;
    }
    filtrados.slice(0, 30).forEach(localidade => {
      const div = document.createElement("div");
      div.className = "equipes-multi-opcao";
      div.textContent = localidade.rotulo_exibicao + " — " + localidade.municipio;
      div.addEventListener("mousedown", e => {
        e.preventDefault();
        definirSelecionadas([...obterSelecionadas(), localidade]);
        buscaInput.value = "";
        renderizar();
        aoDigitar();
      });
      el.appendChild(div);
    });
    el.hidden = false;
  }
  buscaInput.addEventListener("focus", aoDigitar);
  buscaInput.addEventListener("input", aoDigitar);
  buscaInput.addEventListener("blur", () => { document.getElementById(opcoesId).hidden = true; });
}

equipesConfigurarBuscaAreas(
  "equipes_alterar_posicao_polo", "equipes_alterar_areas_busca", "equipes_alterar_areas_opcoes",
  () => equipesAlterarAreasSelecionadas,
  lista => { equipesAlterarAreasSelecionadas = lista; },
  () => equipesRenderizarChipsAreasAlterar()
);

function equipesRenderizarChipsAreasAlterar() {
  equipesRenderizarChipsAreas(
    "equipes_alterar_areas_chips", equipesAlterarAreasSelecionadas, equipesAlterarPosicaoSelecionada,
    localidade => {
      equipesAlterarAreasSelecionadas = equipesAlterarAreasSelecionadas.filter(l => l.id !== localidade.id);
      equipesRenderizarChipsAreasAlterar();
    }
  );
}

/* ================= ALTERAR: OPERADORES (multi-seleção com busca + chips) =================
   Operadores saíram do cadastro rápido (linha só pede equipe/telefone/
   localidade/horário — ver equipesSalvar), mas continuam vinculáveis pelo
   modal avançado, mesmo padrão de busca+chips que já existia no cadastro
   antes da linha rápida (equipesRotuloOperador/aoDigitar reaproveitados,
   só apontando pros ids "_alterar_" e para
   equipesAlterarOperadoresSelecionados em vez do estado do cadastro). */

function equipesRotuloOperador(operador) {
  return operador.matricula ? operador.nome + " (" + operador.matricula + ")" : operador.nome;
}

function equipesRenderizarChipsAlterarOperadores() {
  const cont = document.getElementById("equipes_alterar_operadores_chips");
  cont.innerHTML = "";
  equipesAlterarOperadoresSelecionados.forEach(operador => {
    const chip = document.createElement("span");
    chip.className = "equipes-chip";
    chip.innerHTML = equipesEscapar(operador.nome) +
      '<button type="button" class="equipes-chip-remover" aria-label="Remover ' + equipesEscapar(operador.nome) + '">&times;</button>';
    chip.querySelector(".equipes-chip-remover").addEventListener("click", () => {
      equipesAlterarOperadoresSelecionados = equipesAlterarOperadoresSelecionados.filter(o => o.id !== operador.id);
      equipesRenderizarChipsAlterarOperadores();
    });
    cont.appendChild(chip);
  });
}

function equipesAlterarOperadoresAoDigitar() {
  const texto = document.getElementById("equipes_alterar_operadores_busca").value;
  const idsSelecionados = equipesAlterarOperadoresSelecionados.map(o => o.id);
  const disponiveis = equipesCacheOperadores.filter(o => !idsSelecionados.includes(o.id));
  const filtrados = equipesFiltrarTexto(disponiveis, texto, equipesRotuloOperador);
  const el = document.getElementById("equipes_alterar_operadores_opcoes");
  el.innerHTML = "";

  if (filtrados.length === 0) {
    el.innerHTML = '<div class="equipes-multi-opcao-vazia">Nenhum operador disponível</div>';
    el.hidden = false;
    return;
  }

  filtrados.slice(0, 30).forEach(operador => {
    const div = document.createElement("div");
    div.className = "equipes-multi-opcao";
    div.textContent = equipesRotuloOperador(operador);
    div.addEventListener("mousedown", e => {
      e.preventDefault();
      equipesAlterarOperadoresSelecionados.push(operador);
      document.getElementById("equipes_alterar_operadores_busca").value = "";
      equipesRenderizarChipsAlterarOperadores();
      equipesAlterarOperadoresAoDigitar();
    });
    el.appendChild(div);
  });
  el.hidden = false;
}

/* ================= HORÁRIO: OPÇÕES PRONTAS EM UM CLIQUE ================= */

function equipesSelecionarHorarioPreset(botao) {
  document.querySelectorAll("#equipes_horario_presets .equipes-horario-btn").forEach(b => {
    b.classList.remove("equipes-horario-ativo");
  });
  botao.classList.add("equipes-horario-ativo");

  if (botao.dataset.outro) {
    document.getElementById("equipes_horario_manual").hidden = false;
    document.getElementById("equipes_form_hora_inicio").value = "";
    document.getElementById("equipes_form_hora_fim").value = "";
    document.getElementById("equipes_form_hora_inicio").focus();
    equipesAtualizarDuracao();
    return;
  }

  document.getElementById("equipes_horario_manual").hidden = true;
  document.getElementById("equipes_form_hora_inicio").value = botao.dataset.inicio;
  document.getElementById("equipes_form_hora_fim").value = botao.dataset.fim;
  equipesAtualizarDuracao();
}

/* ================= SUB-NAVEGAÇÃO [ EQUIPES ] [ MAPA OPERACIONAL ] ================= */

function equipesAlternarSubaba(aba) {
  const ehMapa = aba === "mapa";
  document.getElementById("equipes_subnav_lista").classList.toggle("equipes-subnav-ativo", !ehMapa);
  document.getElementById("equipes_subnav_mapa").classList.toggle("equipes-subnav-ativo", ehMapa);
  document.getElementById("equipes_subnav_lista").setAttribute("aria-selected", String(!ehMapa));
  document.getElementById("equipes_subnav_mapa").setAttribute("aria-selected", String(ehMapa));
  document.getElementById("equipes_painel_lista").hidden = ehMapa;
  document.getElementById("equipes_painel_mapa").hidden = !ehMapa;
  if (ehMapa && typeof mapaAoAbrir === "function") {
    const operacoesParaMapa = equipesListaFiltradaPorBusca().linhas.map(l => l.operacao);
    mapaAoAbrir(operacoesParaMapa, equipesCacheLocalidades, document.getElementById("equipes_filtro_polo").value);
  }
}

/* ================= LISTA DE OPERAÇÕES (tabela + mapa, mesma fonte) ================= */

function equipesFormatarHora(horaIso) {
  return horaIso ? horaIso.slice(0, 5) : "";
}

function equipesUsuarioPodeExcluir() {
  // Mesmo padrão de js/admin.js (adminAtualizarMenu) — exclusão exige
  // SUPERVISOR ou ADMINISTRADOR, nunca um OPERADOR comum (regra do backend,
  // ver app/routers/equipes.py::excluir_operacao_do_dia).
  const sessao = authObterSessao();
  const perfis = (sessao && sessao.usuario && sessao.usuario.perfis) || [];
  return perfis.includes("SUPERVISOR") || perfis.includes("ADMINISTRADOR");
}

// Tooltip nativo (title) da linha — carrega tudo que NÃO cabe na linha
// única compacta (item 10): horário, áreas de atuação, operadores,
// município/polo completos e observação. "Visualizar informações
// operacionais" sem inflar a linha nem precisar de mais um clique.
const EQUIPES_RADIO_LABEL = { FUNCIONANDO: "🟢 Funcionando", NAO_FUNCIONANDO: "🔴 Não funcionando" };

function equipesTituloLinha(operacao) {
  const statusInfo = EQUIPES_STATUS[operacao.status] || { emoji: "⚪", label: operacao.status };
  const linhas = [
    "Status: " + statusInfo.label + (operacao.turno_encerrado ? " — TURNO ENCERRADO" : ""),
    "Horário: " + equipesFormatarHora(operacao.hora_inicio) + "–" + equipesFormatarHora(operacao.hora_fim),
    "Polo: " + (operacao.polo || "-"),
    "Município: " + (operacao.posicao ? operacao.posicao.municipio : "-"),
    // (campo || []) em cada .map abaixo — nunca confiar que a API sempre
    // manda o array: um contrato de resposta incompleto (deploy parcial,
    // servidor desatualizado, campo novo ainda não implantado) não pode
    // derrubar a renderização inteira da lista/mapa por causa de UM card;
    // mesmo padrão já usado para `localidade.aliases` (ver equipesFiltrarTexto
    // usages / mapaResolverGeometriaLocalidade).
    "Áreas de atuação: " + ((operacao.areas_atuacao || []).map(a => a.rotulo_exibicao).join(", ") || "-"),
    "Operadores: " + ((operacao.operadores || []).map(o => o.nome).join(", ") || "-"),
    "Viatura: " + (operacao.viatura_numero || "-"),
    "Rádio: " + (EQUIPES_RADIO_LABEL[operacao.radio_status] || "-"),
    "Cursos: " + ((operacao.cursos || []).map(c => c.nome).join(", ") || "-"),
  ];
  if (operacao.observacao) linhas.push("Observação: " + operacao.observacao);
  return linhas.join("\n");
}

// Representação compacta de status (item 11, etapa 3): o painel de
// despacho precisa só de "posso mandar essa equipe pra algo novo agora?" —
// 🟢 só quando DISPONIVEL, 🔴 pra qualquer outro estado (em deslocamento,
// em atendimento, no local, indisponível ou turno encerrado). NÃO apaga os
// estados internos — EQUIPES_STATUS continua completo e o rótulo exato
// aparece no tooltip (equipesTituloLinha) e na "sem geo"/mapa (js/mapa.js,
// inalterado); isto é só a bolinha da linha principal.
function equipesStatusCompacto(operacao) {
  if (operacao.turno_encerrado) return { emoji: "🔴", classe: "equipe-linha-status-encerrado" };
  if (operacao.status === "DISPONIVEL") return { emoji: "🟢", classe: "" };
  return { emoji: "🔴", classe: "" };
}

/* ================= CADASTRO RÁPIDO EM LINHA (Central Operacional) =================
   Cada linha de um bloco é EQUIPE | TELEFONE | LOCALIDADE | HORÁRIO,
   editável no clique (sem modal) quando o dia filtrado é hoje. Duplo clique
   sobre a EQUIPE abre o cadastro avançado já existente (equipesAbrirModalAlterar,
   mesmo modal/mesmo PATCH — nunca um segundo formulário). Dias anteriores
   (histórico) continuam somente leitura, mesma regra de antes. */

let _equipesContadorLinhaId = 0;
function _equipesProximoId(prefixo) {
  _equipesContadorLinhaId += 1;
  return prefixo + "_" + _equipesContadorLinhaId;
}

// .equipes-grupo-lista tem overflow-y:auto (rolagem por bloco, ver
// css/equipes.css) — um dropdown position:absolute dentro dela fica
// CORTADO assim que o menu abre além da borda visível da rolagem (bug real
// visto ao testar: a lista de sugestões de equipe/localidade praticamente
// não aparecia). position:fixed com coordenadas calculadas a partir do
// input escapa desse recorte (não precisa mudar o CSS — style inline sempre
// tem prioridade sobre a regra position:absolute da folha de estilos).
function equipesPosicionarDropdownFixo(inputEl, opcoesEl) {
  const rect = inputEl.getBoundingClientRect();
  opcoesEl.style.position = "fixed";
  opcoesEl.style.left = rect.left + "px";
  opcoesEl.style.top = (rect.bottom + 2) + "px";
  opcoesEl.style.width = Math.max(rect.width, 160) + "px";
  opcoesEl.style.right = "auto";
  opcoesEl.style.marginTop = "0";
}

// Só equipes do CATÁLOGO (equipesCacheEquipes) que:
//   1) classificam para o MESMO bloco da linha atual — reusa
//      equipesClassificarLinha, a mesma fonte de verdade que decide em que
//      bloco a linha aparece na renderização (nunca uma segunda regra);
//   2) ainda não têm operação hoje (equipesUltimaListaOperacoes) — uma
//      equipe já usada hoje não pode ser sugerida de novo, proteção contra
//      duplicidade já existente, agora também no autocomplete.
// `chaveDoBloco` é a MESMA chave usada pra escalar/agrupar o bloco
// (ex.: "ARACAJU_NORTE", "GLOBAL_CR", "POLO_Itabaiana") — ver
// equipesRenderizarGrupo/equipesAgruparLinhas.
function equipesCandidatosDoBloco(chaveDoBloco) {
  const identificadoresHoje = new Set(equipesUltimaListaOperacoes.map(op => op.identificador.toUpperCase()));
  return equipesCacheEquipes.filter(equipe => {
    if (identificadoresHoje.has(equipe.identificador.toUpperCase())) return false;
    return equipesClassificarLinha(equipe).chave === chaveDoBloco;
  });
}

// Combo de EQUIPE de uma linha em rascunho (ainda sem operacao_id) —
// reaproveita equipesRenderizarComboOpcoes (mesmo componente do modal
// "Adicionar Equipe") dando um id gerado ao invés de um id fixo do HTML,
// já que pode haver várias linhas em rascunho abertas ao mesmo tempo.
function equipesConstruirEquipeControles(chaveDoBloco, aoConfirmar) {
  const wrap = document.createElement("div");
  wrap.className = "equipe-linha-equipe-combo equipes-combo";
  const idOpcoes = _equipesProximoId("equipes_draft_equipe_opcoes");

  const input = document.createElement("input");
  input.type = "text";
  input.className = "equipe-linha-input equipe-linha-equipe-input";
  input.autocomplete = "off";
  input.placeholder = "Equipe (ex: ARJ-PS01)";

  const opcoes = document.createElement("div");
  opcoes.className = "equipes-combo-opcoes";
  opcoes.id = idOpcoes;
  opcoes.hidden = true;

  wrap.appendChild(input);
  wrap.appendChild(opcoes);

  function abrir() {
    const candidatos = equipesCandidatosDoBloco(chaveDoBloco);
    const filtrados = equipesFiltrarTexto(candidatos, input.value, e => e.identificador);
    const mensagemVazia = input.value.trim()
      ? "Nenhuma equipe encontrada — confirme para cadastrar \"" + input.value.trim().toUpperCase() + "\""
      : (candidatos.length === 0 ? "Nenhuma equipe disponível neste bloco." : "Digite para buscar ou cadastrar uma equipe");
    equipesRenderizarComboOpcoes(
      idOpcoes, filtrados, e => e.identificador, e => e.polo || "",
      mensagemVazia,
      equipe => {
        input.value = equipe.identificador;
        aoConfirmar(equipe.identificador);
      }
    );
    equipesPosicionarDropdownFixo(input, opcoes);
  }

  input.addEventListener("focus", abrir);
  input.addEventListener("input", abrir);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
  });
  input.addEventListener("blur", () => {
    setTimeout(() => { opcoes.hidden = true; }, 0);
    const valor = input.value.trim().toUpperCase();
    if (valor) aoConfirmar(valor);
  });

  return { wrap, input };
}

// Combo de LOCALIDADE (posição) de uma linha — igual ao anterior, reaproveita
// equipesRenderizarComboOpcoes. `obterPolo` é uma função (não um valor fixo)
// porque numa linha em rascunho o polo só é conhecido depois que a equipe é
// escolhida/confirmada (ver equipesConstruirLinha).
function equipesConstruirLocalidadeControles(obterPolo, aoMudar) {
  const wrap = document.createElement("div");
  wrap.className = "equipe-linha-local-combo equipes-combo";
  const idOpcoes = _equipesProximoId("equipes_linha_local_opcoes");

  const input = document.createElement("input");
  input.type = "text";
  input.className = "equipe-linha-input equipe-linha-local-input";
  input.autocomplete = "off";
  input.placeholder = "Localidade";

  const opcoes = document.createElement("div");
  opcoes.className = "equipes-combo-opcoes";
  opcoes.id = idOpcoes;
  opcoes.hidden = true;

  wrap.appendChild(input);
  wrap.appendChild(opcoes);

  let selecionada = null;

  function abrir() {
    const polo = obterPolo();
    if (!polo) {
      equipesRenderizarComboOpcoes(idOpcoes, [], null, null, "Escolha a equipe primeiro", () => {});
      equipesPosicionarDropdownFixo(input, opcoes);
      return;
    }
    const disponiveis = equipesLocalidadesDoPoloMunicipio(polo, null);
    const filtrados = equipesFiltrarTexto(disponiveis, input.value, equipesTextoBuscavelLocalidade);
    equipesRenderizarComboOpcoes(
      idOpcoes, filtrados, l => l.rotulo_exibicao, l => l.municipio,
      "Nenhuma localidade encontrada",
      localidade => {
        selecionada = localidade;
        input.value = localidade.rotulo_exibicao;
        aoMudar(localidade);
      }
    );
    equipesPosicionarDropdownFixo(input, opcoes);
  }

  input.addEventListener("focus", abrir);
  input.addEventListener("input", () => {
    if (selecionada && input.value !== selecionada.rotulo_exibicao) selecionada = null;
    abrir();
  });
  input.addEventListener("blur", () => {
    setTimeout(() => { opcoes.hidden = true; }, 0);
    if (!input.value.trim() && selecionada) {
      selecionada = null;
      aoMudar(null);
    }
  });

  return {
    wrap, input,
    definir: localidade => { selecionada = localidade; input.value = localidade ? localidade.rotulo_exibicao : ""; },
  };
}

// POST /operations "cru" — get-or-create de identidade continua sendo
// responsabilidade do backend (ver docstring de app/routers/equipes.py); a
// checagem de "já existe operação hoje pra essa equipe" é feita ANTES de
// chamar esta função, em equipesLinhaTentarCriar (evita depender do 409 como
// caminho principal).
async function equipesRowCriarOperacao(estado) {
  const r = await authChamarApi("/api/teams/operations", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, equipesHeaders()),
    body: JSON.stringify({
      polo: estado.polo || null,
      identificador: estado.identificador,
      hora_inicio: estado.horario.inicio,
      hora_fim: estado.horario.fim,
      telefone: estado.telefone || null,
      posicao_localidade_id: estado.localidade ? estado.localidade.id : null,
      areas_atuacao_localidade_ids: estado.localidade ? [estado.localidade.id] : [],
      operador_ids: [],
      curso_ids: [],
      status: "DISPONIVEL",
      observacao: null,
    }),
  });
  if (!r.ok) {
    showToast(equipesExtrairMensagemErro(r.corpo) || "Não foi possível cadastrar a equipe.");
    return null;
  }
  equipesListasCarregadas = false; // uma identidade de equipe nova pode ter sido criada agora
  await equipesCarregarEquipesCache();
  equipesListasCarregadas = true;
  return r.corpo;
}

// PATCH de UM campo da linha (telefone/localidade/horário) — "Nenhuma
// alteração detectada" (reenviar o mesmo valor, ex.: reabrir e sair do campo
// sem digitar nada nele) não é erro, é tratado como sucesso silencioso.
async function equipesRowAtualizarCampo(operacaoId, corpoParcial) {
  const r = await authChamarApi("/api/teams/operations/" + operacaoId, {
    method: "PATCH",
    headers: Object.assign({ "Content-Type": "application/json" }, equipesHeaders()),
    body: JSON.stringify(corpoParcial),
  });
  if (r.ok) return true;
  const mensagem = equipesExtrairMensagemErro(r.corpo);
  if (mensagem === "Nenhuma alteração detectada") return true;
  showToast(mensagem || "Não foi possível salvar a alteração.");
  return false;
}

// Chamada por QUALQUER campo de uma linha em rascunho quando muda — só age
// quando os 2 campos obrigatórios do backend (equipe + horário) já estão
// preenchidos; até lá, só guarda o que foi digitado em `estado` e espera.
// Evita duplicidade (item G da análise): se já existe uma operação hoje com
// esse identificador, NUNCA tenta criar de novo — descarta o rascunho e
// mostra a linha já existente.
async function equipesLinhaTentarCriar(estado, linhaEl) {
  if (linhaEl.dataset.operacaoId) return; // já virou uma operação real, nada a fazer aqui
  if (!estado.identificador || !estado.horario) return;

  const existente = equipesUltimaListaOperacoes.find(
    o => o.identificador.toUpperCase() === estado.identificador.toUpperCase()
  );
  if (existente) {
    showToast(estado.identificador.toUpperCase() + " já tem uma operação hoje — mostrando a existente.");
    equipesRenderizarListaEMapa();
    return;
  }

  const nova = await equipesRowCriarOperacao(estado);
  if (!nova) return;

  equipesUltimaListaOperacoes = [...equipesUltimaListaOperacoes, nova];
  linhaEl.dataset.operacaoId = nova.id;
  linhaEl.classList.remove("equipe-linha-rascunho");
  linhaEl.title = equipesTituloLinha(nova);

  // Rascunho novo (via + Adicionar equipe) tinha um COMBO de equipe -> vira
  // label agora. Linha de identidade já conhecida (roster, sem operação
  // ainda) já nasceu com label fixo (equipesConstruirLinha) — só falta
  // ligar o duplo clique, que não existia até a operação existir de fato.
  const comboEquipe = linhaEl.querySelector(".equipe-linha-equipe-combo");
  let idEl;
  if (comboEquipe) {
    idEl = document.createElement("span");
    idEl.className = "equipe-linha-id";
    idEl.textContent = nova.identificador;
    comboEquipe.replaceWith(idEl);
  } else {
    idEl = linhaEl.querySelector(".equipe-linha-id");
  }
  if (idEl) {
    idEl.title = "Duplo clique para o cadastro avançado";
    idEl.addEventListener("dblclick", () => equipesAbrirModalAlterar(nova.id));
  }

  // Status também precisa deixar de ser ⚪ "sem operação hoje" e passar a
  // refletir o status real (DISPONIVEL) assim que a operação nasce.
  const statusEl = linhaEl.querySelector(".equipe-linha-status");
  if (statusEl) {
    const statusCompacto = equipesStatusCompacto(nova);
    const statusInfo = EQUIPES_STATUS[nova.status] || { emoji: "⚪", label: nova.status };
    statusEl.className = "equipe-linha-status " + statusCompacto.classe;
    statusEl.title = statusInfo.label;
    statusEl.textContent = statusCompacto.emoji;
  }

  if (equipesUsuarioPodeExcluir()) {
    const acoes = linhaEl.querySelector(".equipe-linha-acoes");
    if (acoes && !acoes.querySelector(".equipes-btn-excluir")) {
      const btnExcluir = document.createElement("button");
      btnExcluir.type = "button";
      btnExcluir.className = "equipe-linha-btn-icone equipe-linha-btn-icone-perigo equipes-btn-excluir";
      btnExcluir.title = "Excluir";
      btnExcluir.setAttribute("aria-label", "Excluir");
      btnExcluir.dataset.operacaoId = nova.id;
      btnExcluir.dataset.identificador = nova.identificador;
      btnExcluir.textContent = "🗑";
      acoes.appendChild(btnExcluir);
    }
  }

  // O morph em cima é de propósito (evita recarregar a grade inteira e
  // roubar o foco de quem está digitando) — mas o cabeçalho do bloco
  // (contagem) e a mensagem "Nenhuma equipe neste bloco ainda." foram
  // montados uma vez, no render inicial do bloco vazio, e não se atualizam
  // sozinhos: sem isto, a linha aparece mas o bloco continua dizendo
  // "0"/"nenhuma equipe" ao lado dela.
  const bloco = linhaEl.closest(".equipes-grupo");
  if (bloco) {
    const contagem = bloco.querySelector(".equipes-grupo-contagem");
    if (contagem) contagem.textContent = String(Number(contagem.textContent || "0") + 1);
    const vazioMsg = bloco.querySelector(".equipes-grupo-vazio");
    if (vazioMsg) vazioMsg.remove();
  }

  showToast(nova.identificador + " cadastrada.");
}

// Histórico (dia != hoje) continua 100% somente leitura — mesma marcação
// visual de antes da etapa "central operacional de cadastro rápido".
function equipesConstruirLinhaSomenteLeitura(operacao) {
  const encerrado = operacao.turno_encerrado;
  const statusInfo = EQUIPES_STATUS[operacao.status] || { emoji: "⚪", label: operacao.status };
  const statusCompacto = equipesStatusCompacto(operacao);

  const linha = document.createElement("div");
  linha.className = "equipe-linha equipe-linha-leitura" + (encerrado ? " equipe-linha-encerrado" : "");
  linha.title = equipesTituloLinha(operacao);

  linha.innerHTML =
    '<span class="equipe-linha-status ' + statusCompacto.classe + '" title="' +
      equipesEscapar(statusInfo.label + (encerrado ? " — TURNO ENCERRADO" : "")) + '">' + statusCompacto.emoji + "</span>" +
    '<span class="equipe-linha-id">' + equipesEscapar(operacao.identificador) + "</span>" +
    (operacao.telefone
      ? '<span class="equipe-linha-tel">☎ ' + equipesEscapar(operacao.telefone) + "</span>"
      : '<span class="equipe-linha-tel equipe-linha-vazia">☎ —</span>') +
    (operacao.posicao
      ? '<span class="equipe-linha-local">📍 ' + equipesEscapar(operacao.posicao.rotulo_exibicao) + "</span>"
      : '<span class="equipe-linha-local equipe-linha-vazia">📍 Sem posição</span>') +
    '<span class="equipe-linha-local equipe-linha-vazia">' + equipesEscapar(equipesRotuloHorario(equipesFormatarHora(operacao.hora_inicio), equipesFormatarHora(operacao.hora_fim))) + "</span>" +
    '<span class="equipe-linha-acoes"></span>';
  return linha;
}

// Linha editável do cadastro rápido — TRÊS estados possíveis:
//   1) `operacao` presente: equipe já tem operação HOJE (ou é histórico
//      somente leitura, ver desvio logo abaixo) — igual etapa anterior.
//   2) `operacao` null + `identidadeFixa` presente: equipe já EXISTE no
//      catálogo (GET /teams/equipes) mas ainda sem operação hoje — é o
//      caso central desta etapa (roster pré-escalado). O identificador já
//      é conhecido (rótulo fixo, não um combo de busca); só falta
//      telefone/localidade/horário pra a operação de hoje nascer.
//   3) `operacao` e `identidadeFixa` ambos null: rascunho em branco (só
//      criado via "+ Adicionar equipe", pra uma equipe que ainda não
//      existe no catálogo) — combo de busca/criação, igual etapa anterior.
// `poloPadrao` é o polo usado pra buscar localidades ANTES de a operação
// existir (o filtro Polo já selecionado no topo, ver item 12); no estado 3,
// se o operador escolher uma equipe já existente com outro polo cadastrado,
// `estado.polo` é atualizado e a busca de localidade passa a usar esse.
// `chaveDoBloco` (estado 3) é a chave do bloco em que esta linha está sendo
// desenhada — usada só pra filtrar o autocomplete de equipe pra esse mesmo
// bloco (ver equipesCandidatosDoBloco); não afeta nada mais.
function equipesConstruirLinha(operacao, identidadeFixa, poloPadrao, chaveDoBloco) {
  if (operacao && !equipesFiltroDiaEhHoje()) return equipesConstruirLinhaSomenteLeitura(operacao);

  const estado = {
    identificador: operacao ? operacao.identificador : (identidadeFixa ? identidadeFixa.identificador : ""),
    polo: operacao ? operacao.polo : (identidadeFixa ? identidadeFixa.polo : poloPadrao),
    telefone: operacao ? operacao.telefone : "",
    localidade: operacao ? operacao.posicao : null,
    horario: operacao ? { inicio: equipesFormatarHora(operacao.hora_inicio), fim: equipesFormatarHora(operacao.hora_fim) } : null,
  };

  const linha = document.createElement("div");
  const ehRascunhoNovo = !operacao && !identidadeFixa;
  linha.className = "equipe-linha" + (ehRascunhoNovo ? " equipe-linha-rascunho" : "") +
    (operacao && operacao.turno_encerrado ? " equipe-linha-encerrado" : "");
  if (operacao) {
    linha.dataset.operacaoId = operacao.id;
    linha.title = equipesTituloLinha(operacao);
  }

  // --- status ---
  const statusEl = document.createElement("span");
  statusEl.className = "equipe-linha-status";
  if (operacao) {
    const statusCompacto = equipesStatusCompacto(operacao);
    const statusInfo = EQUIPES_STATUS[operacao.status] || { emoji: "⚪", label: operacao.status };
    statusEl.classList.add(...statusCompacto.classe.split(" ").filter(Boolean));
    statusEl.title = statusInfo.label + (operacao.turno_encerrado ? " — TURNO ENCERRADO" : "");
    statusEl.textContent = statusCompacto.emoji;
  } else {
    statusEl.textContent = "⚪";
    statusEl.title = "Sem operação registrada hoje";
  }
  linha.appendChild(statusEl);

  // --- equipe: rótulo fixo (operação real OU identidade já conhecida —
  // duplo clique só funciona quando já existe operação) ou combo de
  // busca/criação (rascunho totalmente novo) ---
  if (operacao || identidadeFixa) {
    const idEl = document.createElement("span");
    idEl.className = "equipe-linha-id";
    idEl.textContent = estado.identificador;
    if (operacao) {
      idEl.title = "Duplo clique para o cadastro avançado";
      idEl.addEventListener("dblclick", () => equipesAbrirModalAlterar(operacao.id));
    } else {
      idEl.title = "Preencha telefone, localidade ou horário para iniciar a operação de hoje";
    }
    linha.appendChild(idEl);
  } else {
    const equipeControles = equipesConstruirEquipeControles(chaveDoBloco, identificador => {
      estado.identificador = identificador;
      const equipeCache = equipesCacheEquipes.find(e => e.identificador === identificador);
      if (equipeCache && equipeCache.polo) estado.polo = equipeCache.polo;
      equipesLinhaTentarCriar(estado, linha);
    });
    linha.appendChild(equipeControles.wrap);
  }

  // --- telefone ---
  const telefoneInput = document.createElement("input");
  telefoneInput.type = "text";
  telefoneInput.className = "equipe-linha-input equipe-linha-tel-input";
  telefoneInput.placeholder = "Telefone";
  telefoneInput.value = estado.telefone || "";
  telefoneInput.addEventListener("blur", () => {
    const valor = telefoneInput.value.trim();
    if (valor === (estado.telefone || "")) return;
    estado.telefone = valor;
    if (linha.dataset.operacaoId) {
      equipesRowAtualizarCampo(linha.dataset.operacaoId, { telefone: valor || null })
        .then(ok => { if (ok) equipesCarregarOperacoes(); });
    } else {
      equipesLinhaTentarCriar(estado, linha);
    }
  });
  linha.appendChild(telefoneInput);

  // --- localidade ---
  const localidadeControles = equipesConstruirLocalidadeControles(() => estado.polo, localidade => {
    estado.localidade = localidade;
    if (linha.dataset.operacaoId) {
      equipesRowAtualizarCampo(linha.dataset.operacaoId, {
        posicao_localidade_id: localidade ? localidade.id : null,
        areas_atuacao_localidade_ids: localidade ? [localidade.id] : [],
      }).then(ok => { if (ok) equipesCarregarOperacoes(); });
    } else {
      equipesLinhaTentarCriar(estado, linha);
    }
  });
  if (estado.localidade) localidadeControles.definir(estado.localidade);
  linha.appendChild(localidadeControles.wrap);

  // --- horário ---
  const horarioControles = equipesConstruirHorarioControles();
  if (estado.horario) equipesPreencherHorarioControles(horarioControles, estado.horario.inicio, estado.horario.fim);
  function aoMudarHorario() {
    const lido = equipesLerHorarioControles(horarioControles);
    if (!lido) return;
    if (estado.horario && lido.inicio === estado.horario.inicio && lido.fim === estado.horario.fim) return;
    estado.horario = lido;
    if (linha.dataset.operacaoId) {
      equipesRowAtualizarCampo(linha.dataset.operacaoId, { hora_inicio: lido.inicio, hora_fim: lido.fim })
        .then(ok => { if (ok) equipesCarregarOperacoes(); });
    } else {
      equipesLinhaTentarCriar(estado, linha);
    }
  }
  horarioControles.select.addEventListener("change", aoMudarHorario);
  horarioControles.inputInicio.addEventListener("change", aoMudarHorario);
  horarioControles.inputFim.addEventListener("change", aoMudarHorario);
  linha.appendChild(horarioControles.wrap);

  // --- ações (excluir — só linha real, hoje, com permissão) ---
  const acoes = document.createElement("span");
  acoes.className = "equipe-linha-acoes";
  if (operacao && equipesUsuarioPodeExcluir()) {
    const btnExcluir = document.createElement("button");
    btnExcluir.type = "button";
    btnExcluir.className = "equipe-linha-btn-icone equipe-linha-btn-icone-perigo equipes-btn-excluir";
    btnExcluir.title = "Excluir";
    btnExcluir.setAttribute("aria-label", "Excluir");
    btnExcluir.dataset.operacaoId = operacao.id;
    btnExcluir.dataset.identificador = operacao.identificador;
    btnExcluir.textContent = "🗑";
    acoes.appendChild(btnExcluir);
  }
  linha.appendChild(acoes);

  return linha;
}

function equipesRenderizarGrupo(grupo, poloFiltro) {
  const bloco = document.createElement("div");
  bloco.className = "equipes-grupo";
  bloco.innerHTML =
    '<div class="equipes-grupo-cabecalho">' +
      '<span class="equipes-grupo-titulo">' + equipesEscapar(grupo.rotulo) + "</span>" +
      '<span class="equipes-grupo-contagem">' + grupo.itens.length + "</span>" +
    "</div>" +
    '<div class="equipes-grupo-lista"></div>';
  const lista = bloco.querySelector(".equipes-grupo-lista");

  const poloDoBloco = poloFiltro || (grupo.itens[0] && grupo.itens[0].polo) || "";
  grupo.itens.forEach(linha => lista.appendChild(equipesConstruirLinha(linha.operacao, null, poloDoBloco, grupo.chave)));

  if (grupo.itens.length === 0) {
    const vazioMsg = document.createElement("div");
    vazioMsg.className = "equipes-grupo-vazio";
    vazioMsg.textContent = "Nenhuma equipe neste bloco ainda.";
    lista.appendChild(vazioMsg);
  }

  if (equipesFiltroDiaEhHoje()) {
    const btnAdicionar = document.createElement("button");
    btnAdicionar.type = "button";
    btnAdicionar.className = "equipes-linha-add";
    btnAdicionar.textContent = "＋ Adicionar equipe";
    btnAdicionar.addEventListener("click", () => {
      const linha = equipesConstruirLinha(null, null, poloDoBloco, grupo.chave);
      lista.appendChild(linha);
      const inputEquipe = linha.querySelector(".equipe-linha-equipe-input");
      if (inputEquipe) inputEquipe.focus();
    });
    bloco.appendChild(btnAdicionar);
  }

  return bloco;
}

// Fonte das "linhas" exibidas — SEMPRE as operações reais de
// equipesUltimaListaOperacoes (ver comentário da etapa "operação diária"
// acima). Busca por texto é só de apresentação (client-side) — não refaz
// chamada à API.
function equipesListaFiltradaPorBusca() {
  const municipioFiltro = document.getElementById("equipes_filtro_municipio").value;
  const statusFiltro = document.getElementById("equipes_filtro_status").value;
  const texto = document.getElementById("equipes_filtro_busca").value.trim().toLowerCase();

  // Blocos vazios (título + contador 0 + "+ Adicionar equipe", ver
  // equipesRenderizarGrupo) só fazem sentido pra HOJE, sem filtro de
  // município/status ativo — uma busca mais estreita (ex.: "só quem está
  // em Barra dos Coqueiros agora") não deveria inflar a tela com blocos
  // sem nenhum resultado.
  const escalarBlocosVazios = equipesFiltroDiaEhHoje() && !municipioFiltro && !statusFiltro;

  let linhas = equipesUltimaListaOperacoes.map(op => ({ identificador: op.identificador, polo: op.polo, operacao: op }));

  if (texto) {
    linhas = linhas.filter(l => {
      const alvo = [
        l.identificador,
        l.polo,
        l.operacao.posicao ? l.operacao.posicao.rotulo_exibicao : "",
        l.operacao.posicao ? l.operacao.posicao.municipio : "",
      ].join(" | ").toLowerCase();
      return alvo.includes(texto);
    });
  }

  return { linhas, escalarBlocosVazios };
}

function equipesRenderizarListaEMapa() {
  const poloFiltro = document.getElementById("equipes_filtro_polo").value;
  const { linhas, escalarBlocosVazios } = equipesListaFiltradaPorBusca();

  const wrap = document.getElementById("equipes_grid_wrap");
  const grid = document.getElementById("equipes_grid");
  const vazio = document.getElementById("equipes_vazio");
  grid.innerHTML = "";

  // poloFiltro="" (Polo = "Todos") -> escala a UNIÃO dos blocos de todos os
  // polos configurados (poloParaEscalar = true), nunca `null` — passar
  // `null` aqui era o bug: pulava o escalonamento inteiro e caía no
  // "Nenhuma equipe encontrada" mesmo havendo blocos configurados.
  const grupos = equipesAgruparLinhas(linhas, escalarBlocosVazios ? (poloFiltro || true) : null);

  if (grupos.length === 0) {
    wrap.hidden = true;
    vazio.hidden = false;
  } else {
    vazio.hidden = true;
    wrap.hidden = false;
    grupos.forEach(grupo => grid.appendChild(equipesRenderizarGrupo(grupo, poloFiltro)));
  }

  equipesAtualizarVisibilidadeBotaoRecuperar();

  if (!document.getElementById("equipes_painel_mapa").hidden && typeof mapaAoAbrir === "function") {
    mapaAoAbrir(linhas.map(l => l.operacao), equipesCacheLocalidades, poloFiltro);
  }
}

// GERAÇÃO DA REQUISIÇÃO (causa raiz do "cadastro só aparece depois de F5" /
// "lista não reflete o cadastro do dia"): esta função é chamada de vários
// pontos independentes — troca de filtro, abrir o módulo, depois de um
// POST/PATCH/DELETE — e o fetch pode demorar de forma imprevisível (rede,
// tamanho da resposta). SEM controle de ordem, uma resposta ANTIGA que
// demorou mais pode chegar DEPOIS de uma resposta NOVA e sobrescrever
// `equipesUltimaListaOperacoes` com dado desatualizado — exatamente o
// sintoma relatado. `equipesGeracaoOperacoes` é um contador monotônico:
// cada chamada tira um número na entrada e só aplica sua resposta se
// nenhuma chamada mais nova começou entretanto (nenhum setTimeout, nenhum
// reload — só descarta a resposta obsoleta em silêncio, porque a chamada
// mais nova já vai renderizar o estado correto quando ela mesma resolver).
let equipesGeracaoOperacoes = 0;

async function equipesCarregarOperacoes() {
  equipesMostrarErro("equipes_erro", "");
  const params = new URLSearchParams();
  const polo = document.getElementById("equipes_filtro_polo").value;
  const municipio = document.getElementById("equipes_filtro_municipio").value;
  const statusFiltro = document.getElementById("equipes_filtro_status").value;
  const dia = document.getElementById("equipes_filtro_dia").value;
  if (polo) params.set("polo", polo);
  if (municipio) params.set("municipio", municipio);
  if (statusFiltro) params.set("status", statusFiltro);
  if (dia) params.set("data", dia);

  const minhaGeracao = ++equipesGeracaoOperacoes;
  const r = await authChamarApi("/api/teams/operations?" + params.toString(), {
    headers: equipesHeaders(),
  });
  if (minhaGeracao !== equipesGeracaoOperacoes) return; // resposta obsoleta — uma chamada mais nova já está em andamento

  if (!r.ok) {
    equipesMostrarErro("equipes_erro", equipesExtrairMensagemErro(r.corpo) || "Não foi possível carregar as equipes.");
    return;
  }

  equipesUltimaListaOperacoes = r.corpo;
  equipesAtualizarDataOperacao();
  equipesRenderizarListaEMapa();
}

/* ================= MODAL: ADICIONAR EQUIPE ================= */

async function equipesAbrirModal() {
  await equipesCarregarListasAuxiliares();

  document.getElementById("equipes_form_polo").value = document.getElementById("equipes_filtro_polo").value || "";
  document.getElementById("equipes_form_identificador").value = "";
  document.getElementById("equipes_equipe_opcoes").hidden = true;

  document.querySelectorAll("#equipes_horario_presets .equipes-horario-btn").forEach(b => {
    b.classList.remove("equipes-horario-ativo");
  });
  document.getElementById("equipes_horario_manual").hidden = true;
  document.getElementById("equipes_form_hora_inicio").value = "";
  document.getElementById("equipes_form_hora_fim").value = "";
  equipesAtualizarDuracao();

  document.getElementById("equipes_form_telefone").value = "";
  document.getElementById("equipes_form_viatura").value = "";
  document.getElementById("equipes_form_radio").value = "";

  document.getElementById("equipes_form_municipio").value = "";
  equipesAtualizarCampoMunicipio();

  equipesLocalidadesSelecionadas = [];
  equipesRenderizarLocalidadesSelecionadas();
  document.getElementById("equipes_localidades_busca").value = "";
  document.getElementById("equipes_localidades_opcoes").hidden = true;

  equipesCursosSelecionados = [];
  _equipesMultiCursos.renderizarChips();
  document.getElementById("equipes_cursos_busca").value = "";
  document.getElementById("equipes_cursos_opcoes").hidden = true;

  document.getElementById("equipes_form_status").value = "DISPONIVEL";
  document.getElementById("equipes_form_observacao").value = "";
  equipesMostrarErro("equipes_modal_erro", "");

  document.getElementById("equipes_modal_add").style.display = "flex";
}

function equipesFecharModal() {
  document.getElementById("equipes_modal_add").style.display = "none";
}

function equipesCalcularDuracaoMinutos(inicio, fim) {
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);
  let diferenca = (hf * 60 + mf) - (hi * 60 + mi);
  if (diferenca <= 0) diferenca += 24 * 60;
  return diferenca;
}

function equipesAtualizarDuracao() {
  const inicio = document.getElementById("equipes_form_hora_inicio").value;
  const fim = document.getElementById("equipes_form_hora_fim").value;
  const alvo = document.getElementById("equipes_form_duracao");

  if (!inicio || !fim) {
    alvo.textContent = "—";
    return;
  }

  const minutos = equipesCalcularDuracaoMinutos(inicio, fim);
  const horas = Math.floor(minutos / 60);
  const restoMinutos = minutos % 60;
  alvo.textContent = "Duração: " + horas + "h" + (restoMinutos ? restoMinutos + "min" : "");
}

async function equipesSalvar() {
  equipesMostrarErro("equipes_modal_erro", "");

  const polo = document.getElementById("equipes_form_polo").value.trim() || null;
  const identificador = document.getElementById("equipes_form_identificador").value.trim();
  const horaInicio = document.getElementById("equipes_form_hora_inicio").value;
  const horaFim = document.getElementById("equipes_form_hora_fim").value;
  const telefone = document.getElementById("equipes_form_telefone").value.trim();
  const viatura = document.getElementById("equipes_form_viatura").value.trim();
  const radioStatus = document.getElementById("equipes_form_radio").value;
  const statusForm = document.getElementById("equipes_form_status").value;
  const observacao = document.getElementById("equipes_form_observacao").value.trim() || null;

  // Cadastro rápido: só equipe + horário são obrigatórios. Telefone,
  // viatura, rádio, localidades/posição e cursos podem ficar em branco e
  // ser completados depois por outra pessoa. Operadores não fazem mais
  // parte deste formulário (etapa 3, item 12) — a equipe continua podendo
  // existir sem operador vinculado (regra que já existia antes,
  // preservada), só não dá mais pra escolher operadores aqui; envia
  // sempre lista vazia.
  if (!identificador || !horaInicio || !horaFim) {
    equipesMostrarErro("equipes_modal_erro", "Preencha ao menos a equipe e o horário.");
    return;
  }

  const r = await authChamarApi("/api/teams/operations", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, equipesHeaders()),
    body: JSON.stringify({
      polo,
      identificador,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      telefone: telefone || null,
      viatura_numero: viatura || null,
      radio_status: radioStatus || null,
      posicao_localidade_id: equipesLocalidadesSelecionadas.length > 0 ? equipesLocalidadesSelecionadas[0].id : null,
      areas_atuacao_localidade_ids: equipesLocalidadesSelecionadas.map(l => l.id),
      operador_ids: [],
      curso_ids: equipesCursosSelecionados.map(c => c.id),
      status: statusForm,
      observacao,
    }),
  });

  if (!r.ok) {
    equipesMostrarErro(
      "equipes_modal_erro",
      equipesExtrairMensagemErro(r.corpo) || "Não foi possível concluir o cadastro. Verifique os dados e tente novamente."
    );
    return;
  }

  equipesFecharModal();
  equipesListasCarregadas = false; // um polo/equipe novo pode ter sido criado agora
  await equipesCarregarPolos();
  await equipesCarregarEquipesCache();
  equipesListasCarregadas = true;
  await equipesCarregarOperacoes();
}

/* ================= MODAL: ALTERAR POSIÇÃO / ÁREAS / STATUS ================= */

function equipesAbrirModalAlterar(operacaoId) {
  const operacao = equipesUltimaListaOperacoes.find(o => o.id === operacaoId);
  if (!operacao) return;

  equipesAlterarOperacaoId = operacaoId;
  document.getElementById("equipes_alterar_titulo").textContent = "Editar Equipe — " + operacao.identificador;
  document.getElementById("equipes_alterar_subtitulo").textContent = operacao.posicao
    ? "Posição atual: " + operacao.posicao.rotulo_exibicao + " (" + operacao.posicao.municipio + ")"
    : "Posição atual: Sem posição definida";
  equipesMostrarErro("equipes_alterar_erro", "");

  document.getElementById("equipes_alterar_posicao_polo").value = operacao.posicao ? operacao.posicao.polo : "";
  _equipesCascataAlterarPosicao.atualizarMunicipios();
  document.getElementById("equipes_alterar_posicao_municipio").value = operacao.posicao ? operacao.posicao.municipio : "";

  // Horário (agora editável via PATCH, ver EquipeOperacaoUpdate) — mesmo
  // <select>+"Personalizado" do cadastro rápido em linha, ver
  // equipesPopularSelectHorario/equipesPreencherHorarioControles.
  const horarioSelect = document.getElementById("equipes_alterar_horario_select");
  const horarioManual = document.getElementById("equipes_alterar_horario_manual");
  const horarioInputInicio = document.getElementById("equipes_alterar_hora_inicio");
  const horarioInputFim = document.getElementById("equipes_alterar_hora_fim");
  equipesPreencherHorarioControles(
    { select: horarioSelect, customWrap: horarioManual, inputInicio: horarioInputInicio, inputFim: horarioInputFim },
    equipesFormatarHora(operacao.hora_inicio),
    equipesFormatarHora(operacao.hora_fim)
  );

  equipesAlterarPosicaoSelecionada = operacao.posicao ? { ...operacao.posicao } : null;
  equipesRenderizarChipPosicao("equipes_alterar_posicao_chip", equipesAlterarPosicaoSelecionada, equipesRemoverPosicao);

  equipesAlterarAreasSelecionadas = (operacao.areas_atuacao || []).map(a => ({ ...a }));
  equipesRenderizarChipsAreasAlterar();
  equipesAtualizarDisponibilidadeAreasAlterar();
  document.getElementById("equipes_alterar_areas_busca").value = "";

  document.getElementById("equipes_alterar_telefone").value = operacao.telefone || "";
  document.getElementById("equipes_alterar_viatura").value = operacao.viatura_numero || "";
  document.getElementById("equipes_alterar_radio").value = operacao.radio_status || "";

  equipesAlterarOperadoresSelecionados = (operacao.operadores || []).map(o => ({ ...o }));
  equipesRenderizarChipsAlterarOperadores();
  document.getElementById("equipes_alterar_operadores_busca").value = "";
  document.getElementById("equipes_alterar_operadores_opcoes").hidden = true;

  equipesAlterarCursosSelecionados = (operacao.cursos || []).map(c => ({ ...c }));
  _equipesMultiCursosAlterar.renderizarChips();
  document.getElementById("equipes_alterar_cursos_busca").value = "";
  document.getElementById("equipes_alterar_cursos_opcoes").hidden = true;

  document.getElementById("equipes_alterar_status").value =
    operacao.status === "FINALIZADA" ? "DISPONIVEL" : operacao.status;

  document.getElementById("equipes_modal_alterar").style.display = "flex";
}

function equipesFecharModalAlterar() {
  document.getElementById("equipes_modal_alterar").style.display = "none";
  equipesAlterarOperacaoId = null;
}

function equipesRemoverPosicao() {
  // Limpa a posição (equipesAlterarPosicaoSelecionada = null é o sinal de
  // "enviar posicao_localidade_id: null" no PATCH) — NÃO mexe nas áreas de
  // atuação, que continuam registradas (são conceitos independentes).
  equipesAlterarPosicaoSelecionada = null;
  equipesRenderizarChipPosicao("equipes_alterar_posicao_chip", null, () => {});
  equipesRenderizarChipsAreasAlterar();
}

async function equipesSalvarAlteracao() {
  equipesMostrarErro("equipes_alterar_erro", "");
  if (!equipesAlterarOperacaoId) return;

  const telefone = document.getElementById("equipes_alterar_telefone").value.trim();
  const viatura = document.getElementById("equipes_alterar_viatura").value.trim();
  const radioStatus = document.getElementById("equipes_alterar_radio").value;

  const horario = equipesLerHorarioControles({
    select: document.getElementById("equipes_alterar_horario_select"),
    inputInicio: document.getElementById("equipes_alterar_hora_inicio"),
    inputFim: document.getElementById("equipes_alterar_hora_fim"),
  });
  if (!horario) {
    equipesMostrarErro("equipes_alterar_erro", "Selecione um horário (ou preencha início e fim em Personalizado).");
    return;
  }

  const corpo = {
    posicao_localidade_id: equipesAlterarPosicaoSelecionada ? equipesAlterarPosicaoSelecionada.id : null,
    areas_atuacao_localidade_ids: equipesAlterarAreasSelecionadas.map(l => l.id),
    status: document.getElementById("equipes_alterar_status").value,
    telefone: telefone || null,
    hora_inicio: horario.inicio,
    hora_fim: horario.fim,
    viatura_numero: viatura || null,
    radio_status: radioStatus || null,
    operador_ids: equipesAlterarOperadoresSelecionados.map(o => o.id),
    curso_ids: equipesAlterarCursosSelecionados.map(c => c.id),
  };

  const r = await authChamarApi("/api/teams/operations/" + equipesAlterarOperacaoId, {
    method: "PATCH",
    headers: Object.assign({ "Content-Type": "application/json" }, equipesHeaders()),
    body: JSON.stringify(corpo),
  });

  if (!r.ok) {
    equipesMostrarErro("equipes_alterar_erro", equipesExtrairMensagemErro(r.corpo) || "Não foi possível salvar a alteração.");
    return;
  }

  equipesFecharModalAlterar();
  await equipesCarregarOperacoes();
}

/* ================= MODAL: EXCLUIR EQUIPE ================= */

function equipesAbrirModalExcluir(operacaoId, identificador) {
  equipesExcluirOperacaoId = operacaoId;
  document.getElementById("equipes_excluir_identificador").textContent = identificador || "";
  equipesMostrarErro("equipes_excluir_erro", "");
  document.getElementById("equipes_modal_excluir").style.display = "flex";
}

function equipesFecharModalExcluir() {
  document.getElementById("equipes_modal_excluir").style.display = "none";
  equipesExcluirOperacaoId = null;
}

async function equipesConfirmarExclusao() {
  if (!equipesExcluirOperacaoId) return;
  equipesMostrarErro("equipes_excluir_erro", "");

  const r = await authChamarApi("/api/teams/operations/" + equipesExcluirOperacaoId, {
    method: "DELETE",
    headers: equipesHeaders(),
  });

  // 204 No Content -> corpo vazio, r.ok verdadeiro; qualquer outro status
  // (401/403/404/409) mostra o erro DENTRO do modal e NÃO fecha — exclusão
  // só acontece com confirmação explícita bem-sucedida.
  if (!r.ok) {
    equipesMostrarErro("equipes_excluir_erro", equipesExtrairMensagemErro(r.corpo) || "Não foi possível excluir a equipe.");
    return;
  }

  equipesFecharModalExcluir();
  await equipesCarregarOperacoes();
}

/* ================= RECUPERAR EQUIPES E ROTEIROS DO DIA ANTERIOR =================
   Regra crítica (nunca sobrescrever o dia atual): a recuperação é
   estritamente ADITIVA. Para cada equipe do dia anterior, cria uma
   EquipeOperacao NOVA hoje só se ainda não existir uma — nunca PATCH, nunca
   DELETE, nunca toca numa operação já cadastrada hoje. A mesma garantia já
   existe em duas camadas independentes: aqui no cliente (equipesCalcularRecuperacao
   e a checagem repetida em equipesConfirmarRecuperacao) E no banco
   (UniqueConstraint equipe_id+data, ver app/models/equipe.py — um 409 do
   backend é tratado como "já existe", nunca como erro). */

// Pura e testável: dado o que existia ONTEM e o que já existe HOJE (mesmo
// polo), separa quem falta recuperar de quem já está cadastrado hoje (e por
// isso deve ser preservado intacto, nunca tocado).
function equipesCalcularRecuperacao(operacoesOntem, operacoesHoje) {
  const identificadoresHoje = new Set(operacoesHoje.map(op => op.identificador.toUpperCase()));
  const paraAdicionar = operacoesOntem.filter(op => !identificadoresHoje.has(op.identificador.toUpperCase()));
  const jaExistentesHoje = operacoesOntem.filter(op => identificadoresHoje.has(op.identificador.toUpperCase()));
  return { paraAdicionar, jaExistentesHoje };
}

// Monta o payload de POST /operations a partir da operação de ONTEM —
// só os campos que pertencem à OPERAÇÃO DIÁRIA (telefone, roteiro/posição,
// horário, viatura, rádio); cursos ficam de fora de propósito (pertencem à
// identidade da equipe, nunca duplicados aqui — ver app/models/equipe.py::Curso).
// status sempre nasce DISPONIVEL (o status de ontem, ex. FINALIZADA/NO_LOCAL,
// não faz sentido carregar pro dia novo) e observação nunca é recuperada
// (nota do dia anterior pode ficar desatualizada) — nenhum dos dois estava
// na lista de campos pedida para recuperação.
function equipesPayloadRecuperacaoDe(operacaoOntem) {
  return {
    polo: operacaoOntem.polo || null,
    identificador: operacaoOntem.identificador,
    hora_inicio: equipesFormatarHora(operacaoOntem.hora_inicio),
    hora_fim: equipesFormatarHora(operacaoOntem.hora_fim),
    telefone: operacaoOntem.telefone || null,
    viatura_numero: operacaoOntem.viatura_numero || null,
    radio_status: operacaoOntem.radio_status || null,
    posicao_localidade_id: operacaoOntem.posicao ? operacaoOntem.posicao.id : null,
    areas_atuacao_localidade_ids: (operacaoOntem.areas_atuacao || []).map(a => a.id),
    operador_ids: [],
    curso_ids: [],
    status: "DISPONIVEL",
    observacao: null,
  };
}

// Botão só aparece pra HOJE (recuperar histórico não faz sentido) e com um
// POLO específico selecionado (recuperação é escopada por polo — "Todos"
// misturaria equipes de regiões diferentes numa única confirmação).
function equipesAtualizarVisibilidadeBotaoRecuperar() {
  const btn = document.getElementById("equipes_btn_recuperar");
  const poloFiltro = document.getElementById("equipes_filtro_polo").value;
  btn.hidden = !(equipesFiltroDiaEhHoje() && poloFiltro);
}

let equipesRecuperarCandidatos = null; // {paraAdicionar, dataOntem, polo} — computado ao abrir o modal, consumido ao confirmar

async function equipesAbrirModalRecuperar() {
  const poloFiltro = document.getElementById("equipes_filtro_polo").value;
  if (!poloFiltro) return; // defensivo — o botão já fica escondido nesse caso

  equipesMostrarErro("equipes_recuperar_erro", "");
  const dataOntem = equipesDataOntemISO();

  const r = await authChamarApi(
    "/api/teams/operations?" + new URLSearchParams({ data: dataOntem, polo: poloFiltro }).toString(),
    { headers: equipesHeaders() }
  );
  if (!r.ok) {
    showToast(equipesExtrairMensagemErro(r.corpo) || "Não foi possível consultar o dia anterior.");
    return;
  }

  const operacoesOntem = r.corpo;
  const operacoesHoje = equipesUltimaListaOperacoes.filter(op => op.polo === poloFiltro);
  const { paraAdicionar, jaExistentesHoje } = equipesCalcularRecuperacao(operacoesOntem, operacoesHoje);

  equipesRecuperarCandidatos = { paraAdicionar, dataOntem, polo: poloFiltro };

  document.getElementById("equipes_recuperar_titulo").textContent =
    "Recuperar operação de " + equipesFormatarDataBR(dataOntem) + " — " + poloFiltro;

  document.getElementById("equipes_recuperar_resumo").innerHTML =
    "Encontradas no dia anterior: <strong>" + operacoesOntem.length + "</strong> equipe(s)<br>" +
    "Já cadastradas hoje (preservadas, sem nenhuma alteração): <strong>" + jaExistentesHoje.length + "</strong><br>" +
    "Serão adicionadas: <strong>" + paraAdicionar.length + "</strong>";

  const btnConfirmar = document.getElementById("equipes_btn_confirmar_recuperar");
  btnConfirmar.disabled = paraAdicionar.length === 0;
  btnConfirmar.textContent = paraAdicionar.length === 0 ? "Nada para recuperar" : "Recuperar equipes";

  document.getElementById("equipes_modal_recuperar").style.display = "flex";
}

function equipesFecharModalRecuperar() {
  document.getElementById("equipes_modal_recuperar").style.display = "none";
  equipesRecuperarCandidatos = null;
}

async function equipesConfirmarRecuperacao() {
  if (!equipesRecuperarCandidatos || equipesRecuperarCandidatos.paraAdicionar.length === 0) return;
  equipesMostrarErro("equipes_recuperar_erro", "");

  const btnConfirmar = document.getElementById("equipes_btn_confirmar_recuperar");
  btnConfirmar.disabled = true;

  const { paraAdicionar, dataOntem } = equipesRecuperarCandidatos; // capturado ANTES de fechar o modal (que zera equipesRecuperarCandidatos)

  let criadas = 0;
  let jaExistiam = 0; // pulou local OU 409 do servidor — em ambos os casos nunca sobrescreve
  let falhas = 0;

  for (const operacaoOntem of paraAdicionar) {
    // Checagem local DE NOVO no momento de cada criação — pode ter mudado
    // desde que o modal abriu (ex.: outro operador cadastrou manualmente
    // enquanto este modal estava aberto na tela).
    const jaExisteAgora = equipesUltimaListaOperacoes.some(
      op => op.identificador.toUpperCase() === operacaoOntem.identificador.toUpperCase()
    );
    if (jaExisteAgora) { jaExistiam += 1; continue; }

    const r = await authChamarApi("/api/teams/operations", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, equipesHeaders()),
      body: JSON.stringify(equipesPayloadRecuperacaoDe(operacaoOntem)),
    });

    if (r.ok) {
      criadas += 1;
      equipesUltimaListaOperacoes = [...equipesUltimaListaOperacoes, r.corpo];
    } else if (r.status === 409) {
      // Já existe hoje (criada no servidor entre a checagem local e agora)
      // — a garantia final é do banco (equipe_id+data), nunca sobrescreve.
      jaExistiam += 1;
    } else {
      falhas += 1;
    }
  }

  equipesFecharModalRecuperar();
  await equipesCarregarOperacoes();

  let mensagem = criadas + " equipe(s) recuperada(s) de " + equipesFormatarDataBR(dataOntem) + ".";
  if (jaExistiam > 0) mensagem = criadas + " equipe(s) recuperada(s) — " + jaExistiam + " já existiam hoje e foram preservadas.";
  if (falhas > 0) mensagem += " " + falhas + " falharam.";
  showToast(mensagem);
}

/* ================= INICIALIZAÇÃO DO MÓDULO ================= */

async function equipesAoAbrir() {
  equipesPreencherFiltroDia();
  document.getElementById("equipes_filtro_busca").value = "";
  equipesAtualizarDataOperacao();
  await equipesCarregarListasAuxiliares();
  equipesAtualizarFiltroMunicipio();
  await equipesCarregarOperacoes();
}

function equipesConectarEventos() {
  // Fonte única de horários (item HORÁRIO — cadastro rápido em linha):
  // lê os presets já existentes no DOM (botões do modal "Adicionar Equipe")
  // ANTES de qualquer outro código que dependa de EQUIPES_HORARIOS_PRESET.
  equipesCarregarHorariosPresetDoDOM();
  equipesPopularSelectHorario(document.getElementById("equipes_alterar_horario_select"));
  document.getElementById("equipes_alterar_horario_select").addEventListener("change", e => {
    document.getElementById("equipes_alterar_horario_manual").hidden = e.target.value !== EQUIPES_HORARIO_PERSONALIZADO;
  });

  document.getElementById("equipes_btn_adicionar").addEventListener("click", equipesAbrirModal);
  document.getElementById("equipes_btn_adicionar_primeira").addEventListener("click", equipesAbrirModal);
  document.getElementById("equipes_btn_salvar").addEventListener("click", equipesSalvar);
  document.getElementById("equipes_btn_salvar_alterar").addEventListener("click", equipesSalvarAlteracao);

  document.getElementById("equipes_subnav_lista").addEventListener("click", () => equipesAlternarSubaba("lista"));
  document.getElementById("equipes_subnav_mapa").addEventListener("click", () => equipesAlternarSubaba("mapa"));

  document.getElementById("equipes_filtro_polo").addEventListener("change", () => {
    equipesAtualizarFiltroMunicipio();
    equipesCarregarOperacoes();
  });
  document.getElementById("equipes_filtro_municipio").addEventListener("change", equipesCarregarOperacoes);
  document.getElementById("equipes_filtro_status").addEventListener("change", equipesCarregarOperacoes);
  document.getElementById("equipes_filtro_dia").addEventListener("change", equipesCarregarOperacoes);
  // Busca por texto é client-side (não refaz fetch) — só re-renderiza
  // grid+mapa a partir da lista já carregada.
  document.getElementById("equipes_filtro_busca").addEventListener("input", equipesRenderizarListaEMapa);

  // 📍 "Alterar posição" (ícone dedicado) saiu — localidade agora é editável
  // direto na linha (equipesConstruirLinha); abrir o cadastro avançado passou
  // a ser via duplo clique na EQUIPE (listener direto no elemento, não
  // delegação, ver equipesConstruirLinha/equipesLinhaTentarCriar). Só excluir
  // continua delegado aqui — os cards são recriados a cada render.
  document.getElementById("equipes_grid").addEventListener("click", e => {
    const btnExcluir = e.target.closest(".equipes-btn-excluir");
    if (btnExcluir) {
      equipesAbrirModalExcluir(btnExcluir.dataset.operacaoId, btnExcluir.dataset.identificador);
    }
  });

  document.getElementById("equipes_btn_confirmar_excluir").addEventListener("click", equipesConfirmarExclusao);

  document.getElementById("equipes_btn_recuperar").addEventListener("click", equipesAbrirModalRecuperar);
  document.getElementById("equipes_btn_confirmar_recuperar").addEventListener("click", equipesConfirmarRecuperacao);

  document.querySelectorAll("#equipes_horario_presets .equipes-horario-btn").forEach(botao => {
    botao.addEventListener("click", () => equipesSelecionarHorarioPreset(botao));
  });
  document.getElementById("equipes_form_hora_inicio").addEventListener("input", equipesAtualizarDuracao);
  document.getElementById("equipes_form_hora_fim").addEventListener("input", equipesAtualizarDuracao);

  const poloInput = document.getElementById("equipes_form_polo");
  poloInput.addEventListener("focus", equipesPoloAoDigitar);
  poloInput.addEventListener("input", equipesPoloAoDigitar);
  poloInput.addEventListener("blur", () => { document.getElementById("equipes_polo_opcoes").hidden = true; });

  const equipeInput = document.getElementById("equipes_form_identificador");
  equipeInput.addEventListener("focus", equipesEquipeAoDigitar);
  equipeInput.addEventListener("input", equipesEquipeAoDigitar);
  equipeInput.addEventListener("blur", () => { document.getElementById("equipes_equipe_opcoes").hidden = true; });

  const localidadesBusca = document.getElementById("equipes_localidades_busca");
  localidadesBusca.addEventListener("focus", equipesLocalidadesAoDigitar);
  localidadesBusca.addEventListener("input", equipesLocalidadesAoDigitar);
  localidadesBusca.addEventListener("blur", () => { document.getElementById("equipes_localidades_opcoes").hidden = true; });
  // Polo da equipe muda -> passo de Município aparece/some + lista de
  // localidades disponíveis muda junto.
  poloInput.addEventListener("input", () => {
    equipesAtualizarCampoMunicipio();
    if (document.activeElement === localidadesBusca) equipesLocalidadesAoDigitar();
  });
  document.getElementById("equipes_form_municipio").addEventListener("change", () => {
    if (document.activeElement === localidadesBusca) equipesLocalidadesAoDigitar();
  });

  document.getElementById("equipes_btn_remover_posicao").addEventListener("click", equipesRemoverPosicao);

  const alterarOperadoresBusca = document.getElementById("equipes_alterar_operadores_busca");
  alterarOperadoresBusca.addEventListener("focus", equipesAlterarOperadoresAoDigitar);
  alterarOperadoresBusca.addEventListener("input", equipesAlterarOperadoresAoDigitar);
  alterarOperadoresBusca.addEventListener("blur", () => {
    document.getElementById("equipes_alterar_operadores_opcoes").hidden = true;
  });
}

/* Fecha qualquer dropdown de sugestão assim que um clique começa fora dele —
   em fase de captura, ANTES do clique ser resolvido no navegador, para que
   um dropdown aberto nunca "roube" o clique de um controle posicionado
   embaixo dele. */
document.addEventListener("mousedown", e => {
  document.querySelectorAll(".equipes-combo-opcoes, .equipes-multi-opcoes").forEach(dropdown => {
    if (dropdown.hidden) return;
    const container = dropdown.closest(".equipes-combo, .equipes-multi, .equipes-combo-campo");
    if (container && !container.contains(e.target)) dropdown.hidden = true;
  });
}, true);

document.addEventListener("DOMContentLoaded", equipesConectarEventos);
