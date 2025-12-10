import { useState, useMemo, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  MessageCircle,
  Search,
  Send,
  MoreVertical,
  Archive,
  UserPlus,
  Clock,
  CheckCheck,
  Filter,
  Facebook,
  Inbox,
  Users,
  Loader2,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type Conversation = {
  id: number;
  participantName: string;
  participantId: string;
  pageName: string;
  pageId: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  status: string;
  ownerName?: string;
  assignedTo?: {
    id: number;
    name: string;
  };
};

type Message = {
  id: number;
  content: string;
  isFromCustomer: boolean;
  senderName: string;
  sentAt: string;
  isRead: boolean;
  attachmentType?: string;
  attachmentUrl?: string;
};

type SalesPerson = {
  id: number;
  name: string;
  role: string;
};

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return format(date, "h:mm a");
  } else if (isYesterday(date)) {
    return "Yesterday";
  }
  return format(date, "MMM d");
}

function ConversationList({
  conversations,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  isManager,
  isLoading,
}: {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filter: string;
  onFilterChange: (f: string) => void;
  isManager: boolean;
  isLoading: boolean;
}) {
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchesSearch =
        c.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (filter === "unread") return matchesSearch && c.unreadCount > 0;
      if (filter === "unassigned") return matchesSearch && !c.assignedTo;
      return matchesSearch;
    });
  }, [conversations, searchQuery, filter]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="w-5 h-5 text-[#022d60]" />
          <h2 className="font-semibold text-lg">Inbox</h2>
          {totalUnread > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {totalUnread}
            </Badge>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            data-testid="input-search-conversations"
          />
        </div>
        <div className="flex gap-2 mt-3">
          <Select value={filter} onValueChange={onFilterChange}>
            <SelectTrigger className="w-full" data-testid="select-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Messages</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              {isManager && <SelectItem value="unassigned">Unassigned</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-6 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No conversations found</p>
            <p className="text-sm mt-1">Messages from Facebook Marketplace will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={`w-full p-4 text-left hover:bg-accent/50 transition-colors ${
                  selectedId === conversation.id ? "bg-accent" : ""
                }`}
                data-testid={`conversation-item-${conversation.id}`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarFallback className="bg-[#022d60] text-white text-sm">
                      {conversation.participantName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`font-medium truncate ${
                          conversation.unreadCount > 0 ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {conversation.participantName}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {conversation.lastMessageAt &&
                          formatMessageTime(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Facebook className="w-3 h-3" />
                      <span className="truncate">{conversation.pageName}</span>
                    </div>
                    <p
                      className={`text-sm truncate ${
                        conversation.unreadCount > 0
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {conversation.lastMessage || "No messages yet"}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {conversation.assignedTo && (
                        <Badge variant="outline" className="text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          {conversation.assignedTo.name}
                        </Badge>
                      )}
                      {conversation.unreadCount > 0 && (
                        <Badge className="bg-[#00aad2] text-white text-xs">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function MessageThread({
  conversation,
  messages,
  onSendMessage,
  onAssign,
  salespeople,
  isManager,
  isLoadingMessages,
  isSending,
}: {
  conversation: Conversation;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onAssign: (salespersonId: number) => void;
  salespeople: SalesPerson[];
  isManager: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
}) {
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (newMessage.trim() && !isSending) {
      onSendMessage(newMessage.trim());
      setNewMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border bg-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-[#022d60] text-white">
              {conversation.participantName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{conversation.participantName}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Facebook className="w-3 h-3" />
              <span>{conversation.pageName}</span>
              {conversation.assignedTo && (
                <>
                  <span>•</span>
                  <Users className="w-3 h-3" />
                  <span>{conversation.assignedTo.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-assign">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Assign
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {salespeople.map((sp) => (
                  <DropdownMenuItem
                    key={sp.id}
                    onClick={() => onAssign(sp.id)}
                    data-testid={`assign-to-${sp.id}`}
                  >
                    {sp.name}
                    {conversation.assignedTo?.id === sp.id && (
                      <CheckCheck className="w-4 h-4 ml-2 text-green-500" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4 bg-muted/30">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground p-8">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No messages in this conversation yet</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isFromCustomer ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    message.isFromCustomer
                      ? "bg-card border border-border rounded-tl-sm"
                      : "bg-[#022d60] text-white rounded-tr-sm"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <div
                    className={`flex items-center gap-1 mt-1 text-xs ${
                      message.isFromCustomer ? "text-muted-foreground" : "text-white/70"
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>{format(new Date(message.sentAt), "h:mm a")}</span>
                    {!message.isFromCustomer && message.isRead && (
                      <CheckCheck className="w-3 h-3 ml-1" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Input
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
            disabled={isSending}
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
            className="bg-[#022d60] hover:bg-[#022d60]/90"
            data-testid="button-send"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-muted/30">
      <div className="text-center p-8">
        <div className="w-20 h-20 rounded-full bg-[#022d60]/10 flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="w-10 h-10 text-[#022d60]" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
        <p className="text-muted-foreground max-w-sm">
          Choose a conversation from the list to view messages and respond to leads from Facebook
          Marketplace.
        </p>
      </div>
    </div>
  );
}

export default function SalesConversations() {
  const [, setLocation] = useLocation();
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      setLocation('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      
      if (!['salesperson', 'manager', 'admin', 'master', 'super_admin'].includes(parsedUser.role)) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page",
          variant: "destructive",
        });
        setLocation('/');
        return;
      }

      setUser(parsedUser);
    } catch (error) {
      console.error("Auth check failed:", error);
      setLocation('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'master' || user?.role === 'super_admin';

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ['messenger-conversations'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/messenger-conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: salespeople = [] } = useQuery<SalesPerson[]>({
    queryKey: ['salespeople'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/salespeople', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user && isManager,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['messenger-messages', selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return [];
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/messenger-conversations/${selectedConversationId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!user && !!selectedConversationId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/messenger-conversations/${selectedConversationId}/reply`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messenger-messages', selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['messenger-conversations'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (assignedToUserId: number) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/messenger-conversations/${selectedConversationId}/assign`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ assignedToUserId }),
      });
      if (!response.ok) throw new Error('Failed to assign conversation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messenger-conversations'] });
      toast({ title: "Conversation assigned successfully" });
    },
    onError: () => {
      toast({
        title: "Failed to assign conversation",
        variant: "destructive",
      });
    },
  });

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

  const stats = useMemo(() => {
    const unread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    const unassigned = conversations.filter((c) => !c.assignedTo).length;
    const active = conversations.filter((c) => c.status === "active").length;
    return { unread, unassigned, active };
  }, [conversations]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col">
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 max-w-[1800px] flex items-center justify-between">
          <Link
            href="/sales"
            className="flex items-center gap-2 text-[#022d60] hover:text-[#00aad2] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="font-medium">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Unread:</span>
                <Badge variant={stats.unread > 0 ? "destructive" : "secondary"}>
                  {stats.unread}
                </Badge>
              </div>
              {isManager && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Unassigned:</span>
                  <Badge variant={stats.unassigned > 0 ? "default" : "secondary"}>
                    {stats.unassigned}
                  </Badge>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Active:</span>
                <Badge variant="secondary">{stats.active}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-[#022d60]" />
              <span className="font-bold text-[#022d60]">Conversations</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-full md:w-[380px] lg:w-[420px] flex-shrink-0">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversationId}
            onSelect={setSelectedConversationId}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filter={filter}
            onFilterChange={setFilter}
            isManager={isManager}
            isLoading={conversationsLoading}
          />
        </div>

        <div className="hidden md:flex flex-1 flex-col">
          {selectedConversation ? (
            <MessageThread
              conversation={selectedConversation}
              messages={messages}
              onSendMessage={(content) => sendMessageMutation.mutate(content)}
              onAssign={(id) => assignMutation.mutate(id)}
              salespeople={salespeople}
              isManager={isManager}
              isLoadingMessages={messagesLoading}
              isSending={sendMessageMutation.isPending}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}
