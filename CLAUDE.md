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
- **Mapa Regionais** (`#mapas_regionais`) — grid of clickable regional map images, opens `#modal-mapa` via `abrirMapa()`/`fecharMapa()` (`js/utilitarios.js`).
- **Mapa de Empreiteira** — same modal mechanism, single image (`mapas/mapa_empreiteiras.jpg`), triggered directly from the sidebar button (no dedicated `.module`).
- **Tabelas Técnicas** — opens `#modalTabela` (a plain `.modal` div, not a `.module`) via `abrirTabela()`/`fecharTabela()`, defined inline in `index.html`.
- **Escala COI** / **Passagem de Turno** — not internal modules at all; sidebar buttons call `abrirEscala()`/`abrirTurno()` (inline in `index.html`), which just `window.open()` an external URL (GitHub Pages schedule board, Microsoft Forms shift handover).

**Removed (do not reintroduce without an explicit new request):** Bloqueios LV, Substituição de Trafo, Substituição de Poste, Mais Sinergia, Registro de Ocorrências, Preenchimento de SS, the old Gestão de Equipes/Pendências module, the Cronômetro de Pick module, the Script Desarme module, and the generic `step-wizard.js` engine that drove the Trafo/Poste wizards. None of their JS files, HTML, or CSS remain in the working tree as of etapa 3.1.

**All `js/*.js` files load as classic `<script src>` tags (no ES modules, no bundler) and share one global scope.** Current files, each single-purpose:
- `js/core.js` — `showToast()`, `openModule()`, `atualizarRodape()` (footer clock, self-scheduling via `setInterval`). This is the sole definition of these three functions; do not redefine them elsewhere (index.html used to duplicate them inline — removed in etapa 3.1).
- `js/utilitarios.js` — `abrirMapa()`/`fecharMapa()` for the map modal (`#modal-mapa`). Sole definition; index.html used to duplicate these inline — removed in etapa 3.1.
- `js/mensagens.js`, `js/storage.js`, `js/historico.js`, `js/callback-whatsapp.js` — the Callback WhatsApp module, see below.

`abrirTabela()`/`fecharTabela()` (Tabelas Técnicas modal) and `abrirEscala()`/`abrirTurno()` (external links) remain defined inline in `index.html`'s own `<script>` blocks — they have no JS-file counterpart and are not duplicated.

Several files rely on the browser's implicit global bindings for elements with an `id` (e.g. `ramal.value` instead of `document.getElementById('ramal').value`) in older patterns — this means **removing or renaming an `id` that's referenced this way breaks the referencing script even if you only touched the HTML**. Before deleting/renaming any `id`, grep the `js/` folder for bare references to that identifier, not just `getElementById` calls.

**WhatsApp callback module** (`#callback`) is split across four files:
- `js/mensagens.js` — message *content* only: `MENSAGENS_CALLBACK` (20 standardized templates keyed by occurrence type, each `{label, texto}` with `{{OPERADOR}}` placeholder) and `saudacaoPersonalizada()`. Zero logic, safe to edit freely.
- `js/storage.js` — `CallbackStorage`, a small `localStorage` wrapper (`listarTodos()` / `salvar()` / `limparTudo()`), the one module with an actual persistence abstraction. This is the intended seam for a future backend/database swap — `historico.js` and `callback-whatsapp.js` only ever call these three functions, never touch `localStorage` directly.
- `js/historico.js` — renders saved history from `CallbackStorage.listarTodos()`, escapes user content via `historicoEscapar()` before `innerHTML`.
- `js/callback-whatsapp.js` — orchestration: `cbwPreencherTemplate()` does `{{...}}` substitution, `cbwEnviar()` validates required fields, normalizes the phone number (auto-adds `55` DDI for 10/11-digit numbers), builds the `wa.me/<numero>?text=...` link, opens it via `window.open(link, "coiWhatsAppWeb")` (reuses the same named tab across sends), and saves the record via `CallbackStorage.salvar()`.

Fields used per callback record: operator name, occurrence number, client phone, mode (padronizada/personalizada), occurrence type, final sent text, status (always `"Enviado"` — reflects only that the WhatsApp link was opened, **not** delivery/read confirmation, since this is the public `wa.me` link, not the official WhatsApp Business API).

## ARMAZENAMENTO ATUAL

Only one persisted key exists in the entire project: `localStorage["coi_callback_whatsapp_historico"]`, an array of callback records (see `js/storage.js`), written/read exclusively through `CallbackStorage`. No `sessionStorage`, no cookies, no other `localStorage` keys, no JSON data files. Data lives only in the browser that created it — it does not sync between operators or machines.

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

`styles.css` defines the shared design tokens in `:root` (`--accent`, `--surface`, `--border`, `--radius-*`, `--shadow-*`, `--transition-*`, plus dedicated `--sidebar-*` tokens for the dark sidebar) and all global element/utility rules (`button`, `.sec`, `.btn-danger`, `.btn-icon-svg`, modal/toast styling, footer styling, per-module scoped overrides). `css/callback-whatsapp.css` is the one module-specific stylesheet (WhatsApp tab's phone mockup, tabs, history list) and reuses the same custom properties with fallback values (`var(--accent, #0b5394)`) since it's a separate file loaded after `styles.css`.

A number of CSS classes are toggled directly by JS at runtime and must keep their exact names even when restyled: `.module`/`.active` (module + sidebar nav), `.cbw-tab-btn.ativo`, `.cbw-campo-erro`, `.cbw-badge-ok`/`.cbw-badge-pendente`, `.cbw-preview-vazio`, `.cbw-bolha-vazia`, `#modal-mapa` / `#modalTabela` display toggling. When restyling, change values, not selector names.

Note: a CSS section in `styles.css` is still labeled `/* ===== EFEITOS EQUIPES ===== */` even though the rules under it (`.footer-global` and friends) are the current global footer, unrelated to the old Equipes module — the label is stale but the rules themselves are live and in use. Left as-is in etapa 3.1 (comment-only, non-functional); fine to relabel in a future pass.

## Icons

Icons are hand-authored inline SVG (feather-style line icons, `stroke="currentColor"`, no external icon font/CDN) rather than emoji, applied via the `.menu-icon` (sidebar nav) and `.btn-icon-svg` (inline in action buttons) size classes. A few emoji remain intentionally in generated *content* (toast messages, copied report text) — those are message content, not UI icons, and are out of scope for icon-consistency work.
