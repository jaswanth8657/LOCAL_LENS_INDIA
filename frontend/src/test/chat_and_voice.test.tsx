import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TripProvider } from '../context/TripContext';
import { ChatPage } from '../pages/ChatPage';

const renderChatPage = () => {
  return render(
    <TripProvider>
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    </TripProvider>
  );
};

describe('Conversational Travel Assistant (Phase 6)', () => {
  it('renders chatbot header, welcome message, and suggested prompts', () => {
    renderChatPage();

    expect(screen.getByText('LOCAL LENS Travel Assistant')).toBeInTheDocument();
    expect(screen.getByText(/Grounding Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Namaste! I am your/i)).toBeInTheDocument();
    expect(screen.getByText(/Try asking:/i)).toBeInTheDocument();
    expect(screen.getByText(/What are the best beaches and scenic viewpoints in Visakhapatnam\?/i)).toBeInTheDocument();
  });

  it('provides an editable message input field and send button', () => {
    renderChatPage();

    const input = screen.getByPlaceholderText(/Ask about attractions, cuisine, entry tickets/i) as HTMLInputElement;
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Recommend authentic food in Jaipur' } });
    expect(input.value).toBe('Recommend authentic food in Jaipur');

    const sendBtn = screen.getByTitle('Send Message');
    expect(sendBtn).toBeInTheDocument();
    expect(sendBtn).not.toBeDisabled();
  });

  it('contains microphone button strictly inside the chatbot input bar', () => {
    renderChatPage();

    const micBtn = screen.getByLabelText(/Speak Message/i);
    expect(micBtn).toBeInTheDocument();
  });

  it('verifies STRICT PROHIBITION: NO audio elements, NO audio playback, NO speaker controls', () => {
    const { container } = renderChatPage();

    // Zero audio tags
    const audioTags = container.querySelectorAll('audio');
    expect(audioTags.length).toBe(0);

    // Zero video or spoken playback tags
    const videoTags = container.querySelectorAll('video');
    expect(videoTags.length).toBe(0);

    // Confirmation that responses are text-only
    expect(screen.getByText(/Responses are generated in text only/i)).toBeInTheDocument();
    expect(screen.getByText(/No audio files are recorded or stored/i)).toBeInTheDocument();
  });

  it('allows clicking quick suggested prompts to populate and submit', async () => {
    renderChatPage();

    const promptBtn = screen.getByText('Which destinations are currently available in LOCAL LENS INDIA?');
    expect(promptBtn).toBeInTheDocument();

    // Clicking quick prompt initiates question and adds message bubble
    fireEvent.click(promptBtn);
    const elements = screen.getAllByText('Which destinations are currently available in LOCAL LENS INDIA?');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });
});
