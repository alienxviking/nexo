// Gradient pairs for user avatars — hashed from the username
const GRADIENT_PAIRS = [
  ['#FF6B6B', '#EE5A24'],  // Coral → Orange
  ['#A29BFE', '#6C5CE7'],  // Soft Purple → Deep Purple
  ['#55E6C1', '#1ABC9C'],  // Mint → Teal
  ['#FD79A8', '#E84393'],  // Pink → Hot Pink
  ['#FDCB6E', '#F39C12'],  // Gold → Amber
  ['#74B9FF', '#0984E3'],  // Sky → Blue
  ['#00CEC9', '#00B894'],  // Cyan → Emerald
  ['#E17055', '#D63031'],  // Terracotta → Red
  ['#81ECEC', '#6C5CE7'],  // Aqua → Indigo
  ['#FAB1A0', '#E55039'],  // Peach → Vermillion
  ['#DFE6E9', '#B2BEC3'],  // Silver → Slate
  ['#FFEAA7', '#FDCB6E'],  // Lemon → Gold
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function getAvatarGradient(name: string): string {
  const index = hashString(name) % GRADIENT_PAIRS.length;
  const [from, to] = GRADIENT_PAIRS[index];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export function getAvatarColors(name: string): { from: string; to: string } {
  const index = hashString(name) % GRADIENT_PAIRS.length;
  return { from: GRADIENT_PAIRS[index][0], to: GRADIENT_PAIRS[index][1] };
}
