export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-8 h-8 w-40 animate-pulse rounded-lg bg-zinc-200" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-zinc-100" />
        ))}
      </div>
    </main>
  );
}
