# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Internal operational tool for Energisa's COI (Centro de Operação Integrado) — a single-page "app" used by call-center staff to send standardized/personalized WhatsApp messages to customers (callback) and to access a handful of static utility references (regional maps, contractor map, technical tables) and external links (shift schedule, shift handover form). Pure static HTML/CSS/JS, no backend, no build tooling, no package manager. This directory **is** a git repository (`refactor/sistema-ferramentas` branch, off `main`) — commit locally as normal, but see the "Project status" section below for what must not happen yet.

## Running / previewing

There is no install or build step. Open `index.html` directly in a browser (or serve the folder with any static file server). All persistence is `localStorage`; there is no server component.

There is no test suite or linter. To sanity-check an edit without a browser:
- `node -c js/<file>.js` — validates JS syntax (catches broken template literals, stray tags pasted into a `.js` file, etc.)
- A quick Node one-liner to confirm CSS brace balance after editing `styles.css` / `css/callback-whatsapp.css`, e.g. counting `{` vs `}` — useful because the CSS has no build step to catch a mismatched brace.
- Grep for specific `id="..."`, `class="..."`, and `onclick="..."` strings before/after an edit to confirm nothing referenced by JS was renamed.

## ESTADO ATUAL (implementado e funcionando)

**Single-page shell, module-per-screen.** `index.html` contains each real screen as a `<div id="X" class="module">`. Only the module with `.active` is visible (`display:none` otherwise). `openModule(id, btn)` (defined in `js/core.js`) swaps the `.active` class on both the target `.module` and the clicked sidebar `<button>`. There is no router/URL state — refreshing the page always returns to the default module (`#inicio`, marked `active` in the HTML).

**Current modules / sidebar entries:**
- **Início** (`#inicio`) — placeholder welcome screen. No functionality yet; this is where the future home/dashboard will live.
- **Callback WhatsApp** (`#callback`) — the one fully-functional module. See below.
- **Central Callback Web** (ATENDIMENTO) — not an internal module; the sidebar button calls `abrirCentralCallback()` (inline in `index.html`), which opens `https://thiagoshield199403-svg.github.io/central-callback/` in a new tab via `window.open(url, "_blank", "noopener,noreferrer")`.
- **Mapa Regionais** (`#mapas_regionais`) — grid of clickable regional map images, opens `#modal-mapa` via `abrirMapa()`/`fecharMapa()` (`js/utilitarios.js`).
- **Mapa de Empreiteira** — same modal mechanism, single image (`mapas/mapa_empreiteiras.jpg`), triggered directly from the sidebar button (no dedicated `.module`).
- **Tabelas Técnicas** — opens `#modalTabela` (a plain `.modal` div, not a `.module`) via `abrirTabela()`/`fecharTabela()`, defined inline in `index.html`.
- **Escala** (GESTÃO) — not an internal module at all; the sidebar button calls `abrirEscala()` (inline in `index.html`), which opens the external schedule board (`https://adao175.github.io/Escala-operacional-coi-V2/`, GitHub Pages) in a new tab via `window.open(url, "_blank", "noopener,noreferrer")`.
- **Passagem de Turno** (GESTÃO) — not an internal module; the sidebar button calls `abrirPassagemTurno()` (inline in `index.html`), which opens the real Microsoft Power Apps shift-handover app in a new tab (`window.open(url, "_blank", "noopener,noreferrer")`). There is no local Passagem de Turno module and no "Histórico de Passagens" item.

**Removed (do not reintroduce without an explicit new request):** Bloqueios LV, Substituição de Trafo, Substituição de Poste, Mais Sinergia, Registro de Ocorrências, Preenchimento de SS, the old Gestão de Equipes/Pendências module, the later Pendências module (Todas/Comerciais/Técnicas — menu category, `#pendencias` screen, its modals, `js/pendencias.js`, `css/pendencias.css`, `js/pendencias.test.js`), the Cronômetro de Pick module, the Script Desarme module, the generic `step-wizard.js` engine that drove the Trafo/Poste wizards, and the old local Passagem de Turno / Histórico de Passagens modules (shift handover now lives in a separate Microsoft Power Apps system, reached only via the external link above). None of their JS files, HTML, or CSS remain in the working tree as of etapa 3.1.

**All `js/*.js` files load as classic `<script src>` tags (no ES modules, no bundler) and share one global scope.** Current files, each single-purpose:
- `js/core.js` — `showToast()`, `openModule()`, `atualizarRodape()` (footer clock, self-scheduling via `setInterval`). This is the sole definition of these three functions; do not redefine them elsewhere (index.html used to duplicate them inline — removed in etapa 3.1).
- `js/utilitarios.js` — `abrirMapa()`/`fecharMapa()` for the map modal (`#modal-mapa`). Sole definition; index.html used to duplicate these inline — removed in etapa 3.1.
- `js/mensagens.js`, `js/callback-whatsapp.js` — the Callback WhatsApp module, see below.

`abrirTabela()`/`fecharTabela()` (Tabelas Técnicas modal) and `abrirEscala()`/`abrirPassagemTurno()`/`abrirCentralCallback()` (external links) remain defined inline in `index.html`'s own `<script>` blocks — they have no JS-file counterpart and are not duplicated.

