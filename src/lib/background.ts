import { waitUntil } from "@vercel/functions";

/**
 * Runs work that must outlive the HTTP response.
 *
 * The analysis pipeline is deliberately fire-and-forget: the request returns in
 * ~250ms and the client polls for progress. On a long-running server a bare
 * promise is enough — the process stays alive and finishes the job.
 *
 * On a serverless host it is not. The moment the response is sent the function
 * is frozen or destroyed, and any in-flight promise dies with it: the analysis
 * would sit at "pending" forever while the client polled a row nobody was
 * updating. `waitUntil` tells the platform to keep the invocation alive until
 * the work settles.
 *
 * Outside Vercel `waitUntil` throws, so the promise is simply left running,
 * which is the correct behaviour on a persistent server.
 */
export function runInBackground(work: Promise<unknown>, label: string): void {
  const guarded = work.catch((err) => {
    console.error(`[background] ${label} failed`, err);
  });

  try {
    waitUntil(guarded);
  } catch {
    // Not on a platform that supports it — the promise keeps running here.
    void guarded;
  }
}
