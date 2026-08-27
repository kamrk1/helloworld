import { z } from "zod";
import { ALL_STATUSES, CLINIC } from "./clinic-config";

export const phoneSchema = z
  .string()
  .min(8)
  .max(20);

export const bookSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: z.string().trim().email().optional().or(z.literal("")),
  service: z.string().trim().min(2).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const appointmentCreateSchema = z.object({
  patientId: z.string().optional(),
  name: z.string().trim().min(2).max(80).optional(),
  phone: phoneSchema.optional(),
  email: z.string().trim().email().optional().or(z.literal("")).optional(),
  service: z.string().trim().min(2).max(80),
  startAt: z.string().datetime({ offset: true }).or(z.string()),
  durationMin: z.number().refine((n) => (CLINIC.durations as readonly number[]).includes(n), {
    message: "Duration must be 30, 60, or 90 minutes",
  }),
  notes: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(ALL_STATUSES).optional(),
});

export const appointmentPatchSchema = z.object({
  service: z.string().trim().min(2).max(80).optional(),
  startAt: z.string().optional(),
  durationMin: z
    .number()
    .refine((n) => (CLINIC.durations as readonly number[]).includes(n))
    .optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(ALL_STATUSES).optional(),
  followupDate: z.string().nullable().optional(),
  googleCalEventId: z.string().nullable().optional(),
  rxLink: z.string().nullable().optional(),
  name: z.string().trim().min(2).max(80).optional(),
  phone: phoneSchema.optional(),
  email: z.string().trim().email().optional().or(z.literal("")).nullable().optional(),
});

export const blockCreateSchema = z.object({
  startAt: z.string(),
  endAt: z.string(),
  allDay: z.boolean().optional(),
  reason: z.string().trim().max(200).optional().nullable(),
});

export const patientCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: z.string().trim().email().optional().or(z.literal("")),
  concerns: z.string().trim().max(300).optional().nullable(),
});

export const prescriptionSchema = z.object({
  complaints: z.string().trim().min(1).max(2000),
  findings: z.string().trim().min(1).max(2000),
  diagnosis: z.string().trim().min(1).max(2000),
  medicines: z.string().trim().min(1).max(4000),
  advice: z.string().trim().min(1).max(2000),
  followupNote: z.string().trim().max(500).optional().nullable(),
  followupDate: z.string().nullable().optional(),
});
