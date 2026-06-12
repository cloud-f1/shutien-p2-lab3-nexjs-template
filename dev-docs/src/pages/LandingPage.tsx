import { ThemeProvider } from "../context/ThemeContext";
import { LandingNav } from "./landing/LandingNav";
import { HeroSection } from "./landing/HeroSection";
import { ProblemSection } from "./landing/ProblemSection";
import { PipelineSection } from "./landing/PipelineSection";
import { LearningSection } from "./landing/LearningSection";
import { FeaturesSection } from "./landing/FeaturesSection";
import { StructureSection } from "./landing/StructureSection";
import { CtaSection } from "./landing/CtaSection";
import { Footer } from "./landing/Footer";

export default function LandingPage() {
  return (
    <ThemeProvider>
      <LandingNav />
      <main className="pt-14">
        <HeroSection />
        <ProblemSection />
        <PipelineSection />
        <LearningSection />
        <FeaturesSection />
        <StructureSection />
        <CtaSection />
      </main>
      <Footer />
    </ThemeProvider>
  );
}
