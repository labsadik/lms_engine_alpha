import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface GamifyProfile {
  xp: number;
  coins: number;
  level: number;
  current_streak: number;
  longest_streak: number;
}

export function useGamifyRealtime() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<GamifyProfile | null>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch initial data
    supabase.from('profiles')
      .select('xp, coins, level, current_streak, longest_streak')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as GamifyProfile);
      });

    // Subscribe to real-time database changes
    const channel = supabase
      .channel('public:profiles')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        setProfile(payload.new as GamifyProfile);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return profile;
}