/* MAPA REGIONAL INTERATIVO — base estática versionada dos polos.
   Cada município é identificado pelo CÓDIGO IBGE (chave da associação com a
   geometria) e traz o "codigo" operacional do polo, exibido sobre o mapa, na
   lista, no tooltip e no painel. Nomes = malha oficial do IBGE.

   Os números foram incorporados por decisão do responsável pelo projeto
   (2026-11-14), a partir das imagens de referência das 5 regionais e das
   correções confirmadas. A ordem da lista aqui é alfabética; a interface ordena
   pelo código.

   A geometria (caminhos SVG) fica separada, em js/mapa-regional/geometria.js,
   gerada a partir de geodata/ — "geodata" abaixo é o slug da pasta de origem. */

const MAPA_REGIONAL_DADOS = {
  regionais: [
    {
      id: "itabaiana", nome: "Itabaiana", geodata: "itabaiana",
      municipios: [
        { ibge: "2800506", codigo: "50", nome: "Areia Branca" },
        { ibge: "2801009", codigo: "60", nome: "Campo do Brito" },
        { ibge: "2801405", codigo: "70", nome: "Carira" },
        { ibge: "2802304", codigo: "80", nome: "Frei Paulo" },
        { ibge: "2802908", codigo: "30", nome: "Itabaiana" },
        { ibge: "2803708", codigo: "90", nome: "Macambira" },
        { ibge: "2803906", codigo: "100", nome: "Malhador" },
        { ibge: "2804102", codigo: "110", nome: "Moita Bonita" },
        { ibge: "2804458", codigo: "120", nome: "Nossa Senhora Aparecida" },
        { ibge: "2805000", codigo: "130", nome: "Pedra Mole" },
        { ibge: "2805208", codigo: "140", nome: "Pinhão" },
        { ibge: "2806008", codigo: "150", nome: "Ribeirópolis" },
        { ibge: "2806800", codigo: "160", nome: "São Domingos" },
        { ibge: "2807006", codigo: "170", nome: "São Miguel do Aleixo" },
      ],
    },
    {
      id: "lagarto", nome: "Lagarto", geodata: "lagarto",
      municipios: [
        { ibge: "2803500", codigo: "180", nome: "Lagarto" },
        { ibge: "2805505", codigo: "200", nome: "Poço Verde" },
        { ibge: "2806206", codigo: "190", nome: "Salgado" },
        { ibge: "2807105", codigo: "210", nome: "Simão Dias" },
      ],
    },
    {
      id: "gloria", nome: "Glória", geodata: "dores",
      municipios: [
        { ibge: "2801207", codigo: "350", nome: "Canindé de São Francisco" },
        { ibge: "2801306", codigo: "360", nome: "Capela" },
        { ibge: "2801900", codigo: "370", nome: "Cumbe" },
        { ibge: "2802205", codigo: "380", nome: "Feira Nova" },
        { ibge: "2802403", codigo: "390", nome: "Gararu" },
        { ibge: "2802601", codigo: "400", nome: "Graccho Cardoso" },
        { ibge: "2803104", codigo: "410", nome: "Itabi" },
        { ibge: "2804201", codigo: "420", nome: "Monte Alegre de Sergipe" },
        { ibge: "2804508", codigo: "430", nome: "Nossa Senhora da Glória" },
        { ibge: "2804607", codigo: "340", nome: "Nossa Senhora das Dores" },
        { ibge: "2804706", codigo: "440", nome: "Nossa Senhora de Lourdes" },
        { ibge: "2805406", codigo: "450", nome: "Poço Redondo" },
        { ibge: "2805604", codigo: "461", nome: "Porto da Folha" },
      ],
    },
    {
      id: "propria", nome: "Propriá", geodata: "propria",
      municipios: [
        { ibge: "2800100", codigo: "480", nome: "Amparo do São Francisco" },
        { ibge: "2800209", codigo: "490", nome: "Aquidabã" },
        { ibge: "2800704", codigo: "700", nome: "Brejo Grande" },
        { ibge: "2801108", codigo: "510", nome: "Canhoba" },
        { ibge: "2801603", codigo: "521", nome: "Cedro de São João" },
        { ibge: "2802700", codigo: "530", nome: "Ilha das Flores" },
        { ibge: "2803401", codigo: "541", nome: "Japoatã" },
        { ibge: "2803807", codigo: "550", nome: "Malhada dos Bois" },
        { ibge: "2804300", codigo: "560", nome: "Muribeca" },
        { ibge: "2804409", codigo: "570", nome: "Neópolis" },
        { ibge: "2804904", codigo: "580", nome: "Pacatuba" },
        { ibge: "2805703", codigo: "468", nome: "Propriá" },
        { ibge: "2806404", codigo: "590", nome: "Santana do São Francisco" },
        { ibge: "2806909", codigo: "600", nome: "São Francisco" },
        { ibge: "2807303", codigo: "500", nome: "Telha" },
      ],
    },
    {
      id: "maruim", nome: "Maruim", geodata: "maruim",
      municipios: [
        { ibge: "2801504", codigo: "230", nome: "Carmópolis" },
        { ibge: "2802007", codigo: "240", nome: "Divina Pastora" },
        { ibge: "2802502", codigo: "250", nome: "General Maynard" },
        { ibge: "2803302", codigo: "260", nome: "Japaratuba" },
        { ibge: "2803609", codigo: "270", nome: "Laranjeiras" },
        { ibge: "2804003", codigo: "220", nome: "Maruim" },
        { ibge: "2805307", codigo: "280", nome: "Pirambu" },
        { ibge: "2805901", codigo: "290", nome: "Riachuelo" },
        { ibge: "2806107", codigo: "300", nome: "Rosário do Catete" },
        { ibge: "2806503", codigo: "310", nome: "Santa Rosa de Lima" },
        { ibge: "2806602", codigo: "320", nome: "Santo Amaro das Brotas" },
        { ibge: "2807204", codigo: "330", nome: "Siriri" },
      ],
    },

    /* ---- EXPANSÃO (fonte "ibge-2022"): áreas com bairros e localidades ----
       Geometria em js/mapa-regional/geometria-expansao.js e metadados dos bairros e
       localidades em js/mapa-regional/subdivisoes.js (gerados de geodata/ibge-2022/).
       O código é do MUNICÍPIO inteiro (polo): os bairros NÃO recebem código. */
    {
      id: "aracaju", nome: "Aracaju", tipo: "regional", geodata: "aracaju", fonte: "ibge-2022",
      municipios: [
        { ibge: "2800308", codigo: "001", nome: "Aracaju" },
        { ibge: "2800605", codigo: "010", nome: "Barra dos Coqueiros" },
        { ibge: "2804805", codigo: "020", nome: "Nossa Senhora do Socorro" },
      ],
    },
    {
      id: "sao-cristovao", nome: "São Cristóvão", tipo: "area", geodata: "sao-cristovao", fonte: "ibge-2022",
      municipios: [
        { ibge: "2806701", codigo: "620", nome: "São Cristóvão" },
      ],
    },
    {
      id: "itaporanga", nome: "Itaporanga d'Ajuda", tipo: "area", geodata: "itaporanga", fonte: "ibge-2022",
      // limite municipal = referência; a área operacional exata ainda não foi delimitada
      aviso: "Limite municipal do IBGE usado como referência geográfica. A área de atendimento informada alcança a Caueira e a parte superior do município — delimitação operacional ainda não confirmada.",
      municipios: [
        { ibge: "2803203", codigo: null, nome: "Itaporanga d'Ajuda" }, // código a confirmar pelo usuário
      ],
    },
  ],
};

if (typeof module !== "undefined") module.exports = { MAPA_REGIONAL_DADOS };
