import { CursorField } from './components/CursorField'
import { ScrollProgress } from './components/ScrollProgress'
import { useSmoothScroll } from './hooks/useSmoothScroll'
import { Automation } from './sections/Automation'
import { FinalCta } from './sections/FinalCta'
import { Footer } from './sections/Footer'
import { Hero } from './sections/Hero'
import { HowItThinks } from './sections/HowItThinks'
import { Navigation } from './sections/Navigation'
import { Problem } from './sections/Problem'
import {
  DeliveryFundsMoments,
  IntelligenceProductMoments,
  OutcomeProductMoment,
  ProductOverviewMoment,
  ProposalAgreementMoments,
  RoleOnboardingMoment,
} from './sections/ProductMoments'
import { SystemIntelligence } from './sections/SystemIntelligence'
import { Trust } from './sections/Trust'
import { Workflow } from './sections/Workflow'

export function App() {
  useSmoothScroll()

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <ScrollProgress />
      <CursorField />
      <Navigation />
      <main id="main-content">
        <Hero />
        <ProductOverviewMoment />
        <Problem />
        <IntelligenceProductMoments />
        <SystemIntelligence />
        <HowItThinks />
        <ProposalAgreementMoments />
        <Workflow />
        <DeliveryFundsMoments />
        <Automation />
        <Trust />
        <OutcomeProductMoment />
        <RoleOnboardingMoment />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