Several files rely on the browser's implicit global bindings for elements with an `id` (e.g. `ramal.value` instead of `document.getElementById('ramal').value`) in older patterns — this means **removing or renaming an `id` that's referenced this way breaks the referencing script even if you only touched the HTML**. Before deleting/renaming any `id`, grep the `js/` folder for bare references to that identifier, not just `getElementById` calls.

**WhatsApp callback module** (`#callback`) is split across two files (manual entry of operator, incident and phone — no CSV import, by design):
- `js/mensagens.js` — message *content* only: `SAUDACAO_CALLBACK` ("Olá, aqui é a Energisa."), `MENSAGENS_CALLBACK` (the 23 manual-selection messages of the Central Callback Web 1.1.0, copied verbatim from its `js/modelos.js`, each `{grupo, label, prioridade, texto}`, ordered by subject then title, pt-BR) and `saudacaoPersonalizada()`. The 4 automatic Central messages (abertura/previsão/encerramento) are intentionally NOT included. Do not edit texts without updating the Central.
- `js/callback-whatsapp.js` — orchestration: builds the `<select>` with one bold `<optgroup>` per subject ("⚠ PRIORIDADE" on risk subtypes, like the Central), renders the text (`Referência do atendimento: <incidente>` appended, like the Central), applies the greeting to the personalized mode (`cbwComSaudacao`), normalizes the phone only to add DDI 55 (no mobile-only restriction), and opens WhatsApp Web exactly like the Central: `window.open("about:blank", "_blank")` inside the click, `opener = null`, then navigates to `https://web.whatsapp.com/send?phone=55…&text=…`. Never use `wa.me`/`api.whatsapp.com` (they show an intermediate page and caused a second tab). Opening the chat does not send anything.
- `js/callback-whatsapp.test.js` — Node tests for the above.

The old message history (`js/storage.js`, `js/historico.js`, its UI and CSS) was removed. On init the module removes only the obsolete key `localStorage["coi_callback_whatsapp_historico"]`.

## ARMAZENAMENTO ATUAL

The Callback WhatsApp module persists nothing. Other modules use their own keys (e.g. `coi_demo_db_v1` for the demo backend, `coi_auth_sessao_demo` for the demo login) — never clear the whole `localStorage`. No backend, no database; data lives only in the browser that created it.

## AUSÊNCIA DE BACKEND / BANCO

There is no backend, no API, no server process (Node/Python/FastAPI/Express/etc.), and no database of any kind. No `package.json`, no build tooling, no dependencies. "Deploying" this app today means opening `index.html` or copying the folder to any static file host — there is no pipeline.

## PLANO FUTURO (ainda NÃO implementado)

The following are planned for later stages and **do not exist yet** anywhere in this codebase. Do not build them unless a task explicitly asks for that specific item, and do not assume any of this exists when reasoning about current behavior:
- Backend/API layer.
- PostgreSQL database.
- Individual operator login/authentication, user profiles.
- Access-request and admin-approval flow for new logins.
- Password-reset request flow.
- Audit logging (`AUDITORIA`).
- New shared, real-time Gestão de Equipes (distinct from the old removed module).
- Pendências Técnicas e Comerciais (distinct from the old removed module).
- Callback WhatsApp history/indicators backed by a database instead of `localStorage`, plus richer metrics.
- Desligamentos Programados.
- Automations / AI features of any kind.

A proposed entity/table design for the above exists only as a written analysis from the ETAPA 3 architecture review — nothing has been created in a database because no database exists yet.

## Design system (CSS)

`styles.css` defines the shared design tokens in `:root` (`--accent`, `--surface`, `--border`, `--radius-*`, `--shadow-*`, `--transition-*`, plus dedicated `--sidebar-*` tokens for the dark sidebar) and all global element/utility rules (`button`, `.sec`, `.btn-danger`, `.btn-icon-svg`, modal/toast styling, footer styling, per-module scoped overrides). `css/callback-whatsapp.css` is the one module-specific stylesheet (WhatsApp tab's phone mockup, tabs, subject optgroups) and reuses the same custom properties with fallback values (`var(--accent, #0b5394)`) since it's a separate file loaded after `styles.css`.

A number of CSS classes are toggled directly by JS at runtime and must keep their exact names even when restyled: `.module`/`.active` (module + sidebar nav), `.cbw-tab-btn.ativo`, `.cbw-campo-erro`, `.cbw-preview-vazio`, `.cbw-bolha-vazia`, `#modal-mapa` / `#modalTabela` display toggling. When restyling, change values, not selector names.

Note: a CSS section in `styles.css` is still labeled `/* ===== EFEITOS EQUIPES ===== */` even though the rules under it (`.footer-global` and friends) are the current global footer, unrelated to the old Equipes module — the label is stale but the rules themselves are live and in use. Left as-is in etapa 3.1 (comment-only, non-functional); fine to relabel in a future pass.

## Icons

Icons are hand-authored inline SVG (feather-style line icons, `stroke="currentColor"`, no external icon font/CDN) rather than emoji, applied via the `.menu-icon` (sidebar nav) and `.btn-icon-svg` (inline in action buttons) size classes. A few emoji remain intentionally in generated *content* (toast messages, copied report text) — those are message content, not UI icons, and are out of scope for icon-consistency work.
