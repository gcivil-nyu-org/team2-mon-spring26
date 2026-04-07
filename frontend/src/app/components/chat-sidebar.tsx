import { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '@/app/contexts/app-context';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { X, Send } from 'lucide-react';

interface ChatSidebarProps {
  groupId: string;
  onClose: () => void;
}

export function ChatSidebar({ groupId, onClose }: ChatSidebarProps) {
  const { chatMessages, addChatMessage, currentUser } = useApp();
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => chatMessages[groupId] || [], [chatMessages, groupId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !currentUser) return;

    addChatMessage(groupId, {
      id: `msg-${Date.now()}`,
      type: 'user',
      userId: currentUser.id,
      userName: currentUser.name,
      message: message.trim(),
      timestamp: new Date().toISOString()
    });

    setMessage('');
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-white border-l shadow-lg flex flex-col z-50">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Group Chat</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.type === 'system' ? (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full inline-block">
                    {msg.message}
                  </p>
                </div>
              ) : (
                <div className={`flex flex-col ${msg.userId === currentUser?.id ? 'items-end' : 'items-start'}`}>
                  <p className="text-xs text-muted-foreground mb-1">
                    {msg.userName}
                  </p>
                  <div className={`rounded-lg px-3 py-2 max-w-[80%] ${
                    msg.userId === currentUser?.id
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : 'bg-muted'
                  }`}>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
        />
        <Button 
          type="submit" 
          size="icon"
          disabled={!message.trim()}
          className="bg-gradient-to-r from-purple-600 to-pink-600"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
