import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  Clock, 
  User, 
  Calendar,
  BarChart3, 
  Star, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  Settings,
  Plus,
  Trash2,
  Save,
  Eye
} from "lucide-react";

interface CallRecording {
  id: number;
  dealershipId: number;
  ghlCallId: string;
  ghlContactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  salespersonId: number | null;
  salespersonName: string | null;
  callType: string;
  callDirection: string;
  callDuration: number;
  recordingUrl: string | null;
  transcription: string | null;
  callStatus: string;
  startedAt: string;
  analysisStatus: string;
  overallScore: number | null;
  categoryScores: Record<string, number> | null;
  aiSummary: string | null;
  keyMoments: any[] | null;
  coachingPoints: string[] | null;
  needsReview: boolean;
  reviewedBy: number | null;
  reviewNotes: string | null;
  analyzedAt: string | null;
  createdAt: string;
}

interface AnalysisCriteria {
  id: number;
  dealershipId: number;
  name: string;
  description: string | null;
  category: string;
  weight: number;
  isActive: boolean;
  promptInstructions: string | null;
}

interface CallStats {
  totalCalls: number;
  analyzedCalls: number;
  avgScore: number;
  needsReviewCount: number;
  inboundCalls: number;
  outboundCalls: number;
  avgDuration: number;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBadgeVariant(score: number | null): "default" | "secondary" | "destructive" | "outline" {
  if (score === null) return 'outline';
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  return 'destructive';
}

function CallListItem({ call, onClick }: { call: CallRecording; onClick: () => void }) {
  return (
    <div 
      className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
      data-testid={`call-item-${call.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${call.callDirection === 'inbound' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
            {call.callDirection === 'inbound' ? <PhoneIncoming className="w-4 h-4" /> : <PhoneOutgoing className="w-4 h-4" />}
          </div>
          <div>
            <div className="font-medium">{call.contactName || call.contactPhone || 'Unknown Caller'}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-3 h-3" />
              {formatDuration(call.callDuration)}
              <span className="text-muted-foreground/50">•</span>
              {formatDate(call.startedAt)}
            </div>
            {call.salespersonName && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <User className="w-3 h-3" />
                {call.salespersonName}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {call.analysisStatus === 'completed' ? (
            <Badge variant={getScoreBadgeVariant(call.overallScore)} className="text-sm">
              {call.overallScore !== null ? `${call.overallScore}%` : 'N/A'}
            </Badge>
          ) : call.analysisStatus === 'pending' ? (
            <Badge variant="outline" className="text-sm">
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
              Analyzing
            </Badge>
          ) : (
            <Badge variant="outline" className="text-sm text-muted-foreground">
              Not Analyzed
            </Badge>
          )}
          
          {call.needsReview && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Review Needed
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function CallDetailDialog({ 
  call, 
  open, 
  onOpenChange,
  onAnalyze,
  onMarkReviewed
}: { 
  call: CallRecording | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onAnalyze: (id: number) => void;
  onMarkReviewed: (id: number, notes: string) => void;
}) {
  const [reviewNotes, setReviewNotes] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  
  if (!call) return null;
  
  const categoryScores = call.categoryScores || {};
  const keyMoments = call.keyMoments || [];
  const coachingPoints = call.coachingPoints || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {call.callDirection === 'inbound' ? <PhoneIncoming className="w-5 h-5" /> : <PhoneOutgoing className="w-5 h-5" />}
            Call with {call.contactName || call.contactPhone || 'Unknown'}
          </DialogTitle>
          <DialogDescription>
            {formatDate(call.startedAt)} • {formatDuration(call.callDuration)} • {call.salespersonName || 'Unassigned'}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="analysis" className="flex-1 overflow-hidden">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="analysis" data-testid="tab-analysis">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="transcript" data-testid="tab-transcript">
              <MessageSquare className="w-4 h-4 mr-2" />
              Transcript
            </TabsTrigger>
            <TabsTrigger value="coaching" data-testid="tab-coaching">
              <Star className="w-4 h-4 mr-2" />
              Coaching
            </TabsTrigger>
          </TabsList>
          
          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="analysis" className="m-0">
              {call.analysisStatus === 'completed' ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className={`text-4xl font-bold ${getScoreColor(call.overallScore)}`}>
                        {call.overallScore}%
                      </div>
                      <div className="text-sm text-muted-foreground">Overall Score</div>
                    </div>
                    
                    <Separator orientation="vertical" className="h-16" />
                    
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      {Object.entries(categoryScores).map(([category, score]) => (
                        <div key={category} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize">{category.replace(/_/g, ' ')}</span>
                            <span className={getScoreColor(score as number)}>{score}%</span>
                          </div>
                          <Progress value={score as number} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {call.aiSummary && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">AI Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{call.aiSummary}</p>
                      </CardContent>
                    </Card>
                  )}
                  
                  {keyMoments.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Key Moments</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {keyMoments.map((moment, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <Badge variant="outline" className="shrink-0">
                                {moment.timestamp || `${i + 1}`}
                              </Badge>
                              <span>{moment.description || moment}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : call.analysisStatus === 'pending' ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Analysis in progress...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="w-8 h-8 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">This call hasn't been analyzed yet</p>
                  <Button onClick={() => onAnalyze(call.id)} data-testid="btn-analyze-call">
                    <Play className="w-4 h-4 mr-2" />
                    Analyze Now
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="transcript" className="m-0">
              {call.transcription ? (
                <Card>
                  <CardContent className="pt-4">
                    <pre className="text-sm whitespace-pre-wrap font-sans">{call.transcription}</pre>
                  </CardContent>
                </Card>
              ) : call.recordingUrl ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Transcript not available</p>
                  <p className="text-sm text-muted-foreground mt-1">Audio recording is available for playback</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No transcript or recording available</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="coaching" className="m-0">
              <div className="space-y-6">
                {coachingPoints.length > 0 ? (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        AI Coaching Suggestions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {coachingPoints.map((point, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No coaching points available for this call
                  </div>
                )}
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Manager Review Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {call.reviewNotes ? (
                      <div className="p-3 bg-muted rounded-lg text-sm">
                        <p>{call.reviewNotes}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Reviewed by {call.reviewedBy ? `User #${call.reviewedBy}` : 'Manager'}
                        </p>
                      </div>
                    ) : null}
                    
                    {call.needsReview && (
                      <>
                        <Textarea
                          placeholder="Add your review notes here..."
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          className="min-h-[100px]"
                          data-testid="input-review-notes"
                        />
                        <Button 
                          onClick={() => onMarkReviewed(call.id, reviewNotes)}
                          data-testid="btn-mark-reviewed"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Mark as Reviewed
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function CriteriaManagementDialog({
  open,
  onOpenChange,
  criteria,
  onSave,
  onDelete
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criteria: AnalysisCriteria[];
  onSave: (criterion: Partial<AnalysisCriteria>) => void;
  onDelete: (id: number) => void;
}) {
  const [editingCriterion, setEditingCriterion] = useState<Partial<AnalysisCriteria> | null>(null);
  
  const categories = ['professionalism', 'script_adherence', 'customer_sentiment', 'lead_qualification', 'objection_handling', 'closing_skills'];
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Analysis Criteria
          </DialogTitle>
          <DialogDescription>
            Configure the criteria used to analyze and score calls
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1">
          <div className="space-y-4">
            {criteria.map((criterion) => (
              <Card key={criterion.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{criterion.name}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {criterion.category.replace(/_/g, ' ')}
                        </Badge>
                        {!criterion.isActive && (
                          <Badge variant="secondary" className="text-xs">Disabled</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{criterion.description}</p>
                      <div className="text-xs text-muted-foreground mt-2">
                        Weight: {criterion.weight}%
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditingCriterion(criterion)}
                        data-testid={`btn-edit-criterion-${criterion.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onDelete(criterion.id)}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`btn-delete-criterion-${criterion.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setEditingCriterion({ 
                name: '', 
                description: '', 
                category: 'professionalism', 
                weight: 20, 
                isActive: true,
                promptInstructions: ''
              })}
              data-testid="btn-add-criterion"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Criterion
            </Button>
          </div>
        </ScrollArea>
        
        {editingCriterion && (
          <Dialog open={!!editingCriterion} onOpenChange={() => setEditingCriterion(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCriterion.id ? 'Edit' : 'Add'} Criterion</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={editingCriterion.name || ''}
                    onChange={(e) => setEditingCriterion({ ...editingCriterion, name: e.target.value })}
                    placeholder="e.g., Greeting Quality"
                    data-testid="input-criterion-name"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select 
                    value={editingCriterion.category || 'professionalism'} 
                    onValueChange={(v) => setEditingCriterion({ ...editingCriterion, category: v })}
                  >
                    <SelectTrigger data-testid="select-criterion-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat} className="capitalize">
                          {cat.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={editingCriterion.description || ''}
                    onChange={(e) => setEditingCriterion({ ...editingCriterion, description: e.target.value })}
                    placeholder="Describe what this criterion evaluates"
                    data-testid="input-criterion-description"
                  />
                </div>
                <div>
                  <Label>Weight (%)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={editingCriterion.weight || 20}
                    onChange={(e) => setEditingCriterion({ ...editingCriterion, weight: parseInt(e.target.value) || 20 })}
                    data-testid="input-criterion-weight"
                  />
                </div>
                <div>
                  <Label>AI Prompt Instructions (Optional)</Label>
                  <Textarea
                    value={editingCriterion.promptInstructions || ''}
                    onChange={(e) => setEditingCriterion({ ...editingCriterion, promptInstructions: e.target.value })}
                    placeholder="Custom instructions for the AI when evaluating this criterion"
                    className="min-h-[80px]"
                    data-testid="input-criterion-prompt"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditingCriterion(null)}>
                    Cancel
                  </Button>
                  <Button onClick={() => { onSave(editingCriterion); setEditingCriterion(null); }} data-testid="btn-save-criterion">
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CallAnalysis() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [calls, setCalls] = useState<CallRecording[]>([]);
  const [criteria, setCriteria] = useState<AnalysisCriteria[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<CallRecording | null>(null);
  const [showCriteriaDialog, setShowCriteriaDialog] = useState(false);
  
  const [filters, setFilters] = useState({
    salespersonId: '',
    startDate: '',
    endDate: '',
    analysisStatus: '',
    needsReview: '',
    minScore: '',
    maxScore: ''
  });
  
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0
  });
  
  const token = localStorage.getItem('auth_token');
  
  const fetchCalls = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.salespersonId) params.append('salespersonId', filters.salespersonId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.analysisStatus) params.append('analysisStatus', filters.analysisStatus);
      if (filters.needsReview) params.append('needsReview', filters.needsReview);
      if (filters.minScore) params.append('minScore', filters.minScore);
      if (filters.maxScore) params.append('maxScore', filters.maxScore);
      params.append('limit', pagination.limit.toString());
      params.append('offset', pagination.offset.toString());
      
      const response = await fetch(`/api/call-recordings?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 401 || response.status === 403) {
        setLocation('/login');
        return;
      }
      
      if (!response.ok) throw new Error('Failed to fetch calls');
      
      const data = await response.json();
      setCalls(data.calls || []);
      setPagination(prev => ({ ...prev, total: data.total || 0 }));
    } catch (error) {
      console.error('Error fetching calls:', error);
      toast({
        title: "Error",
        description: "Failed to load call recordings",
        variant: "destructive"
      });
    }
  };
  
  const fetchCriteria = async () => {
    try {
      const response = await fetch('/api/call-analysis-criteria', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCriteria(data);
      }
    } catch (error) {
      console.error('Error fetching criteria:', error);
    }
  };
  
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/call-recordings/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };
  
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchCalls(), fetchCriteria(), fetchStats()]);
      setIsLoading(false);
    };
    loadData();
  }, []);
  
  useEffect(() => {
    fetchCalls();
  }, [filters, pagination.offset]);
  
  const handleAnalyzeCall = async (callId: number) => {
    try {
      const response = await fetch(`/api/call-recordings/${callId}/analyze`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to analyze call');
      
      toast({
        title: "Analysis Started",
        description: "The call is being analyzed. This may take a moment."
      });
      
      setTimeout(fetchCalls, 5000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start call analysis",
        variant: "destructive"
      });
    }
  };
  
  const handleMarkReviewed = async (callId: number, notes: string) => {
    try {
      const response = await fetch(`/api/call-recordings/${callId}/review`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes })
      });
      
      if (!response.ok) throw new Error('Failed to mark as reviewed');
      
      toast({
        title: "Marked as Reviewed",
        description: "The call has been marked as reviewed"
      });
      
      setSelectedCall(null);
      fetchCalls();
      fetchStats();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark call as reviewed",
        variant: "destructive"
      });
    }
  };
  
  const handleSaveCriterion = async (criterion: Partial<AnalysisCriteria>) => {
    try {
      const method = criterion.id ? 'PATCH' : 'POST';
      const url = criterion.id 
        ? `/api/call-analysis-criteria/${criterion.id}` 
        : '/api/call-analysis-criteria';
      
      const response = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(criterion)
      });
      
      if (!response.ok) throw new Error('Failed to save criterion');
      
      toast({
        title: "Saved",
        description: "Analysis criterion has been saved"
      });
      
      fetchCriteria();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save criterion",
        variant: "destructive"
      });
    }
  };
  
  const handleDeleteCriterion = async (id: number) => {
    try {
      const response = await fetch(`/api/call-analysis-criteria/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to delete criterion');
      
      toast({
        title: "Deleted",
        description: "Analysis criterion has been deleted"
      });
      
      fetchCriteria();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete criterion",
        variant: "destructive"
      });
    }
  };
  
  const clearFilters = () => {
    setFilters({
      salespersonId: '',
      startDate: '',
      endDate: '',
      analysisStatus: '',
      needsReview: '',
      minScore: '',
      maxScore: ''
    });
    setPagination(prev => ({ ...prev, offset: 0 }));
  };
  
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  
  return (
    <div className="min-h-screen bg-background" data-testid="call-analysis-page">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Call Analysis</h1>
            <p className="text-muted-foreground">AI-powered insights from your team's phone calls</p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowCriteriaDialog(true)}
              data-testid="btn-manage-criteria"
            >
              <Settings className="w-4 h-4 mr-2" />
              Criteria
            </Button>
            <Button 
              onClick={() => { fetchCalls(); fetchStats(); }}
              data-testid="btn-refresh-calls"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
        
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Calls</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stats.totalCalls}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Analyzed</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stats.analyzedCalls}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Avg Score</span>
                </div>
                <div className={`text-2xl font-bold mt-1 ${getScoreColor(stats.avgScore)}`}>
                  {stats.avgScore > 0 ? `${stats.avgScore}%` : '-'}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Needs Review</span>
                </div>
                <div className="text-2xl font-bold mt-1 text-red-600">{stats.needsReviewCount}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <PhoneIncoming className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Inbound</span>
                </div>
                <div className="text-2xl font-bold mt-1">{stats.inboundCalls}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Avg Duration</span>
                </div>
                <div className="text-2xl font-bold mt-1">{formatDuration(stats.avgDuration)}</div>
              </CardContent>
            </Card>
          </div>
        )}
        
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">Status</Label>
                <Select value={filters.analysisStatus} onValueChange={(v) => setFilters({ ...filters, analysisStatus: v })}>
                  <SelectTrigger data-testid="filter-status">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    <SelectItem value="completed">Analyzed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="none">Not Analyzed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">Review Status</Label>
                <Select value={filters.needsReview} onValueChange={(v) => setFilters({ ...filters, needsReview: v })}>
                  <SelectTrigger data-testid="filter-review">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    <SelectItem value="true">Needs Review</SelectItem>
                    <SelectItem value="false">Reviewed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1 min-w-[120px]">
                <Label className="text-xs">Min Score</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0"
                  value={filters.minScore}
                  onChange={(e) => setFilters({ ...filters, minScore: e.target.value })}
                  data-testid="filter-min-score"
                />
              </div>
              
              <div className="flex-1 min-w-[120px]">
                <Label className="text-xs">Max Score</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="100"
                  value={filters.maxScore}
                  onChange={(e) => setFilters({ ...filters, maxScore: e.target.value })}
                  data-testid="filter-max-score"
                />
              </div>
              
              <div className="flex-1 min-w-[140px]">
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  data-testid="filter-start-date"
                />
              </div>
              
              <div className="flex-1 min-w-[140px]">
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  data-testid="filter-end-date"
                />
              </div>
              
              <Button variant="outline" onClick={clearFilters} data-testid="btn-clear-filters">
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : calls.length > 0 ? (
          <>
            <div className="space-y-3">
              {calls.map((call) => (
                <CallListItem 
                  key={call.id} 
                  call={call} 
                  onClick={() => setSelectedCall(call)} 
                />
              ))}
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Showing {pagination.offset + 1}-{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset - prev.limit }))}
                    data-testid="btn-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                    data-testid="btn-next-page"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Call Recordings Found</h3>
              <p className="text-muted-foreground mb-4">
                Call recordings from GoHighLevel will appear here once configured.
              </p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Set up your GHL integration to automatically capture and analyze sales calls.
                Configure tracking numbers and enable call recording in your GHL account.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
      
      <CallDetailDialog
        call={selectedCall}
        open={!!selectedCall}
        onOpenChange={(open) => !open && setSelectedCall(null)}
        onAnalyze={handleAnalyzeCall}
        onMarkReviewed={handleMarkReviewed}
      />
      
      <CriteriaManagementDialog
        open={showCriteriaDialog}
        onOpenChange={setShowCriteriaDialog}
        criteria={criteria}
        onSave={handleSaveCriterion}
        onDelete={handleDeleteCriterion}
      />
    </div>
  );
}
