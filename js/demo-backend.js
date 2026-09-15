/* ============================================================
   BACKEND SIMULADO — COI SERGIPE (VERSÃO DEMONSTRATIVA)
   ============================================================
   Este arquivo substitui COMPLETAMENTE o backend real (FastAPI +
   PostgreSQL) para fins de demonstração pública. Intercepta
   window.fetch: qualquer chamada a um caminho iniciado por "/api/"
   é respondida aqui mesmo, com dados FICTÍCIOS mantidos em
   localStorage — nenhuma requisição sai do navegador.

   Implementa fielmente o contrato de /api/teams/* (Gestão de
   Equipes + Mapa Operacional, ver backend/app/routers/equipes.py e
   backend/app/schemas/equipes.py no projeto original) para que o
   módulo funcione de verdade nesta demo, com dados de mentira.

   Qualquer outra rota /api/* (auth, pendencias, passagens-turno,
   admin) — que nesta demo não deveria ser chamada, pois os módulos
   correspondentes foram pausados (ver js/demo-em-desenvolvimento.js)
   — recebe aqui uma resposta seguros (nunca erro de rede), só como
   proteção extra caso algum código residual tente chamar.

   Nenhum nome, telefone, e-mail, matrícula ou ocorrência real da
   Energisa aparece neste arquivo — tudo abaixo é fictício, criado
   só para esta demonstração.
*/

