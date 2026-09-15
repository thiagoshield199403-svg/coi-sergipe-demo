/* =========================================================
   STORAGE — CALLBACK WHATSAPP
   =========================================================
   Toda a persistência do histórico passa por aqui. Hoje é
   LocalStorage; quando migrar para um banco de dados, só este
   arquivo precisa mudar — historico.js e callback-whatsapp.js
   continuam chamando CallbackStorage.salvar()/listarTodos() do
   mesmo jeito.
   ========================================================= */

const CallbackStorage = (function () {

  const CHAVE = "coi_callback_whatsapp_historico";

  function listarTodos() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      return bruto ? JSON.parse(bruto) : [];
    } catch (erro) {
      console.warn("CallbackStorage: histórico corrompido, reiniciando.", erro);
      return [];
    }
  }

  function salvar(registro) {
    const lista = listarTodos();
    lista.unshift(registro); // mais recente primeiro
    try {
      localStorage.setItem(CHAVE, JSON.stringify(lista));
      return true;
    } catch (erro) {
      console.error("CallbackStorage: falha ao salvar no LocalStorage.", erro);
      return false;
    }
  }

  function limparTudo() {
    localStorage.removeItem(CHAVE);
  }

  return { listarTodos, salvar, limparTudo };

})();
