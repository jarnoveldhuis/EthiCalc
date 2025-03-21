// src/features/banking/index.ts

// Core service
// export { bankConnectionService, type DisconnectionOptions } from './bankConnectionService';

// Hooks
export { useBankConnection } from './useBankConnection';

// Components
export { PlaidConnectionSection } from './PlaidConnectionSection';
export { PlaidConnection } from './PlaidConnection';
export { default as PlaidLink } from './PlaidLink';
export { ConnectionStatusIndicator } from './ConnectionStatusIndicator';

// For developers to know which files are now deprecated
export const DEPRECATED_FILES = [
  'forceDisconnect.ts',
  'connectionReset.ts',
  'completeCleanup.ts'
]; 