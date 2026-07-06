import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from 'next-auth/adapters';

/**
 * users — one row per authenticated person. Auth.js manages sign-in; we
 * store only what the app needs (no password hash — SR-5 / A2).
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  name: text('name'),
  image: text('image'),
  // IANA timezone string, validated by zod before write (SR-6). Used by the
  // nudge engine for quiet-hours math.
  timezone: text('timezone').notNull().default('UTC'),
  // Quiet hours as 0-23 local-hour bounds; nudges never fire in this window.
  quietHoursStart: integer('quiet_hours_start').notNull().default(22),
  quietHoursEnd: integer('quiet_hours_end').notNull().default(8),
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
 * habits — small, user-owned list. `user_id` is always derived from the
 * session server-side (T1 / SR-4), never trusted from client input.
 */
export const habits = pgTable('habits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Habit name, length-capped + control-chars stripped by zod (SR-6).
  name: text('name').notNull(),
  // Optional implementation-intention cue, e.g. "After I pour coffee".
  cue: text('cue'),
  // Free-text note, length-capped.
  note: text('note'),
  // Preferred local time-of-day for the nudge, "HH:MM" 24h string.
  scheduleTime: text('schedule_time').notNull().default('09:00'),
  // Days of week this habit is active, 0=Sun..6=Sat.
  activeDays: jsonb('active_days').$type<number[]>().notNull().default([0, 1, 2, 3, 4, 5, 6]),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('habits_user_idx').on(table.userId),
}));

/**
 * checkins — one row per completed check-in. Streak math is always computed
 * server-side from these rows, never trusted from the client.
 */
export const checkins = pgTable('checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  habitId: uuid('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  habitIdx: index('checkins_habit_idx').on(table.habitId),
  userIdx: index('checkins_user_idx').on(table.userId),
}));

/**
 * push_subscriptions — one live row per (user_id, endpoint). Never returned
 * to any client (SR-3). Deleted immediately on 404/410 from the push
 * service (SR-8).
 */
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userEndpointIdx: uniqueIndex('push_subs_user_endpoint_idx').on(table.userId, table.endpoint),
}));

/**
 * notification_log — every nudge attempt, used for dedupe/backoff/escalation
 * decisions in the nudge engine and for measuring real-world delivery.
 */
export const notificationLog = pgTable('notification_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  habitId: uuid('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  // 'initial' | 'escalation'
  kind: text('kind').notNull(),
  // Which message-variant template was used (for rotation/dedupe).
  variantKey: text('variant_key').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  // 'sent' | 'failed' | 'skipped_quiet_hours' | 'dead_subscription'
  status: text('status').notNull(),
}, (table) => ({
  userHabitDayIdx: index('notification_log_user_habit_idx').on(table.userId, table.habitId),
  sentAtIdx: index('notification_log_sent_at_idx').on(table.sentAt),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Habit = typeof habits.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;
export type Checkin = typeof checkins.$inferSelect;
export type NewCheckin = typeof checkins.$inferInsert;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscriptionRow = typeof pushSubscriptions.$inferInsert;
export type NotificationLogRow = typeof notificationLog.$inferSelect;
export type NewNotificationLogRow = typeof notificationLog.$inferInsert;
