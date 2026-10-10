export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Rismon</h1>
      <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        A hosted AI learning tutor that helps learners master any subject with
        personalized lessons, practice and spaced revision.
      </p>
      <a
        href="/login"
        className="mt-2 rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Sign in
      </a>
    </main>
  );
}
