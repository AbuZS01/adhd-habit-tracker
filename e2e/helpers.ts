import type { APIRequestContext } from '@playwright/test';

export interface SeededChild {
  id: string;
  name: string;
  subjects: { id: string; name: string }[];
}

/**
 * Creates a child (with its four default subjects) directly via the API,
 * using the request context's already-authenticated storage state. Tests
 * that aren't specifically exercising the "add child" UI use this instead
 * of driving the drawer every time, to stay fast and focused.
 */
export async function seedChild(request: APIRequestContext, name: string): Promise<SeededChild> {
  const createRes = await request.post('/api/children', { data: { name } });
  if (!createRes.ok()) {
    throw new Error(`Failed to seed child "${name}": ${createRes.status()} ${await createRes.text()}`);
  }
  const { child } = await createRes.json();

  const subjectsRes = await request.get(`/api/children/${child.id}/subjects`);
  const { subjects } = await subjectsRes.json();

  return { id: child.id, name: child.name, subjects };
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
