
// Helper function to get color class for debt values
export function getColorClass(value: number): string {
  if (value < 0) return "text-green-600";
  if (value === 0) return "text-blue-600";
  if (value <= 10) return "text-yellow-600";
  if (value <= 20) return "text-orange-600";
  if (value <= 50) return "text-red-600";
  return "text-red-700";
}

export const getImpactColorClass = (value: number): string => 
  value < 0
    ? "text-green-600"  // Positive impact
    : value === 0
    ? "text-gray-600"   // Neutral
    : value < 10
    ? "text-yellow-600" // Minor negative
    : value < 20
    ? "text-orange-600" // Moderate negative
    : "text-red-600";   // Severe negative
