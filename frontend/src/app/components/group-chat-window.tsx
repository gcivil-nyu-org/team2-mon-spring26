import { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '@/app/contexts/app-context';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/app/components/ui/select';
import { Send, MessageCircle, ChevronDown, Trash2 } from 'lucide-react';

interface GroupChatWindowProps {
  groupId: string;
  groupName: string;
}

export function GroupChatWindow({ groupId: initialGroupId, groupName: initialGroupName }: GroupChatWindowProps) {
  const { chatMessages, addChatMessage, deleteChatMessage, currentUser, groups } = useApp();
  const [message, setMessage] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const messages = useMemo(() => chatMessages[selectedGroupId] || [], [chatMessages, selectedGroupId]);
  const isLeader = selectedGroup?.members.find(m => m.userId === currentUser?.id)?.isLeader;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !currentUser) return;

    await addChatMessage(selectedGroupId, {
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
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <CardTitle className="text-lg">Chat</CardTitle>
          </div>
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-auto border-0 shadow-none hover:bg-muted/50 transition-colors px-3 py-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground">{selectedGroup?.name || initialGroupName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </SelectTrigger>
            <SelectContent align="end">
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">Start the conversation!</p>
              </div>
            </div>
          ) : (
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
                      <div className={`flex flex-col ${msg.userId === currentUser?.id ? 'items-end' : 'items-start'} group/msg relative w-full`}>
                        <p className="text-xs text-muted-foreground mb-1">
                          {msg.userName}
                        </p>
                        <div className="flex items-center gap-2 w-full justify-end max-w-full">
                          {msg.userId !== currentUser?.id ? (
                            <div className="flex items-center gap-2 w-full justify-start">
                              <div className={`rounded-lg px-3 py-2 max-w-[75%] bg-muted ${msg.message === '[This message has been deleted]' ? 'italic opacity-60' : ''}`}>
                                <p className="text-sm">{msg.message}</p>
                              </div>
                              {isLeader && msg.message !== '[This message has been deleted]' && (
                                <button 
                                  onClick={() => deleteChatMessage(selectedGroupId, msg.id)}
                                  className="opacity-0 group-hover/msg:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-opacity"
                                  title="Delete message"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 w-full justify-end">
                              {isLeader && msg.message !== '[This message has been deleted]' && (
                                <button 
                                  onClick={() => deleteChatMessage(selectedGroupId, msg.id)}
                                  className="opacity-0 group-hover/msg:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-opacity"
                                  title="Delete message"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              <div className={`rounded-lg px-3 py-2 max-w-[75%] bg-gradient-to-r from-purple-600 to-pink-600 text-white ${msg.message === '[This message has been deleted]' ? 'italic opacity-60' : ''}`}>
                                <p className="text-sm">{msg.message}</p>
                              </div>
                            </div>
                          )}
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
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

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
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}