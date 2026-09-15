/* PASSAGEM DE TURNO (Fase 4, etapa 4) — frontend sobre a API já concluída na
   etapa 3 (backend/app/routers/passagem_turno.py). COMPARTILHADA por polo,
   igual Pendências/Equipes: nunca usa localStorage para os dados em si (a
   API é sempre a fonte de verdade). localStorage é usado SÓ para o RASCUNHO
   em andamento (qual lote/passagens estão sendo montadas, em que etapa o
   operador parou) — nunca para pendências/itens/dados de outro módulo, e a
   chave é sempre namespaced pelo usuario.id logado, pra nunca vazar entre
   operadores diferentes no mesmo navegador (ver ptStorageKey/ptSalvarRascunho).

   Convenções seguidas de js/pendencias.js: authChamarApi()/authObterSessao()
   (js/auth.js) para toda chamada, headers só com Bearer token, escape manual
   de texto do usuário antes de innerHTML, mensagens de erro extraídas do
   corpo da resposta.

   Prefixo curto "pt" (mesma lógica de cbw/sg/ds/ss/sp já usados no projeto
   pra módulos de nome composto). */

/* ================= ESTADO ================= */

// Painel de página única (Etapa 4A): não existe mais navegação por etapa
// (wizard) — este array só sobrevive como formato de validação do
// rascunho salvo (ver ptDesserializarRascunho), pra continuar rejeitando
// um rascunho de versão futura/corrompida com um `etapa` desconhecido.
const PT_ETAPAS = ["turno", "polos", "destinatarios", "pendencias", "itens", "revisao", "confirmacao"];

let ptCachePolos = [];
let ptCacheDestinatarios = [];
let ptCarregandoAuxiliares = false;

// Estado do rascunho em andamento — ver ptEstadoInicial() pro formato exato.
let ptEstado = null;

// Cache em memória (não persistida) das pendências/itens já carregados por
// passagem_id nesta sessão de navegação — evita refetch a cada troca de aba
// de polo; sempre recarregado do zero ao reabrir o módulo.
let ptPendenciasPorPassagem = {};
let ptItensPorPassagem = {};
// { em_contingencia, contingencia_descricao } por passagem_id — mesmo
// cache em memória dos dois acima (Etapa 4A).
let ptContingenciaPorPassagem = {};

function ptEstadoInicial() {
  return {
    versao: 1,
    turno: "",
    etapa: "turno",
    poloAtivo: null,
    selecao: [], // [{ polo, destinatarioId }] — antes dos rascunhos existirem
    loteId: null,
    passagens: [], // [{ polo, destinatarioId, passagemId }] — depois de criados
  };
}

/* ================= FUNÇÕES PURAS (testadas em js/passagem-turno.test.js) ================= */

function ptEscapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto === null || texto === undefined ? "" : String(texto);
  return div.innerHTML;
}

