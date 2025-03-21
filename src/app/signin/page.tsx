"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/shared/firebase/firebase";
import { useRouter } from "next/navigation";

export default function SigninPage() {
  const router = useRouter();

  async function handleGoogleSignIn() {
    try {
      const provider = new GoogleAuthProvider();
      // If you'd like to request additional scopes, you can do so here:
      // provider.addScope('https://www.googleapis.com/auth/contacts.readonly');

      // Sign in with a popup window
      const result = await signInWithPopup(auth, provider);

      // The signed-in user info is in result.user
      console.log("Google sign-in success:", result.user);

      // Redirect the user to dashboard (or wherever)
      router.push("/dashboard");
    } catch (error) {
      console.error("Google sign-in error:", error);
      alert("Failed to sign in with Google");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-center">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-3">
          Societal Debt Calculator
        </h1>
        <div className="flex justify-center mb-6">
          <button
            onClick={handleGoogleSignIn}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Sign In with Google
          </button>
        </div>
      </div>
    </div>
  );
}
