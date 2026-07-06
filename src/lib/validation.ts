import { z } from 'zod';

/**
 * Central zod schemas for every external input (SR-6). Every request body
 * or query must be parsed here before use. Invalid input -> 400, never a
 * partial write.
 */

// Strip ASCII control characters (0x00-0x1F, 0x7F) — used before storing
// any user-supplied text that may later be rendered in a push notification
// (SR-11) or the DOM (SR-2, belt-and-suspenders on top of React escaping).
// Built from explicit char codes rather than a literal control-char range
// in source, so no raw control byte lives in this source file.
const CONTROL_CHAR_PATTERN = new RegExp(
  '[\\u0000-\\u001F\\u007F]',
  'g'
);

export function stripControlChars(input: string): string {
  return input.replace(CONTROL_CHAR_PATTERN, '');
}

const trimmedText = (max: number) =>
  z
    .string()
    .transform((v) => stripControlChars(v).trim())
    .pipe(z.string().min(1).max(max));

const optionalTrimmedText = (max: number) =>
  z
    .string()
    .transform((v) => stripControlChars(v).trim())
    .pipe(z.string().max(max))
    .optional()
    .or(z.literal('').transform(() => undefined));

// "HH:MM" 24-hour time string.
const scheduleTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'schedule time must be HH:MM 24-hour format');

// IANA timezone validation — Intl throws for invalid identifiers.
export const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid IANA timezone identifier' }
);

const activeDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .max(7)
  .default([0, 1, 2, 3, 4, 5, 6]);

export const habitNameSchema = trimmedText(80);
export const habitCueSchema = optionalTrimmedText(120);
export const habitNoteSchema = optionalTrimmedText(280);

export const createHabitSchema = z.object({
  name: habitNameSchema,
  cue: habitCueSchema,
  note: habitNoteSchema,
  scheduleTime: scheduleTimeSchema.default('09:00'),
  activeDays: activeDaysSchema,
});

export const updateHabitSchema = z.object({
  name: habitNameSchema.optional(),
  cue: habitCueSchema,
  note: habitNoteSchema,
  scheduleTime: scheduleTimeSchema.optional(),
  activeDays: activeDaysSchema.optional(),
  isArchived: z.boolean().optional(),
});

export const habitIdParamSchema = z.string().uuid();

export const createCheckinSchema = z.object({
  habitId: z.string().uuid(),
});

// Only https:// endpoints are legitimate push service URLs. Rejects
// javascript:, data:, and other schemes that z.string().url() would
// otherwise accept as "valid URLs".
const httpsUrlSchema = z
  .string()
  .max(2048)
  .refine(
    (value) => {
      try {
        return new URL(value).protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Must be an https:// URL' }
  );

// Web Push subscription JSON shape (as produced by PushManager.subscribe()).
export const pushSubscriptionSchema = z.object({
  endpoint: httpsUrlSchema,
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

export const unsubscribeSchema = z.object({
  endpoint: httpsUrlSchema,
});

export const updateSettingsSchema = z.object({
  timezone: timezoneSchema,
  quietHoursStart: z.number().int().min(0).max(23),
  quietHoursEnd: z.number().int().min(0).max(23),
});