function ptExtrairMensagemErro(corpo) {
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

const PT_TIPO_ITEM_ROTULO = {
  OCORRENCIA: "Ocorrência relevante",
  REMANEJAMENTO: "Remanejamento de carga",
  OS_COMERCIAL: "OS comercial prioritária",
  RELIGACAO_PRIORITARIA: "Religação prioritária",
  EQUIPAMENTO_RELIGAMENTO_BLOQUEADO: "Equipamento com religamento bloqueado",
  MANUTENCAO_ACIONADA: "Manutenção acionada / em andamento",
  EQUIPAMENTO_REMOTO: "Equipamento remoto com problema",
  DESLIGAMENTO_PROGRAMADO: "Desligamento programado",
  CONTINGENCIA: "Polo em contingência",
};

function ptRotuloTipoItem(tipo) {
  return PT_TIPO_ITEM_ROTULO[tipo] || tipo || "";
}

/* Ícones inline SVG (feather-style, mesmo padrão de index.html — ver
   .menu-icon/.btn-icon-svg): só decoração visual da Etapa 4B, um por
   tipo_item + um para o card de contingência. Nunca usados como dado —
   puramente cosméticos, então não entram no formato testado de
   PT_PERGUNTAS (ver passagem-turno.test.js, que só confere pergunta/
   exemplo/botao/idLabel/descLabel). */
const PT_ICONE_SVG = {
  OCORRENCIA: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  REMANEJAMENTO: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
  OS_COMERCIAL: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  RELIGACAO_PRIORITARIA: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  EQUIPAMENTO_RELIGAMENTO_BLOQUEADO: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  MANUTENCAO_ACIONADA: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  EQUIPAMENTO_REMOTO: '<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>',
  DESLIGAMENTO_PROGRAMADO: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
  CONTINGENCIA: '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
};

function ptIconeSvg(tipo) {
  const paths = PT_ICONE_SVG[tipo] || PT_ICONE_SVG.OCORRENCIA;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

/* Painel operacional (Etapa 4A): 8 das 9 perguntas reais do Microsoft
   Forms, uma por tipo_item de PassagemTurnoItem — cada uma vira um card de
   LISTA (0..N itens) com seu próprio botão "+ Adicionar ...", nunca um
   seletor genérico de tipo. A antiga pergunta de solicitação da
   supervisão/ToDo do Forms NÃO tem card aqui de propósito: já foi
   substituída pela integração com Pendências desde a Etapa 2 do backend
   (ver o docstring de TipoItemPassagemTurno em
   backend/app/models/passagem_turno.py) — decisão já tomada antes desta
   etapa, só documentada de novo aqui.

   A 9ª pergunta ("Algum polo está em contingência?") NÃO está nesta lista
   — ela é Sim/Não, um estado do POLO nesta passagem, não uma lista de
   ocorrências (Etapa 4A: "não usar a existência/ausência de itens para
   representar contingência"). Por isso agora é um campo próprio de
   PassagemTurno (`em_contingencia`/`contingencia_descricao`, ver
   PATCH .../contingencia) com seu próprio card dedicado — ver
   ptRenderizarContingencia() mais abaixo. O tipo_item CONTINGENCIA
   continua existindo no enum do backend (não removido: mudar/remover um
   valor de ENUM do Postgres é uma migration mais arriscada, e não foi
   pedido) mas nenhum card desta grade o usa mais — PT_TIPO_ITEM_ROTULO
   mantém a entrada só por compatibilidade com dados antigos/rótulo
   genérico, nunca é oferecido como opção de "+ Adicionar" na tela. */
const PT_PERGUNTAS = [
  {
    tipo: "OCORRENCIA",
    pergunta: "Existe alguma ocorrência relevante em andamento?",
    exemplo: "Ex.: OC-000123 — Falta de energia em andamento, equipe já deslocada.",
    botao: "+ Adicionar ocorrência",
    idLabel: "Identificador (opcional)",
    idPlaceholder: "Ex: OC-000123",
    descLabel: "Descrição da ocorrência",
    descPlaceholder: "Descreva a ocorrência em andamento",
  },
  {
    tipo: "REMANEJAMENTO",
    pergunta: "Existem remanejamentos de carga em andamento?",
    exemplo: "Ex.: Remanejamento do circuito X para Y, previsão de normalização às 18h.",
    botao: "+ Adicionar remanejamento",
    idLabel: "Identificador (opcional)",
    idPlaceholder: "",
    descLabel: "Descrição do remanejamento",
    descPlaceholder: "Descreva o remanejamento",
  },
  {
    tipo: "OS_COMERCIAL",
    pergunta: "Há alguma OS comercial prioritária ou com previsão de alta compensação que esteja vencendo hoje?",
    exemplo: "Ex.: OS 123456789 — Ligação nova com previsão de alta compensação, vence hoje às 16h.",
    botao: "+ Adicionar OS",
    idLabel: "Nº da OS",
    idPlaceholder: "Ex: 123456789",
    descLabel: "Descrição",
    descPlaceholder: "Detalhe a situação da OS",
  },
  {
    tipo: "RELIGACAO_PRIORITARIA",
    pergunta: "Há alguma RELIGAÇÃO prioritária ou que esteja vencendo em 4 horas?",
    exemplo: "Ex.: OS 987654321 — Religação prioritária, vencendo em 4 horas.",
    botao: "+ Adicionar religação",
    idLabel: "Nº da religação/OS",
    idPlaceholder: "Ex: 987654321",
    descLabel: "Descrição",
    descPlaceholder: "Detalhe a religação",
  },
  {
    tipo: "EQUIPAMENTO_RELIGAMENTO_BLOQUEADO",
    pergunta: "Existem equipamentos com religamento automático bloqueado?",
    exemplo: "Ex.: RD 0054321 — Religamento automático bloqueado por manutenção na linha.",
    botao: "+ Adicionar equipamento",
    idLabel: "Equipamento",
    idPlaceholder: "Ex: RD 0054321",
    descLabel: "Motivo do bloqueio",
    descPlaceholder: "Explique o motivo do bloqueio",
  },
  {
    tipo: "MANUTENCAO_ACIONADA",
    pergunta: "Existem ocorrências com acionamento da manutenção em andamento?",
    exemplo: "Ex.: Equipe de manutenção acionada para falha no alimentador X, previsão de chegada 30 min.",
    botao: "+ Adicionar acionamento",
    idLabel: "Identificador (opcional)",
    idPlaceholder: "",
    descLabel: "Descrição",
    descPlaceholder: "Descreva o acionamento",
  },
  {
    tipo: "EQUIPAMENTO_REMOTO",
    pergunta: "Existe algum equipamento remoto (RL, RD ou RT) fora de operação ou operando com anomalia?",
    exemplo: "Ex.: RD 0012345678 — Equipamento fora de operação, defeito no cubículo.",
    botao: "+ Adicionar equipamento",
    idLabel: "Equipamento",
    idPlaceholder: "Ex: RD 0012345678",
    descLabel: "Problema",
    descPlaceholder: "Ex: Equipamento fora de operação, defeito no cubículo",
  },
  {
    tipo: "DESLIGAMENTO_PROGRAMADO",
    pergunta: "Existe algum desligamento programado para hoje que possa gerar compensação ou algum desligamento solicitado pelo cliente?",
    exemplo: "Ex.: Desligamento programado das 09h às 12h no alimentador Y, pode gerar compensação.",
    botao: "+ Adicionar desligamento",
    idLabel: "Identificador (opcional)",
    idPlaceholder: "",
    descLabel: "Descrição",
    descPlaceholder: "Descreva o desligamento",
  },
];

function ptConfigPergunta(tipo) {
  return PT_PERGUNTAS.find(p => p.tipo === tipo) || null;
}

function ptFormatarDataHoraBR(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR");
}

function ptFormatarDataBR(isoData) {
  if (!isoData) return "";
  const [ano, mes, dia] = isoData.split("-");
  return `${dia}/${mes}/${ano}`;
}

function ptStorageKey(usuarioId) {
  return "coi_passagem_turno_rascunho::" + usuarioId;
}

// Nunca deixa o texto do termo (ou qualquer outra coisa) ser persistido —
// só os campos estruturais do rascunho (Etapa 4: "não enviar scripts nem
// dados de outros módulos... usar somente para o rascunho da Passagem de
// Turno").
function ptSerializarRascunho(estado) {
  return JSON.stringify({
    versao: estado.versao,
    turno: estado.turno,
    etapa: estado.etapa,
    poloAtivo: estado.poloAtivo,
    selecao: estado.selecao,
    loteId: estado.loteId,
    passagens: estado.passagens,
  });
}

// Nunca confia cegamente no que está salvo (pode estar corrompido/de uma
// versão antiga) — valida o formato mínimo antes de aceitar, senão descarta
// e começa do zero (mais seguro que travar o módulo com um estado inválido).
function ptDesserializarRascunho(bruto) {
  if (!bruto) return null;
  let obj;
  try {
    obj = JSON.parse(bruto);
  } catch (e) {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  if (!Array.isArray(obj.selecao) || !Array.isArray(obj.passagens)) return null;
  if (!PT_ETAPAS.includes(obj.etapa)) return null;
  return {
    versao: 1,
    turno: typeof obj.turno === "string" ? obj.turno : "",
    etapa: obj.etapa,
    poloAtivo: typeof obj.poloAtivo === "string" ? obj.poloAtivo : null,
    selecao: obj.selecao,
    loteId: typeof obj.loteId === "string" ? obj.loteId : null,
    passagens: obj.passagens,
  };
}

function ptValidarSelecaoCompleta(selecao) {
  if (!Array.isArray(selecao) || selecao.length === 0) {
    return { valido: false, mensagem: "Selecione ao menos um polo." };
  }
  const semDestinatario = selecao.filter(s => !s.destinatarioId);
  if (semDestinatario.length > 0) {
    return {
      valido: false,
      mensagem: `Defina o destinatário de: ${semDestinatario.map(s => s.polo).join(", ")}.`,
    };
  }
  return { valido: true, mensagem: null };
}

function ptAdicionarPoloNaSelecao(selecao, polo) {
  if (selecao.some(s => s.polo === polo)) return selecao;
  return [...selecao, { polo, destinatarioId: null }];
}

function ptRemoverPoloDaSelecao(selecao, polo) {
  return selecao.filter(s => s.polo !== polo);
}

function ptDefinirDestinatarioNaSelecao(selecao, polo, destinatarioId) {
  return selecao.map(s => (s.polo === polo ? { ...s, destinatarioId } : s));
}

function ptAplicarDestinatarioEmMassa(selecao, destinatarioId) {
  return selecao.map(s => ({ ...s, destinatarioId }));
}

function ptDuplicarConfigPolo(selecao, poloOrigem, poloDestino) {
  const origem = selecao.find(s => s.polo === poloOrigem);
  if (!origem) return selecao;
  if (selecao.some(s => s.polo === poloDestino)) {
    return selecao.map(s => (s.polo === poloDestino ? { ...s, destinatarioId: origem.destinatarioId } : s));
  }
  return [...selecao, { polo: poloDestino, destinatarioId: origem.destinatarioId }];
}

function ptNomeDestinatario(destinatarios, id) {
  const encontrado = (destinatarios || []).find(d => d.id === id);
  return encontrado ? encontrado.nome : id || "";
}

// "Você" quando bate com o usuário logado — mesmo critério de
// pendenciasFormatarUsuario (js/pendencias.js) — nunca inventa nome que a
// API não devolveu.
function ptFormatarRemetente(idUsuario, usuarioLogadoId, usuarioLogadoNome) {
  if (idUsuario === usuarioLogadoId) return "Você (" + usuarioLogadoNome + ")";
  return idUsuario;
}

// Conta como "ativas" (vão aparecer na passagem enviada) as que não foram
// explicitamente removidas — situacao_atual null significa "ainda não
// decidida" (não deveria sobrar null na prática, já que a etapa de
// pendências resolve automaticamente todas ao carregar; ver
// ptCarregarPendenciasPolo), mas por segurança null também não conta como
// removida.
function ptContarPendenciasAtivas(lista) {
  if (!Array.isArray(lista)) return 0;
  return lista.filter(item => item.situacao_atual === "MANTIDA" || item.situacao_atual === "ADICIONADA").length;
}

function ptContarItens(lista) {
  return Array.isArray(lista) ? lista.length : 0;
}

// Agrupa os itens (já vindos misturados da API, uma lista só por passagem)
// por tipo_item — é o que alimenta cada um dos 8 cards de pergunta-lista na
// tela (ver PT_PERGUNTAS; CONTINGENCIA não usa mais isto — campo próprio,
// Etapa 4A). Pura e testável: nunca perde item nenhum, nunca lança em
// lista vazia/ausente.
function ptAgruparItensPorTipo(itens) {
  const mapa = {};
  (itens || []).forEach(item => {
    if (!mapa[item.tipo_item]) mapa[item.tipo_item] = [];
    mapa[item.tipo_item].push(item);
  });
  return mapa;
}

// Monta as linhas da tabela de revisão (Etapa 4, item "revisão antes do
// envio final"): Polo / Destinatário / Qtd pendências / Qtd itens.
function ptMontarResumoRevisao(passagens, destinatarios, pendenciasPorPassagem, itensPorPassagem) {
  return passagens.map(p => ({
    polo: p.polo,
    destinatarioNome: ptNomeDestinatario(destinatarios, p.destinatarioId),
    qtdPendencias: ptContarPendenciasAtivas(pendenciasPorPassagem[p.passagemId]),
    qtdItens: ptContarItens(itensPorPassagem[p.passagemId]),
  }));
}

function ptMensagemHttp(resposta) {
  if (resposta.status === 401) return "Sua sessão expirou. Faça login novamente.";
  if (resposta.status === 404) return "Passagem ou item não encontrado — pode ter sido removido.";
  if (resposta.status === 0) return "Não foi possível contatar o servidor. Verifique sua conexão.";
  const doCorpo = ptExtrairMensagemErro(resposta.corpo);
  if (doCorpo) return doCorpo;
  if (resposta.status === 403) return "Você não tem permissão para alterar esta passagem — só o remetente pode.";
  if (resposta.status === 409) return "Esta passagem já foi enviada ou o item já está vinculado. Atualize e tente novamente.";
  if (resposta.status === 422) return "É necessário aceitar o termo de responsabilidade para enviar.";
  if (resposta.status >= 500) return "Erro interno no servidor. Tente novamente em instantes.";
  return "Não foi possível concluir a operação.";
}

/* ================= INTEGRAÇÃO COM API ================= */

function ptHeaders() {
  const sessao = authObterSessao();
  return sessao && sessao.access_token ? { "Authorization": "Bearer " + sessao.access_token } : {};
}

function ptSessaoUsuario() {
  const sessao = authObterSessao();
  return sessao && sessao.usuario ? sessao.usuario : null;
}

async function ptApi(caminho, opcoes) {
  return authChamarApi(caminho, opcoes);
}

function ptQueryString(params) {
  const partes = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
  return partes.length ? "?" + partes.join("&") : "";
}

/* ================= PERSISTÊNCIA LOCAL DO RASCUNHO ================= */

function ptSalvarRascunho() {
  const usuario = ptSessaoUsuario();
  if (!usuario || !ptEstado) return;
  try {
    localStorage.setItem(ptStorageKey(usuario.id), ptSerializarRascunho(ptEstado));
  } catch (e) {
    // localStorage indisponível/cheio: segue só em memória, sem travar a UI.
  }
}

function ptCarregarRascunhoSalvo() {
  const usuario = ptSessaoUsuario();
  if (!usuario) return null;
  try {
    return ptDesserializarRascunho(localStorage.getItem(ptStorageKey(usuario.id)));
  } catch (e) {
    return null;
  }
}

function ptLimparRascunhoSalvo() {
  const usuario = ptSessaoUsuario();
  if (!usuario) return;
  try {
    localStorage.removeItem(ptStorageKey(usuario.id));
  } catch (e) {
    // nada a fazer
  }
}

/* ================= CARGA DE LISTAS AUXILIARES ================= */

async function ptCarregarPolos() {
  const r = await ptApi("/api/teams/polos", { headers: ptHeaders() });
  ptCachePolos = r.ok ? r.corpo : [];
}

async function ptCarregarDestinatarios() {
  const r = await ptApi("/api/passagens-turno/destinatarios-possiveis", { headers: ptHeaders() });
  ptCacheDestinatarios = r.ok ? r.corpo : [];
}

/* ================= ABERTURA DO MÓDULO ================= */

async function passagemTurnoAoAbrir() {
  const usuario = ptSessaoUsuario();
  if (!usuario) return;

  document.getElementById("pt_remetente_info").innerHTML =
    `Remetente: <strong>${ptEscapar(usuario.nome)}</strong>`;

  if (ptCarregandoAuxiliares) return;
  ptCarregandoAuxiliares = true;
  try {
    await Promise.all([ptCarregarPolos(), ptCarregarDestinatarios()]);
  } finally {
    ptCarregandoAuxiliares = false;
  }

  const salvo = ptCarregarRascunhoSalvo();
  ptEstado = salvo || ptEstadoInicial();
  ptPendenciasPorPassagem = {};
  ptItensPorPassagem = {};
  ptContingenciaPorPassagem = {};

  document.getElementById("pt_erro_geral").style.display = "none";
  document.getElementById("pt_confirmacao").hidden = true;

  if (ptEstado.passagens.length > 0) {
    await ptValidarPassagensResumidas();
  }

  if (ptEstado.passagens.length > 0) {
    await ptExibirConfigTravada();
  } else {
    ptExibirConfigEditavel();
  }
}

// Ao resumir um rascunho pós-criação, confirma que as passagens ainda
// existem e continuam em RASCUNHO (podem ter sido enviadas em outra aba, ou
// nem existir mais). Remove do estado local qualquer uma que não sirva mais
// — nunca assume que o que está salvo localmente ainda é válido no servidor.
async function ptValidarPassagensResumidas() {
  const validas = [];
  for (const p of ptEstado.passagens) {
    const r = await ptApi("/api/passagens-turno/" + p.passagemId, { headers: ptHeaders() });
    if (r.ok && r.corpo.status === "RASCUNHO") validas.push(p);
  }
  if (validas.length !== ptEstado.passagens.length) {
    showToast("Uma ou mais passagens deste rascunho não estão mais disponíveis (já enviadas ou removidas).");
  }
  ptEstado.passagens = validas;
  if (validas.length === 0) {
    ptEstado.etapa = "turno";
    ptEstado.selecao = [];
    ptEstado.loteId = null;
    ptEstado.poloAtivo = null;
  } else if (!validas.some(p => p.polo === ptEstado.poloAtivo)) {
    ptEstado.poloAtivo = validas[0].polo;
  }
  ptSalvarRascunho();
}

/* ================= CONFIGURAÇÃO DA PASSAGEM (turno + polos + destinatário) =================
   Painel de página única (Etapa 4A): não existe mais "avançar de etapa em
   etapa" aqui — o operador preenche turno e marca os polos com o
   destinatário de cada um, tudo no mesmo bloco, e clica UMA vez em
   "Confirmar configuração". A partir daí o bloco vira um resumo travado
   (a API não tem endpoint pra editar polo/turno de um rascunho já criado —
   pra mudar isso é preciso iniciar uma nova passagem, mesma regra de
   antes). */

function ptSelecionarTurnoUI(turno) {
  document.querySelectorAll(".pt-turno-btn").forEach(btn => {
    btn.classList.toggle("ativo", btn.dataset.turno === turno);
  });
  const manual = document.getElementById("pt_turno_manual");
  const presetBate = [...document.querySelectorAll(".pt-turno-btn")].some(b => b.dataset.turno === turno);
  manual.hidden = !turno || presetBate;
  document.getElementById("pt_turno_input").value = presetBate ? "" : (turno || "");
}

function ptEscolherTurnoPreset(turno) {
  ptEstado.turno = turno;
  ptSelecionarTurnoUI(turno);
  ptSalvarRascunho();
}

function ptEscolherTurnoOutro() {
  document.querySelectorAll(".pt-turno-btn").forEach(btn => btn.classList.remove("ativo"));
  document.getElementById("pt_turno_manual").hidden = false;
  document.getElementById("pt_turno_input").focus();
}

function ptTurnoAtualDoFormulario() {
  const manualVisivel = !document.getElementById("pt_turno_manual").hidden;
  return manualVisivel ? document.getElementById("pt_turno_input").value.trim() : (ptEstado.turno || "");
}

function ptPopularSelectDestinatarios(select, valorAtual) {
  select.innerHTML = '<option value="">Selecione...</option>';
  ptCacheDestinatarios.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.nome;
    select.appendChild(opt);
  });
  select.value = valorAtual || "";
}

// Uma linha compacta por polo (checkbox + nome + destinatário), juntando o
// que antes eram duas etapas separadas — ver comentário em
// css/passagem-turno.css (.pt-config-linha).
function ptRenderizarConfigPolos() {
  const container = document.getElementById("pt_polos_grid");
  container.innerHTML = "";
  ptCachePolos.forEach(polo => {
    const entrada = ptEstado.selecao.find(s => s.polo === polo);
    const selecionado = !!entrada;

    const linha = document.createElement("div");
    linha.className = "pt-config-linha" + (selecionado ? " selecionado" : "");
    linha.innerHTML = `
      <label class="pt-config-linha-check">
        <input type="checkbox" ${selecionado ? "checked" : ""}>
        <span class="pt-config-polo-nome">${ptEscapar(polo)}</span>
      </label>
      <select class="pt-config-destinatario-select" ${selecionado ? "" : "disabled"}></select>
    `;

    const checkbox = linha.querySelector('input[type="checkbox"]');
    const select = linha.querySelector("select");
    ptPopularSelectDestinatarios(select, entrada ? entrada.destinatarioId : null);

    checkbox.addEventListener("change", ev => {
      ptEstado.selecao = ev.target.checked
        ? ptAdicionarPoloNaSelecao(ptEstado.selecao, polo)
        : ptRemoverPoloDaSelecao(ptEstado.selecao, polo);
      ptSalvarRascunho();
      ptRenderizarConfigPolos();
    });
    select.addEventListener("change", () => {
      ptEstado.selecao = ptDefinirDestinatarioNaSelecao(ptEstado.selecao, polo, select.value || null);
      ptSalvarRascunho();
    });

    container.appendChild(linha);
  });

  // .pt-bulk-acao define display:flex (mesmo problema já documentado em
  // css/pendencias.css: uma regra de autor com a mesma especificidade
  // sempre vence o [hidden] do user-agent) — por isso aqui o controle é
  // por style.display, não pelo atributo `hidden`.
  document.getElementById("pt_bulk_wrap").style.display = ptEstado.selecao.length < 2 ? "none" : "flex";
  const selectBulk = document.getElementById("pt_bulk_destinatario");
  selectBulk.innerHTML = '<option value="">Aplicar destinatário a todos os polos selecionados...</option>';
  ptCacheDestinatarios.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.nome;
    selectBulk.appendChild(opt);
  });
}

