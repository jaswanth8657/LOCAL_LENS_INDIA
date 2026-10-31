import React from 'react';
import { Compass, ShieldCheck, Heart, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-24 border-t border-slate-200 dark:border-white/10 bg-slate-100/90 dark:bg-slate-950/90 backdrop-blur-xl relative overflow-hidden transition-colors">
      {/* Decorative ambient gradient */}
      <div className="absolute inset-0 bg-aurora-glow opacity-30 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Philosophy */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-saffron to-brand-amber p-0.5">
                <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[10px] flex items-center justify-center transition-colors">
                  <Compass className="w-5 h-5 text-brand-spice" />
                </div>
              </div>
              <span className="font-bold text-lg text-slate-900 dark:text-white">
                LOCAL LENS <span className="text-gradient-saffron">INDIA</span>
              </span>
            </div>
            
            <p className="text-sm font-medium text-brand-spice">
              Experience Like a Local.
            </p>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md">
              AI-powered personalized travel discovery built specifically for Indian destinations. Discover authentic culture, culinary secrets, and scenic trails powered by verified external data and localized intelligence.
            </p>

            <div className="flex items-center gap-2 pt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Strict Factual Data Policy: Zero fabricated places or coordinates.</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-300">
              Explore & Plan
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <Link to="/discover" className="hover:text-brand-spice transition-colors">
                  Destination Discovery
                </Link>
              </li>
              <li>
                <Link to="/recommendations" className="hover:text-brand-spice transition-colors">
                  Personalized Recommendations
                </Link>
              </li>
              <li>
                <Link to="/map" className="hover:text-brand-spice transition-colors">
                  Interactive Leaflet Map
                </Link>
              </li>
              <li>
                <Link to="/planner" className="hover:text-brand-spice transition-colors">
                  AI Trip Planner
                </Link>
              </li>
              <li>
                <Link to="/chat" className="hover:text-brand-spice transition-colors">
                  AI Conversational Chatbot
                </Link>
              </li>
              <li>
                <Link to="/saved" className="hover:text-brand-spice transition-colors">
                  My Saved Itineraries
                </Link>
              </li>
            </ul>
          </div>

          {/* External Attribution & Privacy */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-300">
              Data & Verification
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-1.5">
                <span>© OpenStreetMap contributors</span>
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-slate-900 dark:hover:text-white"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Free Leaflet + OpenStreetMap (Zero Paid APIs)</li>
              <li>Geocoding via Nominatim & Overpass API</li>
              <li>AI Layer: Google Gemini & Ollama Local Backup</li>
              <li>Speech Engine: 100% Local Inference (Private)</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} LOCAL LENS INDIA. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for genuine travelers across India.
          </p>
        </div>
      </div>
    </footer>
  );
};

