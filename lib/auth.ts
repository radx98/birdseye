import { betterAuth } from "better-auth";
import { Pool } from "pg";
import dns from "dns";

// Force IPv4 resolution to avoid IPv6 connection issues
dns.setDefaultResultOrder("ipv4first");

// Determine base URL for auth
// Priority: BETTER_AUTH_URL > VERCEL_URL (for preview deployments) > localhost
const getAuthBaseURL = () => {
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
};

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false, // Disable SSL for development
  }),
  emailAndPassword: {
    enabled: false, // Disable email/password auth
  },
  socialProviders: {
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID as string,
      clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: getAuthBaseURL(),
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (update session every day)
  },
});

export type Session = typeof auth.$Infer.Session;
