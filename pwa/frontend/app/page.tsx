import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { LandingContent } from "@/components/landing-content";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <LandingContent />
      </main>
      <Footer />
    </>
  );
}
