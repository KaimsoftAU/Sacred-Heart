import React, { useState, useRef, useEffect } from 'react';
import './ChatUI.css';

// Interface defining the structure of a chat message
interface ChatMessage {
    username: string;   // Who sent the message
    message: string;    // The message content
    timestamp: number;  // When it was sent (milliseconds)
}

// Props that the ChatUI component receives from parent
interface ChatUIProps {
    messages: ChatMessage[];                    // Array of all messages to display
    onSendMessage: (message: string) => void;   // Callback to send new message
    username: string;                           // Current user's username
}

/**
 * ChatUI Component - RuneScape-style chat interface
 * Displays in bottom-left corner with transparent background and gold text
 * Press Enter to focus input, Enter again to send, Escape to unfocus
 */
const ChatUI: React.FC<ChatUIProps> = ({ messages, onSendMessage, username }) => {
    // State to track what user is typing
    const [inputValue, setInputValue] = useState('');
    // State to track if input is focused (for keyboard event handling)
    const [isFocused, setIsFocused] = useState(false);
    // Ref to programmatically focus/blur the input element
    const inputRef = useRef<HTMLInputElement>(null);
    // Ref to the bottom of the messages list for auto-scrolling
    const messagesEndRef = useRef<HTMLDivElement>(null);

    /**
     * Effect: Auto-scroll chat to bottom when new messages arrive
     * This ensures users always see the latest message
     */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]); // Re-run whenever messages array changes

    /**
     * Effect: Global keyboard handler for chat focus/unfocus
     * - Enter key when NOT focused: Focus the chat input
     * - Escape key when focused: Unfocus to return to game controls
     * This allows seamless switching between game movement and chat
     */
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !isFocused) {
                e.preventDefault();
                inputRef.current?.focus();  // Focus input to start typing
            } else if (e.key === 'Escape' && isFocused) {
                e.preventDefault();
                inputRef.current?.blur();   // Blur input to return to game
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        // Cleanup: Remove listener when component unmounts
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFocused]); // Re-run when focus state changes

    /**
     * Handler: Submit chat message
     * Prevents empty messages and clears input after sending
     */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            onSendMessage(inputValue.trim());  // Send to parent component
            setInputValue('');                  // Clear input field
        }
    };

    // Track focus state for keyboard handler
    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    return (
        <div className="chat-container">
            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div key={index} className="chat-message">
                        <span className="chat-username">{msg.username}:</span>{' '}
                        <span className="chat-text">{msg.message}</span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="chat-input-form">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    className="chat-input"
                    placeholder="Press Enter to chat..."
                    maxLength={100}
                />
            </form>
        </div>
    );
};

export default ChatUI;
