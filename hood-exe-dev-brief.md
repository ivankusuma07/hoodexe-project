# hood.exe — Developer Brief

**Project**: Windows XP-themed token launchpad frontend
**Codename**: hood.exe
**Chain**: Robinhood Chain (Ethereum L2)
**Backend**: Pons launchpad contracts (Skenario A — aggregator frontend, no own smart contract at MVP)
**Target domain**: `hood.fun` (branding stays "hood.exe" visually)
**Operator**: Wealthy People / Bix
**Timeline target**: 2–3 weeks MVP
**Reference preview**: [attached artifact link — pixel-reference for all UI]

---

## 0. TL;DR

Build a token launchpad frontend that routes launches/trades to Pons on Robinhood Chain, wrapped in a 100% faithful Windows XP desktop interface (Bliss wallpaper, draggable windows, Start menu, taskbar, system tray). Add a Pump.fun-style live callout feed. Entire UX feels like running XP; every interaction uses XP visual language.

**Core features**:
1. Token launch wizard (routes to Pons)
2. Token explore grid + per-token detail (chart, buy/sell, trades, callouts)
3. Live callout feed (Pump.fun-style) with real-time toast notifications
4. XP desktop metaphor (draggable windows, taskbar, start menu)
5. AI rigor scoring on theorem statements
6. Non-custodial wallet connection (RainbowKit-style, XP-skinned)

---

## 1. Naming & Branding

- **Product name**: `hood.exe` (lowercase, dot included — treat as executable filename)
- **Domain**: `hood.fun` (recommended) — `.exe` isn't a valid TLD, so brand visually and own `hood.fun` as the URL. Alternatives: `hoodexe.fun`, `hoodxp.fun`
- **Ticker (if native token launches later)**: `$HOOD` (collision risk with Robinhood stock — can also use `$HOODEXE`)
- **Logo**: stylized "H" in Luna-blue gradient square (Georgia italic), paired with orange dot accent in wordmark (`hood` + orange `.` + grey `exe`)
- **Tagline**: *"Mathematical Superintelligence. On-chain."* / *"Launch coins. Prove theorems. Trade intelligently."*

### Brand palette
```
Hood brand blue:    #2b6cb0 → #1a4b85 (gradient, for H logo)
Hood accent orange: #ff6b00 (for dot in logo, highlights, CTAs)
XP window blue:     #0a62e0 → #3291ff (title bars)
XP green:           #5fc960 → #389139 (start button, success CTAs)
```

---

## 2. Visual Design System

### 2.1 Must be identical to Windows XP SP3
Reference screenshots: Luna Blue theme, Bliss wallpaper, Tahoma UI font, classic XP cursor, 3D button chrome.

- **Zero modern UI patterns** (no flat design, no modern rounded corners, no modern gradients, no modern shadows)
- Every element must look like it was rendered in XP: 3D buttons, pixel-perfect title bars, chrome window edges
- Cursor: XP arrow cursor (included as inline SVG data URI in reference preview)
- Font stack: `Tahoma, "Trebuchet MS", "Segoe UI", Arial, sans-serif` at 11px base

### 2.2 CSS tokens (locked)
```css
:root {
  /* Wallpaper (Bliss) */
  --sky-top: #4593e6; --sky-mid: #8dc0f0; --sky-low: #c0e0f6;
  --hill-light: #86b94a; --hill-mid: #68a537; --hill-dark: #3a7b1a; --hill-deep: #1f5a0a;

  /* Window chrome */
  --title-start: #0a62e0; --title-end: #3291ff;
  --window-chrome: #ece9d8; --window-border: #0054e8;

  /* Buttons */
  --btn-face-top: #f5f5f5; --btn-face-mid: #ece9d8; --btn-face-bot: #d4d0c8;
  --btn-border: #003c74;

  /* Taskbar & start */
  --taskbar-blue: #245edc; --taskbar-blue-lo: #1941a5;
  --start-green-hi: #5fc960; --start-green-mid: #4ca94d; --start-green-lo: #389139;

  /* Semantic */
  --good: #4a8c25; --warn: #d78a00; --bad: #c91f00;
  --selection: #316ac5; --field-border: #7f9db9;

  /* Hood brand */
  --hood-brand: #2b6cb0; --hood-accent: #ff6b00;
}
```

### 2.3 Typography
- **UI**: Tahoma 11px (primary), fallback: `"Segoe UI", Arial`
- **Headlines inside windows**: Georgia italic (for mathematical display)
- **Monospace**: `"Lucida Console", Consolas, monospace` (trade tables, code)

