// src/components/Header.tsx
import { User } from "firebase/auth";
import { useState, useRef, useEffect } from "react";
import { DisconnectBankButton } from "@/features/banking/DisconnectBankButton";

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onOpenValuesModal: () => void; // New prop
  onDisconnectBank?: () => void; // Optional disconnect function
  isBankConnected?: boolean; // Status passed from parent
}

export function Header({
  user,
  onLogout,
  onOpenValuesModal, // New prop
  onDisconnectBank,
  isBankConnected = false
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex items-center space-x-2"> {/* Reduced space-x-4 to space-x-2 to make room */}
      {/* "Customize Values" Button - Updated with Gradient */}
      <button
        onClick={onOpenValuesModal}
        className="px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-md whitespace-nowrap bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 transition-all duration-300 ease-in-out"
      >
        Customize Values
      </button>

      {/* User Menu */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors relative" // Adjusted padding, added relative
        >
           {/* Connection Status Indicator Dot */}
           <span
             className={`absolute -top-1 -right-1 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-800 ${
               isBankConnected ? 'bg-green-500' : 'bg-gray-400'
             }`}
             title={isBankConnected ? 'Bank Connected' : 'Bank Not Connected'}
           />

          {/* User Avatar */}
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
          {/* User Email (Optional, consider hiding on small screens) */}
          {/* <span className="text-sm text-gray-700 dark:text-gray-200 max-w-[100px] truncate hidden sm:inline">
             {user?.email || "User"}
           </span> */}
           {/* Dropdown Arrow */}
          <svg
            className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden z-20 border border-gray-200 dark:border-gray-700">
            {/* User Info Section */}
             <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
               <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.displayName || user?.email || "User"}</div>
               <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</div>
             </div>

             {/* Connection Status Text within Dropdown */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center">
                 <div className={`w-2 h-2 rounded-full mr-2 ${isBankConnected ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                 <span className="text-xs text-gray-600 dark:text-gray-300">
                   {isBankConnected ? 'Bank Connected' : 'No Bank Connected'}
                 </span>
               </div>
            </div>

            {/* Disconnect bank option */}
            {isBankConnected && onDisconnectBank && (
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                {/* Use the Button Component directly */}
                <DisconnectBankButton onDisconnect={() => { onDisconnectBank(); setDropdownOpen(false); }} />
              </div>
            )}

            {/* Logout button */}
            <button
              onClick={() => {
                onLogout();
                setDropdownOpen(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}