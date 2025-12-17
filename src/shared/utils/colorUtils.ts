
// Helper function to get color class for debt values
export function getColorClass(value: number): string {
  // Distinct monochrome: positive vs negative via semantic tokens
  if (value < 0) return "text-[var(--success)]"; // favorable
  if (value === 0) return "text-gray-600";
  return "text-[var(--destructive)]"; // unfavorable
}

export const getImpactColorClass = (value: number): string =>
  value < 0
    ? "text-[var(--success)]"
    : value === 0
    ? "text-gray-600"
    : value < 10
    ? "text-[var(--destructive)] opacity-70"
    : value < 20
    ? "text-[var(--destructive)] opacity-85"
    : "text-[var(--destructive)]"
