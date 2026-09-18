import { Clock3, RotateCcw, Sparkles, Swords, Wind, Zap } from '@lucide/vue'
export const actionIcon = kind => ({ action: Swords, bonus_action: Zap, reaction: RotateCcw, free: Wind, special: Sparkles })[kind] || Clock3
export const actionTone = kind => ({ action: 'var(--accent)', special: 'var(--accent)', bonus_action: 'var(--info)', reaction: 'var(--warning)', free: 'var(--success)' })[kind] || 'var(--text-2)'