function ptAplicarBulkDestinatario() {
  const destinatarioId = document.getElementById("pt_bulk_destinatario").value;
  if (!destinatarioId) return;
  ptEstado.selecao = ptAplicarDestinatarioEmMassa(ptEstado.selecao, destinatarioId);
  ptSalvarRascunho();
  ptRenderizarConfigPolos();
}

function ptMostrarErroConfig(mensagem) {
  const el = document.getElementById("pt_config_erro");
  el.textContent = mensagem || "";
  el.style.display = mensagem ? "block" : "none";
}

function ptExibirConfigEditavel() {
  document.getElementById("pt_config_edicao").hidden = false;
  document.getElementById("pt_config_resumo").hidden = true;
  document.getElementById("pt_corpo").hidden = true;
  document.getElementById("pt_confirmacao").hidden = true;
  ptRenderizarConfigPolos();
  ptSelecionarTurnoUI(ptEstado.turno);
}

function ptRenderizarConfigResumo() {
  const lista = document.getElementById("pt_config_resumo_lista");
  const turnoHtml = `<span class="pt-config-resumo-turno-chip">${ptEscapar(ptEstado.turno)}</span>`;
  const chips = ptEstado.passagens
    .map(p => `
      <span class="pt-config-resumo-chip">
        <span class="pt-config-polo-nome">${ptEscapar(p.polo)}</span>
        <span class="pt-config-seta">&rarr;</span>
        <span>${ptEscapar(ptNomeDestinatario(ptCacheDestinatarios, p.destinatarioId))}</span>
      </span>`)
    .join("");
  lista.innerHTML = turnoHtml + chips;
}

