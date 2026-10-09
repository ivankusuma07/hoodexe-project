import type { ComponentType } from 'react';
import type { WindowState } from '@/store/windows';
import type { AppId } from './meta';
import { About } from './About';
import { ComingSoon } from './ComingSoon';
import { Explore } from './explore/Explore';
import { TokenDetail } from './token/TokenDetail';
import { Launch } from './launch/Launch';
import { Portfolio } from './Portfolio';
import { RecycleBin } from './RecycleBin';
import { TheoremBoard } from './TheoremBoard';
import { Welcome } from './Welcome';

export const APP_COMPONENTS: Record<AppId, ComponentType<{ win: WindowState }>> = {
  welcome: Welcome,
  launch: Launch,
  explore: Explore,
  callouts: ComingSoon,
  portfolio: Portfolio,
  theorem: TheoremBoard,
  about: About,
  recycle: RecycleBin,
  token: TokenDetail,
};
