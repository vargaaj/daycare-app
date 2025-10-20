import Link from 'next/link';

export function Hero() {
  return (
    <section
      id="home"
      className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-12 px-6 pt-32 pb-24 lg:flex-row lg:items-center"
    >
      <div className="flex-1">
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-4 py-1 text-xs font-medium text-indigo-600">
          Built for busy daycare owners
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          Simplify Your Daycare Scheduling
        </h1>
        <p className="mt-6 text-lg text-slate-600 sm:max-w-xl">
          Upload your current class structure, and let Daycare Optimizer handle
          the scheduling for the entire year. Spend less time juggling calendars
          and more time focusing on your staff, families, and students.
        </p>
        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Link
            href="#features"
            className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
          >
            Get Started
          </Link>
          <Link
            href="#"
            className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-700"
          >
            Login / Register
          </Link>
        </div>
      </div>
      <div className="relative flex-1">
        <div className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-400 via-indigo-300 to-indigo-200 px-8 py-14 shadow-xl">
          <div className="absolute -top-6 -left-6 h-24 w-24 rounded-full bg-white/35 blur-2xl" />
          <div className="absolute -bottom-10 -right-8 h-32 w-32 rounded-full bg-white/40 blur-3xl" />
          <div className="relative space-y-6 text-white">
            <div className="flex items-center gap-4">
              <span className="h-12 w-12 rounded-full bg-white/25" />
              <div>
                <p className="text-sm uppercase tracking-widest text-white/70">
                  Preview
                </p>
                <p className="text-lg font-semibold">Class Utilization</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl bg-white/20 p-4">
                <p className="text-xs uppercase tracking-wide text-white/70">
                  Age Group
                </p>
                <p className="mt-2 text-lg font-semibold">2-3 Years</p>
                <p className="mt-4 text-xs text-white/70">90% capacity</p>
              </div>
              <div className="rounded-2xl bg-white/20 p-4">
                <p className="text-xs uppercase tracking-wide text-white/70">
                  Age Group
                </p>
                <p className="mt-2 text-lg font-semibold">4-5 Years</p>
                <p className="mt-4 text-xs text-white/70">Optimum staffing</p>
              </div>
              <div className="col-span-2 rounded-2xl bg-white/15 p-4">
                <p className="text-xs uppercase tracking-wide text-white/70">
                  Monthly Snapshot
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  See staffing allocations, ratios, and classroom adjustments at
                  a glance for every month of the year.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
