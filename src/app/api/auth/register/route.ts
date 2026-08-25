import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    // A specific message the form can show, rather than a zod dump.
    const issue = parsed.error.issues[0];
    const message =
      issue?.path[0] === "email"
        ? "That doesn't look like a valid email address."
        : issue?.path[0] === "password"
          ? "Your password needs to be at least 8 characters."
          : "Please fill in every field.";
    return NextResponse.json({ error: message }, { status: 400 });
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
  return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
}
