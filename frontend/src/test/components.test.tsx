import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerificationBadge, MatchBadge } from '../components/ui/Badge';
import { GlassCard } from '../components/ui/GlassCard';
import { CURATED_DESTINATIONS } from '../data/curatedDestinations';

describe('UI Badges & Verification', () => {
  it('renders verified data badge correctly', () => {
    render(<VerificationBadge status="VERIFIED" source="OpenStreetMap" />);
    expect(screen.getByText('Verified Data')).toBeInTheDocument();
  });

  it('renders estimated badge correctly', () => {
    render(<VerificationBadge status="ESTIMATED" />);
    expect(screen.getByText('Estimated')).toBeInTheDocument();
  });

  it('renders not available badge when status is unavailable', () => {
    render(<VerificationBadge status="UNAVAILABLE" />);
    expect(screen.getByText('Not available')).toBeInTheDocument();
  });

  it('renders match score correctly', () => {
    render(<MatchBadge score={94} />);
    expect(screen.getByText('★ 94% Match')).toBeInTheDocument();
  });
});

describe('GlassCard component', () => {
  it('renders children with glassmorphic classes', () => {
    render(
      <GlassCard data-testid="test-glass-card">
        <div>Content Inside Glass</div>
      </GlassCard>
    );
    expect(screen.getByText('Content Inside Glass')).toBeInTheDocument();
    expect(screen.getByTestId('test-glass-card')).toHaveClass('backdrop-blur-xl');
  });
});

describe('Curated Indian Destinations', () => {
  it('contains essential Indian destinations with verified geocodes', () => {
    expect(CURATED_DESTINATIONS.length).toBeGreaterThanOrEqual(5);

    const vizag = CURATED_DESTINATIONS.find((d) => d.id === 'visakhapatnam');
    expect(vizag).toBeDefined();
    expect(vizag?.latitude).toBeCloseTo(17.6868, 2);
    expect(vizag?.longitude).toBeCloseTo(83.2185, 2);

    const jaipur = CURATED_DESTINATIONS.find((d) => d.id === 'jaipur');
    expect(jaipur).toBeDefined();
    expect(jaipur?.latitude).toBeCloseTo(26.9124, 2);
    expect(jaipur?.longitude).toBeCloseTo(75.7873, 2);
  });
});
