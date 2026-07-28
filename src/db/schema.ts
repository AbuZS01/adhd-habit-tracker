import {
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  boolean,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from 'next-auth/adapters';

/**
 * users — one row per authenticated guardian. Auth.js manages sign-in; we
 * store only what the app needs (no password hash — SR-5 / A2).
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
}));

/**
 * Auth.js required adapter tables (accounts, sessions, verification_token).
 * Shape follows @auth/drizzle-adapter's expected Postgres schema exactly.
 */
export const accounts = pgTable('accounts', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').$type<AdapterAccountType>().notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (table) => ({
  compoundKey: primaryKey({ columns: [table.provider, table.providerAccountId] }),
}));

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable('verification_token', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
}, (table) => ({
  compoundKey: primaryKey({ columns: [table.identifier, table.token] }),
}));

/**
 * families — the account/tenancy boundary. Every child, subject, and log
 * entry belongs to exactly one family. All queries scope by `family_id`
 * derived from the session user's membership row, never from client input
 * (T1 / SR-4 equivalent for this app).
 */
export const families = pgTable('families', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // Which UK nation's home-education rules apply. Drives which legal-standard
  // text is shown on the dashboard and evidence report (src/lib/legal-content.ts)
  // — the four nations' regimes diverge materially, so this can't be
  // guessed or defaulted. Null until the family sets it.
  nation: text('nation').$type<'england' | 'wales' | 'scotland' | 'northern_ireland'>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * family_members — join table enabling multiple guardians (co-parents,
 * carers) per family. A user belongs to at most one family (unique on
 * user_id): this app models one household's education record, not a user
 * juggling several unrelated households.
 */
export const familyMembers = pgTable('family_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  familyId: uuid('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // 'owner' created the family; 'guardian' joined via invite. Both have full
  // read/write on the family's children/subjects/entries — only invite
  // creation and member removal are owner-only.
  role: text('role').$type<'owner' | 'guardian'>().notNull().default('guardian'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: uniqueIndex('family_members_user_idx').on(table.userId),
  familyIdx: index('family_members_family_idx').on(table.familyId),
}));

/**
 * family_invites — single-use, expiring invite codes an owner generates so a
 * co-guardian can join the family. The code is a random token, not guessable
 * from the family id; consuming it sets `used_at` so it can't be replayed.
 */
export const familyInvites = pgTable('family_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  familyId: uuid('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  usedByUserId: uuid('used_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  codeIdx: uniqueIndex('family_invites_code_idx').on(table.code),
  familyIdx: index('family_invites_family_idx').on(table.familyId),
}));

/**
 * children — one profile per home-educated child. Scoped by `family_id`.
 *
 * Deliberately does not store date of birth: for this app's purpose (a
 * subject/evidence log), a year group is all that's needed to organise
 * records, and a child's DOB is unnecessary personal data to hold under
 * GDPR's data minimisation principle (UK GDPR Art. 5(1)(c)) — collecting
 * it would create a retention/security burden with no matching benefit.
 */
export const children = pgTable('children', {
  id: uuid('id').primaryKey().defaultRandom(),
  familyId: uuid('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Free-text, e.g. "Year 4" or "Key Stage 2" — no fixed curriculum imposed.
  yearGroup: text('year_group'),
  notes: text('notes'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  familyIdx: index('children_family_idx').on(table.familyId),
}));

/**
 * subjects — per-child sections (Maths, English, Science, ...). Scoped to a
 * child (not just the family) so siblings can have different subjects.
 * Seeded with sensible defaults when a child profile is created; guardians
 * can rename, add, and archive freely.
 */
export const subjects = pgTable('subjects', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Sort order for consistent display; lower first.
  sortOrder: integer('sort_order').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  childIdx: index('subjects_child_idx').on(table.childId),
}));

/**
 * log_entries — the evidence record: one dated entry per piece of learning
 * activity, note, or output. `entry_date` is guardian-chosen (the date the
 * activity happened), separate from `created_at` (when it was logged), so
 * evidence can be backfilled accurately for LA reporting.
 */
export const logEntries = pgTable('log_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  // Nullable: an entry can be general/cross-curricular rather than tied to
  // one subject (e.g. a museum trip covering several subjects).
  subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
  authorUserId: uuid('author_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entryDate: date('entry_date', { mode: 'string' }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  // 'work_sample' | 'note' | 'outing' | 'resource' | 'assessment' | 'other'
  activityType: text('activity_type').notNull().default('note'),
  // Optional link to evidence hosted elsewhere (e.g. a photo in cloud
  // storage). Validated https/http only at write time (SR-6 equivalent).
  externalLink: text('external_link'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  childIdx: index('log_entries_child_idx').on(table.childId),
  subjectIdx: index('log_entries_subject_idx').on(table.subjectId),
  dateIdx: index('log_entries_date_idx').on(table.entryDate),
}));

/**
 * attachments — uploaded evidence files (photos, PDFs) for a log entry.
 * Stores the Vercel Blob `pathname`, not a public URL: blobs are written
 * with `access: 'private'`, so reading one back requires the read-write
 * token, which only ever happens server-side in the authenticated proxy
 * route (`/api/attachments/[id]/file`) after an ownership check — the
 * file is never reachable via a bare link, unlike a public blob URL.
 */
export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  logEntryId: uuid('log_entry_id').notNull().references(() => logEntries.id, { onDelete: 'cascade' }),
  pathname: text('pathname').notNull(),
  originalName: text('original_name').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  uploadedByUserId: uuid('uploaded_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  logEntryIdx: index('attachments_log_entry_idx').on(table.logEntryId),
}));

/**
 * planned_activities — a forward-looking plan (intended, not yet done),
 * distinct from log_entries (what actually happened). "Completed" is never
 * stored here directly — it's derived by checking whether a matching
 * log_entries row exists for the same child/subject/date, so plan and
 * evidence can never drift out of sync with each other.
 */
export const plannedActivities = pgTable('planned_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  // Nullable for a general/cross-curricular plan, same convention as log_entries.
  subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
  plannedDate: date('planned_date', { mode: 'string' }).notNull(),
  title: text('title'),
  // Manual tick-off, independent of the auto-derived match against
  // log_entries below — lets a guardian mark a plan done without writing a
  // full log entry. The effective "completed" state a plan shows is
  // `completedAt is not null` OR a matching log entry exists (see
  // src/lib/planner.ts withCompletionStatus) — logging real evidence always
  // counts as done even if this was never manually ticked.
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  childIdx: index('planned_activities_child_idx').on(table.childId),
  dateIdx: index('planned_activities_date_idx').on(table.plannedDate),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Family = typeof families.$inferSelect;
export type NewFamily = typeof families.$inferInsert;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type NewFamilyMember = typeof familyMembers.$inferInsert;
export type FamilyInvite = typeof familyInvites.$inferSelect;
export type NewFamilyInvite = typeof familyInvites.$inferInsert;
export type Child = typeof children.$inferSelect;
export type NewChild = typeof children.$inferInsert;
export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
export type LogEntry = typeof logEntries.$inferSelect;
export type NewLogEntry = typeof logEntries.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
export type PlannedActivity = typeof plannedActivities.$inferSelect;
export type NewPlannedActivity = typeof plannedActivities.$inferInsert;
