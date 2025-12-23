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
        <div className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-200 via-indigo-100 to-slate-50 px-6 py-10 shadow-xl sm:px-8">
          <div className="absolute -top-8 -right-10 h-32 w-32 rounded-full bg-white/60 blur-3xl" />
          <div className="absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-indigo-200/50 blur-3xl" />
          <div className="relative rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-lg sm:p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Dashboard Highlights
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">
              Everything you need, month by month
            </h3>
            <p className="mt-3 text-sm text-slate-600">
              A single view that keeps staffing, capacity, and classroom changes
              crystal clear.
            </p>
            <div className="mt-6 space-y-3 text-sm text-slate-600">
              {[
                {
                  title: 'Per-day capacity grid',
                  detail: 'See exactly how many seats are open each weekday.',
                },
                {
                  title: 'Classroom-by-classroom rosters',
                  detail: 'Filter by month and room to spot gaps instantly.',
                },
                {
                  title: 'Inline schedule edits',
                  detail: 'Adjust days without losing context or data.',
                },
                {
                  title: 'Future month projections',
                  detail: 'Plan through the school year with confidence.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  <div>
                    <p className="font-semibold text-slate-900">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Auto optimization', value: 'Future months' },
                { label: 'Safeguards', value: 'Capacity + ages' },
                { label: 'Audit-ready', value: 'Monthly history' },
                { label: 'Save changes', value: 'One click' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
