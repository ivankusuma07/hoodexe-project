# hood.exe — Games Addendum (Solitaire + Minesweeper)

**Scope**: add a classic XP "Games" folder to hood.exe. Ship **Solitaire (Klondike)** fully playable in v1. **Minesweeper** ships as a "Coming Soon" icon only.
**Target branch**: `feat/games`
**Est. effort**: 1–2 days (Solitaire implementation + routing + icons)
**Owner**: dev
**Reviewer**: Bix

---

## 0. Why

- Reinforces XP nostalgia narrative → shareable screenshots on X
- Zero crypto dependency (no wallet needed to play) → long-session engagement
- Easter-egg content → press/community talking point for launch
- Tees up a future viral mechanic (whitelist via game score)

Not shipping as a mini-launch; shipping as part of the existing hood.exe app with no new deployment surface.

---

## 1. Deliverables

### 1.1 File structure
Place inside existing `apps/web/`:

```
apps/web/
├── app/
│   └── games/
│       ├── solitaire/
│       │   └── page.tsx           ← route: /games/solitaire (dev convenience; opened via window in-app)
│       └── minesweeper/
│           └── page.tsx           ← route: /games/minesweeper (coming soon placeholder)
├── components/
│   └── games/
│       ├── Solitaire/
│       │   ├── SolitaireWindow.tsx    ← the XP window wrapper + game
│       │   ├── Solitaire.tsx          ← pure game component (deals, moves, win state)
│       │   ├── Card.tsx               ← single card renderer
│       │   ├── useSolitaire.ts        ← game-state hook (reducer or zustand slice)
│       │   ├── solitaire.types.ts
│       │   ├── solitaire.logic.ts     ← pure game logic (dealing, move validation, auto-complete)
│       │   └── solitaire.module.css
│       └── Minesweeper/
│           └── MinesweeperWindow.tsx  ← coming soon window
└── public/
    └── icons/
        └── games/
            ├── solitaire-32.png
            ├── solitaire-16.png
            ├── minesweeper-32.png
            ├── minesweeper-16.png
            └── games-folder-32.png
```

### 1.2 Register in window manager
In the existing window-manager (whatever Zustand/context slice holds `openWindows`), register two new app IDs:

```ts
// windowRegistry.ts (or wherever APPS are declared)
export const APPS = {
  // ... existing apps
  solitaire: {
    id: 'solitaire',
    title: 'Solitaire',
    shortName: 'Solitaire',
    icon: '/icons/games/solitaire-32.png',
    width: 580,
    height: 480,
    minWidth: 500,
    minHeight: 420,
    component: lazy(() => import('@/components/games/Solitaire/SolitaireWindow')),
    taskbarGroup: 'games',
  },
  minesweeper: {
    id: 'minesweeper',
    title: 'Minesweeper',
    shortName: 'Minesweeper',
    icon: '/icons/games/minesweeper-32.png',
    width: 340,
    height: 400,
    component: lazy(() => import('@/components/games/Minesweeper/MinesweeperWindow')),
    taskbarGroup: 'games',
    comingSoon: true,
  },
};
```

### 1.3 Add to Start Menu
Under Start → **Games** submenu (new category), list both:
- 🂡 Solitaire
- 💣 Minesweeper (badge: "Coming Soon")

If the existing Start menu is a flat list, add a `Games ▸` entry that expands to a submenu.

