import { motion } from 'framer-motion'
import { Upload, Cpu, Download } from 'lucide-react'

const steps = [
  {
    step: 1,
    icon: Upload,
    title: 'Paste or Upload Brief',
    description: 'Simply paste your client brief text or upload a PDF/DOCX file. Our system accepts any format.',
  },
  {
    step: 2,
    icon: Cpu,
    title: 'AI Processes & Structures',
    description: 'Our AI analyzes the brief, extracts key information, identifies risks, and generates structured insights.',
  },
  {
    step: 3,
    icon: Download,
    title: 'Get Decision-Ready Proposal',
    description: 'Download a comprehensive proposal with features, timeline, effort estimates, and risk assessment.',
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-card/30">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-gradient">How It Works</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Three simple steps to transform your client briefs into professional proposals.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Connection line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent -translate-y-1/2" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                className="relative text-center"
              >
                {/* Step number */}
                <div className="relative z-10 mx-auto mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
                    <div className="relative h-20 w-20 mx-auto rounded-full bg-card border-2 border-primary/30 flex items-center justify-center">
                      <item.icon className="h-8 w-8 text-primary" />
                    </div>
                    <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                      {item.step}
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
