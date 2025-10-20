import Link from 'next/link';

export function CTASection() {
  return (
    <section className="mx-auto w-full max-w-6xl rounded-3xl bg-slate-900 px-10 py-16 text-center text-white shadow-xl">
      <h2 className="text-3xl font-semibold sm:text-4xl">
        Ready to organize your daycare with ease?
      </h2>
      <p className="mt-4 text-base text-white/80">
        Join the waitlist to be the first to experience smarter, smoother
        scheduling.
      </p>
      <div className="mt-8 flex justify-center">
        <Link
          href="#"
          className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-white/90"
        >
          Join the Waitlist
        </Link>
      </div>
    </section>
  );
}
