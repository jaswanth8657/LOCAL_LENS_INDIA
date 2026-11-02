import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Compass,
  Scale,
  Sparkles,
  MapPin,
  Bookmark,
  Menu,
  X,
  MessageSquare,
  Sun,
  Moon,
  User as UserIcon,
  LogIn,
  LogOut,
} from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { savedTrips } = useTrip();
  const { theme, toggleTheme } = useTheme();
  const { user, profile, isAuthenticated, logout } = useAuth();

  const navLinks = [
    { name: 'Discover', path: '/discover', icon: Compass },
    { name: 'Compare', path: '/compare', icon: Scale },
    { name: 'Recommendations', path: '/recommendations', icon: Sparkles },
    { name: 'AI Planner', path: '/planner', icon: MapPin },
    { name: 'AI Chatbot', path: '/chat', icon: MessageSquare },
    { name: 'Map Explorer', path: '/map', icon: MapPin },
    { name: 'Saved Trips', path: '/saved', icon: Bookmark, badge: savedTrips.length },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-2xl bg-white/80 dark:bg-slate-950/75 border-b border-slate-200/80 dark:border-white/10 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand identity & Tagline */}
        <Link to="/" className="flex items-center gap-3.5 group">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-saffron via-brand-spice to-brand-amber p-0.5 shadow-glow-saffron group-hover:scale-105 transition-transform duration-300">
            <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[14px] flex items-center justify-center transition-colors">
              <Compass className="w-6 h-6 text-brand-spice group-hover:rotate-45 transition-transform duration-500" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white">
                LOCAL LENS <span className="text-gradient-saffron">INDIA</span>
              </span>
            </div>
            <span className="text-[11px] font-semibold tracking-wider text-brand-spice uppercase">
              Experience Like a Local.
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden xl:flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100/80 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 transition-colors">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.name}
                to={link.path}
                className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-200 ${
                  isActive
                    ? 'text-slate-900 dark:text-white bg-white dark:bg-white/10 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-spice' : 'text-slate-400 dark:text-slate-400'}`} />
                {link.name}
                {link.badge !== undefined && link.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-brand-saffron/20 text-brand-spice border border-brand-saffron/30">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Action Controls: Theme Toggle, Auth, AI Chat Trigger */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:text-brand-spice dark:hover:text-brand-saffron hover:border-brand-saffron/30 transition-all"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 transition-transform hover:-rotate-12" />
            )}
          </button>

          {/* AI Chat trigger */}
          <Link
            to="/chat"
            className="group flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 hover:bg-brand-saffron/10 dark:hover:bg-brand-saffron/20 border border-slate-200 dark:border-white/10 hover:border-brand-saffron/40 transition-all duration-200"
            title="Open AI Travel Assistant"
          >
            <div className="relative">
              <MessageSquare className="w-3.5 h-3.5 text-brand-spice group-hover:scale-110 transition-transform" />
              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span>AI Chat</span>
          </Link>

          {/* Auth Controls */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-saffron/10 dark:bg-brand-saffron/20 border border-brand-saffron/30 text-brand-spice hover:bg-brand-saffron/20 transition-all"
                title="View Profile"
              >
                <div className="w-6 h-6 rounded-lg bg-brand-spice text-white flex items-center justify-center font-bold text-xs uppercase">
                  {profile?.name ? profile.name.charAt(0) : user?.username.charAt(0) || 'U'}
                </div>
                <span className="max-w-[100px] truncate">{profile?.name || user?.username}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
                title="Sign out"
                className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-red-500 hover:border-red-400/30 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 hover:bg-brand-saffron/10 border border-slate-200 dark:border-white/10 transition-all"
            >
              <LogIn className="w-3.5 h-3.5 text-brand-spice" />
              <span>Sign In</span>
            </Link>
          )}

          {/* Primary Action Button */}
          <Link
            to="/planner"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-saffron to-brand-spice hover:opacity-95 shadow-glow-saffron transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Plan Itinerary
          </Link>
        </div>

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-2">
          {/* Theme Toggle Mobile */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          <Link
            to="/chat"
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-brand-spice"
            aria-label="Open AI Assistant"
          >
            <MessageSquare className="w-5 h-5" />
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl px-4 py-4 space-y-2 transition-colors">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-brand-saffron/15 text-brand-spice border border-brand-saffron/20'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  {link.name}
                </div>
                {link.badge !== undefined && link.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-saffron/20 text-brand-spice">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 p-3 rounded-xl text-sm font-semibold bg-brand-saffron/10 text-brand-spice"
                >
                  <UserIcon className="w-4 h-4" />
                  <span>My Profile ({profile?.name || user?.username})</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 p-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-semibold bg-brand-saffron text-white shadow-glow-saffron"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In / Create Account</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};


