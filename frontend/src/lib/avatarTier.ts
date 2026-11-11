// Moldura do avatar que evolui com as tasks concluidas. Puro, sem BD.
export interface AvatarTier {
  key: 'starter' | 'bronze' | 'silver' | 'gold' | 'legend';
  minCompleted: number;
  ringClass: string;
}

// Do mais alto para o mais baixo: o primeiro que couber ganha.
export const AVATAR_TIERS: readonly AvatarTier[] = [
  { key: 'legend', minCompleted: 500, ringClass: 'ring-4 ring-fuchsia-400' },
  { key: 'gold', minCompleted: 100, ringClass: 'ring-4 ring-amber-400' },
  { key: 'silver', minCompleted: 50, ringClass: 'ring-4 ring-sky-300' },
  { key: 'bronze', minCompleted: 10, ringClass: 'ring-4 ring-orange-500' },
  { key: 'starter', minCompleted: 0, ringClass: 'ring-2 ring-neutral-600' },
];

export function avatarTierFor(completed: number): AvatarTier {
  return AVATAR_TIERS.find((tier) => completed >= tier.minCompleted) ?? AVATAR_TIERS[AVATAR_TIERS.length - 1];
}
