import { CTASection } from '@/components/CTASection';
import { Features } from '@/components/Features';
import { Footer } from '@/components/Footer';
import { Hero } from '@/components/Hero';

export default function Home() {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      <main className="flex flex-col items-center pt-16 sm:pt-20">
        <Hero />
        <Features />
        <div className="w-full px-6">
          <CTASection />
        </div>
      </main>
      <Footer />
    </div>
  );
}
