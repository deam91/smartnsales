export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 h-8 w-32 animate-pulse rounded-lg bg-zinc-200" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-2xl bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}
