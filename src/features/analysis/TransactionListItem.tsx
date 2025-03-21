// src/features/analysis/TransactionListItem.tsx
import { Transaction } from "@/shared/types/transactions";

interface TransactionListItemProps {
  transaction: Transaction;
  getColorClass: (value: number) => string;
}

export function TransactionListItem({ transaction, getColorClass }: TransactionListItemProps) {
  const { 
    date, 
    name, 
    amount, 
    societalDebt = 0, 
    unethicalPractices = [], 
    ethicalPractices = [], 
    practiceWeights = {}
  } = transaction;
  
  // Create badges for practices
  const allPractices = [
    ...unethicalPractices.map(practice => ({
      practice,
      text: `${practice} (${practiceWeights[practice] || 0}%)`,
      type: "unethical"
    })),
    ...ethicalPractices.map(practice => ({
      practice,
      text: `${practice} (${practiceWeights[practice] || 0}%)`,
      type: "ethical"
    }))
  ];

  return (
    <div>
      <div className="grid grid-cols-12 gap-2 items-center mb-2">
        <div className="col-span-8 sm:col-span-7">
          <span className="font-medium text-gray-800 block truncate">{name}</span>
          <span className="text-xs text-gray-500">{date}</span>
        </div>
        <div className="col-span-4 sm:col-span-3 text-right">
          <span className="text-gray-700 block">${amount.toFixed(2)}</span>
          <span className={`text-sm font-medium ${getColorClass(societalDebt)}`}>
            ${Math.abs(societalDebt).toFixed(2)}
          </span>
        </div>
        <div className="col-span-0 sm:col-span-2">
          {/* Empty space for consistent layout with other tabs */}
        </div>
      </div>

      {allPractices.length > 0 && (
        <div className="flex flex-wrap gap-1 sm:gap-2 mt-1">
          {allPractices.map((practiceInfo, idx) => {
            const bgColor = practiceInfo.type === "unethical"
              ? "bg-red-100 text-red-800"
              : "bg-green-100 text-green-800";
            
            return (
              <span 
                key={idx} 
                className={`${bgColor} px-1 sm:px-2 py-0.5 rounded-full text-xs truncate max-w-[150px] sm:max-w-full`}
              >
                {practiceInfo.text}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}