### 2.4 Assets
**Pilihan A (DIY, fastest)**: inline SVG + CSS gradients (approach di reference preview)
**Pilihan B (polished)**: download real XP icons dari https://win98icons.alexmeub.com/icons/view.html

**Required icons** (16/32/48px):
- My Computer, Recycle Bin, My Documents, Internet Explorer
- Start flag, close/minimize/maximize controls
- App-specific: launcher, explorer, chart, message bubble, lock, calculator

**Wallpaper**: Bliss (hills + sky). Reference preview uses CSS gradient approximation; production should use actual Bliss image (`.jpg`, ~200KB) atau high-quality CSS gradient.

### 2.5 Cursor
XP classic arrow cursor (white with black outline). Inline SVG data URI atau `.cur` file. Hover state = XP pointer hand cursor.

Reference implementation in preview (CSS):
```css
body {
  cursor: url("data:image/svg+xml;utf8,<svg...>") 3 2, default;
}
button, a, [onclick] {
  cursor: url("data:image/svg+xml;utf8,<svg...>") 7 2, pointer;
}
```

---

## 3. Pages & Windows

Landing page = **XP desktop**. All "pages" within the web app are **draggable windows**.

### 3.1 Desktop (landing)
- Full-screen Bliss wallpaper
- Desktop icons grid (left side, 76×80px cells)
- Taskbar fixed at bottom (30px tall): Start button + open window tabs + system tray + clock
- Clock live-updates every 10s
- Icons: `Start Here`, `Launch.exe`, `Explore.exe`, `Callouts.exe`, `Portfolio`, `Theorem Board`, `About`, `Recycle Bin`

### 3.2 Welcome Window (auto-open on load, ~580×460)
- `hood.exe` wordmark (large, Georgia italic)
- Hero: *"Mathematical Superintelligence. On-chain."*
- Tagline: *"Launch coins backed by theorems. Trade on provable rigor. Powered by Robinhood Chain, routed through Pons."*
- 4 CTAs: ▶ Launch a Coin (accent) · Explore · 📣 Callouts · About
- Tip box explaining desktop/start interactions

### 3.3 Launch.exe — New Token Wizard (~500×580)
Form fields:
1. Token Name (text)
2. Ticker Symbol (text, auto-uppercase)
3. Theorem Statement (textarea, LaTeX support via KaTeX)
4. Bonding Curve Shape (select): Parabolic / Exponential / Logistic / Fibonacci / Riemann Zeta
   - **Live Canvas preview** of chosen curve shape
5. (optional) Description

Footer:
- Fee display: `0.001 ETH (Pons) + 0.0005 ETH (platform)`
- Buttons: `👁 Preview` · `Cancel` · `▶ Deploy` (success green)

**Deploy flow**: open wallet modal → user signs → call Pons SDK/contract → tx hash → success modal → coin added to Explore.

### 3.4 Explore.exe (~580×440)
- Grid view (XP "icon view" style)
- Each token card: `$TICKER`, theorem snippet (italic Georgia), rigor badge (color-coded: green >80, orange 60-80, red <60), market cap
- Click card → open Token Detail window
- Status bar at bottom: count + "AI-scored by rigor"
- Sort options: Latest / Volume / Rigor / MCap

### 3.5 Token Detail Window (~720×540, opened dynamically)
Grid layout (desktop):
```
┌──────────────────────────────────┬─────────────────┐
│ Header: ticker + theorem + stats │                 │
├──────────────────────────────────┤  Buy/Sell       │
│ Chart (candlestick, 180px)       │  Panel (240px)  │
├──────────────────────────────────┤                 │
│ Tabs: Trades | Callouts | Theorem│                 │
│ Tab body (scrollable)            │                 │
└──────────────────────────────────┴─────────────────┘
```
Mobile: single column, stacked.

**Chart**: candlestick, use `lightweight-charts` (TradingView) or custom Canvas. Overlay bonding curve path optional.

**Buy/Sell panel**:
- Tabs: `BUY` (green active) / `SELL` (red active)
- Amount input (ETH)
- Preset buttons: `0.1 | 0.5 | 1.0 | 5.0`
- Live estimate: tokens received, price impact, platform fee
- CTA button changes color/text based on mode
- Powered by Pons footer

**Tabs**:
- **Trades**: table (Side/Amount/Price/User), auto-refresh 5s
- **Callouts**: callouts filtered to this token + "Post one →" link to global Callouts
- **Theorem**: full theorem statement rendered + rigor score breakdown

