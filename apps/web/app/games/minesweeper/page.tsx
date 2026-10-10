import type { Metadata } from 'next';
import { Startup } from '@/components/Startup';

export const metadata: Metadata = {
  title: 'Minesweeper | hood.exe',
  description: 'Minesweeper is coming soon to hood.exe.',
};

/** /games/minesweeper: the desktop boots and opens the Minesweeper placeholder. */
export default function MinesweeperPage() {
  return <Startup />;
}
