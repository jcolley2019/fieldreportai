import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import logo from '@/assets/field-report-ai-logo.png';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type SectionType = 'hero' | 'features' | 'pricing' | 'faq' | 'general';

const getContextualMessage = (section: SectionType): string => {
  const messages: Record<SectionType, string> = {
    hero: "Hey there! 👋 I noticed you're checking out Field Report AI. Want me to walk you through how we can help your team create reports 10x faster?",
    features: "I see you're exploring our features! Would you like me to explain how any of these work, or how they could help your specific workflow?",
    pricing: "Looking at pricing? I can help you figure out which plan is right for your team. How many people will be using Field Report AI?",
    faq: "Got questions? I'm here to help! Feel free to ask me anything about Field Report AI - I might have the answer you're looking for.",
    general: "Hey there! I'm Field, an AI Assistant from Field Report AI. What are you looking to learn more about today?\n\nI'm available if you have questions about our features, pricing, or how our AI can help your construction team!"
  };
  return messages[section];
};

const LandingChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<SectionType>('general');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: getContextualMessage('general')
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track which section the user is viewing
  useEffect(() => {
    const sections = [
      { id: 'pricing', type: 'pricing' as SectionType },
      { id: 'features', type: 'features' as SectionType },
      { id: 'faq', type: 'faq' as SectionType },
    ];

    const observers: IntersectionObserver[] = [];

    sections.forEach(({ id, type }) => {
      const element = document.getElementById(id);
      if (element) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
                setCurrentSection(type);
              }
            });
          },
          { threshold: 0.3 }
        );
        observer.observe(element);
        observers.push(observer);
      }
    });

    // Check if user is at the top (hero section)
    const handleScroll = () => {
      if (window.scrollY < 300) {
        setCurrentSection('hero');
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => {
      observers.forEach(observer => observer.disconnect());
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: messageText.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('landing-chat', {
        body: {
          message: messageText.trim(),
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content }))
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply || "I'm sorry, I couldn't process that. Please try again."
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment, or feel free to explore our features and pricing above!"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleQuickAction = (action: string) => {
    sendMessage(action);
  };

  return (
    <>
      {/* Chat Toggle Button with Label */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
        {/* Label that appears above button when not open */}
        {!isOpen && (
          <div className="bg-card border border-border rounded-full px-4 py-2 shadow-lg transition-all duration-300">
            <span className="text-sm font-medium text-foreground whitespace-nowrap">Questions?</span>
          </div>
        )}
        
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all duration-300 flex items-center justify-center group hover:scale-105"
          aria-label={isOpen ? 'Close chat' : 'Open chat'}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Chat Widget */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 z-40 w-[380px] max-w-[calc(100vw-48px)] shadow-2xl border-2 border-border animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <CardHeader className="pb-3 pt-4 px-4 border-b border-border bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={logo} alt="Field Report AI" className="h-10 w-10 rounded-full object-contain bg-background p-1" />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Field</h3>
                <p className="text-xs text-muted-foreground">AI Assistant</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Messages Area */}
            <div className="h-[320px] overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    }`}
                  >
                    {message.content}
                  </div>
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground font-medium">Field is typing...</span>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions - show only at start */}
            {messages.length <= 1 && (
              <div className="px-4 pb-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1"
                  onClick={() => handleQuickAction("Tell me about your features")}
                >
                  🚀 Get Started
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1"
                  onClick={() => {
                    setIsOpen(false);
                    const pricingSection = document.getElementById('pricing');
                    if (pricingSection) {
                      pricingSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                >
                  💰 Pricing
                </Button>
              </div>
            )}

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-muted/30">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 h-10 text-sm"
                  disabled={isLoading}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="h-10 w-10"
                  disabled={isLoading || !inputValue.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>

            {/* Footer */}
            <div className="px-4 py-2 text-[10px] text-muted-foreground text-center border-t border-border bg-muted/20">
              By chatting with us, you agree to the monitoring and recording of this chat to improve our services as described in our{' '}
              <Link to="#" className="text-primary hover:underline">Privacy Policy</Link>.
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default LandingChatBot;
