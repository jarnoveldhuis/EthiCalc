// src/app/api/banking/PlaidConnectionSection.tsx
import PlaidLink from "@/features/banking/PlaidLink";

interface PlaidConnectionSectionProps {
  // Update the type to accept null as well to match PlaidLink's type signature
  onSuccess: (public_token: string | null) => void;
}

export function PlaidConnectionSection({ onSuccess }: PlaidConnectionSectionProps) {
  return (
    <div className="flex justify-center mb-6">
      <PlaidLink onSuccess={onSuccess} />
    </div>
  );
}