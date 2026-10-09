import type { ComponentType } from 'react';
import type { WindowState } from '@/store/windows';
import type { AppId } from './meta';
import { About } from './About';
import { ComingSoon } from './ComingSoon';
import { Launch } from './launch/Launch';
import { Portfolio } from './Portfolio';
import { RecycleBin } from './RecycleBin';
import { TheoremBoard } from './TheoremBoard';
import { Welcome } from './Welcome';

export const APP_COMPONENTS: Record<AppId, ComponentType<{ win: WindowState }>> = {
  welcome: Welcome,
  launch: Launch,
  explore: ComingSoon,
  callouts: ComingSoon,
  portfolio: Portfolio,
  theorem: TheoremBoard,
  about: About,
  recycle: RecycleBin,
};
