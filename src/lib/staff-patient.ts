import { prisma } from "./prisma";
import { isValidPhone, phoneToStore } from "./phone";
import { ensureOptionalPatientPhone } from "./ensure-schema";

/** Create or reuse a clinic patient for staff booking. Blank phone → new row with NULL (no upsert). */
export async function createOrReuseStaffPatient(opts: {
  clinicId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  concerns?: string | null;
}) {
  await ensureOptionalPatientPhone();
  const name = opts.name.trim();
  const phone = phoneToStore(opts.phone);
  const email = opts.email ? opts.email : null;

  if (phone) {
    if (!isValidPhone(phone)) {
      return { error: "Enter a 10-digit mobile number" as const };
    }
    const patient = await prisma.patient.upsert({
      where: { clinicId_phone: { clinicId: opts.clinicId, phone } },
      create: {
        clinicId: opts.clinicId,
        phone,
        name,
        email,
        concerns: opts.concerns ?? null,
      },
      update: {
        name,
        email: opts.email ? opts.email : undefined,
        concerns: opts.concerns === undefined ? undefined : opts.concerns,
      },
    });
    return { patient };
  }

  const patient = await prisma.patient.create({
    data: {
      clinicId: opts.clinicId,
      phone: null,
      name,
      email,
      concerns: opts.concerns ?? null,
    },
  });
  return { patient };
}
