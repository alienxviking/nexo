// Gradient pairs for user avatars — hashed from the username
// Cute Pastel Colors
const AVATAR_COLORS = [
  '#FFB7B2', // Soft Coral/Rose
  '#B5EAD7', // Soft Seafoam
  '#C7CEEA', // Periwinkle
  '#FFDAC1', // Peach
  '#FF9AA2', // Strawberry
  '#87D3C6', // Soft Aqua
  '#D2B4FF', // Soft Purple
  '#FDFD96', // Pastel Yellow
  '#C4B9D8', // Heather Lavender
  '#F3A8D2', // Cotton Candy
  '#A3D3A3', // Pastel Green
  '#8CDBFC', // Baby Blue
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
  const index = hashString(name) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function getAvatarColors(name: string): { from: string; to: string } {
  const index = hashString(name) % AVATAR_COLORS.length;
  // Fallback to same color if gradient is expected
  return { from: AVATAR_COLORS[index], to: AVATAR_COLORS[index] };
}
