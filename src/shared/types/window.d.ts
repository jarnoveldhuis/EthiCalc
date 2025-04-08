// src/types/window.d.ts
interface Window {
  resetBankConnection?: () => void;
  FORCE_DISCONNECT_PLAID?: () => void;
}


// Define the structure based on the API docs provided
interface EveryDotOrgWidgetOptions {
  selector?: string;
  nonprofitSlug: string;
  fundraiserSlug?: string;
  methods?: string[];
  openAt?: string;
  show?: boolean;
  primaryColor?: string;
  defaultDonationAmount?: number;
  amount?: number;
  minDonationAmount?: number;
  frequency?: "once" | "monthly"; // Assuming DonationFrequency type
  defaultFrequency?: "once" | "monthly";
  addAmounts?: number[];
  completeDonationInNewTab?: boolean;
  noExit?: boolean;
  showGiftCardOption?: boolean;
  webhookToken?: string;
}

interface EveryDotOrgDonateButtonAPI {
  createButton: (options: EveryDotOrgButtonOptions) => void;
  createWidget: (options: EveryDotOrgWidgetOptions) => void;
  setOptions: (options: Partial<EveryDotOrgWidgetOptions>) => void; // Ensure this is present
  showWidget: () => void; // Ensure this is present
  // Add hideWidget() if available/needed
}

interface Window {
    resetBankConnection?: () => void;
    FORCE_DISCONNECT_PLAID?: () => void;
    everyDotOrgDonateButton?: EveryDotOrgDonateButtonAPI; // Ensure this line exists and uses the correct interface
    // Plaid?: PlaidLinkHandler;
  }

interface Window {
  resetBankConnection?: () => void;
  FORCE_DISCONNECT_PLAID?: () => void;
  // Add the Every.org object
  everyDotOrgDonateButton?: EveryDotOrgDonateButtonAPI;
  // Add Plaid if you use its global object elsewhere
  // Plaid?: PlaidLinkHandler;
}
