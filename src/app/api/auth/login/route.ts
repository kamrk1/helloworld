import { NextResponse } from "next/server";
import { checkAdminPassword, createSessionToken, sessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { password?: string };
    const password = body.password ?? "";
    if (!checkAdminPassword(password)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    const cookie = sessionCookie(createSessionToken());
    res.cookies.set(cookie);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
