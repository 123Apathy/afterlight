export type TierKey = 'S' | 'A' | 'B' | 'C' | 'D';

export const TIERS: { key: TierKey; score: number; label: string; color: string }[] = [
  { key: 'S', score: 5, label: 'S — Must use', color: '#E4B778' },
  { key: 'A', score: 4, label: 'A — Great', color: '#CBAE85' },
  { key: 'B', score: 3, label: 'B — Good', color: '#A99A8C' },
  { key: 'C', score: 2, label: 'C — Maybe', color: '#8A8078' },
  { key: 'D', score: 1, label: 'D — Skip', color: '#6B6560' },
];

export function tierForScore(score: number | null | undefined): (typeof TIERS)[number] | null {
  if (score == null) return null;
  const rounded = Math.max(1, Math.min(5, Math.round(score)));
  return TIERS.find((t) => t.score === rounded) || null;
}

export function tierIndexForScore(score: number | null | undefined): number {
  // index into TIERS, 0 = S (top) .. 4 = D (bottom)
  if (score == null) return 2; // default to middle (B) when unrated
  const rounded = Math.max(1, Math.min(5, Math.round(score)));
  return TIERS.findIndex((t) => t.score === rounded);
}