### 3.6 Callouts.exe (~560×500) — LIVE FEED
Pump.fun-style callouts (market calls).

Layout:
```
┌─────────────────────────────────────────┐
│ 🟢 LIVE — 9 callouts · 7 users          │ ← header bar (blue)
├─────────────────────────────────────────┤
│ ┌────┬─────────────────────────────────┐│
│ │ ∑  │ @hood_official $HILBERT · now   ││ ← callout item
│ │    │ Just graduated to Pons DEX...   ││
│ │    │ 🚀 120  👀 40  💀 1              ││
│ └────┴─────────────────────────────────┘│
│ ... (infinite scroll)                   │
├─────────────────────────────────────────┤
│ [Post your callout...        ] [Post]   │ ← compose
└─────────────────────────────────────────┘
```

**Data model**:
```ts
type Callout = {
  id: string;
  user: string;              // handle, no @
  avatar: string;            // emoji or image URL
  token: string | null;      // ticker if about specific coin
  text: string;              // max 180 chars
  timestamp: Date;
  reactions: { rocket: number; eyes: number; skull: number };
  official?: boolean;        // platform account (blue left border)
  verified?: boolean;        // verified checkmark
};
```

**Features**:
- Infinite scroll (load older on scroll down)
- New callouts flash in with yellow background animation
- `$TICKER` detection → clickable link to token detail
- Compose box, 180-char limit
- Rate limit: 5 posts/min/user (backend)
- Verified badges + official account highlighting
- Live indicator (pulsing green dot)
- Mobile: fullscreen takeover

**Backend (realtime)**:
- WebSocket preferred, polling 5-10s fallback
- Indexer subscribes to smart contract events (launch/buy/sell/graduate) + user-submitted POST endpoint
- Store in Postgres or Redis stream
- Optional: ChatGPT moderation API for spam/toxicity filter

### 3.7 Toast Notification System (XP balloon)
When Callouts window is closed and a new callout arrives:
- XP-style yellow balloon pops up from system tray
- Balloon has arrow pointing to tray icon
- Contains: "📣 New Callout" header + close X + body (user + token + preview text)
- Auto-dismiss after 8s (fades at 6s)
- Click balloon → open Callouts window
- Max 3 balloons stacked
- User toggle on/off (localStorage, respect `prefers-reduced-motion`)

Tray icon (📣) has pulsing orange dot indicator when unread callouts.

### 3.8 Portfolio.exe (~420×260)
- Not connected: "Connect Wallet" CTA (green success button)
- Connected: list of launches owned + holdings + unrealized P&L (sorted by rigor-weighted)
- Export CSV button

### 3.9 Theorem Board.dlg (~440×340)
Info dialog explaining theorem launch mechanic + example. OK button to close.

### 3.10 About hood.exe (~400×400)
- Hood wordmark
- v1.0 Service Pack 3 (easter egg)
- Project info table: chain, Pons routing, rigor engine, callouts, theme, operator

### 3.11 Start Menu
Classic XP 2-column layout:
- Header: user avatar (H logo) + name "Bix" + role "hood.exe operator"
- Scrollable list of all apps with icon + name + description
- Footer: `Log Off` | `Shut Down` buttons

**Shut Down modal**: 3-option grid (Stand By / Turn Off / Restart)
- Stand By / Log Off → placeholder modal
- Restart → close all windows, reopen Welcome
- Turn Off → black screen with "It is now safe to turn off your computer" + Power On button

---

## 4. Interactions & Behaviors

### 4.1 Window management
- **Drag** by title bar (mouse + touch support)
- **Minimize**: hide window, stays in taskbar
- **Maximize**: fill screen minus taskbar
- **Close**: destroy window completely
- Clicking window body → bring to front (active title bar = blue, inactive = muted)
- Taskbar click → toggle minimize/restore
- Multiple windows open simultaneously, z-index managed

### 4.2 Desktop
- Single-click icon → select (highlight)
- Double-click → open window
- Mobile: single tap = select, second tap within 400ms = open
- Right-click context menu (v2 nice-to-have): Open, Properties

### 4.3 Event handling
Use **event delegation** on document for `data-action="..."` attributes — avoid inline `onclick` with escaped quotes (fragile and causes XSS risk). Pattern:

```js
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'open-app') openApp(target.dataset.app);
  else if (action === 'open-token') openTokenDetail(target.dataset.ticker);
  // etc
});
```

### 4.4 XSS protection
All user-generated content (callouts, theorem text, token names, ticker symbols) MUST be escaped before rendering:
```js
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}
```

