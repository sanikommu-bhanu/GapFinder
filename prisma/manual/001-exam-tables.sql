-- GapFinder: Exam Mode tables
--
-- These two tables were added after the last successful `prisma db push`, so a
-- database created before then is missing them and Exam Mode will fail. Run
-- this once against your Neon database — the SQL editor in the Neon console
-- works over HTTPS, so it goes through even where port 5432 is blocked.
--
-- Safe to re-run: every statement is IF NOT EXISTS or guarded.

CREATE TABLE IF NOT EXISTS "ExamSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "timeLimitSeconds" INTEGER,
    "verdicts" TEXT,

    CONSTRAINT "ExamSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExamQuestion" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'deterministic',
    "studentAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "reasoningValid" BOOLEAN,
    "firstErrorLine" INTEGER,
    "misconceptionCode" TEXT,
    "timeSpentSeconds" INTEGER,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- One question per position within an exam.
CREATE UNIQUE INDEX IF NOT EXISTS "ExamQuestion_examId_order_key"
  ON "ExamQuestion"("examId", "order");

-- Foreign keys, added only if they aren't already present.
DO $$ BEGIN
  ALTER TABLE "ExamSession"
    ADD CONSTRAINT "ExamSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ExamQuestion"
    ADD CONSTRAINT "ExamQuestion_examId_fkey"
    FOREIGN KEY ("examId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ExamQuestion"
    ADD CONSTRAINT "ExamQuestion_conceptId_fkey"
    FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
