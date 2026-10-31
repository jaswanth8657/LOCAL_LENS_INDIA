import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { MapSearchBar } from '../components/map/MapSearchBar';
import { HomePage } from '../pages/HomePage';
import { TripProvider } from '../context/TripContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Place } from '../types';

// Mock Leaflet as in previous tests
vi.mock('leaflet', () => ({
  default: {
    Icon: {
      Default: {
        prototype: {},
        mergeOptions: vi.fn(),
      },
    },
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

// Helper component to test ThemeContext
const ThemeTestConsumer = () => {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={toggleTheme} data-testid="toggle-theme-btn">
        Toggle
      </button>
      <button onClick={() => setTheme('light')} data-testid="set-light-btn">
        Set Light
      </button>
      <button onClick={() => setTheme('dark')} data-testid="set-dark-btn">
        Set Dark
      </button>
    </div>
  );
};

// Helper component to test AuthContext
const AuthTestConsumer = () => {
  const { isAuthenticated, user, profile } = useAuth();
  return (
    <div>
      <span data-testid="auth-status">{isAuthenticated ? 'logged-in' : 'guest'}</span>
      <span data-testid="username">{user?.username || 'none'}</span>
      <span data-testid="name">{profile?.name || 'none'}</span>
    </div>
  );
};

describe('Phase 9 — Theme System (Task 1)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark', 'light');
  });

  it('initializes with default theme and updates DOM classes', () => {
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    const themeSpan = screen.getByTestId('current-theme');
    expect(['dark', 'light']).toContain(themeSpan.textContent);
    expect(document.documentElement.classList.contains('dark') || document.documentElement.classList.contains('light')).toBe(true);
  });

  it('toggles theme correctly between dark and light', () => {
    render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    const toggleBtn = screen.getByTestId('toggle-theme-btn');
    const themeSpan = screen.getByTestId('current-theme');
    const initialTheme = themeSpan.textContent;

    fireEvent.click(toggleBtn);
    const newTheme = themeSpan.textContent;
    expect(newTheme).not.toBe(initialTheme);
    expect(document.documentElement.classList.contains(newTheme!)).toBe(true);

    fireEvent.click(toggleBtn);
    expect(themeSpan.textContent).toBe(initialTheme);
  });
});

describe('Phase 9 — User Authentication Context (Task 2)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts in guest unauthenticated state by default', () => {
    render(
      <ThemeProvider>
        <AuthProvider>
          <AuthTestConsumer />
        </AuthProvider>
      </ThemeProvider>
    );

    expect(screen.getByTestId('auth-status').textContent).toBe('guest');
    expect(screen.getByTestId('username').textContent).toBe('none');
  });
});

describe('Phase 9 — Chatbot Homepage Section (Task 3)', () => {
  it('renders the chatbot introduction section and sample questions on homepage', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <TripProvider>
              <MemoryRouter>
                <HomePage />
              </MemoryRouter>
            </TripProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    // Heading
    expect(screen.getByText(/Plan Your Next Journey with/i)).toBeInTheDocument();

    // Sample question chips
    expect(screen.getByText(/"Plan a 3-day trip to Jaipur under ₹15,000"/i)).toBeInTheDocument();
    expect(screen.getByText(/"What are the best street food spots in Old Delhi\?"/i)).toBeInTheDocument();
    expect(screen.getByText(/"Suggest a peaceful beach destination in South India"/i)).toBeInTheDocument();
    expect(screen.getByText(/"What is the best time to visit Ladakh\?"/i)).toBeInTheDocument();

    // CTA button
    expect(screen.getByRole('link', { name: /Chat with Local Lens AI/i })).toBeInTheDocument();
  });
});

describe('Phase 9 — Map Explorer Search Bar (Task 4 & 5)', () => {
  const mockPlaces: Place[] = [
    {
      id: 'place-1',
      destinationId: 'visakhapatnam',
      name: 'Rishikonda Beach',
      category: 'beaches',
      address: 'Beach Road, Visakhapatnam',
      latitude: 17.7818,
      longitude: 83.3851,
      ticketPriceInr: 0,
      priceTier: 'Budget',
      dataSource: 'OSM_OVERPASS',
      lastVerifiedAt: '2026-10-30',
      verificationStatus: 'VERIFIED',
      description: 'Golden sand beach',
    },
    {
      id: 'place-2',
      destinationId: 'visakhapatnam',
      name: 'Kailasagiri Hill Park',
      category: 'heritage',
      address: 'Hill Top Road, Visakhapatnam',
      latitude: 17.7492,
      longitude: 83.3422,
      ticketPriceInr: 20,
      priceTier: 'Budget',
      dataSource: 'OSM_OVERPASS',
      lastVerifiedAt: '2026-10-30',
      verificationStatus: 'VERIFIED',
      description: 'Scenic viewpoint and park',
    },
  ];

  it('renders search input and responds to user queries with suggestions', async () => {
    const handleSelectDest = vi.fn();
    const handleSelectPlace = vi.fn();
    const handleSelectLoc = vi.fn();

    render(
      <MapSearchBar
        currentPlaces={mockPlaces}
        onSelectDestination={handleSelectDest}
        onSelectPlace={handleSelectPlace}
        onSelectLocation={handleSelectLoc}
      />
    );

    const input = screen.getByPlaceholderText(/Search places, cities, temples, beaches, landmarks/i);
    expect(input).toBeInTheDocument();

    // Type "Jaipur" to trigger Curated Destination suggestion
    fireEvent.change(input, { target: { value: 'Jaipur' } });

    await waitFor(() => {
      expect(screen.getByText('Jaipur')).toBeInTheDocument();
    });

    // Click suggestion
    fireEvent.click(screen.getByText('Jaipur'));
    expect(handleSelectDest).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'jaipur',
        name: 'Jaipur',
      })
    );
  });

  it('finds loaded database places when matching query', async () => {
    const handleSelectDest = vi.fn();
    const handleSelectPlace = vi.fn();
    const handleSelectLoc = vi.fn();

    render(
      <MapSearchBar
        currentPlaces={mockPlaces}
        onSelectDestination={handleSelectDest}
        onSelectPlace={handleSelectPlace}
        onSelectLocation={handleSelectLoc}
      />
    );

    const input = screen.getByPlaceholderText(/Search places, cities, temples, beaches, landmarks/i);
    fireEvent.change(input, { target: { value: 'Rishikonda' } });

    await waitFor(() => {
      expect(screen.getByText('Rishikonda Beach')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Rishikonda Beach'));
    expect(handleSelectPlace).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'place-1',
        name: 'Rishikonda Beach',
      })
    );
  });

  it('clears query and closes dropdown when clear button is clicked', async () => {
    const handleSelectDest = vi.fn();
    const handleSelectPlace = vi.fn();
    const handleSelectLoc = vi.fn();

    render(
      <MapSearchBar
        currentPlaces={mockPlaces}
        onSelectDestination={handleSelectDest}
        onSelectPlace={handleSelectPlace}
        onSelectLocation={handleSelectLoc}
      />
    );

    const input = screen.getByPlaceholderText(/Search places, cities, temples, beaches, landmarks/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Jaipur' } });

    const clearBtn = screen.getByTitle('Clear search');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(input.value).toBe('');
    expect(screen.queryByText('Jaipur')).not.toBeInTheDocument();
  });
});
