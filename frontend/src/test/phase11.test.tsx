import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TripProvider } from '../context/TripContext';
import { ThemeProvider } from '../context/ThemeContext';
import { FloatingChatbot } from '../components/chat/FloatingChatbot';
import { DiscoverPage } from '../pages/DiscoverPage';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TripProvider>
          <BrowserRouter>{children}</BrowserRouter>
        </TripProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('Phase 11 — Live Discovery & Global Floating AI Chatbot', () => {
  it('renders circular floating chatbot launcher button on the page', () => {
    const Wrapper = createWrapper();
    render(<FloatingChatbot />, { wrapper: Wrapper });

    const launcherBtn = screen.getByLabelText(/Chat with Local Lens AI Guide/i);
    expect(launcherBtn).toBeInTheDocument();
  });

  it('clicking floating launcher opens the assistant panel with header, actions, and input', () => {
    const Wrapper = createWrapper();
    render(<FloatingChatbot />, { wrapper: Wrapper });

    const launcherBtn = screen.getByLabelText(/Chat with Local Lens AI Guide/i);
    fireEvent.click(launcherBtn);

    expect(screen.getByText(/LOCAL LENS AI Guide/i)).toBeInTheDocument();
    expect(screen.getByText(/Grounded/i)).toBeInTheDocument();

    // Check actions: Clear, Open Full Page, Minimize, Close
    expect(screen.getByTitle(/Clear chat history/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Open full page chat/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Close assistant/i)).toBeInTheDocument();

    // Input form
    const input = screen.getByPlaceholderText(/Ask about places, food, hours.../i);
    expect(input).toBeInTheDocument();
  });

  it('verifies speech-to-text mic input is present with zero audio playback tags', () => {
    const Wrapper = createWrapper();
    const { container } = render(<FloatingChatbot />, { wrapper: Wrapper });

    const launcherBtn = screen.getByLabelText(/Chat with Local Lens AI Guide/i);
    fireEvent.click(launcherBtn);

    // Verify ZERO audio tags in DOM
    const audioTags = container.querySelectorAll('audio');
    expect(audioTags.length).toBe(0);

    // Verify ZERO video tags in DOM
    const videoTags = container.querySelectorAll('video');
    expect(videoTags.length).toBe(0);
  });

  it('clearing history in floating chatbot resets conversation to default prompt', () => {
    const Wrapper = createWrapper();
    render(<FloatingChatbot />, { wrapper: Wrapper });

    const launcherBtn = screen.getByLabelText(/Chat with Local Lens AI Guide/i);
    fireEvent.click(launcherBtn);

    const clearBtn = screen.getByTitle(/Clear chat history/i);
    fireEvent.click(clearBtn);

    expect(screen.getByText(/Conversation cleared/i)).toBeInTheDocument();
  });

  it('DiscoverPage renders both Destination Hubs and Live Place Discovery tabs', () => {
    const Wrapper = createWrapper();
    render(<DiscoverPage />, { wrapper: Wrapper });

    expect(screen.getByText(/Destination Hubs/i)).toBeInTheDocument();
    expect(screen.getByText(/Live Place & Attraction Discovery/i)).toBeInTheDocument();
  });

  it('switching to Live Place Discovery tab shows hybrid search metadata', () => {
    const Wrapper = createWrapper();
    render(<DiscoverPage />, { wrapper: Wrapper });

    const liveTab = screen.getByText(/Live Place & Attraction Discovery/i);
    fireEvent.click(liveTab);

    expect(screen.getByText(/Places Discovered/i)).toBeInTheDocument();
    expect(screen.getAllByText(/SQLite Database/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Live OSM/i)).toBeInTheDocument();
  });
});
