import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const patientId = new URL(request.url).searchParams.get("patientId");
    if (!patientId) {
      return NextResponse.json(
        { ok: false, error: "patientId is required" },
        { status: 400 },
      );
    }

    const appointments = await prisma.appointment.findMany({
      where: { patientId },
      orderBy: { date: "asc" },
      include: { mole: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ ok: true, appointments });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { patientId, doctorName, moleId, date, notes } = await request.json();

    if (typeof patientId !== "string" || !patientId.trim()) {
      return NextResponse.json(
        { ok: false, error: "patientId is required" },
        { status: 400 },
      );
    }
    if (typeof doctorName !== "string" || !doctorName.trim()) {
      return NextResponse.json(
        { ok: false, error: "doctorName is required" },
        { status: 400 },
      );
    }
    if (typeof date !== "string" || !date) {
      return NextResponse.json(
        { ok: false, error: "date is required" },
        { status: 400 },
      );
    }

    const when = new Date(date);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json(
        { ok: false, error: "date is invalid" },
        { status: 400 },
      );
    }
    if (when.getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: "Appointment must be in the future" },
        { status: 400 },
      );
    }

    // If a mole is attached, make sure it belongs to this patient
    if (moleId) {
      const mole = await prisma.mole.findFirst({
        where: { id: moleId, patientId },
      });
      if (!mole) {
        return NextResponse.json(
          { ok: false, error: "Mole not found for this patient" },
          { status: 400 },
        );
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorName: doctorName.trim(),
        moleId: moleId || null,
        date: when,
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      },
    });

    return NextResponse.json({ ok: true, appointment });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    );
  }
}
