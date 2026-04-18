import Link from 'next/link';

/** Keep this file self-contained (no heavy imports) so dev error recovery never pulls missing chunks. */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-velo-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-velo-text">Page not found</h1>
      <p className="mt-2 text-sm text-velo-muted">
        This URL does not match any route in the Command Center.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-md bg-velo-accent px-4 py-2 text-sm font-medium text-white hover:bg-velo-accent-hover"
      >
        Back to overview
      </Link>
    </main>
  );
}