// Estado travado: a configuração (turno/polos/destinatários) não pode mais
// ser editada porque os rascunhos já existem no servidor (sem endpoint pra
// isso — ver comentário no topo desta seção). Carrega o resumo de todas as
// passagens de uma vez (alimenta a Revisão Final sem precisar refazer essa
// chamada a cada troca de aba de polo).
async function ptExibirConfigTravada() {
  document.getElementById("pt_config_edicao").hidden = true;
  document.getElementById("pt_config_resumo").hidden = false;
  ptRenderizarConfigResumo();

  await ptCarregarResumoTodasPassagens();

  document.getElementById("pt_corpo").hidden = false;
  ptRenderizarPoloTabs();
  ptRenderizarPerguntasGrid();
  document.getElementById("pt_itens_anterior_lista").hidden = true;
  document.getElementById("pt_itens_anterior_lista").innerHTML = "";
  await ptCarregarDadosDoPoloAtivo();
  ptAtualizarRevisaoTabela();

  // Nunca confia no estado do checkbox que o navegador pode ter restaurado
  // sozinho num F5/reabertura de aba — o aceite do termo é sempre exigido
  // de novo a cada vez que o painel é (re)aberto com passagens em RASCUNHO.
  document.getElementById("pt_termo_checkbox").checked = false;
  ptAtualizarBotaoEnviar();
}

async function ptConfirmarConfiguracao() {
  const turno = ptTurnoAtualDoFormulario();
  if (!turno) {
    ptMostrarErroConfig("Selecione ou informe o turno.");
    return;
  }
  const validacao = ptValidarSelecaoCompleta(ptEstado.selecao);
  if (!validacao.valido) {
    ptMostrarErroConfig(validacao.mensagem);
    return;
  }
  ptMostrarErroConfig("");
  ptEstado.turno = turno;

  const botao = document.getElementById("pt_btn_confirmar_config");
  botao.disabled = true;
  try {
    const payload = {
      itens: ptEstado.selecao.map(s => ({ polo: s.polo, turno: ptEstado.turno, destinatario_id: s.destinatarioId })),
    };
    const r = await ptApi("/api/passagens-turno", {
      method: "POST",
      headers: { ...ptHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      ptMostrarErroConfig(ptMensagemHttp(r));
      return;
    }
    ptEstado.passagens = r.corpo.map(p => ({ polo: p.polo, destinatarioId: p.destinatario_id, passagemId: p.id }));
    ptEstado.loteId = r.corpo.length > 1 ? r.corpo[0].lote_id : null;
    ptEstado.poloAtivo = ptEstado.passagens[0].polo;
    ptEstado.etapa = "itens";
    ptSalvarRascunho();
    await ptExibirConfigTravada();
  } finally {
    botao.disabled = false;
  }
}

/* ================= ABA DE POLO ATIVO (Pendências + Perguntas juntas) ================= */

function ptRenderizarPoloTabs() {
  const container = document.getElementById("pt_polo_tabs");
  container.innerHTML = "";
  if (ptEstado.passagens.length < 2) return; // 1 polo só: aba não agrega nada, fica limpo sem ela
  ptEstado.passagens.forEach(p => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pt-polo-tab-btn" + (p.polo === ptEstado.poloAtivo ? " ativo" : "");
    btn.innerHTML = `
      <span class="pt-polo-tab-nome">${ptEscapar(p.polo)}</span>
      <span class="pt-polo-tab-dest">${ptEscapar(ptNomeDestinatario(ptCacheDestinatarios, p.destinatarioId))}</span>
    `;
    btn.addEventListener("click", async () => {
      ptEstado.poloAtivo = p.polo;
      ptSalvarRascunho();
      ptRenderizarPoloTabs();
      document.getElementById("pt_itens_anterior_lista").hidden = true;
      document.getElementById("pt_itens_anterior_lista").innerHTML = "";
      await ptCarregarDadosDoPoloAtivo();
    });
    container.appendChild(btn);
  });
}

function ptPassagemAtiva() {
  return ptEstado.passagens.find(p => p.polo === ptEstado.poloAtivo) || null;
}

// Etiqueta visual (Etapa 4B, item 7/11: "identificação do polo precisa
// ficar visualmente óbvia") ao lado dos títulos de Pendências e Informações
// Operacionais — puramente cosmético, não decide nada: os dados exibidos
// já são só do polo ativo (ptPassagemAtiva()), isto só deixa isso claro na
// tela mesmo com 1 polo só (sem abas visíveis nesse caso).
function ptAtualizarRotuloPoloAtivo() {
  const passagem = ptPassagemAtiva();
  const texto = passagem ? passagem.polo : "";
  const tagPendencias = document.getElementById("pt_pendencias_polo_tag");
  const tagItens = document.getElementById("pt_itens_polo_tag");
  if (tagPendencias) tagPendencias.textContent = texto;
  if (tagItens) tagItens.textContent = texto;
}

async function ptCarregarDadosDoPoloAtivo() {
  // Contingência não é mais por polo ativo (ajuste UX): o card mostra todos
  // os polos ao mesmo tempo, ver ptRenderizarContingenciaPolos — nada aqui
  // precisa resetar ao trocar de aba.
  ptAtualizarRotuloPoloAtivo();
  await ptCarregarPendenciasPolo();
  await ptCarregarItensPolo();
}

/* ================= PENDÊNCIAS DO POLO ================= */

// Recuperação automática (Etapa 3, item 8 do backend): GET
// .../pendencias-disponiveis já devolve as pendências PENDENTES do polo com
// entra_passagem_turno=true. As que ainda não têm situacao_atual (nunca
// vinculadas nesta passagem) são "materializadas" aqui via POST
// .../pendencias — é o próprio backend quem decide a situação (MANTIDA,
// nunca confiado do cliente). Depois disso, a única ação que resta pro
// operador é REMOVER (não existe endpoint pra desfazer uma remoção nesta
// etapa da API — limitação aceita, não inventada aqui).
async function ptCarregarPendenciasPolo() {
  const passagem = ptPassagemAtiva();
  if (!passagem) return;
  const container = document.getElementById("pt_pendencias_lista");
  const erroEl = document.getElementById("pt_pendencias_erro");
  erroEl.style.display = "none";
  container.innerHTML = '<div class="pt-vazio">Carregando...</div>';

  const r = await ptApi(`/api/passagens-turno/${passagem.passagemId}/pendencias-disponiveis`, { headers: ptHeaders() });
  if (!r.ok) {
    container.innerHTML = "";
    erroEl.textContent = ptMensagemHttp(r);
    erroEl.style.display = "block";
    return;
  }

  const naoVinculadas = r.corpo.filter(item => item.situacao_atual === null);
  for (const item of naoVinculadas) {
    await ptApi(`/api/passagens-turno/${passagem.passagemId}/pendencias`, {
      method: "POST",
      headers: { ...ptHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ pendencia_id: item.pendencia.id }),
    });
  }

  const rFinal = naoVinculadas.length
    ? await ptApi(`/api/passagens-turno/${passagem.passagemId}/pendencias-disponiveis`, { headers: ptHeaders() })
    : r;
  const lista = rFinal.ok ? rFinal.corpo : r.corpo;
  ptPendenciasPorPassagem[passagem.passagemId] = lista;
  ptRenderizarPendencias(lista);
  ptAtualizarRevisaoTabela();
}

