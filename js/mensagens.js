/* =========================================================
   MENSAGENS — CALLBACK WHATSAPP
   =========================================================
   Conteúdo copiado da Central Callback Web 1.1.0 (js/modelos.js da
   referência): somente as 23 mensagens de seleção manual
   (gatilho "manual"). As 4 mensagens automáticas da Central
   (abertura, abertura de risco, previsão e encerramento) NÃO entram
   aqui de propósito.

   - grupo:      assunto (vira <optgroup> em negrito no seletor)
   - label:      título exibido na lista (igual à Central)
   - prioridade: true nos subtipos de RISCO da Central (marca
                 "⚠ PRIORIDADE" ao lado do título; não muda a ordem)
   - texto:      texto exato da Central, já com a saudação
                 institucional "Olá, aqui é a Energisa."

   A ordem abaixo é a mesma da Central: assunto e título em ordem
   alfabética (pt-BR). Não editar os textos sem atualizar a Central.
   ========================================================= */

/* Saudação institucional aprovada na Central Callback Web 1.1.0. */
const SAUDACAO_CALLBACK = "Olá, aqui é a Energisa.";

const MENSAGENS_CALLBACK = {

  manual_choque_eletrico: {
    grupo: "Choque, faíscas e incêndio",
    label: "Choque elétrico",
    prioridade: true,
    texto: "Olá, aqui é a Energisa. Estamos verificando sua ocorrência relacionada a choque elétrico. Se houver risco de choque, evite tocar no local e mantenha distância até que a situação seja avaliada. Poderia nos informar onde o choque está sendo identificado (dentro da residência, na caixa de medição, no poste da residência ou em poste da Energisa)? Responda esta mensagem para continuar o atendimento."
  },

  manual_faiscas_rede: {
    grupo: "Choque, faíscas e incêndio",
    label: "Faíscas na rede",
    prioridade: true,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente a faíscas na rede elétrica. Por segurança, não se aproxime nem toque na rede elétrica. Poderia nos informar se as faíscas continuam ocorrendo e em qual local foram observadas? Responda esta mensagem para continuar o atendimento."
  },

  manual_faiscas_ramal: {
    grupo: "Choque, faíscas e incêndio",
    label: "Faíscas no ramal de serviço",
    prioridade: true,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente a faíscas no ramal de serviço. Por segurança, não se aproxime nem toque nos fios ou equipamentos. Poderia nos informar se as faíscas continuam ocorrendo? Responda esta mensagem para continuar o atendimento."
  },

  manual_incendio: {
    grupo: "Choque, faíscas e incêndio",
    label: "Incêndio",
    prioridade: true,
    texto: "Olá, aqui é a Energisa. Se houver pessoa ferida, ligue agora para 193 (Bombeiros). Por segurança, mantenha distância de cabos e postes e não toque em nada. O incêndio está na caixa de medição da residência ou na rede elétrica da rua? Responda esta mensagem para continuar o atendimento."
  },

  manual_falta_energia: {
    grupo: "Falta de energia",
    label: "Falta de energia — residência",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Estamos verificando sua ocorrência de falta de energia. Sua residência continua sem energia? Já foram realizados os testes no disjuntor interno e no disjuntor na medição? Responda esta mensagem para continuar o atendimento."
  },

  manual_falta_energia_geral: {
    grupo: "Falta de energia",
    label: "Falta de energia geral — confirmação com vizinhos",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Estamos entrando em contato referente a uma solicitação de falta de energia. Poderia nos informar se a falta de energia está acontecendo apenas na sua residência ou se os vizinhos da localidade também estão sem energia?"
  },

  manual_atualizacao: {
    grupo: "Geral",
    label: "Solicitação não identificada — pedir mais informações",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Estamos entrando em contato referente a uma solicitação que você registrou conosco. Você poderia nos fornecer mais informações sobre a situação?"
  },

  manual_poste_abalroado: {
    grupo: "Poste",
    label: "Poste abalroado",
    prioridade: true,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente a poste. Por segurança, mantenha distância de cabos e postes e não toque em nada. Poderia nos informar se o poste foi atingido por veículo ou se ocorreu algum outro tipo de dano? Responda esta mensagem para continuar o atendimento."
  },

  manual_poste_auxiliar_quebrado: {
    grupo: "Poste",
    label: "Poste auxiliar quebrado",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente a poste auxiliar. Poderia nos informar a situação do poste e se existe algum risco para pessoas ou veículos? Responda esta mensagem para continuar o atendimento."
  },

  manual_poste_ferragens_expostas: {
    grupo: "Poste",
    label: "Poste com ferragens expostas",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Estamos entrando em contato referente à ocorrência de ferragens expostas em um poste. Para nos ajudar a compreender melhor a situação, poderia enviar uma foto do local, caso seja seguro realizar o registro? Não se aproxime do poste nem toque em estruturas ou componentes da rede elétrica."
  },

  manual_poste_inclinado: {
    grupo: "Poste",
    label: "Poste inclinado",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente a poste inclinado. Poderia nos informar se o poste pertence à sua residência ou se é um poste da Energisa? Responda esta mensagem para continuar o atendimento."
  },

  manual_defeito_disjuntor: {
    grupo: "Ramal, medição e disjuntor",
    label: "Defeito no disjuntor",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente a defeito no disjuntor. Poderia nos informar se o imóvel continua sem energia? O problema está no disjuntor localizado na caixa de medição? Responda esta mensagem para continuar o atendimento."
  },

  manual_problema_ramal: {
    grupo: "Ramal, medição e disjuntor",
    label: "Problema no ramal de serviço",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente ao ramal de serviço. Poderia nos informar qual problema foi identificado no ramal? Existe algum fio solto, rompido, danificado ou alguma outra situação? Responda esta mensagem para continuar o atendimento."
  },

  manual_arvore_rede: {
    grupo: "Rede e condutores",
    label: "Árvore na rede",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente a uma árvore na rede elétrica. Poderia nos informar se a árvore está em contato com a rede elétrica ou se existe algum risco para pessoas ou veículos? Responda esta mensagem para continuar o atendimento."
  },

  manual_condutor_desnivelado: {
    grupo: "Rede e condutores",
    label: "Condutor desnivelado",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente a condutor desnivelado. Poderia nos dar mais informações sobre a situação? Responda esta mensagem para continuar o atendimento."
  },

  manual_condutor_partido: {
    grupo: "Rede e condutores",
    label: "Condutor partido",
    prioridade: true,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência de condutor partido. Por segurança, mantenha distância de cabos e postes e não toque em nada. Existe risco para pessoas ou veículos? Poderia nos dar mais informações? Responda esta mensagem para continuar o atendimento."
  },

  manual_objeto_estranho_rede: {
    grupo: "Rede e condutores",
    label: "Objeto estranho na rede",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente a um objeto estranho na rede elétrica. Poderia nos informar se o objeto é uma árvore, animal ou outro tipo de objeto sobre ou próximo à rede? Responda esta mensagem para continuar o atendimento."
  },

  manual_inversao_fase: {
    grupo: "Tensão e oscilação",
    label: "Inversão de fase",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente a possível inversão de fase. Poderia nos informar qual equipamento ou aparelho está apresentando problema? O problema ocorre, por exemplo, com algum motor funcionando no sentido contrário? Responda esta mensagem para continuar o atendimento."
  },

  manual_oscilacao: {
    grupo: "Tensão e oscilação",
    label: "Oscilação de energia",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Estamos verificando sua ocorrência de oscilação de energia. Poderia nos informar se a oscilação continua acontecendo? A oscilação ocorre em toda a residência ou apenas em algum ponto específico? Responda esta mensagem para continuar o atendimento."
  },

  manual_tensao_alta: {
    grupo: "Tensão e oscilação",
    label: "Tensão alta",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente a tensão alta. Poderia nos informar quais aparelhos ou equipamentos estão apresentando problema? O problema está acontecendo neste momento? Responda esta mensagem para continuar o atendimento."
  },

  manual_tensao_baixa: {
    grupo: "Tensão e oscilação",
    label: "Tensão baixa",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente a tensão baixa. Poderia nos informar quais aparelhos ou equipamentos estão apresentando problema? O problema está acontecendo neste momento? Responda esta mensagem para continuar o atendimento."
  },

  manual_defeito_transformador: {
    grupo: "Transformador",
    label: "Defeito no transformador",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente a possível defeito no transformador. Poderia nos informar o que foi observado no equipamento? Foi percebido vazamento de óleo, barulho anormal, fumaça ou alguma outra situação? Responda esta mensagem para continuar o atendimento."
  },

  manual_transformador_oleo: {
    grupo: "Transformador",
    label: "Transformador com vazamento de óleo",
    prioridade: false,
    texto: "Olá, aqui é a Energisa. Recebemos uma ocorrência referente a transformador com vazamento de óleo. Poderia nos informar o que foi observado no equipamento? Responda esta mensagem para continuar o atendimento."
  }

};

/* Saudação usada no início do modo "Mensagem Personalizada" — a mesma
   da Central 1.1.0 (sem o nome do operador). Fica aqui (e não no
   callback-whatsapp.js) porque é conteúdo, não lógica. */
function saudacaoPersonalizada() {
  return SAUDACAO_CALLBACK;
}
