-- GapFinder: Spotify account link (Focus Mode)
--
-- Adds the SpotifyAccount table introduced with Focus Mode's optional music
-- card. A database created before then is missing it, and connecting Spotify
-- will fail at the final write with ?spotify=exchange_failed — the OAuth
-- handshake itself succeeds, so the symptom points away from the real cause.
--
-- Applied over HTTPS by:  npm run db:apply prisma/manual/004-spotify-account.sql
-- (prisma db push needs port 5432, which is blocked or IPv6-broken on many
-- networks; Neon's serverless driver uses 443 and gets through.)
--
-- Safe to re-run: every statement is IF NOT EXISTS or guarded.
--
-- Note on the columns: tokens are stored server-side and are never returned by
-- any API route. The row is DELETED on disconnect or on a rejected refresh
-- rather than blanked, so "not connected" is simply the absence of a row.

CREATE TABLE IF NOT EXISTS "SpotifyAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "product" TEXT NOT NULL DEFAULT 'unknown',
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpotifyAccount_pkey" PRIMARY KEY ("id")
);

-- One Spotify account per user; the upsert in linkAccount() targets this.
CREATE UNIQUE INDEX IF NOT EXISTS "SpotifyAccount_userId_key" ON "SpotifyAccount"("userId");

-- Cascade: deleting a user must not leave orphaned tokens behind.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'SpotifyAccount_userId_fkey'
    ) THEN
        ALTER TABLE "SpotifyAccount"
            ADD CONSTRAINT "SpotifyAccount_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- focusMusic was a leftover from a removed feature that saved a preference and
-- played nothing. Spotify supersedes it. Dropped only if it is still present.
ALTER TABLE "UserSettings" DROP COLUMN IF EXISTS "focusMusic";