### 4.5 Sound (optional v2)
XP system sounds (download from Internet Archive):
- `tada.wav` on startup
- `chord.wav` on open window
- `ding.wav` on notification
- `error.wav` on failed tx
User toggle (localStorage, muted by default to avoid autoplay issues).

### 4.6 Easter eggs (optional v2)
- BSOD on failed deploy tx (joke error screen)
- Clippy mascot ("It looks like you're writing a theorem...")
- "Shut Down" with real XP shutdown sound
- Minesweeper icon → actual Minesweeper mini-game (deep nerd pleaser)

---

## 5. Tech Stack

### 5.1 Frontend
- **Framework**: Next.js 14 (App Router) or Vite + React 18
- **Styling**: Vanilla CSS + CSS variables (preferred for XP replication) OR Tailwind + custom XP components
- **State**: Zustand (window manager state, open windows, active app)
- **Web3**:
  - `wagmi` + `viem` for wallet connection
  - `RainbowKit` for connect modal (skin to XP style per below)
  - Pons SDK (or direct `viem` contract calls)
- **Charts**: `lightweight-charts` (TradingView) or raw Canvas for custom look
- **Math rendering**: `katex` (CSS + JS) for LaTeX theorem statements
- **Hosting**: Vercel (recommended for Next.js) or Hostinger
- **Analytics**: Plausible or PostHog

### 5.2 Backend (minimal)
- **Indexer**: Goldsky or Envio for Pons events (or self-host via SubQuery/Ponder)
- **Database**: Postgres (Supabase) or Redis for callout stream
- **API**: Next.js API routes or separate Node.js (Fastify) service
- **AI**: OpenAI or Anthropic API for rigor scoring (`/api/score-theorem` POST endpoint)
- **Realtime**: WebSocket via `socket.io` or `pusher.com`

### 5.3 Dependencies (approximate)
```json
{
  "next": "^14.2.0",
  "react": "^18.3.0",
  "wagmi": "^2.5.0",
  "viem": "^2.7.0",
  "@rainbow-me/rainbowkit": "^2.0.0",
  "zustand": "^4.5.0",
  "katex": "^0.16.0",
  "lightweight-charts": "^4.1.0",
  "date-fns": "^3.0.0"
}
```

---

## 6. Integration Points

### 6.1 Pons (critical dependency)
**Research required before dev kickoff**:
- SDK availability (TypeScript package? or direct contract calls?)
- Public API endpoint for reading launch data
- Smart contract permissionless or whitelisted?
- Referral program → % cut if we route volume?
- Rate limits
- Event signatures for indexing

**Functions needed**:
```ts
// Pseudocode — adapt to actual Pons interface
createToken(params: { name, ticker, metadataURI, curveType }) → txHash
buyToken(tokenAddress, amount, slippage) → txHash
sellToken(tokenAddress, amount, slippage) → txHash
getTokenInfo(tokenAddress) → { price, supply, mcap, graduatedAt }
getTrades(tokenAddress, limit) → Trade[]
subscribeToEvents(filter) → EventStream
```

**Fee markup (Phase 2)**: deploy small wrapper contract that routes to Pons + takes 0.5% cut. Not required for MVP.

