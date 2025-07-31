import Head from 'next/head'
import Link from 'next/link'
import { useAuth } from '../lib/auth'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { 
  CheckCircleIcon, 
  ShieldCheckIcon, 
  ClockIcon, 
  UserGroupIcon,
  DocumentTextIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

export default function HomePage() {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>DevOnboard - Streamline Developer Onboarding</title>
        <meta name="description" content="Automate and track developer onboarding with interactive playbooks, live documentation, and secure secrets management." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {/* Header */}
        <header className="relative bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <h1 className="text-2xl font-bold text-gray-900">DevOnboard</h1>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Link
                  href="/login"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Sign In
                </Link>
                <Link
                  href="/login"
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative py-20 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                Streamline Developer
                <span className="text-primary-600 block">Onboarding</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                Automated playbooks, live documentation, and secure secrets management 
                to get your developers productive from day one.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/login"
                  className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors shadow-lg"
                >
                  Start Free Trial
                </Link>
                <Link
                  href="#features"
                  className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3 rounded-lg text-lg font-medium transition-colors"
                >
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Everything you need for smooth onboarding
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Reduce onboarding time from weeks to days with our comprehensive platform.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={<DocumentTextIcon className="h-8 w-8 text-primary-600" />}
                title="Interactive Playbooks"
                description="Step-by-step guided onboarding with progress tracking and verification."
              />
              <FeatureCard
                icon={<ClockIcon className="h-8 w-8 text-primary-600" />}
                title="Live Documentation"
                description="Always up-to-date docs synced from your GitHub repositories."
              />
              <FeatureCard
                icon={<ShieldCheckIcon className="h-8 w-8 text-primary-600" />}
                title="Secure Secrets"
                description="Safe distribution of API keys and credentials to new team members."
              />
              <FeatureCard
                icon={<UserGroupIcon className="h-8 w-8 text-primary-600" />}
                title="Team Management"
                description="Invite and manage team members with role-based access control."
              />
              <FeatureCard
                icon={<ChartBarIcon className="h-8 w-8 text-primary-600" />}
                title="Analytics Dashboard"
                description="Track onboarding progress and identify common bottlenecks."
              />
              <FeatureCard
                icon={<CheckCircleIcon className="h-8 w-8 text-primary-600" />}
                title="GitHub Integration"
                description="Seamless integration with your existing development workflow."
              />
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Why teams choose DevOnboard
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <BenefitCard
                stat="75%"
                title="Faster Onboarding"
                description="Reduce time to first contribution from weeks to days"
              />
              <BenefitCard
                stat="90%"
                title="Completion Rate"
                description="Higher onboarding completion rates with guided workflows"
              />
              <BenefitCard
                stat="50%"
                title="Less Support"
                description="Fewer questions to senior developers and team leads"
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-primary-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to transform your onboarding?
            </h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              Start your free trial today and see how DevOnboard can help your team 
              onboard developers faster and more effectively.
            </p>
            <Link
              href="/login"
              className="bg-white text-primary-600 hover:bg-gray-100 px-8 py-3 rounded-lg text-lg font-medium transition-colors shadow-lg"
            >
              Get Started Free
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-4">DevOnboard</h3>
              <p className="text-gray-400 mb-4">
                Streamlining developer onboarding for teams worldwide.
              </p>
              <p className="text-gray-500 text-sm">
                © 2024 DevOnboard. Built with ❤️ for developers.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="text-center p-6">
      <div className="flex justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

function BenefitCard({ stat, title, description }: {
  stat: string
  title: string
  description: string
}) {
  return (
    <div className="text-center p-6">
      <div className="text-4xl font-bold text-primary-600 mb-2">{stat}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}