### 1.4 Desktop icons (optional, user-configurable)
Add two optional desktop icons:
- `Games` folder (double-click → opens a mini explorer with 2 icons inside, matching XP's "Games" folder behavior)
- OR: just place `Solitaire.exe` + `Minesweeper.exe` icons directly on desktop

**Recommendation**: use the folder approach — it's more authentically XP and keeps desktop clean. The folder window reuses the Explore.exe layout with just 2 icons.

---

## 2. Solitaire (Klondike) — Full Spec

### 2.1 Rules (standard Klondike, 1-card draw)
- 52-card deck, shuffled
- **Tableau**: 7 columns, column `i` has `i+1` cards, only the top card face-up
- **Stock**: remaining 24 cards, face-down
- **Waste**: cards flipped from stock, 1 at a time
- **Foundations**: 4 piles, build up by suit from Ace → King
- Tableau builds down, alternating colors (red on black, black on red)
- Move cards one at a time OR drag a sequence (face-up ordered run)
- Empty tableau slots accept only Kings (or any sequence starting with King)
- Win condition: all 52 cards on foundations

### 2.2 UI layout
```
┌─ Solitaire (XP title bar) ──────────────────────── _ □ × ┐
│ Game  Help                                               │ ← menu bar
├──────────────────────────────────────────────────────────┤
│ 🂠 🂡     ⬜ ♥ ⬜ ♦ ⬜ ♣ ⬜ ♠                              │ ← stock/waste + foundations
│                                                          │
│ 🂡  🂢  🂣  🂤  🂥  🂦  🂧                                  │ ← 7 tableau columns
│     🂨  🂩  🂪  🂫  🂬  🂭                                  │
│         🂮  🂯  🂰  🂱  🂲                                  │
│             🂳  🂴  🂵  🂶                                  │
│                 🂷  🂸  🂹                                  │
│                     🂺  🂻                                  │
│                         🂼                                  │
├──────────────────────────────────────────────────────────┤
│ Time: 0:42  |  Moves: 17  |  Score: 120                  │ ← status bar
└──────────────────────────────────────────────────────────┘
```

### 2.3 Menu bar
- **Game**
  - New Game (shortcut: F2)
  - Deal Again (same shuffle, reset state)
  - Statistics (modal: wins, games played, best time, best moves — localStorage)
  - Exit → closes window
- **Help**
  - How to Play (modal with rules)
  - About Solitaire (XP-style about dialog)

### 2.4 Card styling
- Use real card faces. Options:
  - **Preferred**: SVG unicode playing cards (🂡–🂮, 🂱–🃎) — zero dependency
  - **Alt**: public domain card deck PNG (e.g., https://code.google.com/archive/p/vector-playing-cards/)
- Card back: XP-style blue cross-hatch pattern OR red checker pattern (user picks in Game menu)
- Card dimensions: ~65×90px desktop, ~45×62px mobile
- Red suits (♥ ♦) in `#c91f00`, black (♣ ♠) in `#000`
- Face-up card: white background, 1px border #999, rounded corners 3px, slight shadow
- Face-down card: pattern fill, same border/shadow

### 2.5 Interactions
- **Click stock** → flip top 1 card to waste
- **Stock empty + click** → recycle waste → stock (track as recycle counter, deduct score)
- **Drag card** (mouse + touch) → from waste/tableau/foundation to valid target
- **Double-click card** → auto-send to foundation if valid, else wiggle animation
- **Right-click** (desktop only) → send to foundation if valid
- **Keyboard**:
  - `F2` or `Ctrl+N` → new game
  - `Ctrl+Z` → undo last move (unlimited stack)
  - `Esc` → close any open modal

### 2.6 Animations
Keep subtle, XP-era appropriate (no fancy springs):
- Card flip: 150ms CSS transform rotateY
- Card snap to target: 200ms ease-out translate
- Invalid move: 300ms shake (translateX -4,+4,-4,+4,0)
- Win: cards cascade off foundations one by one, bouncing to bottom (reference the classic XP win animation — https://www.youtube.com/watch?v=qjzyIKT9ulw for timing)

### 2.7 Game state (TypeScript)
```ts
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13; // A, 2-10, J, Q, K
export type Card = { suit: Suit; rank: Rank; faceUp: boolean; id: string };

export type GameState = {
  stock: Card[];
  waste: Card[];
  foundations: Record<Suit, Card[]>;
  tableau: Card[][];               // 7 columns
  moves: number;
  score: number;
  startedAt: number;               // Date.now()
  recycles: number;
  history: GameState[];            // for undo (keep last 100)
  status: 'playing' | 'won';
};
```

### 2.8 Scoring (classic Windows Solitaire rules)
- +10 waste → tableau
- +10 tableau → foundation
- +5 waste → foundation
- −2 every 10 seconds elapsed (penalty)
- −15 recycle waste → stock
- Bonus on win: 700000 ÷ seconds elapsed (if > 30s)

### 2.9 Persistence (localStorage)
Save between sessions:
- `solitaire:stats` → { gamesPlayed, wins, bestTime, bestMoves, bestScore, currentStreak }
- `solitaire:settings` → { cardBack: 'blue' | 'red', autoComplete: true | false, sound: true | false }
- `solitaire:current` → serialize GameState if user closed mid-game (prompt "Resume?" on reopen)

### 2.10 Edge cases
- Window resize mid-game → cards re-layout smoothly (CSS grid or flex, not absolute pixels)
- Window too small (< 500px wide) → show "Please resize the window" message
- Mobile: fullscreen, cards fit screen with scroll if needed

### 2.11 Testing
Add to existing test suite (`pnpm --filter @hood/web test`):
- `solitaire.logic.test.ts` → unit tests for:
  - `canStackOnTableau(card, target)` — alternating color + descending rank
  - `canPlaceOnFoundation(card, foundation)` — same suit + ascending rank
  - `isWon(state)` — all foundations full
  - `autoCompleteMoves(state)` — returns moves if game is solvable
- Snapshot test for initial deal

---

## 3. Minesweeper — Coming Soon Window

### 3.1 Behavior
Clicking the Minesweeper icon (desktop or Start menu) opens a small XP window:

```
┌─ Minesweeper ────────────────────── _ □ × ┐
│                                            │
│         [💣 icon, large, centered]         │
│                                            │
│       Minesweeper is being installed.      │
│                                            │
│  ████████████░░░░░░░░░░ 47% complete       │ ← fake progress bar (loops 0-100 slowly)
│                                            │
│  Coming soon to hood.exe.                  │
│  Follow @hoodexe for release updates.      │
│                                            │
│                     [    OK    ]           │
│                                            │
└────────────────────────────────────────────┘
```

### 3.2 Spec
- Window size: 340×400px, fixed (not resizable)
- Progress bar: pure CSS animation, loops 0→100% over 8s indefinitely
- "OK" button closes the window
- Optional cheeky message randomized on each open:
  - "Minesweeper is being installed."
  - "Reticulating splines..."
  - "Mining the sweeper..."
  - "Still cheaper than mainnet gas."
- "Follow @hoodexe" is a real link to the X account (opens new tab)
- No actual installation happens; purely cosmetic

### 3.3 Icon badge
On the desktop icon and in Start menu, show a small "SOON" badge in XP style (small red oval, white text, top-right corner of icon):

```
┌──────┐
│  💣  │ SOON
│      │
└──────┘
Minesweeper
```

---

## 4. Assets Needed

### 4.1 Icons (download from https://win98icons.alexmeub.com or similar)
- `games-folder-32.png` (if using folder approach)
- `solitaire-32.png` + `solitaire-16.png`
- `minesweeper-32.png` + `minesweeper-16.png`
- Playing card SVGs OR unicode (if going asset-light)

### 4.2 Sounds (optional, nice-to-have, default off)
- Card flip: `card-flip.wav`
- Card place: `card-place.wav`
- Win fanfare: `win-fanfare.wav`
Source: https://www.myinstants.com has XP Solitaire sounds.

---

## 5. Routes & Navigation

Keep window-based UX as primary. Pages at `/games/solitaire` and `/games/minesweeper` exist for:
- Direct deep-linking (sharing a game URL opens hood.exe with that window pre-opened)
- SEO (optional meta tags for each game)

**Deep-link behavior**: visiting `/games/solitaire` → hood.exe boots → auto-opens Solitaire window on load.

Implement via existing routing pattern (likely using Next.js app router + a `?open=solitaire` query param, or an effect in the root layout).

---

## 6. Analytics (if PostHog/Plausible is live)

Track:
- `game_opened` (props: game name)
- `solitaire_started` (new game)
- `solitaire_won` (props: time, moves, score)
- `solitaire_closed` (props: duration)
- `minesweeper_coming_soon_viewed`

---

## 7. Acceptance Criteria

Dev may ship when:
- [ ] Solitaire plays end-to-end: new game → play → win → shows win animation + stats
- [ ] All drag/drop works on mouse AND touch
- [ ] Undo works for last 100 moves
- [ ] Mid-game state persists on close + resumes
- [ ] Minesweeper window opens, shows coming-soon UI, closes cleanly
- [ ] Icons appear in desktop + Start menu
- [ ] No console errors in production build
- [ ] Lighthouse mobile score for `/games/solitaire` ≥ 85
- [ ] All existing tests still pass (`pnpm typecheck && pnpm lint && pnpm test && pnpm build`)

---

## 8. Out of Scope (future iterations)

- Multiplayer Solitaire
- Themes/skins beyond card back
- Minesweeper actual implementation (separate ticket when ready)
- Spider Solitaire, FreeCell, Hearts, Pinball (future easter eggs)
- Score leaderboard on-chain (planned post-launch viral mechanic)
- Minesweeper-win → whitelist (planned viral mechanic, not in this ticket)

---

## 9. Dev Notes

- Keep the Solitaire module **tree-shakeable** and lazy-loaded. The main hood.exe bundle must not grow more than ~30KB gzipped for users who never open the game.
- All game logic (`solitaire.logic.ts`) must be pure/stateless — no DOM, no React — so it's testable and portable.
- Don't use heavy animation libraries (no Framer Motion for this). Vanilla CSS transforms + requestAnimationFrame is enough.
- Match existing hood.exe CSS token system (same Tahoma font, same button chrome, same window chrome).
- If existing `components/windows/Window.tsx` or similar exists → reuse it. Don't rebuild window chrome from scratch.

---

## 10. Timeline

| Day | Task |
|---|---|
| Day 1 AM | Scaffold routes, components, window registry entries, icons |
| Day 1 PM | Solitaire logic (dealing, moves, validation) + unit tests |
| Day 2 AM | Solitaire UI (card rendering, drag/drop, menu bar, stats) |
| Day 2 PM | Win animation, persistence, Minesweeper placeholder, polish |
| Day 3 | Buffer for mobile testing + bug fixes |

Total: **1.5–2 working days** for an experienced dev.

---

## 11. Reference

- Classic XP Solitaire gameplay: https://www.youtube.com/watch?v=qjzyIKT9ulw
- Rules: https://en.wikipedia.org/wiki/Klondike_(solitaire)
- Scoring rules (standard Windows): https://en.wikipedia.org/wiki/Microsoft_Solitaire#Scoring
- Unicode playing cards block: https://en.wikipedia.org/wiki/Playing_cards_in_Unicode
- XP icon pack: https://win98icons.alexmeub.com

---

**End of brief.**

*Document version 1.0 — 2026-10-09 for hood.exe (Wealthy People)*