### 6.2 AI Rigor Score
**Endpoint**: `POST /api/score-theorem`
**Request**:
```json
{
  "theorem": "x^n + y^n = z^n for n > 2",
  "name": "Fermat's Last Coin",
  "description": "..."
}
```
**Response**:
```json
{
  "score": 94,
  "reasoning": "Classical theorem with proven validity, high mathematical significance.",
  "cached": false
}
```
- Cache by content hash (24h TTL) to limit API spend
- Rate limit: 1 request per launch per IP (prevent abuse)
- Prompt engineering: give clear 0-100 rubric to LLM
- Fallback: default score of 50 if API fails (don't block launch)

### 6.3 Metadata storage
- Theorem text + proof + metadata: store on **IPFS** via Pinata or web3.storage
- Reference IPFS hash in token's on-chain metadata URI
- Cache resolved metadata in backend Postgres for fast reads

### 6.4 Indexer
- Index all Pons launches that happened via our frontend
- Mechanism: tag launches with a UTM param or referrer wallet address, filter in indexer query
- Store: `(tx_hash, token_address, launcher_wallet, metadata_uri, rigor_score, created_at)`
- Options: Goldsky subgraph, Envio, self-host Ponder

---

## 7. Mobile Responsiveness

Desktop metaphor doesn't translate 1:1 to mobile. Degradation strategy:

**Breakpoint**: `max-width: 640px`

**Changes on mobile**:
- Desktop icons: 3-column grid, scrollable
- Windows: fullscreen (not draggable), swipe-down to close (optional)
- Start menu: fullscreen takeover
- Taskbar: visible, same style
- Toast balloons: full-width at bottom

**Mobile-specific**:
- Larger tap targets (min 44×44px)
- Form inputs: use native mobile pickers where appropriate
- Chart: pinch-to-zoom

---

## 8. Deliverables Timeline

### Phase 1 — MVP (Week 1-2)
- [ ] XP design system (tokens, window component, buttons, inputs, cursor)
- [ ] Desktop + draggable windows + taskbar + start menu
- [ ] Launch wizard (connected to Pons)
- [ ] Explore grid (reads from indexer)
- [ ] Wallet connection (RainbowKit, XP-skinned)
- [ ] Deploy to Vercel staging URL

### Phase 2 — Core features (Week 3)
- [ ] Token detail window with chart + buy/sell + trades
- [ ] Callouts.exe window with live feed
- [ ] Toast balloon notification system
- [ ] Portfolio page (basic)
- [ ] AI rigor scoring integration
- [ ] Theorem Board + About dialogs

### Phase 3 — Polish & production (Week 4)
- [ ] Mobile responsive pass
- [ ] XP sound effects (optional)
- [ ] BSOD + Clippy easter eggs (optional)
- [ ] Mainnet deployment
- [ ] Production domain + hosting
- [ ] Analytics setup
- [ ] Soft launch via cabal network

---

## 9. Open Questions (research before dev kickoff)

**For Pons team (DM Discord/Telegram)**:
1. Public SDK availability? If not, which contract addresses and ABI?
2. Permissionless frontend allowed, or whitelist required?
3. Referral program active? If yes, revenue cut and signup process?
4. Rate limits on contract calls or API?
5. Recommended indexer approach (own vs. hosted)?

**For Bix**:
1. Final domain purchase: `hood.fun` or alternative?
2. Native token launch at MVP or Phase 2?
3. Brand assets (logo file, favicon, OG image) — DIY or outsource?
4. GitHub repo visibility: private or public?
5. AI scoring: wait for API choice (OpenAI vs. Anthropic vs. self-hosted) or decide in brief?

---

## 10. Pre-launch Checklist for Bix

- [ ] Confirm final name: `hood.exe` ✅ (locked)
- [ ] Buy domain: `hood.fun` (recommended) or alternative
- [ ] Research Pons SDK/API (DM team if docs unclear)
- [ ] Prepare brand assets:
  - [ ] Logo (SVG, PNG 512×512, favicon ICO)
  - [ ] OG image (1200×630)
  - [ ] Twitter header
- [ ] GitHub repo setup (private initially)
- [ ] Hosting account (Vercel)
- [ ] Analytics account (Plausible / PostHog)
- [ ] AI API account (OpenAI or Anthropic) + budget cap
- [ ] Agree pricing + milestones with dev

---

## 11. Reference Materials

- **Live preview artifact**: [attach link from chat]
- **Visual reference**: 2 Windows XP screenshots (desktop + system properties dialog)
- **Narrative inspiration**: 
  - `desk404.fun` — retro dialog pattern reference
  - `pump.fun` — launchpad flow + callout feed
  - Harmonic AI / Vlad Tenev MathAI narrative
- **Robinhood Chain docs**: [attach link]
- **Pons docs**: [attach link]
- **XP icon pack**: https://win98icons.alexmeub.com
- **Bliss wallpaper source**: original Windows XP wallpaper (Microsoft) — use CSS gradient or licensed version

---

## 12. Non-Goals (explicitly out of scope for MVP)

- Own smart contract / custom bonding curve logic (we route to Pons)
- Fee markup wrapper contract (Phase 2+)
- Full custody / vault functionality (non-custodial by design)
- Multi-chain support (RH Chain only)
- Mobile native app (web-only, mobile-responsive)
- Decentralized governance / DAO
- Native token launch (Phase 2+ decision)
- Audit (not required at this scale; add Phase 3+ if TVL grows)

---

## 13. Success Metrics (first 30 days post-launch)

- **Day 7**: 50+ launches via hood.exe
- **Day 14**: $10k+ cumulative volume routed through platform
- **Day 30**: 200+ unique wallets interacted, 500+ callouts posted
- **Technical**: <2s initial page load on mobile 4G, zero critical bugs reported

---

**End of brief.**

*Document version 1.0 — generated 2026-10-08 for hood.exe (Wealthy People)*
