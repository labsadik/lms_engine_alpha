// src/lib/gamify.ts
import { supabase } from '@/integrations/supabase/client';

export async function awardWatchedMinute(userId: string, partId: string, minute: number, courseId?: string) {
  try {
    const { data, error } = await supabase.functions.invoke('award-watch-minute', {
      body: { part_id: partId, minute, course_id: courseId || null },
    });
    if (error || (data as any)?.error) return false;
    return Boolean((data as any)?.awarded);
  } catch (e) {
    console.error("Gamification error:", e);
    return false;
  }
}

export async function completePart(userId: string, partId: string, courseId?: string): Promise<{
  reward_xp: number;
  reward_coins: number;
  current_streak: number;
} | null> {
  // 1. Mark part as completed in progress table
  const { data: existing } = await supabase
    .from('progress').select('id, completed').eq('user_id', userId).eq('part_id', partId).maybeSingle();

  if (existing?.completed) return null; // Already done

  if (existing) {
    await supabase.from('progress').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await supabase.from('progress').insert({ user_id: userId, part_id: partId, completed: true, completed_at: new Date().toISOString() });
  }

  // 2. Trigger the reward edge function
  try {
    const { data, error } = await supabase.functions.invoke('complete-part-reward', {
      body: { part_id: partId, course_id: courseId || null },
    });
    
    if (error || (data as any)?.error) return null;
    
    const d = data as any;
    return {
      reward_xp: d?.reward_xp ?? 0,
      reward_coins: d?.reward_coins ?? 0,
      current_streak: d?.current_streak ?? 0,
    };
  } catch (e) {
    console.error('complete-part-reward exception:', e);
    return null;
  }
}