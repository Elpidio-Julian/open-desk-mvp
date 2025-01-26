import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowUpDown } from 'lucide-react';
import { ticketsService } from '../../services/api/tickets';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const MARKDOWN_TIPS = `
### Markdown Tips:
- **Bold** text: \`**text**\`
- *Italic* text: \`*text*\`
- Lists: Start lines with \`-\` or \`1.\`
- [Links](url): \`[text](url)\`
- \`Code\`: \`\`\`code\`\`\`
- > Quotes: Start lines with \`>\`
`.trim();

const TICKET_VIEWS = {
  ALL: 'all',
  UNASSIGNED: 'unassigned',
  MY_TICKETS: 'my_tickets',
  URGENT: 'urgent',
};

const TICKET_FILTERS = {
  STATUS: ['all', 'new', 'open', 'pending', 'waiting_on_customer', 'resolved', 'closed', 'archived'],
  PRIORITY: ['all', 'low', 'medium', 'high', 'urgent']
};

const TICKET_TABS = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
};

const SupportQueue = ({
  isWidget = false,
  maxHeight,
  onClose,
  defaultView = TICKET_VIEWS.ALL,
  hideViewSelector = false
}) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [currentView, setCurrentView] = useState(defaultView);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetails, setTicketDetails] = useState(null);
  const [ticketComments, setTicketComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [showMarkdownTips, setShowMarkdownTips] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedComments, setExpandedComments] = useState(false);
  const [sorting, setSorting] = useState({ field: null, direction: 'asc' });
  const [currentTab, setCurrentTab] = useState(TICKET_TABS.ACTIVE);
  
  const INITIAL_COMMENTS_TO_SHOW = 3;

  useEffect(() => {
    fetchTickets();
  }, [currentView, statusFilter, priorityFilter]);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await ticketsService.getTickets({
        view: currentView,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        userId: currentView === TICKET_VIEWS.MY_TICKETS ? user.id : undefined
      });
      
      if (error) throw error;
      setTickets(data);
    } catch (error) {
      setAlert({ type: 'error', message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (field) => {
    setSorting(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getFilteredTickets = () => {
    let filtered = [...tickets];

    // First apply tab filtering
    if (currentTab === TICKET_TABS.ACTIVE) {
      filtered = filtered.filter(ticket => !['resolved', 'closed'].includes(ticket.status));
    } else if (currentTab === TICKET_TABS.RESOLVED) {
      filtered = filtered.filter(ticket => ticket.status === 'resolved');
    } else if (currentTab === TICKET_TABS.CLOSED) {
      filtered = filtered.filter(ticket => ticket.status === 'closed');
    }

    // Then apply status filter if it's not 'all'
    if (statusFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.status === statusFilter);
    }

    // Apply priority filter if it's not 'all'
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.priority === priorityFilter);
    }

    // Apply search filter if there's a search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ticket => 
        ticket.title.toLowerCase().includes(query) ||
        ticket.creator?.full_name?.toLowerCase().includes(query) ||
        ticket.creator?.email?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const getSortedTickets = () => {
    if (!sorting.field) return getFilteredTickets();

    return [...getFilteredTickets()].sort((a, b) => {
      let aValue = a[sorting.field];
      let bValue = b[sorting.field];

      // Handle nested fields
      if (sorting.field === 'creator') {
        aValue = a.creator?.full_name || a.creator?.email;
        bValue = b.creator?.full_name || b.creator?.email;
      } else if (sorting.field === 'assigned_agent') {
        aValue = a.assigned_agent_id ? 'Assigned' : 'Unassigned';
        bValue = b.assigned_agent_id ? 'Assigned' : 'Unassigned';
      }

      if (aValue === bValue) return 0;
      if (sorting.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = tickets.map(ticket => ticket.id);
      setSelectedTickets(new Set(allIds));
    } else {
      setSelectedTickets(new Set());
    }
  };

  const handleAssignTicket = async (ticketId) => {
    try {
      const { error } = await ticketsService.bulkAssign([ticketId], user.id);
      if (error) throw error;
      await fetchTickets();
      setAlert({ type: 'success', message: 'Ticket assigned successfully' });
    } catch (error) {
      setAlert({ type: 'error', message: error.message });
    }
  };

  const handleBulkAssign = async () => {
    try {
      const { error } = await ticketsService.bulkAssign(Array.from(selectedTickets), user.id);
      if (error) throw error;
      setSelectedTickets(new Set());
      await fetchTickets();
      setAlert({ type: 'success', message: 'Tickets assigned successfully' });
    } catch (error) {
      setAlert({ type: 'error', message: error.message });
    }
  };

  const handleStatusUpdate = async (ticketId, newStatus) => {
    try {
      const { error } = await ticketsService.updateTicket(ticketId, { status: newStatus });
      if (error) throw error;
      await fetchTickets();
      setAlert({ type: 'success', message: 'Status updated successfully' });
    } catch (error) {
      setAlert({ type: 'error', message: error.message });
    }
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    try {
      const { error } = await ticketsService.bulkUpdateStatus(Array.from(selectedTickets), newStatus);
      if (error) throw error;
      setSelectedTickets(new Set());
      await fetchTickets();
      setAlert({ type: 'success', message: 'Statuses updated successfully' });
    } catch (error) {
      setAlert({ type: 'error', message: error.message });
    }
  };

  const handleAddComment = async (ticketId, content, isInternal) => {
    setIsSubmittingComment(true);
    try {
      const { error } = await ticketsService.addComment(ticketId, user.id, content, isInternal);
      if (error) throw error;
      
      // Clear the comment field and show success message
      setNewComment('');
      setAlert({ 
        type: 'success', 
        message: `${isInternal ? 'Internal note' : 'Response'} sent successfully` 
      });
      
      // Refresh ticket data
      await fetchTicketDetails(ticketId);
      await fetchTickets();
    } catch (error) {
      setAlert({ 
        type: 'error', 
        message: `Failed to send ${isInternal ? 'internal note' : 'response'}: ${error.message}` 
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const fetchTicketDetails = async (ticketId) => {
    try {
      const [ticketResponse, commentsResponse] = await Promise.all([
        ticketsService.getTicketDetails(ticketId),
        ticketsService.getStaffComments(ticketId)
      ]);

      if (ticketResponse.error) throw ticketResponse.error;
      if (commentsResponse.error) throw commentsResponse.error;

      setTicketDetails(ticketResponse.data);
      setTicketComments(commentsResponse.data);

      // Get customer history
      const { data: history, error: historyError } = await ticketsService.getCustomerHistory(ticketResponse.data.creator_id);
      if (historyError) throw historyError;
      setCustomerHistory(history || []);
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to fetch ticket details: ' + error.message,
      });
    }
  };

  const handleTicketClick = async (ticket) => {
    setSelectedTicket(ticket);
    setIsDetailsModalOpen(true);
    await fetchTicketDetails(ticket.id);
  };

  const handleUpdateTicket = async (updates) => {
    try {
      const { error } = await ticketsService.updateTicket(selectedTicket.id, updates);
      if (error) throw error;

      await fetchTicketDetails(selectedTicket.id);
      await fetchTickets();

      setAlert({
        type: 'success',
        message: 'Ticket updated successfully',
      });
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to update ticket: ' + error.message,
      });
    }
  };

  const containerStyle = {
    maxHeight: maxHeight || 'auto',
    overflow: 'auto',
    ...(isWidget && {
      border: '1px solid hsl(var(--border))',
      borderRadius: 'calc(var(--radius) * 1.5)',
    }),
  };

  return (
    <div className="px-4 py-8" style={containerStyle}>
      {alert && (
        <Alert variant={alert.type === 'error' ? 'destructive' : 'default'} className="mb-4">
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {currentView === TICKET_VIEWS.MY_TICKETS ? 'My Tickets' : 'Support Queue'}
          </h1>
          <div className="flex items-center gap-4">
            <Input
              type="search"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
            {isWidget && onClose && (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList>
            <TabsTrigger value={TICKET_TABS.ACTIVE}>Active Tickets</TabsTrigger>
            <TabsTrigger value={TICKET_TABS.RESOLVED}>Resolved</TabsTrigger>
            <TabsTrigger value={TICKET_TABS.CLOSED}>Closed</TabsTrigger>
          </TabsList>
        </Tabs>

        {!hideViewSelector && (
          <div className="flex flex-wrap gap-4">
            <div className="flex">
              {Object.entries(TICKET_VIEWS).map(([key, value]) => (
                <Button
                  key={key}
                  variant={currentView === value ? 'default' : 'outline'}
                  onClick={() => setCurrentView(value)}
                  className="first:rounded-l-lg last:rounded-r-lg rounded-none"
                >
                  {key.replace('_', ' ')}
                </Button>
              ))}
            </div>

            {currentTab === TICKET_TABS.ACTIVE && (
              <>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_FILTERS.STATUS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === 'all' ? 'All Statuses' : status.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_FILTERS.PRIORITY.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority === 'all' ? 'All Priorities' : priority}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        )}

        {selectedTickets.size > 0 && (
          <div className="flex items-center gap-4 bg-muted p-4 rounded-lg">
            <span className="text-sm text-muted-foreground">
              {selectedTickets.size} tickets selected
            </span>
            {currentTab === TICKET_TABS.ACTIVE && (
              <Button variant="secondary" onClick={handleBulkAssign}>
                Assign to Me
              </Button>
            )}
            <Select onValueChange={handleBulkStatusUpdate}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Update Status" />
              </SelectTrigger>
              <SelectContent>
                {currentTab === TICKET_TABS.ACTIVE && 
                  TICKET_FILTERS.STATUS
                    .filter(s => !['all', 'resolved', 'closed'].includes(s))
                    .map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace('_', ' ')}
                      </SelectItem>
                    ))
                }
                {currentTab === TICKET_TABS.RESOLVED && (
                  <>
                    <SelectItem value="open">Reopen</SelectItem>
                    <SelectItem value="closed">Close</SelectItem>
                  </>
                )}
                {currentTab === TICKET_TABS.CLOSED && (
                  <SelectItem value="open">Reopen</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedTickets.size === tickets.length}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('priority')}
                    className="flex items-center gap-1"
                  >
                    Priority
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('title')}
                    className="flex items-center gap-1"
                  >
                    Title
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('creator')}
                    className="flex items-center gap-1"
                  >
                    Customer
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('assigned_agent')}
                    className="flex items-center gap-1"
                  >
                    Assigned To
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('status')}
                    className="flex items-center gap-1"
                  >
                    Status
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('created_at')}
                    className="flex items-center gap-1"
                  >
                    Created
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getSortedTickets().map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="cursor-pointer"
                  onClick={() => handleTicketClick(ticket)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedTickets.has(ticket.id)}
                      onCheckedChange={(checked) => {
                        const newSelected = new Set(selectedTickets);
                        if (checked) {
                          newSelected.add(ticket.id);
                        } else {
                          newSelected.delete(ticket.id);
                        }
                        setSelectedTickets(newSelected);
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        ticket.priority === 'urgent' ? 'destructive' :
                        ticket.priority === 'high' ? 'orange' :
                        ticket.priority === 'medium' ? 'yellow' :
                        'green'
                      }
                    >
                      {ticket.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>{ticket.title}</TableCell>
                  <TableCell>
                    {ticket.creator?.full_name || ticket.creator?.email}
                  </TableCell>
                  <TableCell>
                    {ticket.assigned_agent_id ? 'Assigned' : 'Unassigned'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(ticket.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {ticket.comments?.[0]?.count || 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedTicket && ticketDetails && (
        <Dialog open={isDetailsModalOpen} onOpenChange={() => {
          setIsDetailsModalOpen(false);
          setSelectedTicket(null);
          setTicketDetails(null);
          setTicketComments([]);
          setShowPreview(false);
          setShowHistory(false);
        }}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{ticketDetails?.title || 'Ticket Details'}</DialogTitle>
              <DialogDescription>
                Ticket #{ticketDetails.id}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Status</Label>
                    <div className="col-span-3">
                      <Select
                        value={ticketDetails.status}
                        onValueChange={(value) => handleUpdateTicket({ status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_FILTERS.STATUS.filter(s => s !== 'all').map((status) => (
                            <SelectItem key={status} value={status}>
                              {status.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Priority</Label>
                    <div className="col-span-3">
                      <Select
                        value={ticketDetails.priority}
                        onValueChange={(value) => handleUpdateTicket({ priority: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_FILTERS.PRIORITY.filter(p => p !== 'all').map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {priority}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Assignment</Label>
                    <div className="col-span-3">
                      <Button
                        variant={ticketDetails.assigned_agent_id === user.id ? "secondary" : "primary"}
                        onClick={() => handleUpdateTicket({ 
                          assigned_agent_id: ticketDetails.assigned_agent_id === user.id ? null : user.id 
                        })}
                      >
                        {ticketDetails.assigned_agent_id === user.id ? "Unassign" : "Assign to Me"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Customer</Label>
                    <div className="col-span-3">
                      <p className="text-sm">{ticketDetails.creator?.full_name || ticketDetails.creator?.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Created</Label>
                    <div className="col-span-3">
                      <p className="text-sm">{new Date(ticketDetails.created_at).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right pt-2">Description</Label>
                    <div className="col-span-3 prose prose-sm max-w-none bg-muted p-3 rounded-md">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {ticketDetails.description}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Comments & Notes</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHistory(!showHistory)}
                    >
                      {showHistory ? 'Hide History' : 'Show History'}
                    </Button>
                  </div>

                  {showHistory && customerHistory.length > 0 && (
                    <div className="border rounded-md p-4 bg-muted/50">
                      <h4 className="font-medium mb-2">Customer History</h4>
                      <div className="space-y-2">
                        {customerHistory.map((ticket) => (
                          <div
                            key={ticket.id}
                            className="text-sm p-2 rounded bg-background cursor-pointer hover:bg-accent"
                            onClick={() => handleTicketClick(ticket)}
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-medium">{ticket.title}</span>
                              <Badge variant="outline">{ticket.status.replace(/_/g, ' ')}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Created: {new Date(ticket.created_at).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {ticketComments.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">No comments yet</p>
                    ) : (
                      <>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                          {(expandedComments ? ticketComments : ticketComments.slice(-INITIAL_COMMENTS_TO_SHOW)).map((comment) => (
                            <div
                              key={comment.id}
                              className={`p-4 rounded-lg ${
                                comment.is_internal ? 'bg-yellow-50' : 'bg-muted'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-sm font-medium">
                                    {comment.user_id === ticketDetails.creator_id ? (
                                      comment.user?.full_name || comment.user?.email
                                    ) : (
                                      <span className="text-primary">
                                        (Support Agent) {comment.user?.full_name || comment.user?.email || 'Support Team'}
                                      </span>
                                    )}
                                  </span>
                                  {comment.is_internal && (
                                    <Badge variant="warning" className="ml-2">
                                      Internal Note
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(comment.created_at).toLocaleString()}
                                </span>
                              </div>
                              <div className="mt-1 prose prose-sm max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {comment.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ))}
                        </div>
                        {ticketComments.length > INITIAL_COMMENTS_TO_SHOW && (
                          <div className="text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedComments(!expandedComments)}
                            >
                              {expandedComments ? 'Show Less' : `Show ${ticketComments.length - INITIAL_COMMENTS_TO_SHOW} More Comments`}
                            </Button>
                          </div>
                        )}
                      </>
                    )}

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <h4 className="font-medium">Add Response</h4>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="internal"
                              checked={isInternalNote}
                              onCheckedChange={setIsInternalNote}
                            />
                            <Label htmlFor="internal">Internal Note</Label>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowMarkdownTips(!showMarkdownTips)}
                          >
                            {showMarkdownTips ? 'Hide Formatting Help' : 'Formatting Help'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowPreview(!showPreview)}
                          >
                            {showPreview ? 'Edit' : 'Preview'}
                          </Button>
                        </div>
                      </div>

                      {showMarkdownTips && (
                        <div className="p-4 bg-muted rounded-lg text-sm prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {MARKDOWN_TIPS}
                          </ReactMarkdown>
                        </div>
                      )}

                      {showPreview ? (
                        <div className="min-h-[200px] p-4 bg-muted rounded-lg prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {newComment || '*No content yet*'}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder={`Write your ${isInternalNote ? 'internal note' : 'response'}... (Markdown supported)`}
                          className="w-full min-h-[200px] p-3 rounded-md border bg-background"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsDetailsModalOpen(false)}>
                Close
              </Button>
              <Button
                onClick={() => handleAddComment(selectedTicket.id, newComment, isInternalNote)}
                disabled={!newComment.trim() || isSubmittingComment}
              >
                {isSubmittingComment ? 'Sending...' : isInternalNote ? 'Add Note' : 'Send Response'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default SupportQueue; 