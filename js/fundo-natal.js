// FUNDO ANIMADO NATALINO — camada decorativa independente (ver css/fundo-natal.css).
// Não depende de nenhum outro script nem altera nenhum módulo. Vídeo de 20 s em loop contínuo, sem áudio.
//
// Escolha automática da versão:
//   - sistema pede menos movimento (prefers-reduced-motion) ou economia de dados → imagem estática;
//   - máquina com poucos recursos (≤ 4 núcleos ou ≤ 4 GB) ou tela pequena → vídeo 720p;
//   - navegador decodifica VP9 → WebM 1080p (menor); senão → MP4 H.264 1080p.
// O vídeo pausa quando a aba fica oculta e volta ao reabrir. Se o vídeo falhar, fica a imagem estática.
//
// Para desligar: FUNDO_NATAL_ATIVO = false abaixo, ou abrir a página com ?natal=0.

const FUNDO_NATAL_ATIVO = true;
const FUNDO_NATAL_PASTA = "assets/natal/";

/** Decide a versão do fundo a partir das capacidades do navegador (função pura — testada em fundo-natal.test.js). */
function fundoNatalEscolherFonte(amb) {
  if (amb.reduzirMovimento) return {tipo: "imagem", motivo: "menos movimento"};
  if (amb.economiaDados) return {tipo: "imagem", motivo: "economia de dados"};
  const fraco = (amb.nucleos || 8) <= 4 || (amb.memoriaGB || 8) <= 4;
  const telaPequena = amb.ladoMaiorPx < 1600;
  if (fraco || telaPequena) {
    return {tipo: "video", motivo: fraco ? "máquina com poucos recursos" : "tela pequena", fontes: [["natal-coi-720p.mp4", "video/mp4"]]};
  }
  const mp4 = ["natal-coi-1080p.mp4", "video/mp4"];
  if (amb.vp9) return {tipo: "video", motivo: "VP9", fontes: [["natal-coi-1080p.webm", "video/webm"], mp4]};
  return {tipo: "video", motivo: "H.264", fontes: [mp4]};
}

function fundoNatalIniciar() {
  if (!FUNDO_NATAL_ATIVO || new URLSearchParams(location.search).get("natal") === "0") return;
  if (document.querySelector(".natal-bg")) return;

  const amb = {
    reduzirMovimento: matchMedia("(prefers-reduced-motion: reduce)").matches,
    economiaDados: !!(navigator.connection && navigator.connection.saveData),
    nucleos: navigator.hardwareConcurrency,
    memoriaGB: navigator.deviceMemory,
    ladoMaiorPx: Math.max(screen.width, screen.height) * (devicePixelRatio || 1),
    vp9: document.createElement("video").canPlayType('video/webm; codecs="vp9"') === "probably",
  };
  const escolha = fundoNatalEscolherFonte(amb);

  const camada = document.createElement("div");
  camada.className = "natal-bg";
  camada.setAttribute("aria-hidden", "true");
  camada.dataset.versao = escolha.motivo;

  if (escolha.tipo === "imagem") {
    const img = document.createElement("img");
    img.src = FUNDO_NATAL_PASTA + "natal-coi-poster.jpg";
    img.alt = "";
    camada.appendChild(img);
  } else {
    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.disablePictureInPicture = true;
    video.poster = FUNDO_NATAL_PASTA + "natal-coi-poster-720.jpg";
    let ultima = null;
    for (const [arquivo, tipo] of escolha.fontes) {
      ultima = document.createElement("source");
      ultima.src = FUNDO_NATAL_PASTA + arquivo;
      ultima.type = tipo;
      video.appendChild(ultima);
    }
    // o navegador tenta as fontes em ordem; só quando a ÚLTIMA falha não há vídeo utilizável →
    // fica apenas a imagem estática do CSS
    ultima.addEventListener("error", () => video.remove());
    camada.appendChild(video);
    const tocar = () => video.play().catch(() => {});
    document.addEventListener("visibilitychange", () => (document.hidden ? video.pause() : tocar()));
    tocar();
  }

  document.body.insertBefore(camada, document.body.firstChild);
  document.documentElement.classList.add("natal-ativo");
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fundoNatalIniciar);
  else fundoNatalIniciar();
}

if (typeof module !== "undefined") module.exports = {fundoNatalEscolherFonte};
