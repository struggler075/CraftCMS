import PageTransition from '../components/layout/PageTransition'
import HeroSection from '../components/home/HeroSection'
import NewsSection from '../components/home/NewsSection'
import ServersSection from '../components/home/ServersSection'

export default function HomePage() {
  return (
    <PageTransition>
      <main>
        <HeroSection />

        <div className="max-w-7xl mx-auto px-4 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
            {/* News — left, primary content */}
            <NewsSection />

            {/* Servers — right sticky sidebar */}
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <ServersSection />
            </aside>
          </div>
        </div>
      </main>
    </PageTransition>
  )
}
