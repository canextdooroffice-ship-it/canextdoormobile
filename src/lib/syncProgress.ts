import { supabase } from '../supabaseClient';
import type { ProgressState } from '../components/Subjects';

export interface UserData {
  progress_state: ProgressState;
  ca_level: string;
  study_target: number;
  total_hours: number;
}

/**
 * Load user progress from the Supabase `user_progress` table.
 * Returns null if no row exists or on error.
 */
export const loadFromSupabase = async (userId: string): Promise<UserData | null> => {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('progress_state, ca_level, study_target, total_hours')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // PGRST116: No rows found
        return null;
      }
      throw error;
    }

    if (!data) return null;

    return {
      progress_state: data.progress_state as ProgressState,
      ca_level: data.ca_level as string,
      study_target: data.study_target as number,
      total_hours: data.total_hours as number,
    };
  } catch (err) {
    console.warn('Failed to load from Supabase:', err);
    throw err;
  }
};

/**
 * Upsert user progress into the Supabase `user_progress` table.
 * Uses the unique `user_id` column to insert or update.
 */
export const saveToSupabase = async (userId: string, userData: UserData): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_progress')
      .upsert(
        {
          user_id: userId,
          progress_state: userData.progress_state,
          ca_level: userData.ca_level,
          study_target: userData.study_target,
          total_hours: userData.total_hours,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.warn('Supabase sync save failed:', error.message);
    }
  } catch {
    console.warn('Supabase sync save failed (network error)');
  }
};
