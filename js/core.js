function showToast(msg){
 const t=document.getElementById("toast");
 t.innerText=msg;
 t.style.display="block";
 setTimeout(()=>t.style.display="none",2000);
}

function openModule(id,btn){
 document.querySelectorAll('.module').forEach(m=>m.classList.remove('active'));
 document.querySelectorAll('.menu button').forEach(b=>b.classList.remove('active'));
 document.getElementById(id).classList.add('active');
 btn.classList.add('active');
 // Tela ampla: só a Gestão de Equipes precisa da largura toda (a lista de
 // equipes cresce; ver css/equipes.css) — qualquer outro módulo mantém a
 // sidebar normal. Um único ponto de decisão aqui evita que cada módulo
 // precise gerenciar isso por conta própria.
 document.body.classList.toggle('modo-tela-ampla', id === 'equipes');
}

// VERSÃO DEMONSTRATIVA: abre o placeholder único "#em_desenvolvimento" em
// vez do módulo real (Pendências/Passagem de Turno/Histórico/Administração)
// — nunca executa o código original do módulo, nunca chama a API.
function abrirEmDesenvolvimento(nomeModulo, btn) {
 openModule('em_desenvolvimento', btn);
 document.getElementById('em_dev_nome').textContent = nomeModulo;
}

// VERSÃO DEMONSTRATIVA: abre o placeholder "#material_removido" — usado
// pelos itens cujas imagens originais (mapas/*.jpg) continham dados
// operacionais internos reais e foram deletadas desta cópia.
function abrirMaterialRemovido(btn) {
 openModule('material_removido', btn);
}

function atualizarRodape(){
    const agora = new Date();

    const data = agora.toLocaleDateString("pt-BR");
    const hora = agora.toLocaleTimeString("pt-BR", {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    document.getElementById("dataHoraSistema").innerText = data + " " + hora;
}

setInterval(atualizarRodape, 1000);
atualizarRodape();
