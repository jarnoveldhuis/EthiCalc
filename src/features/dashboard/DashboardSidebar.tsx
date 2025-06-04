import React, { useMemo } from "react";
import { useTransactionStore } from "@/store/transactionStore";
import { AnimatedCounter } from "@/shared/ui/AnimatedCounter";
import { ShareImpactButton } from "./ShareImpactButton";
import { DonationModal } from "@/features/charity/DonationModal";
import { useDonationModal } from "@/hooks/useDonationModal";

export function DashboardSidebar() {
  const impactAnalysis = useTransactionStore((s) => s.impactAnalysis);
  const isBankConnected = useTransactionStore(
    (s) => s.connectionStatus.isConnected
  );
  const appStatus = useTransactionStore((s) => s.appStatus);
  const { modalState, openDonationModal, closeDonationModal } = useDonationModal();

  const balance = useMemo(() => impactAnalysis?.balance ?? 0, [impactAnalysis]);
  const totalPositive = useMemo(
    () => impactAnalysis?.positiveImpact ?? 0,
    [impactAnalysis]
  );
  const totalNegative = useMemo(
    () => impactAnalysis?.negativeImpact ?? 0,
    [impactAnalysis]
  );

  const handleDonate = () => {
    if (balance < 0) {
      openDonationModal("Overall", Math.abs(balance));
    }
  };

  return (
    <div className="w-full lg:col-span-1">
      <div className="card mb-6">
        <div className="p-4 text-center">
          <AnimatedCounter
            value={balance}
            prefix={balance < 0 ? "-$" : "$"}
            className="font-bold text-4xl"
            decimalPlaces={0}
            duration={3000}
          />
          <p className="text-sm font-medium text-gray-600">Your Balance</p>
          {balance < 0 && (
            <button
              onClick={handleDonate}
              disabled={appStatus !== "idle"}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded"
            >
              Offset
            </button>
          )}
        </div>
        {impactAnalysis && (
          <div className="p-4 text-center text-sm text-gray-500">
            <p>Positive Impact: ${totalPositive.toFixed(0)}</p>
            <p>Negative Impact: ${totalNegative.toFixed(0)}</p>
          </div>
        )}
        {impactAnalysis && (
          <div className="p-4 text-center">
            <ShareImpactButton
              overallRatio={null}
              totalPositiveImpact={totalPositive}
            />
          </div>
        )}
      </div>
      {modalState.isOpen && (
        <DonationModal
          isOpen={modalState.isOpen}
          practice={modalState.practice || ""}
          amount={modalState.amount || 0}
          onClose={closeDonationModal}
        />
      )}
    </div>
  );
}
