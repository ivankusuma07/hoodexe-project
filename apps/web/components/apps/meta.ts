import type { ComponentType } from 'react';
import {
  CalloutsIcon,
  ExploreIcon,
  HelpIcon,
  InfoIcon,
  LaunchIcon,
  PortfolioIcon,
  RecycleBinIcon,
  TheoremIcon,
  type IconProps,
} from '@/components/xp/Icons';

export type AppId = 'welcome' | 'launch' | 'explore' | 'callouts' | 'portfolio' | 'theorem' | 'about' | 'recycle' | 'token';

export type AppMeta = {
  id: AppId;
  /** Window title. */
  title: string;
  /** Label under the desktop icon. */
  label: string;
  /** One-liner for the Start menu. */
  description: string;
  Icon: ComponentType<IconProps>;
  w: number;
  h: number;
  maximizable?: boolean;
};

export const APPS: Record<AppId, AppMeta> = {
  welcome: {
    id: 'welcome',
    title: 'Welcome to hood.exe',
    label: 'Start Here',
    description: 'Tour of the desktop',
    Icon: HelpIcon,
    w: 580,
    h: 460,
  },
  launch: {
    id: 'launch',
    title: 'Launch.exe — New Token Wizard',
    label: 'Launch.exe',
    description: 'Launch a coin on Pons',
    Icon: LaunchIcon,
    w: 500,
    h: 580,
    maximizable: false,
  },
  explore: {
    id: 'explore',
    title: 'Explore.exe',
    label: 'Explore.exe',
    description: 'Browse coins by rigor and market cap',
    Icon: ExploreIcon,
    w: 580,
    h: 440,
  },
  callouts: {
    id: 'callouts',
    title: 'Callouts.exe — Live',
    label: 'Callouts.exe',
    description: 'Live market calls from holders',
    Icon: CalloutsIcon,
    w: 560,
    h: 500,
  },
  portfolio: {
    id: 'portfolio',
    title: 'Portfolio',
    label: 'Portfolio',
    description: 'Your launches and holdings',
    Icon: PortfolioIcon,
    w: 420,
    h: 260,
  },
  theorem: {
    id: 'theorem',
    title: 'Theorem Board.dlg',
    label: 'Theorem Board',
    description: 'How theorem launches work',
    Icon: TheoremIcon,
    w: 440,
    h: 340,
    maximizable: false,
  },
  about: {
    id: 'about',
    title: 'About hood.exe',
    label: 'About',
    description: 'Version and system info',
    Icon: InfoIcon,
    w: 400,
    h: 400,
    maximizable: false,
  },
  token: {
    id: 'token',
    title: 'Token Detail',
    label: 'Token',
    description: 'One coin: curve, theorem, links',
    Icon: TheoremIcon,
    w: 720,
    h: 540,
  },
  recycle: {
    id: 'recycle',
    title: 'Recycle Bin',
    label: 'Recycle Bin',
    description: 'Deleted items',
    Icon: RecycleBinIcon,
    w: 460,
    h: 300,
  },
};

/** Desktop icon order (docs/BRIEF.md §4.1). */
export const DESKTOP_APPS: AppId[] = ['welcome', 'launch', 'explore', 'callouts', 'portfolio', 'theorem', 'about', 'recycle'];

/** Start menu list order. */
export const START_APPS: AppId[] = ['launch', 'explore', 'callouts', 'portfolio', 'theorem'];

export const isAppId = (v: string | null | undefined): v is AppId => !!v && v in APPS;
