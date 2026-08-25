import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

  await createSession(user.id);
  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
