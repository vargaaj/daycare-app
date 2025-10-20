import Link from 'next/link';

const footerLinks = [
  { label: 'Privacy', href: '#' },
  { label: 'Terms', href: '#' },
  { label: 'Contact', href: '#' },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-white/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-slate-900">Daycare Optimizer</p>
          <p className="mt-2 text-xs sm:text-sm">
            © {new Date().getFullYear()} Daycare Optimizer. All rights reserved.
          </p>
        </div>
        <div className="flex items-center gap-6">
          {footerLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="transition-colors hover:text-indigo-600"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