(function () {
  "use strict";

  const DB_KEY = "coi_demo_db_v1";

  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function hojeISO() {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mes + "-" + dia;
  }

  function somarDiasISO(dataISO, dias) {
    const [a, m, d] = dataISO.split("-").map(Number);
    const dt = new Date(a, m - 1, d);
    dt.setDate(dt.getDate() + dias);
    const mes = String(dt.getMonth() + 1).padStart(2, "0");
    const dia = String(dt.getDate()).padStart(2, "0");
    return dt.getFullYear() + "-" + mes + "-" + dia;
  }

  /* ================= DADOS FICTÍCIOS (SEED) ================= */

  function montarSeed() {
    // Nomes de polo/município/localidade abaixo são as 7 regionais REAIS já
    // presentes em geodata/ (fronteiras públicas do IBGE, já no projeto
    // original) — mantidos aqui de propósito para que "Mapas das Regionais"
    // (js/mapas-regionais.js, casamento por NOME normalizado com o GeoJSON,
    // nunca por slug_geojson inventado aqui) funcione de verdade na demo.
    // Nenhum dado abaixo além desses nomes de município é real: telefones,
    // viaturas, operadores e ocorrências (montados mais abaixo) são 100%
    // fictícios, criados só para esta demonstração.
    const localidades = [
      { id: uuid(), polo: "Aracaju", municipio: "Aracaju", codigo_operacional: null, nome: "Aracaju", slug_territorial: "aracaju-aracaju-aracaju", aliases: [], tipo: "MUNICIPIO", caso_especial: false, slug_geojson: null, latitude: -10.9472, longitude: -37.0731 },
      { id: uuid(), polo: "São Cristóvão", municipio: "São Cristóvão", codigo_operacional: null, nome: "São Cristóvão", slug_territorial: "sao-cristovao-sao-cristovao-sao-cristovao", aliases: [], tipo: "MUNICIPIO", caso_especial: false, slug_geojson: null, latitude: -11.0144, longitude: -37.2058 },
      { id: uuid(), polo: "Itabaiana", municipio: "Itabaiana", codigo_operacional: "D01", nome: "Itabaiana", slug_territorial: "itabaiana-itabaiana-itabaiana", aliases: [], tipo: "MUNICIPIO", caso_especial: false, slug_geojson: null, latitude: -10.6849, longitude: -37.4181 },
      { id: uuid(), polo: "Lagarto", municipio: "Lagarto", codigo_operacional: "D02", nome: "Lagarto", slug_territorial: "lagarto-lagarto-lagarto", aliases: [], tipo: "MUNICIPIO", caso_especial: false, slug_geojson: null, latitude: -10.9099, longitude: -37.6580 },
      { id: uuid(), polo: "Propriá", municipio: "Propriá", codigo_operacional: "D03", nome: "Propriá", slug_territorial: "propria-propria-propria", aliases: [], tipo: "MUNICIPIO", caso_especial: false, slug_geojson: null, latitude: -10.2088, longitude: -36.8419 },
      { id: uuid(), polo: "Maruim", municipio: "Maruim", codigo_operacional: "D04", nome: "Maruim", slug_territorial: "maruim-maruim-maruim", aliases: [], tipo: "MUNICIPIO", caso_especial: false, slug_geojson: null, latitude: -10.7386, longitude: -37.0906 },
      { id: uuid(), polo: "Dores", municipio: "Dores", codigo_operacional: "D05", nome: "Dores", slug_territorial: "dores-dores-dores", aliases: [], tipo: "MUNICIPIO", caso_especial: false, slug_geojson: null, latitude: -10.4750, longitude: -37.1928 },
    ];

    const operadores = [
      { id: uuid(), nome: "Ana Demonstração", matricula: "DEMO-001" },
      { id: uuid(), nome: "Bruno Demonstração", matricula: "DEMO-002" },
      { id: uuid(), nome: "Carla Demonstração", matricula: "DEMO-003" },
      { id: uuid(), nome: "Diego Demonstração", matricula: "DEMO-004" },
      { id: uuid(), nome: "Elaine Demonstração", matricula: "DEMO-005" },
      { id: uuid(), nome: "Fábio Demonstração", matricula: "DEMO-006" },
    ];

    const cursos = [
      { id: uuid(), nome: "NR-10 (fictício)", ativo: true },
      { id: uuid(), nome: "NR-35 (fictício)", ativo: true },
      { id: uuid(), nome: "Direção Defensiva (fictício)", ativo: true },
      { id: uuid(), nome: "Primeiros Socorros (fictício)", ativo: true },
    ];

    const equipes = [
      { id: uuid(), identificador: "EQ-DEMO-01", nome: "EQ-DEMO-01", polo: "Aracaju", ativo: true, curso_ids: [cursos[0].id] },
      { id: uuid(), identificador: "EQ-DEMO-02", nome: "EQ-DEMO-02", polo: "Itabaiana", ativo: true, curso_ids: [] },
      { id: uuid(), identificador: "EQ-DEMO-03", nome: "EQ-DEMO-03", polo: "Lagarto", ativo: true, curso_ids: [cursos[1].id] },
    ];

    const hoje = hojeISO();
    const operacoes = [
      {
        id: uuid(), equipe_id: equipes[0].id, data: hoje,
        hora_inicio: "07:00", hora_fim: "19:00",
        telefone: "(79) 90000-0001", viatura_numero: "DEMO-0001", radio_status: "FUNCIONANDO",
        posicao_localidade_id: localidades[0].id, areas_atuacao_localidade_ids: [localidades[0].id],
        status: "DISPONIVEL", observacao: null, operador_ids: [operadores[0].id, operadores[1].id],
      },
      {
        id: uuid(), equipe_id: equipes[1].id, data: hoje,
        hora_inicio: "19:00", hora_fim: "07:00",
        telefone: "(79) 90000-0002", viatura_numero: "DEMO-0002", radio_status: "FUNCIONANDO",
        posicao_localidade_id: localidades[2].id, areas_atuacao_localidade_ids: [localidades[2].id],
        status: "EM_ATENDIMENTO", observacao: "Ocorrência fictícia de demonstração.", operador_ids: [operadores[2].id],
      },
      {
        id: uuid(), equipe_id: equipes[2].id, data: hoje,
        hora_inicio: "07:00", hora_fim: "19:00",
        telefone: "(79) 90000-0003", viatura_numero: "DEMO-0003", radio_status: "NAO_FUNCIONANDO",
        posicao_localidade_id: localidades[3].id, areas_atuacao_localidade_ids: [localidades[3].id],
        status: "DESLOCAMENTO", observacao: null, operador_ids: [operadores[3].id, operadores[4].id],
      },
    ];

    return { localidades, operadores, cursos, equipes, operacoes, historico: [] };
  }

  function carregarDB() {
    try {
      const bruto = localStorage.getItem(DB_KEY);
      if (bruto) return JSON.parse(bruto);
    } catch (e) { /* localStorage indisponível/corrompido — recria abaixo */ }
    const seed = montarSeed();
    salvarDB(seed);
    return seed;
  }

  function salvarDB(db) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (e) { /* armazenamento cheio/indisponível — demo continua só em memória */ }
  }

  let DB = carregarDB();

  /* ================= HELPERS DE SERIALIZAÇÃO ================= */

  function rotuloExibicao(loc) {
    if (!loc.codigo_operacional) return loc.nome;
    return loc.codigo_operacional + " — " + loc.nome;
  }

  function localidadeOut(loc) {
    return {
      id: loc.id, polo: loc.polo, municipio: loc.municipio,
      codigo_operacional: loc.codigo_operacional, nome: loc.nome,
      slug_territorial: loc.slug_territorial, aliases: loc.aliases,
      tipo: loc.tipo, caso_especial: loc.caso_especial,
      slug_geojson: loc.slug_geojson, latitude: loc.latitude, longitude: loc.longitude,
      rotulo_exibicao: rotuloExibicao(loc),
    };
  }

  function localidadeResumo(loc) {
    return {
      id: loc.id, polo: loc.polo, municipio: loc.municipio, nome: loc.nome,
      codigo_operacional: loc.codigo_operacional, caso_especial: loc.caso_especial,
      rotulo_exibicao: rotuloExibicao(loc),
    };
  }

  function operadorOut(op) {
    return { id: op.id, nome: op.nome, matricula: op.matricula };
  }

  function cursoOut(c) {
    return { id: c.id, nome: c.nome };
  }

  function acharLocalidade(id) { return DB.localidades.find(l => l.id === id) || null; }
  function acharOperador(id) { return DB.operadores.find(o => o.id === id) || null; }
  function acharCurso(id) { return DB.cursos.find(c => c.id === id) || null; }
  function acharEquipe(id) { return DB.equipes.find(e => e.id === id) || null; }

  function calcularTurnoEncerrado(op) {
    const [ha, ma] = op.hora_inicio.split(":").map(Number);
    const [hf, mf] = op.hora_fim.split(":").map(Number);
    const [ano, mes, dia] = op.data.split("-").map(Number);
    let fim = new Date(ano, mes - 1, dia, hf, mf, 0);
    if (hf * 60 + mf <= ha * 60 + ma) fim.setDate(fim.getDate() + 1);
    return new Date() >= fim;
  }

  function operacaoOut(op) {
    const equipe = acharEquipe(op.equipe_id);
    const posicao = op.posicao_localidade_id ? acharLocalidade(op.posicao_localidade_id) : null;
    return {
      id: op.id, equipe_id: op.equipe_id, identificador: equipe ? equipe.identificador : "",
      polo: equipe ? equipe.polo : null, data: op.data, hora_inicio: op.hora_inicio, hora_fim: op.hora_fim,
      telefone: op.telefone, viatura_numero: op.viatura_numero, radio_status: op.radio_status,
      posicao: posicao ? localidadeResumo(posicao) : null,
      areas_atuacao: (op.areas_atuacao_localidade_ids || []).map(acharLocalidade).filter(Boolean).map(localidadeResumo),
      status: op.status, turno_encerrado: calcularTurnoEncerrado(op), observacao: op.observacao,
      operadores: (op.operador_ids || []).map(acharOperador).filter(Boolean).map(operadorOut),
      cursos: equipe ? (equipe.curso_ids || []).map(acharCurso).filter(Boolean).map(cursoOut) : [],
    };
  }

  function erro(status, detail) {
    return resposta(status, { detail: detail });
  }

  function resposta(status, body) {
    if (body === undefined || body === null) return new Response(null, { status: status });
    return new Response(JSON.stringify(body), { status: status, headers: { "Content-Type": "application/json" } });
  }

  function corpoOrdenadoPolos() {
    const s = new Set();
    DB.localidades.forEach(l => s.add(l.polo));
    DB.equipes.forEach(e => { if (e.polo) s.add(e.polo); });
    return Array.from(s).sort();
  }

  /* ================= ROTEAMENTO /api/teams/* ================= */

  function tratarTeams(path, method, params, body) {
    if (path === "/api/teams/polos" && method === "GET") {
      return resposta(200, corpoOrdenadoPolos());
    }

    if (path === "/api/teams/localidades" && method === "GET") {
      let lista = DB.localidades.slice();
      const polo = params.get("polo");
      const municipio = params.get("municipio");
      if (polo) lista = lista.filter(l => l.polo === polo);
      if (municipio) lista = lista.filter(l => l.municipio === municipio);
      lista.sort((a, b) => {
        if (a.polo !== b.polo) return a.polo < b.polo ? -1 : 1;
        const ca = a.codigo_operacional ? parseInt(a.codigo_operacional.replace(/\D/g, ""), 10) : null;
        const cb = b.codigo_operacional ? parseInt(b.codigo_operacional.replace(/\D/g, ""), 10) : null;
        if ((ca !== null) !== (cb !== null)) return ca !== null ? -1 : 1;
        if (ca !== null && cb !== null && ca !== cb) return ca - cb;
        if (a.municipio !== b.municipio) return a.municipio < b.municipio ? -1 : 1;
        return a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0;
      });
      return resposta(200, lista.map(localidadeOut));
    }

    if (path === "/api/teams/operators" && method === "GET") {
      const lista = DB.operadores.slice().sort((a, b) => (a.nome < b.nome ? -1 : 1));
      return resposta(200, lista.map(operadorOut));
    }

    if (path === "/api/teams/cursos" && method === "GET") {
      const lista = DB.cursos.filter(c => c.ativo).sort((a, b) => (a.nome < b.nome ? -1 : 1));
      return resposta(200, lista.map(cursoOut));
    }

    if (path === "/api/teams/cursos" && method === "POST") {
      const nome = (body && body.nome ? String(body.nome) : "").trim();
      if (!nome) return erro(422, "Informe o nome do curso.");
      const existente = DB.cursos.find(c => c.nome === nome);
      if (existente) {
        if (existente.ativo) return erro(409, "Já existe um curso com este nome");
        existente.ativo = true;
        salvarDB(DB);
        return resposta(201, cursoOut(existente));
      }
      const novo = { id: uuid(), nome: nome, ativo: true };
      DB.cursos.push(novo);
      salvarDB(DB);
      return resposta(201, cursoOut(novo));
    }

    if (path === "/api/teams/equipes" && method === "GET") {
      let lista = DB.equipes.filter(e => e.ativo);
      const q = params.get("q");
      const polo = params.get("polo");
      if (q) lista = lista.filter(e => e.identificador.toLowerCase().includes(q.toLowerCase()));
      if (polo) lista = lista.filter(e => e.polo === polo);
      lista = lista.slice().sort((a, b) => (a.identificador < b.identificador ? -1 : 1)).slice(0, 100);
      return resposta(200, lista.map(e => ({ id: e.id, identificador: e.identificador, nome: e.nome, polo: e.polo })));
    }

    if (path === "/api/teams/operations" && method === "GET") {
      const hoje = hojeISO();
      const limite = somarDiasISO(hoje, -6);
      const alvo = params.get("data") || hoje;
      if (alvo > hoje || alvo < limite) {
        return erro(400, "Data fora do intervalo permitido (hoje e os últimos 6 dias)");
      }
      let lista = DB.operacoes.filter(op => op.data === alvo);
      const polo = params.get("polo");
      const municipio = params.get("municipio");
      const statusFiltro = params.get("status");
      if (polo) lista = lista.filter(op => { const eq = acharEquipe(op.equipe_id); return eq && eq.polo === polo; });
      if (municipio) lista = lista.filter(op => { const loc = op.posicao_localidade_id ? acharLocalidade(op.posicao_localidade_id) : null; return loc && loc.municipio === municipio; });
      if (statusFiltro) lista = lista.filter(op => op.status === statusFiltro);
      lista = lista.slice().sort((a, b) => {
        const ea = acharEquipe(a.equipe_id), eb = acharEquipe(b.equipe_id);
        const ia = ea ? ea.identificador : "", ib = eb ? eb.identificador : "";
        return ia < ib ? -1 : ia > ib ? 1 : 0;
      });
      return resposta(200, lista.map(operacaoOut));
    }

    const matchHistorico = path.match(/^\/api\/teams\/operations\/([^/]+)\/historico$/);
    if (matchHistorico && method === "GET") {
      const opId = matchHistorico[1];
      const registros = DB.historico.filter(h => h.operacao_id === opId)
        .sort((a, b) => (a.criado_em < b.criado_em ? -1 : 1));
      return resposta(200, registros);
    }

    if (path === "/api/teams/operations" && method === "POST") {
      const dados = body || {};
      const operadorIds = Array.isArray(dados.operador_ids) ? dados.operador_ids : [];
      for (const id of operadorIds) {
        if (!acharOperador(id)) return erro(400, "Um ou mais operadores informados não existem");
      }
      const areasIds = Array.isArray(dados.areas_atuacao_localidade_ids) ? dados.areas_atuacao_localidade_ids.slice() : [];
      for (const id of areasIds) {
        if (!acharLocalidade(id)) return erro(400, "Uma ou mais localidades informadas não existem ou estão inativas");
      }
      if (dados.posicao_localidade_id) {
        if (!acharLocalidade(dados.posicao_localidade_id)) {
          return erro(400, "Uma ou mais localidades informadas não existem ou estão inativas");
        }
        if (!areasIds.includes(dados.posicao_localidade_id)) areasIds.unshift(dados.posicao_localidade_id);
      }

      const identificador = String(dados.identificador || "").trim().toUpperCase();
      if (!identificador) return erro(422, "Informe o identificador da equipe.");
      if (!dados.hora_inicio || !dados.hora_fim) return erro(422, "Informe o horário.");

      let equipe = DB.equipes.find(e => e.identificador === identificador);
      if (!equipe) {
        const cursoIds = Array.isArray(dados.curso_ids) ? dados.curso_ids : [];
        for (const id of cursoIds) {
          if (!acharCurso(id)) return erro(400, "Um ou mais cursos informados não existem ou estão inativos");
        }
        equipe = { id: uuid(), identificador: identificador, nome: identificador, polo: dados.polo || null, ativo: true, curso_ids: cursoIds };
        DB.equipes.push(equipe);
      }

      const hoje = hojeISO();
      const jaExiste = DB.operacoes.find(op => op.equipe_id === equipe.id && op.data === hoje);
      if (jaExiste) return erro(409, "Esta equipe já possui uma operação registrada para hoje");

      const nova = {
        id: uuid(), equipe_id: equipe.id, data: hoje,
        hora_inicio: dados.hora_inicio, hora_fim: dados.hora_fim,
        telefone: dados.telefone || null, viatura_numero: dados.viatura_numero || null,
        radio_status: dados.radio_status || null,
        posicao_localidade_id: dados.posicao_localidade_id || null,
        areas_atuacao_localidade_ids: areasIds,
        status: dados.status || "DISPONIVEL", observacao: dados.observacao || null,
        operador_ids: operadorIds,
      };
      DB.operacoes.push(nova);
      DB.historico.push({
        id: uuid(), operacao_id: nova.id, equipe_id: equipe.id, criado_em: new Date().toISOString(),
        acao: "EQUIPE_OPERACAO_CRIADA", campo_alterado: null, valor_anterior: null, valor_novo: null,
      });
      salvarDB(DB);
      return resposta(201, operacaoOut(nova));
    }

    const matchOperacao = path.match(/^\/api\/teams\/operations\/([^/]+)$/);
    if (matchOperacao && method === "PATCH") {
      const op = DB.operacoes.find(o => o.id === matchOperacao[1]);
      if (!op) return erro(404, "Operação não encontrada");
      if (op.data !== hojeISO()) return erro(409, "Somente a operação de hoje pode ser alterada — dias anteriores são histórico");

      const dados = body || {};
      const campos = Object.keys(dados);
      if (campos.length === 0) return erro(422, "Informe ao menos um campo para atualizar");

      let mudou = false;

      if (campos.includes("status") && dados.status != null && dados.status !== op.status) {
        op.status = dados.status; mudou = true;
      }
      if (campos.includes("posicao_localidade_id") && dados.posicao_localidade_id !== op.posicao_localidade_id) {
        if (dados.posicao_localidade_id) {
          if (!acharLocalidade(dados.posicao_localidade_id)) return erro(400, "Uma ou mais localidades informadas não existem ou estão inativas");
          op.posicao_localidade_id = dados.posicao_localidade_id;
          if (!op.areas_atuacao_localidade_ids.includes(dados.posicao_localidade_id)) {
            op.areas_atuacao_localidade_ids.push(dados.posicao_localidade_id);
          }
        } else {
          op.posicao_localidade_id = null;
        }
        mudou = true;
      }
      if (campos.includes("areas_atuacao_localidade_ids") && dados.areas_atuacao_localidade_ids != null) {
        const novosIds = Array.from(new Set(dados.areas_atuacao_localidade_ids));
        for (const id of novosIds) {
          if (!acharLocalidade(id)) return erro(400, "Uma ou mais localidades informadas não existem ou estão inativas");
        }
        if (op.posicao_localidade_id && !novosIds.includes(op.posicao_localidade_id)) novosIds.push(op.posicao_localidade_id);
        const antigosOrdenados = op.areas_atuacao_localidade_ids.slice().sort().join(",");
        const novosOrdenados = novosIds.slice().sort().join(",");
        if (antigosOrdenados !== novosOrdenados) { op.areas_atuacao_localidade_ids = novosIds; mudou = true; }
      }
      if (campos.includes("telefone") && dados.telefone !== op.telefone) { op.telefone = dados.telefone; mudou = true; }
      if (campos.includes("operador_ids") && dados.operador_ids != null) {
        for (const id of dados.operador_ids) {
          if (!acharOperador(id)) return erro(400, "Um ou mais operadores informados não existem");
        }
        const antigosOrdenados = op.operador_ids.slice().sort().join(",");
        const novosOrdenados = dados.operador_ids.slice().sort().join(",");
        if (antigosOrdenados !== novosOrdenados) { op.operador_ids = dados.operador_ids; mudou = true; }
      }
      if (campos.includes("hora_inicio") && (dados.hora_inicio !== op.hora_inicio || dados.hora_fim !== op.hora_fim)) {
        op.hora_inicio = dados.hora_inicio; op.hora_fim = dados.hora_fim; mudou = true;
      }
      if (campos.includes("viatura_numero") && dados.viatura_numero !== op.viatura_numero) { op.viatura_numero = dados.viatura_numero; mudou = true; }
      if (campos.includes("radio_status") && dados.radio_status !== op.radio_status) { op.radio_status = dados.radio_status; mudou = true; }
      if (campos.includes("curso_ids") && dados.curso_ids != null) {
        for (const id of dados.curso_ids) {
          if (!acharCurso(id)) return erro(400, "Um ou mais cursos informados não existem ou estão inativos");
        }
        const equipe = acharEquipe(op.equipe_id);
        const antigosOrdenados = (equipe.curso_ids || []).slice().sort().join(",");
        const novosOrdenados = dados.curso_ids.slice().sort().join(",");
        if (antigosOrdenados !== novosOrdenados) { equipe.curso_ids = dados.curso_ids; mudou = true; }
      }
      if (campos.includes("observacao") && dados.observacao !== op.observacao) { op.observacao = dados.observacao; mudou = true; }

      if (!mudou) return erro(400, "Nenhuma alteração detectada");

      DB.historico.push({
        id: uuid(), operacao_id: op.id, equipe_id: op.equipe_id, criado_em: new Date().toISOString(),
        acao: "OPERACAO_ATUALIZADA", campo_alterado: campos.join(", "), valor_anterior: null, valor_novo: null,
      });
      salvarDB(DB);
      return resposta(200, operacaoOut(op));
    }

    if (matchOperacao && method === "DELETE") {
      const idx = DB.operacoes.findIndex(o => o.id === matchOperacao[1]);
      if (idx === -1) return erro(404, "Operação não encontrada");
      const op = DB.operacoes[idx];
      if (op.data !== hojeISO()) return erro(409, "Somente a operação de hoje pode ser excluída — dias anteriores são histórico");
      DB.operacoes.splice(idx, 1);
      salvarDB(DB);
      return resposta(204, null);
    }

    return null; // rota /api/teams/* não reconhecida
  }

  /* ================= INTERCEPTAÇÃO DE window.fetch ================= */

  const fetchOriginal = window.fetch.bind(window);

  window.fetch = function (entrada, opcoes) {
    const urlStr = typeof entrada === "string" ? entrada : (entrada && entrada.url) || "";
    let urlObj;
    try {
      urlObj = new URL(urlStr, window.location.origin);
    } catch (e) {
      return fetchOriginal(entrada, opcoes);
    }

    if (!urlObj.pathname.startsWith("/api/")) {
      return fetchOriginal(entrada, opcoes);
    }

    const method = ((opcoes && opcoes.method) || "GET").toUpperCase();
    let corpoRequisicao = null;
    if (opcoes && opcoes.body) {
      try { corpoRequisicao = JSON.parse(opcoes.body); } catch (e) { corpoRequisicao = null; }
    }

    return new Promise(function (resolve) {
      setTimeout(function () {
        let respostaFinal = null;
        if (urlObj.pathname.startsWith("/api/teams/")) {
          respostaFinal = tratarTeams(urlObj.pathname, method, urlObj.searchParams, corpoRequisicao);
        }
        if (!respostaFinal) {
          // Rota não implementada no backend simulado (ex.: módulo pausado
          // nesta demo) — resposta segura, nunca erro de rede/exceção.
          respostaFinal = erro(503, "Recurso não disponível na versão demonstrativa.");
        }
        resolve(respostaFinal);
      }, 120);
    });
  };
})();
