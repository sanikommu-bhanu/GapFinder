import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";

const Body = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      settings: { create: {} },
      studyPreference: { create: {} },
      learningMemory: { create: {} },
      roadmap: { create: { nodes: "[]" } },
    },
  });

  await createSession(user.id);
  return NextResponse.json({ id: user.id, name: user.name, email: user.email });
}
