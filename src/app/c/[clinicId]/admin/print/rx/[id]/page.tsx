import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { displayPhone } from "@/lib/phone";
import { formatDateLong, formatTime } from "@/lib/datetime";
import { PrintTrigger } from "./PrintTrigger";
import { getSession } from "@/lib/auth";
import { clinicLoginPath, clinicLogoUrl } from "@/lib/clinic-config";
import { getClinicRuntime } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function PrintRxPage({
  params,
  searchParams,
}: {
  params: { clinicId: string; id: string };
  searchParams: { print?: string };
}) {
  const clinicId = params.clinicId.toLowerCase();
  const session = await getSession();
  if (!session || session.role !== "clinic" || session.clinicId !== clinicId) {
    redirect(clinicLoginPath(clinicId));
  }
  const clinic = await getClinicRuntime(clinicId);
  if (!clinic || !clinic.flags.prescriptions) notFound();

  const appt = await prisma.appointment.findFirst({
    where: { id: params.id, clinicId },
    include: { patient: true, prescription: true },
  });
  if (!appt || !appt.prescription) notFound();
  const rx = appt.prescription;
  const medicines = rx.medicines.split("\n").map((l) => l.trim()).filter(Boolean);
  const letter = clinic.rx;
  const logoSrc = clinic.hasLogo ? clinicLogoUrl(clinic.id, clinic.updatedAt) : "/logo.svg";

  return (
    <div className="min-h-dvh bg-white px-6 py-8 text-slate-900">
      <PrintTrigger auto={searchParams.print === "1"} clinicId={clinicId} />
      <div className="mx-auto max-w-[720px]">
        <div className="flex items-start justify-between border-b-2 border-teal pb-4">
          <div className="flex items-center gap-3">
            {letter.printLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt="" className="h-14 w-14 rounded-xl object-cover" />
            )}
            <div>
              {letter.printClinic && (
                <div className="font-display text-2xl font-semibold text-teal-dark">{clinic.name}</div>
              )}
              {letter.doctorName && (
                <div className="text-sm font-semibold text-slate-700">{letter.doctorName}</div>
              )}
              {letter.qualifications && <div className="text-xs text-slate-500">{letter.qualifications}</div>}
              {letter.registrationNo && <div className="text-xs text-slate-500">Reg. {letter.registrationNo}</div>}
              {!letter.doctorName && <div className="text-sm text-slate-500">Prescription</div>}
            </div>
          </div>
          <div className="text-right text-sm text-slate-500">
            {formatDateLong(appt.startAt)}
            <div>{formatTime(appt.startAt)}</div>
          </div>
        </div>
        {letter.printClinic && (clinic.address || clinic.phone) && (
          <p className="mt-2 text-xs text-slate-500">
            {clinic.address}
            {clinic.address && clinic.phone ? " · " : ""}
            {clinic.phone ? displayPhone(clinic.phone) : ""}
          </p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-ivory p-4 text-sm">
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Patient</div>
            <div className="font-semibold">{appt.patient.name}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Phone</div>
            <div>{displayPhone(appt.patient.phone)}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Ref</div>
            <div>{appt.ref}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Visit</div>
            <div>{appt.service}</div>
          </div>
        </div>
        <Section title="Complaints">{rx.complaints}</Section>
        <Section title="Findings">{rx.findings}</Section>
        <Section title="Diagnosis">{rx.diagnosis}</Section>
        <div className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-teal">Medicines</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {medicines.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ol>
        </div>
        <Section title="Advice">{rx.advice}</Section>
        {rx.followupNote && <Section title="Follow-up">{rx.followupNote}</Section>}
        {letter.footer && <p className="mt-6 text-xs text-slate-500">{letter.footer}</p>}
        <div className="mt-16 flex justify-end">
          <div className="w-48 border-t border-slate-300 pt-2 text-center text-xs text-slate-500">
            Doctor&apos;s signature
          </div>
        </div>
        <p className="mt-10 text-center text-[11px] text-slate-400">
          Generated locally by {clinic.name}. Not uploaded to Google Drive.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-teal">{title}</div>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{children}</p>
    </div>
  );
}
