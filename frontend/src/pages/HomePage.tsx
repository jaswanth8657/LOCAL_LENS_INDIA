import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CURATED_DESTINATIONS } from '../data/curatedDestinations';
import { DestinationCard } from '../components/discovery/DestinationCard';
import { PreferenceSelector } from '../components/discovery/PreferenceSelector';
import { GlassCard } from '../components/ui/GlassCard';
import { useTrip } from '../context/TripContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  MessageSquare,
  ShieldCheck,
  Search,
  ArrowRight,
  Cpu,
  Compass,
  SlidersHorizontal,
  BookmarkCheck
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { setSelectedDestination, setPreferences } = useTrip();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'South' | 'North' | 'West' | 'North-East'>('all');

  const filteredDestinations = CURATED_DESTINATIONS.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || d.region === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleQuickDestinationSelect = (destName: string) => {
    const dest = CURATED_DESTINATIONS.find((d) => d.name.toLowerCase().includes(destName.toLowerCase()));
    if (dest) {
      setSelectedDestination(dest);
      setPreferences((prev) => ({ ...prev, destination: dest.id, destinationName: dest.name }));
      navigate('/discover');
    }
  };

  const fadeInUp = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: 'easeOut' },
      };

  return (
    <div className="space-y-20 pb-20">
      {/* 1. Hero Section */}
      <section className="relative pt-12 md:pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Ambient Aurora Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-aurora-glow opacity-60 blur-3xl pointer-events-none" />

        <motion.div {...fadeInUp} className="relative z-10 max-w-4xl mx-auto space-y-6">
          {/* Brand Tagline Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-brand-saffron/30 text-xs font-bold text-brand-spice shadow-glow-saffron">
            <Sparkles className="w-3.5 h-3.5 text-brand-saffron" />
            <span>LOCAL LENS INDIA • EXPERIENCE LIKE A LOCAL</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
            Discover India Through <br />
            <span className="text-gradient-saffron">Authentic Local Eyes</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            AI-powered personalized travel discovery built on verified real-world facts. Tailored to your budget, interests, and group.
          </p>

          {/* Search Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) {
                navigate(`/discover?q=${encodeURIComponent(searchQuery.trim())}`);
              } else {
                navigate('/discover');
              }
            }}
            className="pt-4 max-w-2xl mx-auto"
          >
            <GlassCard className="p-2 sm:p-2.5 flex items-center gap-2 border-slate-200 dark:border-white/15 shadow-2xl">
              <div className="pl-3 text-slate-400">
                <Search className="w-5 h-5 text-brand-saffron" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Indian cities, states, or coastal heritage..."
                className="w-full bg-transparent border-none text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none px-2"
              />
              <button
                type="button"
                onClick={() => navigate(searchQuery ? `/chat?q=${encodeURIComponent(searchQuery)}` : '/chat')}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-brand-saffron/20 border border-slate-200 dark:border-white/10 text-brand-spice transition-all shrink-0"
                title="Ask AI Assistant"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                type="submit"
                className="hidden sm:flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-saffron to-brand-spice shadow-glow-saffron hover:opacity-95 transition-all shrink-0"
              >
                <span>Explore</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </GlassCard>

            {/* Quick destination tags */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-3 text-xs text-slate-600 dark:text-slate-400">
              <span className="text-[11px] font-semibold text-slate-500">Popular Hubs:</span>
              {['Visakhapatnam', 'Jaipur', 'Kochi', 'Varanasi', 'Ladakh', 'Hampi'].map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleQuickDestinationSelect(name)}
                  className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          </form>
        </motion.div>
      </section>

      {/* 2. First-Time Visitor Journey: How Local Lens Works (Task 2 UX Polish) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-saffron/15 text-brand-spice border border-brand-saffron/30 text-xs font-bold">
            <Compass className="w-3.5 h-3.5" />
            <span>HOW IT WORKS • 4 SIMPLE STEPS</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Your Seamless Travel Planning Experience
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            From discovering any Indian city to customized AI daily itineraries and transparent budget breakdowns.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Step 1 */}
          <GlassCard className="p-5 flex flex-col justify-between border-slate-200 dark:border-white/10 hover:border-brand-saffron/40 transition-all space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-brand-saffron/15 text-brand-spice font-mono font-bold text-xs flex items-center justify-center border border-brand-saffron/30">
                  01
                </span>
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Search Destination
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Choose from 7+ curated regional hubs or explore unseeded cities like Hyderabad with live OpenStreetMap attractions.
              </p>
            </div>
            <Link
              to="/discover"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-spice hover:text-brand-saffron transition-colors pt-2 border-t border-slate-200 dark:border-white/5"
            >
              <span>Explore Destinations</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </GlassCard>

          {/* Step 2 */}
          <GlassCard className="p-5 flex flex-col justify-between border-slate-200 dark:border-white/10 hover:border-brand-saffron/40 transition-all space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-brand-teal/15 text-brand-teal font-mono font-bold text-xs flex items-center justify-center border border-brand-teal/30">
                  02
                </span>
                <SlidersHorizontal className="w-4 h-4 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Set Preferences
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Specify your daily budget (₹500 to ₹15,000), group size, trip duration, and passions like heritage, street food, or beaches.
              </p>
            </div>
            <a
              href="#preferences-section"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-teal hover:opacity-80 transition-colors pt-2 border-t border-slate-200 dark:border-white/5"
            >
              <span>Customize Profile</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </GlassCard>

          {/* Step 3 */}
          <GlassCard className="p-5 flex flex-col justify-between border-slate-200 dark:border-white/10 hover:border-brand-saffron/40 transition-all space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 font-mono font-bold text-xs flex items-center justify-center border border-purple-500/30">
                  03
                </span>
                <Sparkles className="w-4 h-4 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                View Recommendations
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Discover Scikit-Learn ranked spots with real entry fees, timings, photos, and match explanations grounded in real facts.
              </p>
            </div>
            <Link
              to="/recommendations"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:opacity-80 transition-colors pt-2 border-t border-slate-200 dark:border-white/5"
            >
              <span>See Recommendations</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </GlassCard>

          {/* Step 4 */}
          <GlassCard className="p-5 flex flex-col justify-between border-slate-200 dark:border-white/10 hover:border-brand-saffron/40 transition-all space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono font-bold text-xs flex items-center justify-center border border-amber-500/30">
                  04
                </span>
                <BookmarkCheck className="w-4 h-4 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Generate & Save Itinerary
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Generate a multi-day plan via Gemini with Ollama fallback, inspect the cost breakdown, save, and reopen anytime in Saved Trips.
              </p>
            </div>
            <Link
              to="/planner"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:opacity-80 transition-colors pt-2 border-t border-slate-200 dark:border-white/5"
            >
              <span>Open AI Planner</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </GlassCard>
        </div>
      </section>

      {/* 3. Three Pillars of LOCAL LENS INDIA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassCard className="p-6 border-slate-200 dark:border-white/10 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-saffron/15 border border-brand-saffron/30 flex items-center justify-center text-brand-spice">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">100% Verified Real-World Data</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Never invent places, coordinates, or prices. All attractions, historical sites, and coordinates originate from verified OpenStreetMap and official tourism records.
            </p>
          </GlassCard>

          <GlassCard className="p-6 border-slate-200 dark:border-white/10 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-teal/15 border border-brand-teal/30 flex items-center justify-center text-brand-teal">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Scikit-Learn Matching Engine</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Deterministic TF-IDF vectorization, Cosine similarity, and PostGIS distance clustering that ranks experiences independently of LLM availability.
            </p>
          </GlassCard>

          <GlassCard className="p-6 border-slate-200 dark:border-white/10 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Gemini + Ollama Fallback</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Primary cloud intelligence powered by Google Gemini, paired with automatic local Ollama model fallback when offline or rate-limited.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* 4. Interactive Destination Discovery Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-brand-spice uppercase tracking-wider">
              Curated Destinations
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              Explore India's Authentic Terrains
            </h2>
          </div>

          {/* Region Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 overflow-x-auto text-xs">
            {(['all', 'South', 'North', 'West', 'North-East'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl font-semibold capitalize transition-all ${
                  activeTab === tab
                    ? 'bg-brand-saffron text-white shadow-glow-saffron'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab === 'all' ? 'All India' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Destination Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredDestinations.slice(0, 8).map((dest) => (
            <DestinationCard key={dest.id} destination={dest} />
          ))}
        </div>

        <div className="text-center pt-4">
          <Link
            to="/discover"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-all"
          >
            <span>View All Destinations & Map Explorer</span>
            <ArrowRight className="w-4 h-4 text-brand-spice" />
          </Link>
        </div>
      </section>

      {/* 5. Travel Preference Builder Section */}
      <section id="preferences-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <PreferenceSelector />
      </section>

      {/* 6. AI Travel Chatbot Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <GlassCard className="relative overflow-hidden p-8 sm:p-12 border-brand-saffron/20 dark:border-white/10 shadow-2xl">
          {/* Subtle Ambient Background Gradients */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-saffron/10 dark:bg-brand-saffron/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-brand-teal/10 dark:bg-brand-teal/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
            {/* Tag Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-saffron/10 dark:bg-white/[0.04] border border-brand-saffron/30 text-xs font-bold text-brand-spice shadow-glow-saffron">
              <MessageSquare className="w-4 h-4 text-brand-spice animate-pulse" />
              <span>AI CONVERSATIONAL TRAVEL COMPANION</span>
            </div>

            {/* Section Heading & Subtitle */}
            <div className="space-y-3">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Plan Your Next Journey with{' '}
                <span className="text-gradient-saffron">Local Lens AI</span>
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
                Ask anything about Indian travel: get day-by-day itineraries, discover verified regional street food, check real ticket prices and opening hours, or speak naturally using voice input.
              </p>
            </div>

            {/* Sample Question Chips */}
            <div className="pt-2 pb-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Click any question to ask instantly:
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {[
                  {
                    question: 'Plan a 3-day trip to Jaipur under ₹15,000',
                    tag: 'Heritage & Budget',
                  },
                  {
                    question: 'What are the best street food spots in Old Delhi?',
                    tag: 'Food & Culinary',
                  },
                  {
                    question: 'Suggest a peaceful beach destination in South India',
                    tag: 'Coastal Bliss',
                  },
                  {
                    question: 'What is the best time to visit Ladakh?',
                    tag: 'High Altitude',
                  },
                  {
                    question: 'What are the top hidden viewpoints in Visakhapatnam?',
                    tag: 'Local Gems',
                  },
                ].map(({ question, tag }) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => navigate(`/chat?q=${encodeURIComponent(question)}`)}
                    className="group relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-white/5 hover:bg-brand-saffron/15 dark:hover:bg-brand-saffron/20 border border-slate-200 dark:border-white/10 hover:border-brand-saffron/40 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <span className="text-brand-spice font-mono text-[10px] px-1.5 py-0.5 rounded bg-brand-saffron/10 dark:bg-brand-saffron/20 border border-brand-saffron/20">
                      {tag}
                    </span>
                    <span className="text-left group-hover:text-brand-spice transition-colors">
                      "{question}"
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-spice group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link
                to="/chat"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-brand-saffron via-brand-spice to-brand-amber shadow-glow-saffron hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat with Local Lens AI</span>
              </Link>
              <Link
                to="/discover"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-all"
              >
                <span>Explore Destinations</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </GlassCard>
      </section>
    </div>
  );
};
