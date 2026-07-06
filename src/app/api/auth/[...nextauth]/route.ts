import { handlers } from '@/lib/auth';

// Auth.js route handler. This is the one endpoint under /api/** that is
// intentionally unauthenticated (it IS the authentication mechanism).
export const { GET, POST } = handlers;
