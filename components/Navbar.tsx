import Link from 'next/link';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/nextjs';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '/#features' },
];

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6 text-sm sm:h-16 sm:text-base">
        <div className="flex items-center gap-10">
          <Link
            href="/"
            className="font-semibold text-slate-900 transition-colors hover:text-indigo-600"
          >
            Daycare Optimizer
          </Link>
          <div className="hidden items-center gap-6 text-xs font-medium text-slate-600 sm:flex sm:text-sm">
            {navLinks.map((link) => (
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
        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-full border border-indigo-600 px-4 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-600 hover:text-white sm:text-sm">
                Log in
              </button>
            </SignInButton>
            <SignUpButton mode="modal" forceRedirectUrl="/configure">
              <button className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:text-sm">
                Register
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="hidden rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-100 hover:text-indigo-600 sm:block sm:text-sm"
              >
                Dashboard
              </Link>
              <Link
                href="/configure"
                className="hidden rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-100 hover:text-indigo-600 sm:block sm:text-sm"
              >
                Configure
              </Link>
            </div>
            <UserButton />
          </SignedIn>
        </div>
      </nav>
    </header>
  );
}
