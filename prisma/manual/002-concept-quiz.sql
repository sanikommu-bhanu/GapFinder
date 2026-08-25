-- Concept-check questions.
--
-- Exam Mode originally only asked for working to verify. A quiz that follows a
-- concept explanation has nothing to verify line by line, so it asks the
-- student to choose between the documented misconceptions instead. Two nullable
-- columns carry that; existing rows keep behaving exactly as before.
--
-- Safe to re-run.

ALTER TABLE "ExamQuestion" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'working';
ALTER TABLE "ExamQuestion" ADD COLUMN IF NOT EXISTS "options" TEXT;
