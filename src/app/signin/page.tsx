// src/app/signin/page.jsx
// src/app/signin/page.jsx
"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/core/firebase/firebase"; // Correct path based on your structure
import { auth } from "@/core/firebase/firebase"; // Correct path based on your structure
import { useRouter } from "next/navigation";
import Image from 'next/image'; // Import Next.js Image component
import Image from 'next/image'; // Import Next.js Image component

export default function SigninPage() {
  const router = useRouter();

  async function handleGoogleSignIn() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log("Google sign-in success:", result.user);
      // Redirect to dashboard after successful sign-in
      // Redirect to dashboard after successful sign-in
      router.push("/dashboard");
    } catch (error) {
      console.error("Google sign-in error:", error);
      // Consider showing a user-friendly error message here
      alert("Failed to sign in with Google. Please try again.");
      // Consider showing a user-friendly error message here
      alert("Failed to sign in with Google. Please try again.");
    }
  }

  return (
    // Use site background variable
    <div className="min-h-screen bg-[var(--background)] flex justify-center items-center p-4"> {/* <-- PAGE BG CHANGED */}

      {/* Card container - Use theme variables */}
      <div className="bg-[var(--card-background)] shadow-xl rounded-lg p-8 max-w-md w-full text-center border border-[var(--border-color)]"> {/* <-- CARD BG & BORDER CHANGED */}

        {/* Logo */}
        <div className="flex justify-center mb-4">
          <Image
            src="/cashLogo.png" // Make sure this path is correct in your public folder
            alt="ValueBalance Logo"
            width={80} // Adjust size as needed
            height={80}
            priority // Prioritize loading the logo
          />
        </div>

        {/* Title - Use card foreground variable */}
        <h1 className="text-2xl font-bold text-[var(--card-foreground)] mb-2"> {/* <-- TEXT COLOR CHANGED */}
          Welcome to Value-Balance
        </h1>

        {/* Premise Text - Use muted foreground variable */}
        <p className="text-[var(--muted-foreground)] text-sm mb-6 px-4"> {/* <-- TEXT COLOR CHANGED */}
          Understand the ethical impact of your spending and offset your &apos;societal debt&apos; by supporting relevent top-rated charities. Align your values with your wallet.
        </p>

        {/* Sign-in Button - Keep primary button styling */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          // Note: You might want button variables too, but primary blue often works in light/dark
        >
          {/* Simple Google SVG Icon */}
          <svg className="w-4 h-4 mr-2" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
          Sign In with Google
        </button>


        {/* Premise Text - Use muted foreground variable */}
        <p className="text-[var(--muted-foreground)] text-sm mb-6 px-4"> {/* <-- TEXT COLOR CHANGED */}
          Understand the ethical impact of your spending and offset your &apos;societal debt&apos; by supporting relevent top-rated charities. Align your values with your wallet.
        </p>

        {/* Sign-in Button - Keep primary button styling */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          // Note: You might want button variables too, but primary blue often works in light/dark
        >
          {/* Simple Google SVG Icon */}
          <svg className="w-4 h-4 mr-2" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
          Sign In with Google
        </button>

      </div>
    </div>
  );
}