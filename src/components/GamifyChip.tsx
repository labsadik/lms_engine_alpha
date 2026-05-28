// src/components/GamifyChip.tsx
import { useGamifyRealtime } from '@/hooks/useGamifyRealtime';
import { Zap, Flame, Coins } from 'lucide-react';

export default function GamifyChip() {
  const profile = useGamifyRealtime();

  if (!profile) return null;

  return (
    <div className="flex items-center gap-2 text-xs font-bold">
      <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg">
        <Zap className="w-3 h-3" /> {profile.xp}
      </div>
      <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-lg">
        <Coins className="w-3 h-3" /> {profile.coins}
      </div>
      <div className="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded-lg">
        <Flame className="w-3 h-3" /> {profile.current_streak}
      </div>
    </div>
  );
}