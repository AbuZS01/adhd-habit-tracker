import type { DefaultSession } from 'next-auth';

// Augment Auth.js session type to include the database user id, which is
// the sole source of truth for `user_id` in every DB query (SR-4).
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}
