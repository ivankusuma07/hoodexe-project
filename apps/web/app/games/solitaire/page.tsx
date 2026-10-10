import type { Metadata } from 'next';
import { Startup } from '@/components/Startup';

export const metadata: Metadata = {
  title: 'Solitaire | hood.exe',
  description: 'Classic Klondike Solitaire on the hood.exe desktop. No wallet needed.',
};

/** /games/solitaire: the desktop boots and opens Solitaire (the desktop reads the path). */
export default function SolitairePage() {
  return <Startup />;
}
