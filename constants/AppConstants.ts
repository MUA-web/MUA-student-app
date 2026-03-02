// AppConstants.ts
// This file is being phased out in favor of dynamic Supabase fetching.

export const LEVELS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];

// Redundant but kept for backward compatibility if any screen hasn't been updated yet
export const DEPT_DATA: Record<string, { prefix: string }> = {};
export const DEPTS: string[] = [];
