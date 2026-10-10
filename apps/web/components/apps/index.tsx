import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { GamesFolder } from '@/components/games/GamesFolder';
import { MinesweeperWindow } from '@/components/games/Minesweeper/MinesweeperWindow';
import type { WindowState } from '@/store/windows';
import type { AppId } from './meta';
import { About } from './About';
import { Callouts } from './callouts/Callouts';
import { Explore } from './explore/Explore';
import { TokenDetail } from './token/TokenDetail';
import { Launch } from './launch/Launch';
import { Privacy, Risk, Terms } from './legal/Legal';
import { Portfolio } from './portfolio/Portfolio';
import { RecycleBin } from './RecycleBin';
import { TheoremBoard } from './TheoremBoard';
import { Welcome } from './Welcome';

type AppComponent = ComponentType<{ win: WindowState }>;

// Solitaire is code-split: its code loads the first time someone opens it (hood-exe-games-brief.md §9).
const SolitaireWindow = lazy(() => import('@/components/games/Solitaire/SolitaireWindow'));

export const APP_COMPONENTS: Record<AppId, AppComponent | LazyExoticComponent<AppComponent>> = {
  welcome: Welcome,
  launch: Launch,
  explore: Explore,
  callouts: Callouts,
  portfolio: Portfolio,
  theorem: TheoremBoard,
  about: About,
  recycle: RecycleBin,
  token: TokenDetail,
  terms: Terms,
  risk: Risk,
  privacy: Privacy,
  games: GamesFolder,
  solitaire: SolitaireWindow,
  minesweeper: MinesweeperWindow,
};
