import { createAuthClient } from "better-auth/react";

// Use current origin for auth URLs to support preview deployments
// This prevents CORS errors when accessing preview URLs
const getBaseURL = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000";
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
});

export const { useSession, signIn, signOut } = authClient;
