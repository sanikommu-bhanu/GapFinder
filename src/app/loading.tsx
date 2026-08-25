/**
 * Shown while a route's server work resolves. A calm skeleton rather than a
 * spinner: the student sees the shape of what's coming, not a blank hold.
 */
export default function Loading() {
  return (
    <div className="px-5 pt-8" role="status" aria-label="Loading">
      <div className="mx-auto h-6 w-36 animate-pulse rounded-pill bg-navy-50" />
      <div className="mt-6 flex flex-col gap-3">
        <div className="h-24 animate-pulse rounded-card bg-surface-card" />
        <div className="h-16 animate-pulse rounded-card bg-surface-card" />
        <div className="h-16 animate-pulse rounded-card bg-surface-card" />
      </div>
    </div>
  );
}