// Campos exibidos no corpo do card (fora do cabeçalho, que já mostra
// código + tipo separadamente — ver ptRenderizarPendencias).
const PT_CAMPOS_PENDENCIA_CARD = [
  ["descricao", "Descrição"],
  ["os_numero", "Nº OS"],
  ["inc_numero", "Nº INC"],
  ["ss_numero", "Nº SS"],
  ["responsabilidade", "Responsabilidade"],
  ["data_vencimento", "Vencimento", ptFormatarDataBR],
];

// Layout compacto pedido: código em destaque, tipo logo abaixo, depois os
// demais campos existentes, terminando no botão de remover — sem duplicar
// nenhum dado que a API de Pendências já devolve (PendenciaOut).
function ptRenderizarPendencias(lista) {
  const container = document.getElementById("pt_pendencias_lista");
  container.innerHTML = "";
  if (!lista || lista.length === 0) {
    container.innerHTML = '<div class="pt-vazio">Nenhuma pendência recuperada automaticamente para este polo.</div>';
    return;
  }

  lista.forEach(item => {
    const p = item.pendencia;
    const removida = item.situacao_atual === "REMOVIDA";
    const linhas = PT_CAMPOS_PENDENCIA_CARD
      .filter(([campo]) => p[campo] !== null && p[campo] !== undefined && p[campo] !== "")
      .map(([campo, rotulo, formatar]) => {
        const valor = formatar ? formatar(p[campo]) : p[campo];
        return `<div><strong>${ptEscapar(rotulo)}:</strong> ${ptEscapar(valor)}</div>`;
      })
      .join("");

    const card = document.createElement("div");
    card.className = "pt-pendencia-card" + (removida ? " pt-pendencia-removida" : "");
    card.innerHTML = `
      ${removida ? '<span class="pt-pendencia-situacao-removida">Removida</span>' : ""}
      <div class="pt-pendencia-codigo">${ptEscapar(p.codigo)}</div>
      <div class="pt-pendencia-tipo">${ptEscapar(p.tipo)}</div>
      ${linhas}
      ${removida ? "" : '<button type="button" class="pendencias-btn-perigo pt-btn-remover-pendencia">Remover da passagem</button>'}
    `;
    if (!removida) {
      card.querySelector(".pt-btn-remover-pendencia").addEventListener("click", () => ptRemoverPendencia(p.id));
    }
    container.appendChild(card);
  });
}

async function ptRemoverPendencia(pendenciaId) {
  const passagem = ptPassagemAtiva();
  if (!passagem) return;
  const r = await ptApi(`/api/passagens-turno/${passagem.passagemId}/pendencias/${pendenciaId}`, {
    method: "DELETE",
    headers: ptHeaders(),
  });
  if (!r.ok) {
    showToast(ptMensagemHttp(r));
    return;
  }
  await ptCarregarPendenciasPolo();
}

/* ================= INFORMAÇÕES OPERACIONAIS (9 perguntas, todas na mesma tela) =================
   Painel operacional (Etapa 4A): cada uma das 8 perguntas-lista de
   PT_PERGUNTAS vira um card fixo com seu próprio botão "+ Adicionar ..." —
   nunca um formulário único com seletor de tipo. Um único modal genérico
   (#pt_modal_item) é reaproveitado pelos 8 tipos e também pelo Editar,
   porque o formulário é sempre a mesma forma (identificador + descrição);
   o que muda por tipo são só os rótulos/placeholders/exemplo, vindos de
   ptConfigPergunta(tipo). */

let ptModalItemContexto = { tipoItem: null, itemId: null };

// Ajuste UX (pós-4B): contingência deixou de ser Sim/Não por polo ativo e
// virou uma seleção múltipla — um checkbox por polo da passagem, todos
// visíveis ao mesmo tempo (não depende de qual aba está ativa). Este Set
// guarda os passagemId marcados NA TELA agora mesmo; nem todo marcado
// necessariamente já foi salvo no servidor — um polo fica "marcado mas
// pendente" enquanto não houver motivo preenchido (o backend EXIGE
// contingencia_descricao quando em_contingencia=True, ver
// PassagemTurnoContingenciaUpdate — não dá pra relaxar isso sem mexer no
// schema, que é área protegida). Reconstruído a partir de
// ptContingenciaPorPassagem sempre que o módulo abre/uma passagem nova é
// criada (ver ptContingenciaInicializarMarcados).
let ptContingenciaMarcados = new Set();

// Etapa 4C: "ver tudo -> adicionar só o que precisa". As 8 perguntas viram
// linhas compactas de accordion (ícone + título + contador + Adicionar),
// corpo (dica + itens) só aparece quando expandida. Guarda só os TIPOS
// abertos nesta sessão de tela — reseta ao reabrir o módulo (não precisa
// persistir, é conveniência de leitura, não dado). ptContingenciaExpandida
// seguindo a mesma ideia: começa fechada (mostra só um botão "+ Selecionar
// polos"), mas nunca esconde um estado que já tem polo marcado — ver
// ptRenderizarContingenciaPolos.
let ptPerguntasExpandidas = new Set();
let ptContingenciaExpandida = false;

function ptAlternarPerguntaExpandida(tipo) {
  if (ptPerguntasExpandidas.has(tipo)) {
    ptPerguntasExpandidas.delete(tipo);
  } else {
    ptPerguntasExpandidas.add(tipo);
  }
  const linha = document.querySelector(`.pt-pergunta-row[data-tipo="${tipo}"]`);
  if (!linha) return;
  const expandida = ptPerguntasExpandidas.has(tipo);
  linha.classList.toggle("expandido", expandida);
  linha.querySelector(".pt-pergunta-row-corpo").hidden = !expandida;
}

