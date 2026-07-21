import { z } from 'zod';

/**
 * Central zod schemas for every external input (SR-6 equivalent). Every
 * request body or query is parsed here before use. Invalid input -> 400,
 * never a partial write.
 */

// Strip ASCII control characters (0x00-0x1F, 0x7F) before storing any
// user-supplied text (belt-and-suspenders on top of React's DOM escaping).
// Built from explicit char codes rather than a literal control-char range
// in source, so no raw control byte lives in this source file.
const CONTROL_CHAR_PATTERN = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

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

const nullableTrimmedText = (max: number) =>
  z
    .string()
    .transform((v) => stripControlChars(v).trim())
    .pipe(z.string().max(max))
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null));

// ISO "YYYY-MM-DD" date-only string (no time component — evidence dates are
// calendar days, not timestamps). Rejects impossible dates like 2024-02-30.
function isoDateSchema(opts: { allowFuture: boolean }) {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD format')
    .refine((value) => {
      const parsed = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) return false;
      // Reject silently-rolled-over dates (e.g. 2024-02-30 -> 2024-03-01).
      return parsed.toISOString().slice(0, 10) === value;
    }, 'must be a real calendar date')
    .refine((value) => {
      if (opts.allowFuture) return true;
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      return value <= tomorrow.toISOString().slice(0, 10);
    }, 'date cannot be in the future');
}

const httpUrlSchema = z
  .string()
  .max(2048)
  .refine(
    (value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
      } catch {
        return false;
      }
    },
    { message: 'must be a valid http(s):// URL' }
  );

export const childNameSchema = trimmedText(80);
export const yearGroupSchema = optionalTrimmedText(40);
export const childNotesSchema = optionalTrimmedText(1000);

export const createChildSchema = z.object({
  name: childNameSchema,
  yearGroup: yearGroupSchema,
  notes: childNotesSchema,
});

export const updateChildSchema = z.object({
  name: childNameSchema.optional(),
  yearGroup: yearGroupSchema,
  notes: nullableTrimmedText(1000),
  isArchived: z.boolean().optional(),
});

export const subjectNameSchema = trimmedText(60);

export const createSubjectSchema = z.object({
  name: subjectNameSchema,
});

export const updateSubjectSchema = z.object({
  name: subjectNameSchema.optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isArchived: z.boolean().optional(),
});

export const activityTypeSchema = z.enum([
  'work_sample',
  'note',
  'outing',
  'resource',
  'assessment',
  'other',
]);

export const entryDateSchema = isoDateSchema({ allowFuture: false });
export const entryTitleSchema = trimmedText(140);
export const entryDescriptionSchema = optionalTrimmedText(4000);
export const entryExternalLinkSchema = httpUrlSchema.nullable().optional().or(z.literal('').transform(() => null));

export const createLogEntrySchema = z.object({
  childId: z.string().uuid(),
  subjectId: z.string().uuid().nullable().optional(),
  entryDate: entryDateSchema,
  title: entryTitleSchema,
  description: entryDescriptionSchema,
  activityType: activityTypeSchema.default('note'),
  externalLink: entryExternalLinkSchema,
});

export const updateLogEntrySchema = z.object({
  subjectId: z.string().uuid().nullable().optional(),
  entryDate: entryDateSchema.optional(),
  title: entryTitleSchema.optional(),
  description: entryDescriptionSchema,
  activityType: activityTypeSchema.optional(),
  externalLink: entryExternalLinkSchema,
});

export const listEntriesQuerySchema = z.object({
  childId: z.string().uuid(),
  subjectId: z.string().uuid().optional(),
  from: isoDateSchema({ allowFuture: true }).optional(),
  to: isoDateSchema({ allowFuture: true }).optional(),
});

export const familyNameSchema = trimmedText(120);

export const updateFamilySchema = z.object({
  name: familyNameSchema,
});

export const inviteAcceptSchema = z.object({
  code: z.string().min(1).max(200),
});

export const idParamSchema = z.string().uuid();
