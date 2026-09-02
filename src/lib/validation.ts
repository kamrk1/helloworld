import { z } from "zod";
import { ALL_STATUSES } from "./clinic-config";
import { isValidPhone, normalizePhone } from "./phone";
import { validateHoursWindows } from "./clinic-hours";

function blankToUndefined(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

const indianMobile = z
  .string({ required_error: "Enter a 10-digit mobile number", invalid_type_error: "Enter a 10-digit mobile number" })
  .transform((s) => normalizePhone(s))
  .refine((s) => isValidPhone(s), { message: "Enter a 10-digit mobile number" });

/** Required 10-digit Indian mobile. Empty string is omitted then rejected. */
export const phoneSchema = z.preprocess(blankToUndefined, indianMobile);

/** Empty / missing phone is omitted; if present it must be a valid 10-digit mobile. */
export const optionalPhoneSchema = z.preprocess(blankToUndefined, indianMobile.optional());

const patientName = z
  .string({ required_error: "Patient name is required", invalid_type_error: "Patient name is required" })
  .trim()
  .min(2, "Patient name is required")
  .max(80);

export const bookSchema = z.object({
  name: patientName,
  phone: phoneSchema,
  email: z.string().trim().email().optional().or(z.literal("")),
  service: z.string().trim().min(2, "Choose a service").max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const appointmentCreateSchema = z
  .object({
    patientId: z.preprocess(blankToUndefined, z.string().min(1).optional()),
    name: z.preprocess(blankToUndefined, patientName.optional()),
    phone: optionalPhoneSchema,
    email: z.string().trim().email().optional().or(z.literal("")).optional(),
    service: z.string().trim().min(2, "Choose a service").max(80),
    startAt: z.string().min(1, "Choose a date and time."),
    durationMin: z
      .number({ required_error: "Choose a duration between 5 and 480 minutes." })
      .int()
      .min(5, "Choose a duration between 5 and 480 minutes.")
      .max(480, "Choose a duration between 5 and 480 minutes."),
    notes: z.string().trim().max(1000).optional().nullable(),
    status: z.enum(ALL_STATUSES).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.patientId) return;
    if (!data.name) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["name"], message: "Patient name is required" });
    }
  });

export const appointmentPatchSchema = z.object({
  service: z.string().trim().min(2, "Choose a service").max(80).optional(),
  startAt: z.string().min(1, "Choose a date and time.").optional(),
  durationMin: z
    .number()
    .int()
    .min(5, "Choose a duration between 5 and 480 minutes.")
    .max(480, "Choose a duration between 5 and 480 minutes.")
    .optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(ALL_STATUSES).optional(),
  followupDate: z.string().nullable().optional(),
  googleCalEventId: z.string().nullable().optional(),
  rxLink: z.string().nullable().optional(),
  name: z.preprocess(blankToUndefined, patientName.optional()),
  phone: optionalPhoneSchema,
  email: z.string().trim().email().optional().or(z.literal("")).nullable().optional(),
});

export const blockCreateSchema = z.object({
  startAt: z.string(),
  endAt: z.string(),
  allDay: z.boolean().optional(),
  reason: z.string().trim().max(200).optional().nullable(),
});

export const patientCreateSchema = z.object({
  name: patientName,
  phone: optionalPhoneSchema,
  email: z.string().trim().email().optional().or(z.literal("")),
  concerns: z.string().trim().max(300).optional().nullable(),
});

export const clinicSettingsSchema = z
  .object({
  name: z.string().trim().min(2).max(80).optional(),
  shortName: z.string().trim().max(24).optional(),
  tagline: z.string().trim().max(120).optional(),
  timezone: z.string().trim().min(3).max(64).optional(),
  hoursOpen: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hoursClose: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hoursWindows: z
    .array(
      z.object({
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .min(1)
    .max(8)
    .optional(),
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
})
  .superRefine((data, ctx) => {
    if (!data.hoursWindows) return;
    const checked = validateHoursWindows(data.hoursWindows);
    if (!checked.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["hoursWindows"], message: checked.error });
    }
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

export const invoiceSchema = z.object({
  billNo: z.string().trim().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  amountWords: z.string().trim().max(500),
  paymentMode: z.string().trim().max(100),
  items: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    cost: z.number().min(0),
  })).min(1, "Add at least one item"),
  totalAmount: z.number().min(0),
});

const ZOD_NOISE =
  /must contain at least|too_small|Invalid datetime|Invalid enum value|^Required$|Expected |Invalid (input|type|literal)/i;

/** Never return raw Zod copy like "String must contain at least 8 character(s)". */
export function humanZodMessage(error: z.ZodError, fallback = "Please check the form and try again."): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  const msg = issue.message;
  const path = issue.path.map(String).join(".");
  if (ZOD_NOISE.test(msg) || msg.length > 80) {
    if (path.includes("phone")) return "Enter a 10-digit mobile number";
    if (path.includes("name")) return "Patient name is required";
    if (path.includes("startAt")) return "Choose a date and time.";
    if (path.includes("durationMin")) return "Choose a duration between 5 and 480 minutes.";
    if (path.includes("service")) return "Choose a service.";
    if (path.includes("hours")) return "Check clinic hours."
    if (path.includes("time") || path.includes("slot")) return "Choose a time slot.";
    return fallback;
  }
  return msg;
}
