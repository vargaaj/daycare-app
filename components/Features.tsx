import { CalendarCheck, LayoutDashboard, UploadCloud } from 'lucide-react';

const features = [
  {
    icon: UploadCloud,
    title: 'Upload & Analyze',
    description:
      'Easily upload your current daycare class structure using Excel or CSV. The system validates your data automatically.',
  },
  {
    icon: CalendarCheck,
    title: 'Yearly Optimization',
    description:
      'Our smart engine optimizes classrooms and schedules for the entire school year based on age and attendance.',
  },
  {
    icon: LayoutDashboard,
    title: 'Interactive Dashboard',
    description:
      'Visualize classrooms month-by-month, make edits, and stay organized with an intuitive dashboard view.',
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24"
    >
      <div className="text-center">
        <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          Everything you need to stay organized
        </h2>
        <p className="mt-4 text-base text-slate-600 sm:text-lg">
          Streamline scheduling, staffing, and classroom planning with tools
          built specifically for daycares.
        </p>
      </div>
      <div className="mt-12 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="group relative rounded-3xl border border-slate-200 bg-white/60 p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="mt-6 text-xl font-semibold text-slate-900">
              {title}
            </h3>
            <p className="mt-4 text-sm text-slate-600 sm:text-base">
              {description}
            </p>
            <div className="pointer-events-none absolute -top-3 -right-3 h-16 w-16 rounded-full bg-indigo-100 opacity-0 blur-2xl transition duration-300 group-hover:opacity-100" />
          </div>
        ))}
      </div>
    </section>
  );
}