function ptRenderizarPerguntasGrid() {
  const container = document.getElementById("pt_perguntas_grid");
  container.innerHTML = PT_PERGUNTAS.map(cfg => `
    <div class="pt-pergunta-row" data-tipo="${ptEscapar(cfg.tipo)}">
      <div class="pt-pergunta-row-cabecalho">
        <button type="button" class="pt-pergunta-row-toggle" data-tipo="${ptEscapar(cfg.tipo)}">
          <span class="pt-pergunta-icone">${ptIconeSvg(cfg.tipo)}</span>
          <span class="pt-pergunta-row-titulo">${ptEscapar(cfg.pergunta)}</span>
          <span class="pt-pergunta-row-contagem" id="pt_contagem_${ptEscapar(cfg.tipo)}"></span>
          <svg class="pt-pergunta-row-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <button type="button" class="pt-btn-add-item" data-tipo="${ptEscapar(cfg.tipo)}">${ptEscapar(cfg.botao)}</button>
      </div>
      <div class="pt-pergunta-row-corpo" hidden>
        <p class="pt-pergunta-hint">${ptEscapar(cfg.exemplo)}</p>
        ${cfg.hint ? `<p class="pt-pergunta-hint">${ptEscapar(cfg.hint)}</p>` : ""}
        <div class="pt-pergunta-itens" id="pt_itens_${ptEscapar(cfg.tipo)}"></div>
      </div>
    </div>
  `).join("") + `
    <div class="pt-pergunta-row pt-contingencia-row" id="pt_card_contingencia">
      <div class="pt-pergunta-row-cabecalho">
        <span class="pt-pergunta-icone pt-pergunta-icone-alerta">${ptIconeSvg("CONTINGENCIA")}</span>
        <span class="pt-pergunta-row-titulo">Algum polo está em contingência?</span>
      </div>
      <div class="pt-pergunta-row-corpo pt-contingencia-corpo">
        <p class="pt-pergunta-hint">Selecione os polos que estão em condição de contingência.</p>
        <button type="button" class="pt-btn-add-item" id="pt_btn_selecionar_contingencia">+ Selecionar polos</button>
        <div class="pt-contingencia-polos-grid" id="pt_contingencia_polos_grid" hidden></div>
        <div id="pt_contingencia_motivo_wrap" style="display:none;">
          <label for="pt_contingencia_descricao_input">Motivo da contingência</label>
          <input id="pt_contingencia_descricao_input" maxlength="300" placeholder="Descreva brevemente o motivo">
          <div id="pt_contingencia_erro" class="pendencias-erro" style="display:none;"></div>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll(".pt-btn-add-item[data-tipo]").forEach(btn => {
    btn.addEventListener("click", ev => {
      ev.stopPropagation();
      ptAbrirModalItem(btn.dataset.tipo, null);
    });
  });
  container.querySelectorAll(".pt-pergunta-row-toggle").forEach(btn => {
    btn.addEventListener("click", () => ptAlternarPerguntaExpandida(btn.dataset.tipo));
  });

  // Contingência sempre visível (não é um accordion igual às 8 perguntas —
  // é uma pergunta única e simples), mas a seleção de polos fica atrás de
  // "+ Selecionar polos" até ter algo pra mostrar (ver ptRenderizarContingenciaPolos).
  document.getElementById("pt_btn_selecionar_contingencia").addEventListener("click", () => {
    ptContingenciaExpandida = true;
    ptRenderizarContingenciaPolos();
  });

  const campoMotivo = document.getElementById("pt_contingencia_descricao_input");
  campoMotivo.addEventListener("blur", ptSalvarMotivoContingencia);
  campoMotivo.addEventListener("keydown", ev => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      campoMotivo.blur(); // dispara o blur acima, mesmo caminho de salvar
    }
  });

  ptContingenciaInicializarMarcados();
  ptRenderizarContingenciaPolos();
}

async function ptCarregarItensPolo() {
  const passagem = ptPassagemAtiva();
  if (!passagem) return;
  const r = await ptApi(`/api/passagens-turno/${passagem.passagemId}`, { headers: ptHeaders() });
  if (!r.ok) {
    document.getElementById("pt_itens_erro").textContent = ptMensagemHttp(r);
    document.getElementById("pt_itens_erro").style.display = "block";
    return;
  }
  document.getElementById("pt_itens_erro").style.display = "none";
  ptItensPorPassagem[passagem.passagemId] = r.corpo.itens;
  ptPendenciasPorPassagem[passagem.passagemId] = r.corpo.pendencias.map(v => ({
    pendencia: v.pendencia,
    situacao_atual: v.situacao,
  }));
  // Mantém o cache de contingência deste polo em dia (fonte de verdade
  // ainda é o servidor) — não precisa re-renderizar o card aqui: ele mostra
  // todos os polos juntos e não depende de qual aba está ativa (ver
  // ptRenderizarContingenciaPolos), então re-desenhá-lo a cada troca de aba
  // só arriscaria perder texto que o operador esteja digitando no campo de
  // motivo nesse momento.
  ptContingenciaPorPassagem[passagem.passagemId] = {
    em_contingencia: r.corpo.em_contingencia,
    contingencia_descricao: r.corpo.contingencia_descricao,
  };
  ptRenderizarItensNasPerguntas(r.corpo.itens);
  ptAtualizarRevisaoTabela();
}

function ptRenderizarItensNasPerguntas(itens) {
  const agrupados = ptAgruparItensPorTipo(itens);
  PT_PERGUNTAS.forEach(cfg => {
    const container = document.getElementById("pt_itens_" + cfg.tipo);
    if (!container) return;
    const doTipo = agrupados[cfg.tipo] || [];
    const contagemEl = document.getElementById("pt_contagem_" + cfg.tipo);
    if (contagemEl) {
      contagemEl.textContent = doTipo.length > 0 ? String(doTipo.length) : "";
      contagemEl.classList.toggle("pt-pergunta-row-contagem-ativa", doTipo.length > 0);
    }
    if (doTipo.length === 0) {
      container.innerHTML = '<div class="pt-pergunta-vazio">Nenhuma informação adicionada</div>';
      return;
    }
    container.innerHTML = doTipo
      .map(item => `
        <div class="pt-item-linha" data-item-id="${ptEscapar(item.id)}">
          <div class="pt-item-linha-texto">
            ${item.identificador ? `<strong>${ptEscapar(item.identificador)}</strong><br>` : ""}${ptEscapar(item.descricao)}
          </div>
          <div class="pt-item-linha-acoes">
            <button type="button" class="sec pt-btn-editar-item" data-item-id="${ptEscapar(item.id)}">Editar</button>
            <button type="button" class="pendencias-btn-perigo pt-btn-remover-item" data-item-id="${ptEscapar(item.id)}">Excluir</button>
          </div>
        </div>
      `)
      .join("");

    container.querySelectorAll(".pt-btn-editar-item").forEach(btn => {
      const item = doTipo.find(i => i.id === btn.dataset.itemId);
      btn.addEventListener("click", () => ptAbrirModalItem(cfg.tipo, item));
    });
    container.querySelectorAll(".pt-btn-remover-item").forEach(btn => {
      btn.addEventListener("click", () => ptRemoverItem(btn.dataset.itemId));
    });
  });
}

function ptMostrarErroItens(mensagem) {
  const el = document.getElementById("pt_itens_erro");
  el.textContent = mensagem || "";
  el.style.display = mensagem ? "block" : "none";
}

/* ================= CONTINGÊNCIA (seleção múltipla de polos — ajuste UX) =================
   Nunca representada por item — é o único card desta grade que não vem de
   PT_PERGUNTAS/ptAbrirModalItem, e que fala direto com
   PATCH .../contingencia (reaproveitado, sem endpoint novo) em vez do
   endpoint genérico de itens.

   Modelo mental: cada polo da passagem já É uma PassagemTurno própria (regra
   de arquitetura de sempre — POLO + REMETENTE + DESTINATÁRIO + MOMENTO), com
   seu próprio em_contingencia/contingencia_descricao. Marcar/desmarcar um
   polo aqui só faz PATCH NAQUELE passagemId — nunca em lote, nunca cria
   estado global. Por isso o card mostra TODOS os polos de ptEstado.passagens
   de uma vez (não só o polo da aba ativa) — ver ptRenderizarContingenciaPolos.

   ptContingenciaMarcados é a fonte de verdade da TELA (o que o operador
   pediu); ptContingenciaPorPassagem é a fonte de verdade do SERVIDOR (o que
   já foi salvo). As duas só divergem enquanto um polo está "marcado mas
   pendente de motivo" — desmarcar nunca fica pendente (não exige motivo). */

// Reconstrói o Set a partir do que já está salvo no servidor
// (ptContingenciaPorPassagem) — chamado sempre que o grid é (re)desenhado do
// zero (abertura do módulo/F5, ou nova passagem), nunca no meio de uma
// edição em andamento (senão apagaria uma marcação ainda pendente de motivo).
function ptContingenciaInicializarMarcados() {
  ptContingenciaMarcados = new Set(
    ptEstado.passagens.filter(p => ptContingenciaPorPassagem[p.passagemId]?.em_contingencia).map(p => p.passagemId)
  );
}

function ptRenderizarContingenciaPolos() {
  const grid = document.getElementById("pt_contingencia_polos_grid");
  if (!grid) return;

  // Nunca esconde um estado que já tem polo marcado (F5/reabertura sempre
  // mostra a seleção existente) — só fica atrás do botão "+ Selecionar
  // polos" quando não há nada marcado ainda e o operador não clicou nele.
  if (ptContingenciaMarcados.size > 0) ptContingenciaExpandida = true;
  const botaoSelecionar = document.getElementById("pt_btn_selecionar_contingencia");
  if (botaoSelecionar) botaoSelecionar.hidden = ptContingenciaExpandida;
  grid.hidden = !ptContingenciaExpandida;

  grid.innerHTML = ptEstado.passagens
    .map(p => {
      const marcado = ptContingenciaMarcados.has(p.passagemId);
      return `
        <label class="pt-contingencia-polo-item${marcado ? " selecionado" : ""}">
          <input type="checkbox" data-passagem-id="${ptEscapar(p.passagemId)}" ${marcado ? "checked" : ""}>
          <span class="pt-config-polo-nome">${ptEscapar(p.polo)}</span>
        </label>`;
    })
    .join("");

  grid.querySelectorAll("input[type=checkbox]").forEach(input => {
    input.addEventListener("change", () => ptAlternarContingenciaPolo(input.dataset.passagemId, input.checked));
  });

  // #pt_contingencia_motivo_wrap tem display:flex por ID no CSS — mesmo
  // problema já documentado em css/pendencias.css/ptAplicarBulkDestinatario:
  // uma regra de autor com a mesma especificidade sempre vence o [hidden] do
  // user-agent, e um seletor de ID tem especificidade MAIOR ainda. Por isso o
  // controle aqui é por style.display, nunca pelo atributo `hidden`.
  const wrap = document.getElementById("pt_contingencia_motivo_wrap");
  wrap.style.display = ptContingenciaMarcados.size > 0 ? "flex" : "none";

  // Nunca sobrescreve o campo enquanto o operador está digitando nele
  // (mesmo cuidado já usado no restante do módulo, ex.: ptRenderizarContingencia
  // original). Pré-preenche com a descrição já salva de algum polo marcado,
  // se houver — simples de propósito (Etapa 4B/ajuste: "não misturar
  // silenciosamente descrições diferentes" = todo polo marcado sempre reflete
  // o texto único deste campo a partir do próximo salvamento).
  const input = document.getElementById("pt_contingencia_descricao_input");
  if (document.activeElement !== input) {
    const comDescricao = ptEstado.passagens
      .map(p => ptContingenciaPorPassagem[p.passagemId])
      .find(d => d && d.em_contingencia && d.contingencia_descricao);
    input.value = comDescricao ? comDescricao.contingencia_descricao : "";
  }
  document.getElementById("pt_contingencia_erro").style.display = "none";
}

// Desmarcar é sempre seguro e imediato (schema nunca exige motivo pra
// em_contingencia=false — ver PassagemTurnoContingenciaUpdate). Marcar só
// salva na hora se já existir um motivo preenchido no campo; senão fica
// "pendente" (continua marcado na tela, mas nada foi persistido ainda) até o
// operador digitar o motivo e sair do campo (ptSalvarMotivoContingencia).
async function ptAlternarContingenciaPolo(passagemId, marcado) {
  if (marcado) {
    ptContingenciaMarcados.add(passagemId);
  } else {
    ptContingenciaMarcados.delete(passagemId);
  }

  if (!marcado) {
    const r = await ptApi(`/api/passagens-turno/${passagemId}/contingencia`, {
      method: "PATCH",
      headers: { ...ptHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ em_contingencia: false }),
    });
    if (r.ok) {
      ptContingenciaPorPassagem[passagemId] = {
        em_contingencia: r.corpo.em_contingencia,
        contingencia_descricao: r.corpo.contingencia_descricao,
      };
    } else {
      showToast(ptMensagemHttp(r));
    }
    ptRenderizarContingenciaPolos();
    return;
  }

  const descricaoAtual = document.getElementById("pt_contingencia_descricao_input").value.trim();
  if (descricaoAtual) {
    await ptSalvarMotivoContingencia();
  } else {
    ptRenderizarContingenciaPolos();
    document.getElementById("pt_contingencia_descricao_input").focus();
  }
}

// Aplica o motivo atual do campo a TODOS os polos marcados na tela agora
// (inclui os "pendentes" e os já salvos que possam ter um motivo antigo) —
// chamado ao sair do campo (blur) ou Enter. Nunca cria um PATCH em lote de
// verdade: continua sendo um PATCH por passagemId, só que disparado em
// sequência a partir de um único texto (o "não criar endpoint novo" pedido).
async function ptSalvarMotivoContingencia() {
  const erroEl = document.getElementById("pt_contingencia_erro");
  if (ptContingenciaMarcados.size === 0) {
    erroEl.style.display = "none";
    return;
  }

  const descricao = document.getElementById("pt_contingencia_descricao_input").value.trim();
  if (!descricao) {
    erroEl.textContent = "Informe o motivo para confirmar a contingência dos polos marcados.";
    erroEl.style.display = "block";
    return;
  }
  erroEl.style.display = "none";

  for (const passagemId of ptContingenciaMarcados) {
    const atual = ptContingenciaPorPassagem[passagemId];
    if (atual && atual.em_contingencia && atual.contingencia_descricao === descricao) continue; // já salvo, evita PATCH redundante
    const r = await ptApi(`/api/passagens-turno/${passagemId}/contingencia`, {
      method: "PATCH",
      headers: { ...ptHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ em_contingencia: true, contingencia_descricao: descricao }),
    });
    if (r.ok) {
      ptContingenciaPorPassagem[passagemId] = {
        em_contingencia: r.corpo.em_contingencia,
        contingencia_descricao: r.corpo.contingencia_descricao,
      };
    } else {
      erroEl.textContent = ptMensagemHttp(r);
      erroEl.style.display = "block";
    }
  }
  ptRenderizarContingenciaPolos();
}

function ptAbrirModalItem(tipoItem, itemParaEditar) {
  const cfg = ptConfigPergunta(tipoItem);
  if (!cfg) return;
  ptModalItemContexto = { tipoItem, itemId: itemParaEditar ? itemParaEditar.id : null };

  document.getElementById("pt_modal_item_titulo").textContent = itemParaEditar ? "Editar item" : "Adicionar item";
  document.getElementById("pt_modal_item_exemplo").textContent = cfg.exemplo;
  document.getElementById("pt_modal_item_label_identificador").textContent = cfg.idLabel;
  document.getElementById("pt_modal_item_label_descricao").textContent = cfg.descLabel;

  const campoId = document.getElementById("pt_modal_item_identificador");
  const campoDesc = document.getElementById("pt_modal_item_descricao");
  campoId.placeholder = cfg.idPlaceholder || "";
  campoDesc.placeholder = cfg.descPlaceholder || "";
  campoId.value = itemParaEditar ? (itemParaEditar.identificador || "") : "";
  campoDesc.value = itemParaEditar ? itemParaEditar.descricao : "";

  document.getElementById("pt_btn_modal_item_salvar").textContent = itemParaEditar ? "Salvar" : "Adicionar";
  document.getElementById("pt_modal_item_erro").style.display = "none";
  document.getElementById("pt_modal_item").style.display = "flex";
  campoId.focus();
}

function ptFecharModalItem() {
  document.getElementById("pt_modal_item").style.display = "none";
  ptModalItemContexto = { tipoItem: null, itemId: null };
}

function ptMostrarErroModalItem(mensagem) {
  const el = document.getElementById("pt_modal_item_erro");
  el.textContent = mensagem || "";
  el.style.display = mensagem ? "block" : "none";
}

async function ptSalvarModalItem() {
  const passagem = ptPassagemAtiva();
  if (!passagem || !ptModalItemContexto.tipoItem) return;

  const identificador = document.getElementById("pt_modal_item_identificador").value.trim() || null;
  const descricao = document.getElementById("pt_modal_item_descricao").value.trim();
  if (!descricao) {
    ptMostrarErroModalItem("Informe a descrição.");
    return;
  }
  ptMostrarErroModalItem("");

  const botao = document.getElementById("pt_btn_modal_item_salvar");
  botao.disabled = true;
  try {
    const editando = !!ptModalItemContexto.itemId;
    const r = editando
      ? await ptApi(`/api/passagens-turno/${passagem.passagemId}/itens/${ptModalItemContexto.itemId}`, {
          method: "PATCH",
          headers: { ...ptHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ identificador, descricao }),
        })
      : await ptApi(`/api/passagens-turno/${passagem.passagemId}/itens`, {
          method: "POST",
          headers: { ...ptHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ tipo_item: ptModalItemContexto.tipoItem, identificador, descricao }),
        });
    if (!r.ok) {
      ptMostrarErroModalItem(ptMensagemHttp(r));
      return;
    }
    ptFecharModalItem();
    await ptCarregarItensPolo();
  } finally {
    botao.disabled = false;
  }
}

async function ptRemoverItem(itemId) {
  const passagem = ptPassagemAtiva();
  if (!passagem) return;
  const r = await ptApi(`/api/passagens-turno/${passagem.passagemId}/itens/${itemId}`, {
    method: "DELETE",
    headers: ptHeaders(),
  });
  if (!r.ok) {
    showToast(ptMensagemHttp(r));
    return;
  }
  await ptCarregarItensPolo();
}

// "Recuperar passagem anterior" (Etapa 4, mantido na 4A): busca a última
// passagem ENVIADA deste mesmo polo (qualquer remetente/destinatário —
// mesma política de autorização por polo já usada no resto do sistema) e
// mostra os itens dela como REFERÊNCIA — nunca copia nada automaticamente,
// o operador decide item a item o que ainda faz sentido levar adiante
// ("Copiar para esta passagem" chama o mesmo POST .../itens já usado no
// formulário normal — nenhum dado de Pendências é tocado aqui, itens não
// são Pendências, que têm seu próprio mecanismo de recuperação).
async function ptVerPassagemAnterior() {
  const passagemAtual = ptPassagemAtiva();
  if (!passagemAtual) return;
  const container = document.getElementById("pt_itens_anterior_lista");
  container.hidden = false;
  container.innerHTML = "Buscando...";

  const query = ptQueryString({ polo: passagemAtual.polo, status: "ENVIADA", limit: 1, offset: 0 });
  const r = await ptApi("/api/passagens-turno" + query, { headers: ptHeaders() });
  if (!r.ok || r.corpo.items.length === 0) {
    container.innerHTML = '<div class="pt-vazio">Nenhuma passagem anterior encontrada para este polo.</div>';
    return;
  }

  const anteriorId = r.corpo.items[0].id;
  const rDetalhe = await ptApi("/api/passagens-turno/" + anteriorId, { headers: ptHeaders() });
  if (!rDetalhe.ok || rDetalhe.corpo.itens.length === 0) {
    container.innerHTML = '<div class="pt-vazio">A passagem anterior deste polo não tinha itens operacionais.</div>';
    return;
  }

  container.innerHTML = "";
  rDetalhe.corpo.itens.forEach(item => {
    const linha = document.createElement("div");
    linha.className = "pt-item-anterior-linha";
    linha.innerHTML = `
      <span><span class="pt-item-tipo-rotulo">${ptEscapar(ptRotuloTipoItem(item.tipo_item))}</span>
      ${item.identificador ? ptEscapar(item.identificador) + " — " : ""}${ptEscapar(item.descricao)}</span>
      <button type="button" class="sec pt-btn-copiar-item">Copiar para esta passagem</button>
    `;
    linha.querySelector(".pt-btn-copiar-item").addEventListener("click", async () => {
      const passagem = ptPassagemAtiva();
      await ptApi(`/api/passagens-turno/${passagem.passagemId}/itens`, {
        method: "POST",
        headers: { ...ptHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ tipo_item: item.tipo_item, identificador: item.identificador, descricao: item.descricao }),
      });
      await ptCarregarItensPolo();
      showToast("Item copiado.");
    });
    container.appendChild(linha);
  });
}

/* ================= REVISÃO FINAL + TERMO + ENVIO ================= */

// Carrega pendências/itens de TODAS as passagens de uma vez (só na entrada
// do painel operacional) pra Revisão Final já nascer com os números certos
// de todos os polos, mesmo os que o operador ainda não abriu na aba. Depois
// disso, cada polo mantém seu próprio cache atualizado sozinho (toda
// operação de pendência/item já recarrega só o polo ativo) — não é preciso
// repetir esta varredura completa a cada clique.
async function ptCarregarResumoTodasPassagens() {
  for (const p of ptEstado.passagens) {
    const r = await ptApi("/api/passagens-turno/" + p.passagemId, { headers: ptHeaders() });
    if (r.ok) {
      ptPendenciasPorPassagem[p.passagemId] = r.corpo.pendencias.map(v => ({ pendencia: v.pendencia, situacao_atual: v.situacao }));
      ptItensPorPassagem[p.passagemId] = r.corpo.itens;
      // Contingência (ajuste UX): carregada aqui pra TODOS os polos de uma
      // vez, não só o polo ativo — o card de contingência agora mostra
      // todos os polos juntos (ver ptRenderizarContingenciaPolos), então
      // precisa do estado de cada um já disponível antes de renderizar,
      // inclusive num F5 (esta função roda sempre em ptExibirConfigTravada).
      ptContingenciaPorPassagem[p.passagemId] = {
        em_contingencia: r.corpo.em_contingencia,
        contingencia_descricao: r.corpo.contingencia_descricao,
      };
    }
  }
}

// Resumo compacto (Etapa 4B, item 13: "não quero outra página enorme") —
// uma linha de agregados no topo (calculada aqui em cima do resultado já
// pronto de ptMontarResumoRevisao, função pura testada e inalterada) mais
// uma lista compacta por polo, no lugar da antiga tabela.
function ptAtualizarRevisaoTabela() {
  const tbody = document.getElementById("pt_revisao_tbody");
  if (!tbody) return;
  const resumo = ptMontarResumoRevisao(ptEstado.passagens, ptCacheDestinatarios, ptPendenciasPorPassagem, ptItensPorPassagem);

  const topoEl = document.getElementById("pt_revisao_resumo_topo");
  if (topoEl) {
    const destinatariosUnicos = new Set(ptEstado.passagens.map(p => p.destinatarioId)).size;
    const totalPendencias = resumo.reduce((soma, linha) => soma + linha.qtdPendencias, 0);
    const totalItens = resumo.reduce((soma, linha) => soma + linha.qtdItens, 0);
    topoEl.innerHTML = `
      <span><strong>${resumo.length}</strong>polo${resumo.length === 1 ? "" : "s"}</span>
      <span><strong>${destinatariosUnicos}</strong>destinatário${destinatariosUnicos === 1 ? "" : "s"}</span>
      <span><strong>${totalPendencias}</strong>pendência${totalPendencias === 1 ? "" : "s"}</span>
      <span><strong>${totalItens}</strong>informaç${totalItens === 1 ? "ão operacional" : "ões operacionais"}</span>
    `;
  }

  tbody.innerHTML = resumo
    .map(
      linha => `<div class="pt-revisao-linha">
        <div class="pt-revisao-linha-polo"><strong>${ptEscapar(linha.polo)}</strong><span class="pt-revisao-seta">&rarr;</span>${ptEscapar(linha.destinatarioNome)}</div>
        <div class="pt-revisao-linha-contagem">${linha.qtdPendencias} pendência${linha.qtdPendencias === 1 ? "" : "s"} &middot; ${linha.qtdItens} informaç${linha.qtdItens === 1 ? "ão" : "ões"}</div>
      </div>`
    )
    .join("");
}

function ptAtualizarBotaoEnviar() {
  const aceito = document.getElementById("pt_termo_checkbox").checked;
  document.getElementById("pt_btn_enviar").disabled = !aceito;
}

function ptMostrarErroEnvio(mensagem) {
  const el = document.getElementById("pt_envio_erro");
  el.textContent = mensagem || "";
  el.style.display = mensagem ? "block" : "none";
}

// Envia UMA passagem por vez pro endpoint já existente (POST .../enviar) —
// nenhum endpoint novo. Se alguma falhar no meio do caminho (ex.: 409 porque
// já foi enviada em outra aba), o rascunho local NÃO é limpo — o operador
// pode tentar de novo sem perder o que já foi preenchido (Etapa 4: "em caso
// de erro, nunca apagar os dados preenchidos pelo operador").
async function ptEnviarPassagens() {
  const botao = document.getElementById("pt_btn_enviar");
  botao.disabled = true;
  ptMostrarErroEnvio("");

  const enviadas = [];
  try {
    for (const p of ptEstado.passagens) {
      const r = await ptApi(`/api/passagens-turno/${p.passagemId}/enviar`, {
        method: "POST",
        headers: { ...ptHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ termo_responsabilidade_aceito: true }),
      });
      if (!r.ok) {
        ptMostrarErroEnvio(
          `Falha ao enviar a passagem de ${p.polo}: ${ptMensagemHttp(r)}` +
            (enviadas.length ? ` (${enviadas.length} de ${ptEstado.passagens.length} já enviada(s) com sucesso antes desta falha)` : "")
        );
        return;
      }
      enviadas.push({ ...p, enviadaEm: r.corpo.enviada_em });
    }
    ptMostrarConfirmacao(enviadas);
    ptLimparRascunhoSalvo();
  } finally {
    botao.disabled = false;
  }
}

/* ================= CONFIRMAÇÃO ================= */

function ptMostrarConfirmacao(enviadas) {
  const corpo = document.getElementById("pt_confirmacao_corpo");
  corpo.innerHTML = enviadas
    .map(p => {
      const nomeDest = ptNomeDestinatario(ptCacheDestinatarios, p.destinatarioId);
      const qtdPend = ptContarPendenciasAtivas(ptPendenciasPorPassagem[p.passagemId]);
      const qtdItens = ptContarItens(ptItensPorPassagem[p.passagemId]);
      return `<div><strong>${ptEscapar(p.polo)}</strong> → ${ptEscapar(nomeDest)}
        — ${ptEscapar(ptFormatarDataHoraBR(p.enviadaEm))} —
        ${qtdPend} pendência(s), ${qtdItens} informação(ões) operacional(is)</div>`;
    })
    .join("");
  document.getElementById("pt_corpo").hidden = true;
  document.getElementById("pt_confirmacao").hidden = false;
}

function ptIniciarNovaPassagem() {
  ptEstado = ptEstadoInicial();
  ptPendenciasPorPassagem = {};
  ptItensPorPassagem = {};
  ptContingenciaPorPassagem = {};
  ptContingenciaMarcados = new Set();
  ptContingenciaExpandida = false;
  ptPerguntasExpandidas = new Set();
  ptLimparRascunhoSalvo();
  document.getElementById("pt_erro_geral").style.display = "none";
  ptExibirConfigEditavel();
}

/* ================= EVENTOS ================= */

function ptConectarEventos() {
  document.querySelectorAll(".pt-turno-btn:not(#pt_turno_btn_outro)").forEach(btn => {
    btn.addEventListener("click", () => ptEscolherTurnoPreset(btn.dataset.turno));
  });
  document.getElementById("pt_turno_btn_outro").addEventListener("click", ptEscolherTurnoOutro);

  document.getElementById("pt_btn_bulk_aplicar").addEventListener("click", ptAplicarBulkDestinatario);
  document.getElementById("pt_btn_confirmar_config").addEventListener("click", ptConfirmarConfiguracao);
  document.getElementById("pt_btn_nova_passagem_topo").addEventListener("click", ptIniciarNovaPassagem);

  document.getElementById("pt_btn_ver_passagem_anterior").addEventListener("click", ptVerPassagemAnterior);
  document.getElementById("pt_btn_modal_item_salvar").addEventListener("click", ptSalvarModalItem);

  document.getElementById("pt_termo_checkbox").addEventListener("change", ptAtualizarBotaoEnviar);
  document.getElementById("pt_btn_enviar").addEventListener("click", ptEnviarPassagens);

  document.getElementById("pt_btn_nova_passagem").addEventListener("click", ptIniciarNovaPassagem);
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", ptConectarEventos);
}
