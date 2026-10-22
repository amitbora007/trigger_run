import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useAuth } from '@/features/auth/AuthContext';

export interface CronPreset {
  label: string;
  schedule: string;
  description: string;
  tag?: string;
}

export const CRON_PRESETS: CronPreset[] = [
  {
    label: 'Every 1 minute',
    schedule: '* * * * *',
    description: 'Instant reaction, runs 1,440 checks per day (~43.2k/mo). Standard default.',
    tag: 'Default',
  },
  {
    label: 'Every 2 minutes',
    schedule: '*/2 * * * *',
    description: 'Runs 720 times per day (~21.6k/mo). Halves execution volume.',
  },
  {
    label: 'Every 3 minutes',
    schedule: '*/3 * * * *',
    description: 'Runs 480 times per day (~14.4k/mo). Optimal balance of speed & quota efficiency.',
  },
  {
    label: 'Every 4 minutes',
    schedule: '*/4 * * * *',
    description: 'Runs 360 times per day (~10.8k/mo). Smooth custom monitoring cadence.',
  },
  {
    label: 'Every 5 minutes',
    schedule: '*/5 * * * *',
    description: 'Runs 288 times per day (~8.6k/mo). Excellent for production fleets on free tiers.',
  },
  {
    label: 'Every 10 minutes',
    schedule: '*/10 * * * *',
    description: 'Runs 144 times per day (~4.3k/mo). Ultra-lightweight cadence.',
  },
  {
    label: 'Every 15 minutes',
    schedule: '*/15 * * * *',
    description: 'Runs 96 times per day (~2.8k/mo). Minimal maintenance mode.',
  },
];

export function getHumanCronLabel(schedule: string): string {
  const trimmed = schedule ? schedule.trim() : '';
  const match = CRON_PRESETS.find((p) => p.schedule === trimmed);
  if (match) return match.label;
  if (trimmed === '* * * * *') return 'Every 1 minute';

  // Dynamic match for any */N * * * * expression
  const stepMatch = trimmed.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (stepMatch) {
    const mins = stepMatch[1];
    return `Every ${mins} minute${mins === '1' ? '' : 's'}`;
  }

  return `Cron: ${trimmed}`;
}

const STORAGE_KEY = 'vigilapi_cron_schedule';

export function useCronSchedule() {
  const { isDemoMode } = useAuth();
  const queryClient = useQueryClient();
  const [isMigrationMissing, setIsMigrationMissing] = useState(false);

  // Load initial value from localStorage or fallback
  const getLocalSchedule = () => {
    try {
      return localStorage.getItem(STORAGE_KEY) || '* * * * *';
    } catch {
      return '* * * * *';
    }
  };

  const query = useQuery({
    queryKey: ['dispatcher_cron_schedule'],
    queryFn: async () => {
      if (isDemoMode || !isSupabaseConfigured) {
        return {
          schedule: getLocalSchedule(),
          active: true,
          jobname: 'vigilapi-minute-dispatcher',
        };
      }

      try {
        const { data, error } = await supabase.rpc('get_dispatcher_cron_schedule', {
          p_job_name: 'vigilapi-minute-dispatcher',
        });

        if (error) {
          // If RPC doesn't exist yet in Supabase (PGRST202)
          if (error.code === 'PGRST202' || error.message?.includes('not found')) {
            setIsMigrationMissing(true);
          }
          return {
            schedule: getLocalSchedule(),
            active: true,
            jobname: 'vigilapi-minute-dispatcher',
          };
        }

        if (data && data.length > 0) {
          setIsMigrationMissing(false);
          const activeSchedule = data[0].schedule;
          try {
            localStorage.setItem(STORAGE_KEY, activeSchedule);
          } catch {
            // Ignore storage quota
          }
          return data[0];
        }

        return {
          schedule: getLocalSchedule(),
          active: true,
          jobname: 'vigilapi-minute-dispatcher',
        };
      } catch (err) {
        console.warn('Could not fetch dispatcher cron schedule from Supabase:', err);
        return {
          schedule: getLocalSchedule(),
          active: true,
          jobname: 'vigilapi-minute-dispatcher',
        };
      }
    },
    staleTime: 60000,
  });

  const mutation = useMutation({
    mutationFn: async (newSchedule: string) => {
      const trimmed = newSchedule.trim();

      // Demo mode or unconfigured Supabase
      if (isDemoMode || !isSupabaseConfigured) {
        localStorage.setItem(STORAGE_KEY, trimmed);
        return { success: true, schedule: trimmed };
      }

      const { data, error } = await supabase.rpc('update_dispatcher_cron_schedule', {
        p_schedule: trimmed,
        p_job_name: 'vigilapi-minute-dispatcher',
      });

      if (error) {
        if (error.code === 'PGRST202' || error.message?.includes('not found')) {
          setIsMigrationMissing(true);
        }
        throw new Error(error.message || 'Failed to update cron schedule in Supabase.');
      }

      localStorage.setItem(STORAGE_KEY, trimmed);
      return data;
    },
    onSuccess: (_data, newSchedule) => {
      queryClient.setQueryData(['dispatcher_cron_schedule'], (old: any) => ({
        ...old,
        schedule: newSchedule.trim(),
      }));
      queryClient.invalidateQueries({ queryKey: ['dispatcher_cron_schedule'] });
    },
  });

  const currentSchedule = query.data?.schedule || getLocalSchedule();

  return {
    schedule: currentSchedule,
    humanLabel: getHumanCronLabel(currentSchedule),
    isLoading: query.isLoading,
    isUpdating: mutation.isPending,
    isMigrationMissing,
    updateSchedule: mutation.mutateAsync,
    updateError: mutation.error as Error | null,
    refetch: query.refetch,
  };
}
