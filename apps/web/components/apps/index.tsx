import type { ComponentType } from 'react';
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

export const APP_COMPONENTS: Record<AppId, ComponentType<{ win: WindowState }>> = {
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
};
