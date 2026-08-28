import { z } from "zod";
import { ALL_STATUSES } from "./clinic-config";

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
  durationMin: z.number().int().min(5).max(480),
  notes: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(ALL_STATUSES).optional(),
});

export const appointmentPatchSchema = z.object({
  service: z.string().trim().min(2).max(80).optional(),
  startAt: z.string().optional(),
  durationMin: z.number().int().min(5).max(480).optional(),
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

export const clinicSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  shortName: z.string().trim().max(24).optional(),
  tagline: z.string().trim().max(120).optional(),
  timezone: z.string().trim().min(3).max(64).optional(),
  hoursOpen: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hoursClose: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closedWeekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  slotMinutes: z.number().int().min(5).max(120).optional(),
  defaultDuration: z.number().int().min(5).max(480).optional(),
  durations: z.array(z.number().int().min(5).max(480)).min(1).max(8).optional(),
  services: z.array(z.string().trim().min(2).max(80)).min(1).max(40).optional(),
  phone: z.string().trim().max(20).optional(),
  address: z.string().trim().max(200).optional(),
  reviewUrl: z.string().trim().max(300).optional(),
  brandPrimary: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
  brandAccent: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
  rx: z
    .object({
      doctorName: z.string().trim().max(80).optional(),
      qualifications: z.string().trim().max(200).optional(),
      registrationNo: z.string().trim().max(80).optional(),
      footer: z.string().trim().max(500).optional(),
      printLogo: z.boolean().optional(),
      printClinic: z.boolean().optional(),
    })
    .optional(),
});

export const platformCreateClinicSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{0,31}$/),
  name: z.string().trim().min(2).max(80),
  shortName: z.string().trim().max(24).optional(),
  password: z.string().min(4).max(200),
  tagline: z.string().trim().max(120).optional(),
  timezone: z.string().trim().min(3).max(64).optional(),
  hoursOpen: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hoursClose: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closedWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
  slotMinutes: z.number().int().min(5).max(120).optional(),
  defaultDuration: z.number().int().min(5).max(480).optional(),
  durations: z.array(z.number().int().min(5).max(480)).optional(),
  flags: z
    .object({
      publicBooking: z.boolean().optional(),
      pendingApproval: z.boolean().optional(),
      followUps: z.boolean().optional(),
      closures: z.boolean().optional(),
      prescriptions: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
    })
    .optional(),
});

export const platformPatchClinicSchema = z.object({
  enabled: z.boolean().optional(),
  password: z.string().min(4).max(200).optional(),
  flags: z
    .object({
      publicBooking: z.boolean().optional(),
      pendingApproval: z.boolean().optional(),
      followUps: z.boolean().optional(),
      closures: z.boolean().optional(),
      prescriptions: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
    })
    .optional(),
  name: z.string().trim().min(2).max(80).optional(),
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
