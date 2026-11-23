import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Statement from "@/components/Statement";
import HowItWorks from "@/components/HowItWorks";
import Details from "@/components/Details";
import Developers from "@/components/Developers";
import Download from "@/components/Download";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Statement />
        <HowItWorks />
        <Details />
        <Developers />
        <Download />
      </main>
    </>
  );
}
