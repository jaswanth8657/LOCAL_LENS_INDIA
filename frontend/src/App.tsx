import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { TripProvider } from './context/TripContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { PageLoader } from './components/ui/PageLoader';
import { FloatingChatbot } from './components/chat/FloatingChatbot';

import { HomePage } from './pages/HomePage';

// Route-level code splitting for performance and bundle optimization
const DiscoverPage = lazy(() => import('./pages/DiscoverPage').then((m) => ({ default: m.DiscoverPage })));
const RecommendationsPage = lazy(() => import('./pages/RecommendationsPage').then((m) => ({ default: m.RecommendationsPage })));
const MapExplorePage = lazy(() => import('./pages/MapExplorePage').then((m) => ({ default: m.MapExplorePage })));
const PlannerPage = lazy(() => import('./pages/PlannerPage').then((m) => ({ default: m.PlannerPage })));
const SavedTripsPage = lazy(() => import('./pages/SavedTripsPage').then((m) => ({ default: m.SavedTripsPage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#faf8f5] dark:bg-[#070A13] text-stone-900 dark:text-slate-100 selection:bg-brand-saffron/30 selection:text-brand-spice transition-colors duration-200">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/recommendations" element={<RecommendationsPage />} />
            <Route path="/map" element={<MapExplorePage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/saved" element={<SavedTripsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      {/* Global Floating AI Chatbot Assistant */}
      <FloatingChatbot />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TripProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </TripProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
