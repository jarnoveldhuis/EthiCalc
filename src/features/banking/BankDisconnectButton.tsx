// // src/features/banking/BankDisconnectButton.tsx
// import { useState } from 'react';
// import { DisconnectionOptions } from './bankConnectionService';

// interface BankDisconnectButtonProps {
//   onDisconnect: (options?: DisconnectionOptions) => Promise<boolean>;
//   variant?: 'default' | 'small' | 'danger';
//   buttonText?: string;
//   reloadPage?: boolean;
// }

// export function BankDisconnectButton({ 
//   onDisconnect, 
//   variant = 'default',
//   buttonText,
//   reloadPage = false
// }: BankDisconnectButtonProps) {
//   const [isDisconnecting, setIsDisconnecting] = useState(false);
  
//   const handleDisconnect = async () => {
//     if (isDisconnecting) return;
    
//     const confirmMessage = reloadPage 
//       ? 'This will disconnect your bank account and reload the page. Continue?' 
//       : 'Disconnect your bank account?';
      
//     if (!confirm(confirmMessage)) {
//       return;
//     }
    
//     setIsDisconnecting(true);
    
//     try {
//       // Set disconnection options
//       const options: DisconnectionOptions = {
//         reloadPage,
//         clearStoredData: true,
//         preventAutoReconnect: true
//       };
      
//       await onDisconnect(options);
      
//       // If not reloading, reset the state
//       if (!reloadPage) {
//         setIsDisconnecting(false);
//       }
//     } catch (error) {
//       console.error('Error disconnecting bank:', error);
//       setIsDisconnecting(false);
//     }
//   };
  
//   // Default text based on variant and state
//   let text = buttonText;
//   if (!text) {
//     if (isDisconnecting) {
//       text = 'Disconnecting...';
//     } else {
//       text = variant === 'danger' ? 'Disconnect Bank' : 'Disconnect';
//     }
//   }
  
//   // Styles based on variant
//   let className = '';
  
//   switch (variant) {
//     case 'danger':
//       className = 'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium text-sm';
//       break;
//     case 'small':
//       className = 'text-gray-600 hover:text-gray-800 underline text-sm';
//       break;
//     default:
//       className = 'bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm';
//   }
  
//   if (isDisconnecting) {
//     className = className.replace('hover:', '') + ' opacity-75 cursor-not-allowed';
//   }
  
//   return (
//     <button
//       onClick={handleDisconnect}
//       disabled={isDisconnecting}
//       className={className}
//     >
//       {text}
//     </button>
//   );
// }