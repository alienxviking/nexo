// Gradient pairs for user avatars — hashed from the username
const GRADIENT_PAIRS = [
  // Cute Pastel Colors
  ['#FFD1DC', '#FFB7B2'],  // Pastel Pink to Soft Rose
  ['#E2F0CB', '#B5EAD7'],  // Mint to Soft Seafoam
  ['#C7CEEA', '#B5B9FF'],  // Lavender to Periwinkle
  ['#FFDAC1', '#FFB7B2'],  // Peach to Melon
  ['#FF9AA2', '#FFB7B2'],  // Strawberry to Coral Pink
  ['#B5EAD7', '#87D3C6'],  // Soft Aqua to Sea Green
  ['#E5D4FF', '#D2B4FF'],  // Lilac to Soft Purple
  ['#FFFED2', '#FDFD96'],  // Buttercream to Pastel Yellow
  ['#DED9EB', '#C4B9D8'],  // Heather to Lavender
  ['#FAD1E6', '#F3A8D2'],  // Cotton Candy Pink
  ['#C1E1C1', '#A3D3A3'],  // Pastel Green
  ['#B1EBFE', '#8CDBFC'],  // Baby Blue
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
