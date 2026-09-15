/* =========================================================
   MENSAGENS — CALLBACK WHATSAPP
   =========================================================
   Templates das mensagens padronizadas. Edite o texto livremente
   aqui — nada disso está preso na lógica do sistema (callback-whatsapp.js).

   Placeholders suportados (substituídos automaticamente):
     {{OPERADOR}}   -> Nome do Operador

   Para adicionar um novo placeholder no futuro (ex: {{OCORRENCIA}}),
   basta usar {{OCORRENCIA}} no texto abaixo e incluir a chave
   correspondente no objeto "dados" passado para preencherTemplate()
   em callback-whatsapp.js — não é preciso mexer em mais nada.
   ========================================================= */

const MENSAGENS_CALLBACK = {

  falta_energia_residencia: {
    label: "Falta de energia — Residência",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Estamos verificando sua ocorrência de falta de energia. Gostaria de confirmar algumas informações.

Sua residência continua sem energia?

Já foram realizados os testes?

• Disjuntor interno
• Disjuntor na medição

Aguardo seu retorno.`
  },

  falta_energia_geral: {
    label: "Falta de energia — Geral",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Estamos verificando sua ocorrência de falta de energia.

A falta de energia ocorre somente na sua residência ou também em outras residências da localidade?

Se possível, poderia nos informar se os imóveis próximos também estão sem energia?

Aguardo seu retorno.`
  },

  condutor_partido: {
    label: "Condutor partido",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Recebemos uma ocorrência de condutor partido.

Existe risco para pessoas ou veículos? Poderia nos dar mais informações?

Se possível, poderia nos enviar fotos ou vídeos?

Aguardo seu retorno.`
  },

  oscilacao_energia: {
    label: "Oscilação de energia",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Estamos verificando sua ocorrência de oscilação de energia.

Poderia nos informar se a oscilação continua acontecendo?

A oscilação ocorre em toda a residência ou apenas em algum ponto específico?

Se possível, poderia nos informar quando o problema começou e com que frequência está ocorrendo?

Aguardo seu retorno.`
  },

  choque_instalacao: {
    label: "Choque na instalação",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Estamos verificando sua ocorrência relacionada a choque elétrico.

Poderia nos informar onde o choque está sendo identificado?

• Dentro da residência
• Na caixa de medição
• No poste da residência
• Em poste da Energisa

Se houver risco de choque, evite tocar no local e mantenha distância até que a situação seja avaliada.

Aguardo seu retorno.`
  },

  tensao_alta: {
    label: "Tensão alta",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Recebemos uma ocorrência referente a tensão alta.

Poderia nos informar quais aparelhos ou equipamentos estão apresentando problema?

O problema está acontecendo neste momento?

Se possível, poderia nos informar quando começou e se ocorre de forma contínua ou em determinados momentos?

Aguardo seu retorno.`
  },

  faiscas_rede: {
    label: "Centelhamento na rede",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Recebemos uma ocorrência referente a faíscas na rede elétrica.

Poderia nos informar se as faíscas continuam ocorrendo e em qual local foram observadas?

Se possível, poderia nos enviar fotos ou vídeos da situação?

Por segurança, não se aproxime nem toque na rede elétrica.

Aguardo seu retorno.`
  },

  faiscas_ramal_servico: {
    label: "Centelhamento no ramal de serviço",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Recebemos uma ocorrência referente a faíscas no ramal de serviço.

Poderia nos informar se as faíscas continuam ocorrendo?

Se possível, poderia nos enviar fotos ou vídeos da situação?

Por segurança, não se aproxime nem toque nos fios ou equipamentos.

Aguardo seu retorno.`
  },

  defeito_disjuntor: {
    label: "Defeito no disjuntor",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Recebemos uma ocorrência referente a defeito no disjuntor.

Poderia nos informar se o imóvel continua sem energia?

O problema está no disjuntor localizado na caixa de medição?

Aguardo seu retorno.`
  },

  inversao_fase: {
    label: "Inversão de fase",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Recebemos uma ocorrência referente a possível inversão de fase.

Poderia nos informar qual equipamento ou aparelho está apresentando problema?

O problema ocorre, por exemplo, com algum motor funcionando no sentido contrário?

Aguardo seu retorno.`
  },

  defeito_transformador: {
    label: "Defeito no transformador",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Recebemos uma ocorrência referente a possível defeito no transformador.

Poderia nos informar o que foi observado no equipamento?

Foi percebido vazamento de óleo, barulho anormal, fumaça ou alguma outra situação?

Se possível, poderia nos enviar fotos ou vídeos?

Aguardo seu retorno.`
  },

  poste_abalroado: {
    label: "Poste abalroado",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Recebemos uma ocorrência referente a poste.

Poderia nos informar se o poste foi atingido por veículo ou se ocorreu algum outro tipo de dano?

Se possível, poderia nos enviar fotos ou vídeos da situação?

Aguardo seu retorno.`
  },

  poste_auxiliar_quebrado: {
    label: "Poste auxiliar quebrado",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Recebemos uma ocorrência referente a poste auxiliar.

Poderia nos informar a situação do poste e se existe algum risco para pessoas ou veículos?

Se possível, poderia nos enviar fotos ou vídeos da situação?

Aguardo seu retorno.`
  },

  problema_ramal_servico: {
    label: "Problema no ramal de serviço",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Recebemos uma ocorrência referente ao ramal de serviço.

Poderia nos informar qual problema foi identificado no ramal?

Existe algum fio solto, rompido, danificado ou alguma outra situação?

Se possível, poderia nos enviar fotos ou vídeos?

Aguardo seu retorno.`
  },

  arvore_rede: {
    label: "Árvore na rede",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Recebemos uma ocorrência referente a uma árvore na rede elétrica.

Poderia nos informar se a árvore está em contato com a rede elétrica ou se existe algum risco para pessoas ou veículos?

Se possível, poderia nos enviar fotos ou vídeos da situação? Essas informações ajudam a identificar a situação e avaliar a necessidade de atendimento.

Aguardo seu retorno.`
  },

  objeto_estranho_rede: {
    label: "Objeto estranho na rede",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Recebemos uma ocorrência referente a um objeto estranho na rede elétrica.

Poderia nos informar se o objeto é uma árvore, animal ou outro tipo de objeto sobre ou próximo à rede?

Se possível, poderia nos enviar fotos ou vídeos da situação? Essas informações ajudam a identificar o que está sobre a rede e avaliar a necessidade de atendimento.

Aguardo seu retorno.`
  },

  poste_inclinado: {
    label: "Poste inclinado",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Se possível, envie uma foto do poste inclinado. Informe também se o poste pertence à sua residência ou se é um poste da Energisa.`
  },

  incendio: {
    label: "Incêndio",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Se possível, envie uma foto ou vídeo do incêndio. Informe também se o incêndio está na caixa de medição da residência ou na rede elétrica da rua.`
  },

  tensao_baixa: {
    label: "Tensão baixa",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Recebemos uma ocorrência referente a tensão baixa.

Poderia nos informar quais aparelhos ou equipamentos estão apresentando problema?

O problema está acontecendo neste momento?

Se possível, poderia nos informar quando começou e se ocorre de forma contínua ou em determinados momentos?

Aguardo seu retorno.`
  },

  transformador_oleo: {
    label: "Transformador vazando óleo",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Se possível, envie uma foto ou vídeo do transformador e do vazamento de óleo, para que possamos verificar melhor a situação.`
  },

  condutor_desnivelado: {
    label: "Condutor desnivelado",
    texto:
`Olá! Aqui é a Energisa. Meu nome é {{OPERADOR}}.

Se possível, envie uma foto ou vídeo do condutor desnivelado, para que possamos verificar melhor a situação.`
  }

};

/* Saudação usada no início do modo "Mensagem Personalizada".
   Fica aqui (e não no callback-whatsapp.js) pelo mesmo motivo dos
   templates acima: é conteúdo, não lógica. */
function saudacaoPersonalizada(nomeOperador) {
  const nome = (nomeOperador || "").trim() || "____";
  return `Olá!\nAqui é a Energisa.\nMeu nome é ${nome}.\n\n`;
}
