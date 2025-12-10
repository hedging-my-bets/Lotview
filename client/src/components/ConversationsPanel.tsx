import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Send, 
  RefreshCw, 
  User, 
  Clock, 
  Bot, 
  Sparkles, 
  Calendar,
  Phone,
  Mail,
  ClipboardCheck,
  ChevronRight,
  Search,
  Facebook,
  MessageCircle,
  Edit3,
  Lightbulb,
  GraduationCap
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface Conversation {
  id: number;
  type: "website_chat" | "messenger";
  category?: string;
  vehicleName?: string;
  participantName?: string;
  handoffPhone?: string;
  handoffEmail?: string;
  handoffName?: string;
  ghlContactId?: string;
  messages?: Message[];
  lastMessage?: string;
  createdAt: string;
  lastMessageAt?: string;
  updatedAt?: string;
  unreadCount?: number;
  pageName?: string;
}

interface ConversationsPanelProps {
  dealershipId: number;
  onSwitchToTraining?: () => void;
}

export function ConversationsPanel({ dealershipId, onSwitchToTraining }: ConversationsPanelProps) {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<{
    websiteChats: Conversation[];
    messengerConversations: Conversation[];
    totalWebsiteChats: number;
    totalMessengerConversations: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [trainingMode, setTrainingMode] = useState(false);
  const [fwcMessageType, setFwcMessageType] = useState<'sms' | 'email' | 'facebook' | null>(null);
  const [fwcMessageText, setFwcMessageText] = useState("");
  const [isSendingFwc, setIsSendingFwc] = useState(false);
  
  // Training mode state
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);
  const [selectedTrainingMessage, setSelectedTrainingMessage] = useState<{
    originalContent: string;
    messageIndex: number;
    context: Message[];
  } | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [trainingFeedback, setTrainingFeedback] = useState<string | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      generateAiSuggestion();
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/all-conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        
        // Auto-select first conversation if none selected
        // Normalize types before selection to ensure consistent handling
        if (!selectedConversation) {
          if (data.websiteChats?.length > 0) {
            selectConversation({ ...data.websiteChats[0], type: 'website_chat' });
          } else if (data.messengerConversations?.length > 0) {
            selectConversation({ ...data.messengerConversations[0], type: 'messenger' });
          }
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Select a conversation and load messages if needed (for messenger)
  const selectConversation = async (conv: Conversation) => {
    if (conv.type === 'messenger' && !conv.messages) {
      // Fetch messenger messages separately
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/messenger-conversations/${conv.id}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const messagesData = await response.json();
          // Transform messenger messages to match our format
          const messages: Message[] = messagesData.map((m: any) => ({
            role: m.senderType === 'customer' ? 'user' : 'assistant',
            content: m.content,
            timestamp: m.createdAt
          }));
          setSelectedConversation({ ...conv, messages });
        } else {
          setSelectedConversation(conv);
        }
      } catch (error) {
        console.error('Error fetching messenger messages:', error);
        setSelectedConversation(conv);
      }
    } else {
      setSelectedConversation(conv);
    }
  };

  const generateAiSuggestion = async () => {
    if (!selectedConversation?.messages?.length) {
      setAiSuggestion(null);
      return;
    }
    
    setIsLoadingAi(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/ai/suggest-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          messages: selectedConversation.messages.slice(-5),
          context: {
            vehicleName: selectedConversation.vehicleName,
            category: selectedConversation.category,
            customerName: getContactName(selectedConversation)
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAiSuggestion(data.suggestion);
      }
    } catch (error) {
      console.error('Error generating AI suggestion:', error);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const sendReply = async () => {
    if (!selectedConversation || !replyText.trim()) return;
    
    // Only Messenger conversations support replies via API
    if (selectedConversation.type === 'website_chat') {
      toast({ 
        title: "Info", 
        description: "Website chat replies are not supported. Use the customer's phone or email to follow up.",
        variant: "default"
      });
      return;
    }
    
    setIsSending(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/messenger-conversations/${selectedConversation.id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: replyText.trim() })
      });
      
      if (response.ok) {
        toast({ title: "Sent", description: "Message sent successfully" });
        setReplyText("");
        loadConversations();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const useAiSuggestion = () => {
    if (aiSuggestion) {
      setReplyText(aiSuggestion);
    }
  };

  const sendFwcMessage = async () => {
    if (!selectedConversation || !fwcMessageType || !fwcMessageText.trim()) {
      toast({ title: "Error", description: "Please select a message type and enter a message", variant: "destructive" });
      return;
    }

    if (!selectedConversation.ghlContactId) {
      toast({ 
        title: "FWC Not Linked", 
        description: "This conversation doesn't have a linked FWC contact. Contact info may be missing.", 
        variant: "destructive" 
      });
      return;
    }

    setIsSendingFwc(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/conversations/${selectedConversation.id}/fwc-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          type: fwcMessageType,
          message: fwcMessageText.trim()
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({ title: "Sent", description: data.message || `${fwcMessageType.toUpperCase()} sent successfully` });
        setFwcMessageText("");
        setFwcMessageType(null);
      } else {
        toast({ title: "Error", description: data.error || "Failed to send message", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send FWC message", variant: "destructive" });
    } finally {
      setIsSendingFwc(false);
    }
  };

  // Training mode functions
  const handleAiMessageClick = (msg: Message, index: number) => {
    if (!trainingMode || msg.role !== 'assistant' || !selectedConversation?.messages) return;
    
    // Get context (previous messages up to and including this one)
    const context = selectedConversation.messages.slice(0, index + 1);
    
    setSelectedTrainingMessage({
      originalContent: msg.content,
      messageIndex: index,
      context
    });
    setEditedContent(msg.content);
    setTrainingFeedback(null);
    setCurrentPrompt(null);
    setTrainingDialogOpen(true);
    
    // Load the current prompt for this dealership
    loadCurrentPrompt();
  };

  const loadCurrentPrompt = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/chat-prompts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const prompts = await response.json();
        // Get the active prompt for the 'sales' or 'general' scenario
        const activePrompt = prompts.find((p: any) => p.isActive && (p.scenario === 'sales' || p.scenario === 'general'));
        if (activePrompt) {
          setCurrentPrompt(activePrompt.systemPrompt);
        } else if (prompts.length > 0) {
          setCurrentPrompt(prompts[0].systemPrompt);
        }
      }
    } catch (error) {
      console.error('Error loading prompt:', error);
    }
  };

  const getTrainingFeedback = async () => {
    if (!selectedTrainingMessage || editedContent === selectedTrainingMessage.originalContent) {
      toast({ title: "No Changes", description: "Edit the response to get AI feedback", variant: "default" });
      return;
    }

    setIsLoadingFeedback(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/chat/training-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          originalResponse: selectedTrainingMessage.originalContent,
          editedResponse: editedContent,
          conversationContext: selectedTrainingMessage.context,
          currentPrompt: currentPrompt
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setTrainingFeedback(data.feedback);
      } else {
        toast({ title: "Error", description: "Failed to get training feedback", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to get training feedback", variant: "destructive" });
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const closeTrainingDialog = () => {
    setTrainingDialogOpen(false);
    setSelectedTrainingMessage(null);
    setEditedContent("");
    setTrainingFeedback(null);
    setCurrentPrompt(null);
  };

  const getContactName = (conv: Conversation): string => {
    if (conv.handoffName) return conv.handoffName;
    if (conv.participantName) return conv.participantName;
    
    // Common words that are NOT names
    const skipWords = ['yes', 'no', 'hi', 'hello', 'hey', 'sure', 'ok', 'okay', 'thanks', 'thank', 'interested', 'looking', 
      'yeah', 'yep', 'nope', 'maybe', 'please', 'car', 'vehicle', 'price', 'available', 'test', 'drive', 
      'info', 'information', 'details', 'more', 'about', 'good', 'great', 'nice', 'awesome'];
    
    // Try to extract name from messages if not stored
    if (conv.messages?.length) {
      for (const msg of conv.messages) {
        if (msg.role === 'user') {
          const content = msg.content.trim();
          
          // Pattern 1: Explicit name declarations
          const namePatterns = [
            /my name is\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
            /i'm\s+([a-zA-Z]+)(?:\s|,|\.|\!|$)/i,
            /i am\s+([a-zA-Z]+)(?:\s|,|\.|\!|$)/i,
            /this is\s+([a-zA-Z]+)(?:\s|,|\.|\!|$)/i,
            /call me\s+([a-zA-Z]+)(?:\s|,|\.|\!|$)/i,
            /^([a-zA-Z]+)\s+here(?:\s|,|\.|\!|$)/i,
          ];
          
          for (const pattern of namePatterns) {
            const match = content.match(pattern);
            if (match && match[1] && match[1].length > 1 && match[1].length < 20) {
              if (!skipWords.includes(match[1].toLowerCase())) {
                return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
              }
            }
          }
          
          // Pattern 2: Single word response that looks like a name (capitalized, 2-15 chars)
          // Only check short messages (likely name responses to "what's your name?")
          if (content.length >= 2 && content.length <= 20 && /^[A-Za-z]+$/.test(content)) {
            const potentialName = content.toLowerCase();
            if (!skipWords.includes(potentialName) && content.length >= 3) {
              // Check if previous message (assistant) asked for name
              const msgIndex = conv.messages.indexOf(msg);
              if (msgIndex > 0) {
                const prevMsg = conv.messages[msgIndex - 1];
                if (prevMsg.role === 'assistant' && /name|who.*you|call you|introduce/i.test(prevMsg.content)) {
                  return content.charAt(0).toUpperCase() + content.slice(1).toLowerCase();
                }
              }
            }
          }
        }
      }
    }
    
    if (conv.handoffEmail) return conv.handoffEmail.split('@')[0];
    return 'Unknown';
  };

  const getContactInitials = (conv: Conversation): string => {
    const name = getContactName(conv);
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getLastMessage = (conv: Conversation): string => {
    if (conv.messages && conv.messages.length > 0) {
      const lastMsg = conv.messages[conv.messages.length - 1];
      return lastMsg.content.substring(0, 50) + (lastMsg.content.length > 50 ? '...' : '');
    }
    if (conv.lastMessage) {
      return conv.lastMessage.substring(0, 50) + (conv.lastMessage.length > 50 ? '...' : '');
    }
    return 'No messages';
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const allConversations = [
    ...(conversations?.websiteChats?.map(c => ({ ...c, type: 'website_chat' as const })) || []),
    ...(conversations?.messengerConversations?.map(c => ({ ...c, type: 'messenger' as const })) || [])
  ].sort((a, b) => {
    const dateA = new Date(a.lastMessageAt || a.createdAt);
    const dateB = new Date(b.lastMessageAt || b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });

  const filteredConversations = allConversations.filter(conv => {
    if (!searchQuery) return true;
    const name = getContactName(conv).toLowerCase();
    const lastMsg = getLastMessage(conv).toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || lastMsg.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="h-[calc(100vh-200px)] flex bg-background rounded-lg border overflow-hidden" data-testid="conversations-panel">
      {/* Left Panel - Contacts List (iPhone Messages style) */}
      <div className="w-80 border-r flex flex-col bg-muted/30">
        {/* Header with search and training toggle */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Messages</h2>
            <Button variant="ghost" size="sm" onClick={loadConversations} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
              data-testid="search-conversations"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="training-mode" className="text-sm flex items-center gap-2 cursor-pointer">
              <ClipboardCheck className="w-4 h-4" />
              Training Mode
            </Label>
            <Switch
              id="training-mode"
              checked={trainingMode}
              onCheckedChange={setTrainingMode}
              data-testid="toggle-training-mode"
            />
          </div>
        </div>

        {/* Contacts List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-36 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length > 0 ? (
            <div>
              {filteredConversations.map((conv) => (
                <div
                  key={`${conv.type}-${conv.id}`}
                  className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b ${
                    selectedConversation?.id === conv.id && selectedConversation?.type === conv.type
                      ? 'bg-primary/10'
                      : ''
                  }`}
                  onClick={() => selectConversation(conv)}
                  data-testid={`conversation-${conv.type}-${conv.id}`}
                >
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                    conv.type === 'messenger' ? 'bg-blue-500' : 'bg-green-500'
                  }`}>
                    {getContactInitials(conv)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{getContactName(conv)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(conv.lastMessageAt || conv.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground truncate">
                        {getLastMessage(conv)}
                      </p>
                      {conv.unreadCount && conv.unreadCount > 0 && (
                        <Badge className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No conversations found</p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Middle Panel - Chat View */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between bg-background">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                  selectedConversation.type === 'messenger' ? 'bg-blue-500' : 'bg-green-500'
                }`}>
                  {getContactInitials(selectedConversation)}
                </div>
                <div>
                  <h3 className="font-semibold">{getContactName(selectedConversation)}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {selectedConversation.handoffPhone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {selectedConversation.handoffPhone}
                      </span>
                    )}
                    {selectedConversation.handoffEmail && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {selectedConversation.handoffEmail}
                      </span>
                    )}
                    {selectedConversation.vehicleName && (
                      <Badge variant="outline" className="text-xs">
                        {selectedConversation.vehicleName}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Badge variant={selectedConversation.type === 'messenger' ? 'default' : 'secondary'}>
                {selectedConversation.type === 'messenger' ? 'Messenger' : 'Website'}
              </Badge>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {trainingMode && (
                <div className="mb-3 p-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-purple-600" />
                  <p className="text-xs text-purple-700 dark:text-purple-400">
                    Training Mode: Click any AI response (blue) to edit and improve the prompt
                  </p>
                </div>
              )}
              <div className="space-y-4">
                {selectedConversation.messages?.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      onClick={() => handleAiMessageClick(msg, idx)}
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-white dark:bg-gray-700 text-foreground border border-gray-200 dark:border-gray-600 rounded-bl-md'
                          : `bg-blue-500 text-white rounded-br-md ${trainingMode ? 'cursor-pointer hover:bg-blue-600 ring-2 ring-transparent hover:ring-purple-400' : ''}`
                      }`}
                      data-testid={`message-${msg.role}-${idx}`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {trainingMode && msg.role === 'assistant' && (
                        <div className="flex items-center gap-1 mt-1 text-blue-200 text-xs">
                          <Edit3 className="w-3 h-3" />
                          <span>Click to train</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-background">
              {selectedConversation.type === 'website_chat' && (
                <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Website chats are read-only. Use the customer's phone or email to follow up.
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  placeholder={selectedConversation.type === 'messenger' ? "Type a message..." : "Replies not available for website chats"}
                  value={replyText}
                  disabled={selectedConversation.type === 'website_chat'}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendReply()}
                  className="flex-1"
                  data-testid="message-input"
                />
                <Button 
                  onClick={sendReply} 
                  disabled={isSending || !replyText.trim() || selectedConversation.type === 'website_chat'}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a conversation from the left to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - AI Assistant */}
      <div className="w-80 border-l flex flex-col bg-muted/30">
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Assistant
          </h3>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* AI Draft Message */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  Suggested Reply
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingAi ? (
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                    <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                  </div>
                ) : aiSuggestion ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">{aiSuggestion}</p>
                    <Button size="sm" onClick={useAiSuggestion} className="w-full">
                      Use This Reply
                    </Button>
                  </div>
                ) : selectedConversation ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Analyzing conversation...</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Select a conversation to see AI suggestions
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Scheduled Messages */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Scheduled Messages
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scheduledMessages.length > 0 ? (
                  <div className="space-y-2">
                    {scheduledMessages.map((msg, idx) => (
                      <div key={idx} className="text-sm p-2 bg-muted rounded">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <Clock className="w-3 h-3" />
                          {msg.scheduledFor}
                        </div>
                        <p className="line-clamp-2">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No scheduled messages
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Conversation Analysis */}
            {selectedConversation && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Contact Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Name:</span>{' '}
                    <span className="font-medium">{getContactName(selectedConversation)}</span>
                  </div>
                  {selectedConversation.handoffPhone && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Phone:</span>{' '}
                      <span className="font-medium">{selectedConversation.handoffPhone}</span>
                    </div>
                  )}
                  {selectedConversation.handoffEmail && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Email:</span>{' '}
                      <span className="font-medium">{selectedConversation.handoffEmail}</span>
                    </div>
                  )}
                  {selectedConversation.vehicleName && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Interest:</span>{' '}
                      <span className="font-medium">{selectedConversation.vehicleName}</span>
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Messages:</span>{' '}
                    <span className="font-medium">{selectedConversation.messages?.length || 0}</span>
                  </div>
                  {selectedConversation.ghlContactId && (
                    <div className="text-sm">
                      <Badge variant="outline" className="text-xs">
                        FWC Linked
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* FWC Follow-up Actions */}
            {selectedConversation && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    FWC Follow-up
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Message Type Selector */}
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={fwcMessageType === 'sms' ? 'default' : 'outline'}
                      onClick={() => setFwcMessageType(fwcMessageType === 'sms' ? null : 'sms')}
                      className="flex-1"
                      disabled={!selectedConversation.handoffPhone}
                      title={!selectedConversation.handoffPhone ? 'No phone number available' : 'Send SMS'}
                    >
                      <Phone className="w-3 h-3 mr-1" />
                      SMS
                    </Button>
                    <Button
                      size="sm"
                      variant={fwcMessageType === 'email' ? 'default' : 'outline'}
                      onClick={() => setFwcMessageType(fwcMessageType === 'email' ? null : 'email')}
                      className="flex-1"
                      disabled={!selectedConversation.handoffEmail}
                      title={!selectedConversation.handoffEmail ? 'No email available' : 'Send Email'}
                    >
                      <Mail className="w-3 h-3 mr-1" />
                      Email
                    </Button>
                    <Button
                      size="sm"
                      variant={fwcMessageType === 'facebook' ? 'default' : 'outline'}
                      onClick={() => setFwcMessageType(fwcMessageType === 'facebook' ? null : 'facebook')}
                      className="flex-1"
                      disabled={selectedConversation.type !== 'messenger'}
                      title={selectedConversation.type !== 'messenger' ? 'Only for Facebook conversations' : 'Send Facebook Message'}
                    >
                      <Facebook className="w-3 h-3 mr-1" />
                      FB
                    </Button>
                  </div>

                  {/* Message Input */}
                  {fwcMessageType && (
                    <div className="space-y-2">
                      <textarea
                        placeholder={`Type your ${fwcMessageType === 'facebook' ? 'Facebook' : fwcMessageType.toUpperCase()} message...`}
                        value={fwcMessageText}
                        onChange={(e) => setFwcMessageText(e.target.value)}
                        className="w-full min-h-[80px] p-2 text-sm border rounded-md resize-none"
                        data-testid="fwc-message-input"
                      />
                      <div className="flex gap-2">
                        {aiSuggestion && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setFwcMessageText(aiSuggestion)}
                            className="flex-1"
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            Use AI
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={sendFwcMessage}
                          disabled={isSendingFwc || !fwcMessageText.trim() || !selectedConversation.ghlContactId}
                          className="flex-1"
                          data-testid="send-fwc-message"
                        >
                          {isSendingFwc ? (
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3 mr-1" />
                          )}
                          Send
                        </Button>
                      </div>
                      {!selectedConversation.ghlContactId && (
                        <p className="text-xs text-amber-600">
                          No FWC contact linked. Sync required.
                        </p>
                      )}
                    </div>
                  )}

                  {!fwcMessageType && (
                    <div className="text-xs text-center py-2 space-y-1">
                      <p className="text-muted-foreground">
                        Select a channel above to send follow-up
                      </p>
                      {!selectedConversation.handoffPhone && !selectedConversation.handoffEmail && selectedConversation.type === 'website_chat' && (
                        <p className="text-amber-600">
                          No contact info available. Customer needs to provide phone or email during chat.
                        </p>
                      )}
                      {selectedConversation.type === 'website_chat' && (
                        <p className="text-muted-foreground text-xs">
                          Website chats: SMS/Email enabled when customer shares contact info
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Training Mode Dialog */}
      <Dialog open={trainingDialogOpen} onOpenChange={(open) => !open && closeTrainingDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-purple-600" />
              AI Training Mode
            </DialogTitle>
          </DialogHeader>

          {selectedTrainingMessage && (
            <div className="space-y-4">
              {/* Conversation Context Preview */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Conversation Context</Label>
                <div className="max-h-32 overflow-y-auto bg-muted/50 rounded-lg p-3 space-y-2">
                  {selectedTrainingMessage.context.slice(-5).map((msg, idx) => (
                    <div key={idx} className={`text-xs ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <span className={`inline-block px-2 py-1 rounded ${
                        msg.role === 'user' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-blue-100 dark:bg-blue-900'
                      }`}>
                        <span className="font-medium">{msg.role === 'user' ? 'Customer' : 'AI'}:</span>{' '}
                        {msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Current System Prompt */}
              <div>
                <Label className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  Current System Prompt
                </Label>
                <div className="bg-muted/50 rounded-lg p-3 max-h-24 overflow-y-auto">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {currentPrompt || 'Loading prompt...'}
                  </p>
                </div>
              </div>

              {/* Editable AI Response */}
              <div>
                <Label className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  Edit AI Response
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Modify the response to show how the AI should have replied:
                </p>
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[100px]"
                  placeholder="Edit the AI response..."
                  data-testid="training-edit-input"
                />
                {editedContent !== selectedTrainingMessage.originalContent && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" />
                    Response modified - click "Get Feedback" to analyze
                  </p>
                )}
              </div>

              {/* AI Feedback Section */}
              {trainingFeedback && (
                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <Label className="text-sm font-medium mb-2 flex items-center gap-2 text-purple-700 dark:text-purple-400">
                    <Lightbulb className="w-4 h-4" />
                    AI Training Feedback
                  </Label>
                  <p className="text-sm whitespace-pre-wrap">{trainingFeedback}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2 mt-4">
            <Button variant="outline" onClick={closeTrainingDialog}>
              Close
            </Button>
            <Button 
              onClick={getTrainingFeedback}
              disabled={isLoadingFeedback || editedContent === selectedTrainingMessage?.originalContent}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isLoadingFeedback ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Get Feedback
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
