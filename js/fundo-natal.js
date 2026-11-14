// FUNDO NATALINO — camada decorativa independente (ver css/fundo-natal.css).
// Não depende de nenhum outro script nem altera nenhum módulo.
//
// Fotografia estática do COI (assets/natal/fundo-coi-natal.png), com véu escuro e pequenos pontos de
// luz posicionados sobre as lâmpadas reais do pisca-pisca da foto (varal acima dos monitores e algumas
// lâmpadas da árvore). Só esses pontos piscam, suavemente, cada um no seu ritmo. A foto não se move.
// Com prefers-reduced-motion as luzes ficam paradas (regra no CSS).
//
// Para desligar: FUNDO_NATAL_ATIVO = false abaixo, ou abrir a página com ?natal=0.

const FUNDO_NATAL_ATIVO = true;

/* Posição de cada lâmpada em % da fotografia (1672×941): [x, y, cor].
   Cores: r = vermelho, g = verde, z = azul, a = amarelo, b = branco quente.
   Coordenadas medidas na própria foto (centro de cada lâmpada acesa). */
const FUNDO_NATAL_LUZES = [
  // varal acima dos monitores
  [27.30, 20.69, "r"],
  [28.37, 21.39, "z"],
  [29.37, 19.88, "r"],
  [30.64, 20.54, "z"],
  [32.30, 18.23, "g"],
  [33.39, 20.22, "r"],
  [34.46, 18.58, "r"],
  [35.24, 18.63, "r"],
  [35.34, 17.33, "r"],
  [35.99, 19.74, "g"],
  [36.89, 18.85, "r"],
  [39.42, 18.91, "a"],
  [41.01, 16.15, "b"],
  [42.22, 18.44, "g"],
  [45.16, 18.05, "r"],
  [46.63, 14.92, "a"],
  [47.46, 16.68, "b"],
  [48.42, 15.75, "z"],
  [50.09, 17.28, "a"],
  [52.36, 13.48, "b"],
  [52.79, 15.71, "a"],
  [56.20, 15.19, "r"],
  [57.98, 13.01, "g"],
  [63.78, 13.90, "z"],
  [65.84, 11.60, "g"],
  [67.44, 13.57, "r"],
  [70.73, 12.28, "r"],
  [72.23, 10.73, "r"],
  [73.29, 11.82, "b"],
  [74.75, 9.88, "g"],
  [76.15, 10.80, "r"],
  [79.24, 11.05, "r"],
  [80.14, 10.02, "r"],
  [82.28, 10.09, "z"],
  [84.86, 7.01, "a"],
  [84.90, 8.53, "r"],
  [87.02, 10.35, "b"],
  [90.11, 6.34, "g"],
  [91.90, 9.64, "r"],
  [93.90, 6.97, "a"],
  [96.88, 4.30, "r"],
  [97.00, 5.97, "r"],
  // �rvore (s� algumas l�mpadas, n�o a �rvore inteira)
  [22.19, 40.83, "z"],
  [21.70, 43.74, "b"],
  [19.90, 44.00, "a"],
  [23.39, 46.28, "b"],
  [24.83, 50.26, "z"],
  [19.01, 52.03, "a"],
  [23.64, 52.96, "b"],
  [21.24, 37.12, "r"],
  [23.27, 38.34, "r"]
];

/** Ritmo de cada luz, determinístico pelo índice (função pura — testada em fundo-natal.test.js).
    Durações de 2,4 s a 5,6 s, atrasos negativos (as luzes já começam em fases diferentes),
    intensidade mínima e máxima variando um pouco de lâmpada para lâmpada. */
function fundoNatalRitmo(i) {
  // pseudoaleatório simples e estável (mesmo resultado em toda carga da página)
  const r = (n) => {
    const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const dur = 2.4 + r(1) * 3.2;
  return {
    dur: +dur.toFixed(2),
    atraso: -+(r(2) * dur).toFixed(2),
    min: +(0.03 + r(3) * 0.09).toFixed(2),
    pico: +(0.90 + r(4) * 0.10).toFixed(2),
  };
}

function fundoNatalIniciar() {
  if (!FUNDO_NATAL_ATIVO || new URLSearchParams(location.search).get("natal") === "0") return;
  if (document.querySelector(".natal-bg")) return;

  const camada = document.createElement("div");
  camada.className = "natal-bg";
  camada.setAttribute("aria-hidden", "true");

  const palco = document.createElement("div");
  palco.className = "natal-palco";

  FUNDO_NATAL_LUZES.forEach(([x, y, cor], i) => {
    const ritmo = fundoNatalRitmo(i);
    const luz = document.createElement("span");
    luz.className = "natal-luz cor-" + cor;
    luz.style.left = x + "%";
    luz.style.top = y + "%";
    luz.style.setProperty("--dur", ritmo.dur + "s");
    luz.style.setProperty("--atraso", ritmo.atraso + "s");
    luz.style.setProperty("--min", ritmo.min);
    luz.style.setProperty("--pico", ritmo.pico);
    palco.appendChild(luz);
  });

  camada.appendChild(palco);
  document.body.insertBefore(camada, document.body.firstChild);
  document.documentElement.classList.add("natal-ativo");
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fundoNatalIniciar);
  else fundoNatalIniciar();
}

if (typeof module !== "undefined") module.exports = {fundoNatalRitmo, FUNDO_NATAL_LUZES};
