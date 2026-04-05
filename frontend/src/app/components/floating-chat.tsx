import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { MessageCircle, X, Send, Plus, Users, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { useApp } from '@/app/contexts/app-context';

type ConversationType = 'group' | 'dm';

interface Conversation {
  id: string;
  type: ConversationType;
  name: string;
  lastMessage?: string;
  lastMessageTime?: string;
  isGroup: boolean;
}

export function FloatingChat() {
  const { groups, dmConversations, chatMessages, addChatMessage, deleteChatMessage, currentUser, createDMConversation, getAllUsers } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [showNewDMDialog, setShowNewDMDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Build conversation list
  const conversations: Conversation[] = [
    ...groups.map(g => ({
      id: g.id,
      type: 'group' as ConversationType,
      name: g.name,
      isGroup: true,
      lastMessage: chatMessages[g.id]?.slice(-1)[0]?.message,
      lastMessageTime: chatMessages[g.id]?.slice(-1)[0]?.timestamp
    })),
    ...dmConversations.map(dm => {
      // Get the other participant's name
      const otherParticipantName = dm.participantNames.find(name => name !== currentUser?.name) || 'Unknown';
      return {
        id: dm.id,
        type: 'dm' as ConversationType,
        name: otherParticipantName,
        isGroup: false,
        lastMessage: chatMessages[dm.id]?.slice(-1)[0]?.message,
        lastMessageTime: dm.lastMessageTime
      };
    })
  ];

  // Sort conversations by last message time
  conversations.sort((a, b) => {
    const aTime = a.lastMessageTime || '0';
    const bTime = b.lastMessageTime || '0';
    return bTime.localeCompare(aTime);
  });

  // Set initial conversation when data loads
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations.length, selectedConversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);
  const messages = useMemo(() => selectedConversationId ? chatMessages[selectedConversationId] || [] : [], [selectedConversationId, chatMessages]);
  const isLeader = selectedConversation?.isGroup ? groups.find(g => g.id === selectedConversationId)?.members.find(m => m.userId === currentUser?.id)?.isLeader : false;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversationId || !currentUser) return;

    addChatMessage(selectedConversationId, {
      id: `msg-${Date.now()}`,
      type: 'user',
      userId: currentUser.id,
      userName: currentUser.name,
      message: newMessage.trim(),
      timestamp: new Date().toISOString()
    });

    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartDM = useCallback(async (participantId: string) => {
    // Check if DM already exists
    const existingDM = dmConversations.find(dm => 
      dm.participants.includes(participantId) && dm.participants.includes(currentUser!.id)
    );

    if (existingDM) {
      setSelectedConversationId(existingDM.id);
    } else {
      try {
        const newDM = await createDMConversation(participantId);
        setSelectedConversationId(newDM.id);
      } catch (err) {
        console.error('Failed to create or navigate to DM', err);
      }
    }
    setShowNewDMDialog(false);
  }, [dmConversations, currentUser, createDMConversation]);

  useEffect(() => {
    const handleOpenDM = (e: CustomEvent<string>) => {
      setIsOpen(true);
      handleStartDM(e.detail);
    };
    window.addEventListener('open-chat-dm', handleOpenDM as EventListener);
    return () => {
      window.removeEventListener('open-chat-dm', handleOpenDM as EventListener);
    };
  }, [handleStartDM]);

  // Get all users from groups (potential DM contacts)
  const potentialDMContacts = getAllUsers().filter(user => {
    // Exclude current user
    if (user.id === currentUser?.id) return false;
    // Only show users who are in at least one group with the current user
    return groups.some(group => 
      group.members.some(m => m.userId === user.id) &&
      group.members.some(m => m.userId === currentUser?.id)
    );
  });

  // Don't render if no current user (not logged in) or no conversations
  if (!currentUser || (groups.length === 0 && dmConversations.length === 0)) {
    return null;
  }

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-50"
          aria-label="Open chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className={`fixed bottom-6 right-6 ${isExpanded ? 'w-[calc(100vw-3rem)] h-[calc(100vh-3rem)]' : 'w-[680px] h-[580px]'} shadow-2xl flex flex-row z-50 overflow-hidden transition-all duration-300 ease-in-out`}>
          {/* Conversations List - Left Side */}
          <div className="w-[240px] border-r flex flex-col bg-muted/30">
            {/* Header */}
            <div className="px-4 py-3 border-b bg-background flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold">Chats</h3>
              </div>
              <Dialog open={showNewDMDialog} onOpenChange={setShowNewDMDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Direct Message</DialogTitle>
                    <DialogDescription>
                      Start a conversation with someone from your groups
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {potentialDMContacts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No available contacts
                        </p>
                      ) : (
                        potentialDMContacts.map(user => (
                          <button
                            key={user.id}
                            onClick={() => handleStartDM(user.id)}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium">
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>

            {/* Conversations */}
            <ScrollArea className="flex-1">
              <div className="py-2">
                {conversations.map(conversation => {
                  const isSelected = conversation.id === selectedConversationId;
                  return (
                    <button
                      key={conversation.id}
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors border-l-2 ${
                        isSelected ? 'bg-muted border-purple-600' : 'border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          conversation.isGroup 
                            ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                            : 'bg-gradient-to-br from-purple-400 to-pink-400'
                        } text-white font-medium`}>
                          {conversation.isGroup ? (
                            <Users className="w-5 h-5" />
                          ) : (
                            conversation.name.charAt(0)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm truncate ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                              {conversation.name}
                            </p>
                          </div>
                          {conversation.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {conversation.lastMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Messages - Right Side */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="px-4 py-3 border-b bg-background flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  selectedConversation?.isGroup 
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                    : 'bg-gradient-to-br from-purple-400 to-pink-400'
                } text-white text-sm font-medium`}>
                  {selectedConversation?.isGroup ? (
                    <Users className="w-4 h-4" />
                  ) : (
                    selectedConversation?.name.charAt(0)
                  )}
                </div>
                <h3 className="font-semibold truncate">{selectedConversation?.name}</h3>
              </div>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => {
                    setIsOpen(false);
                    setIsExpanded(false);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4">
              <div className="py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                    <p className="text-sm">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    if (msg.type === 'system') {
                      return (
                        <div key={msg.id} className="text-center">
                          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                            {msg.message}
                          </span>
                        </div>
                      );
                    }

                    const isCurrentUser = msg.userId === currentUser?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} group/msg relative w-full`}
                      >
                        {!isCurrentUser && (
                          <span className="text-xs text-muted-foreground mb-1 px-1">
                            {msg.userName}
                          </span>
                        )}
                        <div className="flex items-center gap-2 w-full justify-end max-w-full">
                          {!isCurrentUser ? (
                            <div className="flex items-center gap-2 w-full justify-start">
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2 bg-muted text-foreground ${msg.message === '[This message has been deleted]' ? 'italic opacity-60' : ''}`}>
                                <p className="text-sm break-words">{msg.message}</p>
                              </div>
                              {isLeader && msg.message !== '[This message has been deleted]' && selectedConversationId && (
                                <button 
                                  onClick={() => deleteChatMessage(selectedConversationId, msg.id)}
                                  className="opacity-0 group-hover/msg:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-opacity"
                                  title="Delete message"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 w-full justify-end">
                              {isLeader && msg.message !== '[This message has been deleted]' && selectedConversationId && (
                                <button 
                                  onClick={() => deleteChatMessage(selectedConversationId, msg.id)}
                                  className="opacity-0 group-hover/msg:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded transition-opacity"
                                  title="Delete message"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              <div className={`max-w-[75%] rounded-2xl px-4 py-2 bg-purple-600 text-white ${msg.message === '[This message has been deleted]' ? 'italic opacity-60' : ''}`}>
                                <p className="text-sm break-words">{msg.message}</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1 px-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  size="icon"
                  className="bg-purple-600 hover:bg-purple-700 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}