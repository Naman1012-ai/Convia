import React, { useEffect } from 'react';
import { analyticsService } from '../analytics/analyticsService';
import { LandingLayout } from '../layouts/LandingLayout';
import { HeroSection } from '../sections/HeroSection';
import { InteractiveProductPreview } from '../sections/InteractiveProductPreview';
import { CoreFeaturesGrid } from '../sections/CoreFeaturesGrid';
import { AiBlueprintShowcase } from '../sections/AiBlueprintShowcase';
import { ExpandedUseCasesSection } from '../sections/ExpandedUseCasesSection';
import { RealtimePlatformStats } from '../sections/RealtimePlatformStats';
import { ComprehensiveFaqSection } from '../sections/ComprehensiveFaqSection';
import { FinalLandingCtaSection } from '../sections/FinalLandingCtaSection';

export default function LandingPage() {
  useEffect(() => {
    // Dynamic SEO Document Title & Meta Tags
    document.title = 'Convia — Where Ideas Converge into Action.';

    // Meta Description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = 'Convia turns team ideas and discussions into structured decisions, AI technical blueprints, and actionable tasks.';
    }

    // Open Graph Title & Description
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.content = 'Convia — Where Ideas Converge into Action.';
    }

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.content = 'Convia turns team ideas and discussions into structured decisions, AI technical blueprints, and actionable tasks.';
    }

    const twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (twitterDesc) {
      twitterDesc.content = 'Convia turns team ideas and discussions into structured decisions, AI technical blueprints, and actionable tasks.';
    }

    // Track Pageview via Analytics Service Layer
    analyticsService.trackPageView('/');
  }, []);

  return (
    <LandingLayout>
      <HeroSection />
      <InteractiveProductPreview />
      <CoreFeaturesGrid />
      <AiBlueprintShowcase />
      <ExpandedUseCasesSection />
      <RealtimePlatformStats />
      <ComprehensiveFaqSection />
      <FinalLandingCtaSection />
    </LandingLayout>
  );
}
