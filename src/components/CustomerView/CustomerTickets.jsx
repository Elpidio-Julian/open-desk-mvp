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
} from "../ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { customersService } from '../../services/api/customers';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Label } from "../ui/label";
import { ChevronDown, ChevronUp } from "lucide-react";

const MARKDOWN_TIPS = `
### Markdown Tips:
- **Bold** text: \`**text**\`
- *Italic* text: \`*text*\`
- Lists: Start lines with \`-\` or \`1.\`
- [Links](url): \`[text](url)\`
- \`Code\`: \`\`\`code\`\`\`
- > Quotes: Start lines with \`>\`
`.trim();

const CustomerTickets = ({ isWidget = false, maxHeight, onClose }) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [isTicketDetailsModalOpen, setIsTicketDetailsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketComments, setTicketComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'low',
    custom_fields: {}
  });
  const [alert, setAlert] = useState(null);
  const [showMarkdownTips, setShowMarkdownTips] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedComments, setExpandedComments] = useState(false);
  const INITIAL_COMMENTS_TO_SHOW = 3;
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedback, setFeedback] = useState({ rating: '5', comment: '' });
  const [showClosedTickets, setShowClosedTickets] = useState(false);
  const [issueCategories, setIssueCategories] = useState([]);
  const [isCategoryEnabled, setIsCategoryEnabled] = useState(false);
  const [filters, setFilters] = useState({
    title: '',
    status: '',
    category: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  useEffect(() => {
    fetchTickets();
    if (isNewTicketModalOpen) {
      checkIssueCategories();
    }
  }, [isNewTicketModalOpen]);

  const fetchTickets = async () => {
    try {
      const { data, error } = await customersService.getTickets(user.id);
      if (error) throw error;
      setTickets(data);
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to fetch tickets: ' + error.message,
      });
    }
  };

  const fetchTicketDetails = async (ticketId) => {
    try {
      const [ticketResponse, commentsResponse] = await Promise.all([
        customersService.getTicketDetails(ticketId, user.id),
        customersService.getTicketComments(ticketId)
      ]);

      if (ticketResponse.error) throw ticketResponse.error;
      if (commentsResponse.error) throw commentsResponse.error;

      setSelectedTicket(ticketResponse.data);
      setTicketComments(commentsResponse.data);
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to fetch ticket details: ' + error.message,
      });
    }
  };

  const handleTicketClick = async (ticket) => {
    setSelectedTicket(ticket);
    setIsTicketDetailsModalOpen(true);
    await fetchTicketDetails(ticket.id);
  };

  const checkIssueCategories = async () => {
    const enabled = await customersService.isIssueCategoryEnabled();
    setIsCategoryEnabled(enabled);
    if (enabled) {
      const categories = await customersService.getIssueCategories();
      setIssueCategories(categories);
    }
  };

  const handleCreateTicket = async () => {
    try {
      if (isCategoryEnabled && !newTicket.custom_fields['Issue Category']) {
        setAlert({
          type: 'error',
          message: 'Please select an issue category'
        });
        return;
      }

      const { data, error } = await customersService.createTicket({
        title: newTicket.title,
        description: newTicket.description,
        priority: newTicket.priority,
        created_by: user.id,
        custom_fields: newTicket.custom_fields
      });

      if (error) throw new Error(error);

      setAlert({
        type: 'success',
        message: 'Ticket created successfully!'
      });
      setIsNewTicketModalOpen(false);
      setNewTicket({
        title: '',
        description: '',
        priority: 'low',
        custom_fields: {}
      });
      fetchTickets();
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to create ticket: ' + error.message
      });
    }
  };

  const handleCreateComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const { error } = await customersService.addComment(
        selectedTicket.id,
        user.id,
        newComment.trim()
      );

      if (error) throw error;
      await fetchTicketDetails(selectedTicket.id);
      setNewComment('');
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to add comment: ' + error.message,
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleResolveTicket = async () => {
    try {
      const { error } = await customersService.updateTicket(selectedTicket.id, {
        status: 'resolved'
      });

      if (error) throw error;

      setAlert({
        type: 'success',
        message: 'Ticket resolved successfully!'
      });
      
      // Update the selected ticket locally
      setSelectedTicket({
        ...selectedTicket,
        status: 'resolved'
      });
      
      // Refresh tickets list
      fetchTickets();
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to resolve ticket: ' + error.message
      });
    }
  };

  const handleSubmitFeedback = async () => {
    try {
      // Update ticket status to closed
      const { error: updateError } = await customersService.updateTicket(selectedTicket.id, {
        status: 'closed',
        feedback_rating: parseInt(feedback.rating),
        feedback_comment: feedback.comment
      });

      if (updateError) throw updateError;

      setAlert({
        type: 'success',
        message: 'Thank you for your feedback!'
      });
      
      // Update the selected ticket locally
      setSelectedTicket({
        ...selectedTicket,
        status: 'closed',
        feedback_rating: parseInt(feedback.rating),
        feedback_comment: feedback.comment
      });
      
      // Reset feedback form
      setFeedback({ rating: '5', comment: '' });
      setShowFeedbackDialog(false);
      
      // Refresh tickets list
      fetchTickets();
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to submit feedback: ' + error.message
      });
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedTickets = (ticketsToSort) => {
    if (!sortConfig.key) return ticketsToSort;

    return [...ticketsToSort].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const columns = [
    {
      accessorKey: "title",
      header: (
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => handleSort('title')}
        >
          Title
          {sortConfig.key === 'title' && (
            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
          )}
        </div>
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.original.title}</div>
      ),
    },
    {
      accessorKey: "status",
      header: (
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => handleSort('status')}
        >
          Status
          {sortConfig.key === 'status' && (
            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
          )}
        </div>
      ),
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.original.status)}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: (
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => handleSort('created_at')}
        >
          Created
          {sortConfig.key === 'created_at' && (
            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
          )}
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-muted-foreground">
          {new Date(row.original.created_at).toLocaleDateString()}
        </div>
      ),
    },
  ];

  const getStatusVariant = (status) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const containerStyle = {
    maxHeight: maxHeight || 'auto',
    overflow: 'auto',
    ...(isWidget && {
      border: '1px solid #e5e7eb',
      borderRadius: '0.5rem',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    }),
  };

  // Separate active and closed tickets
  const activeTickets = tickets.filter(ticket => ticket.status !== 'closed');
  const closedTickets = tickets.filter(ticket => ticket.status === 'closed');

  // Update the table body to use sorted tickets
  const sortedActiveTickets = getSortedTickets(activeTickets);
  const sortedClosedTickets = getSortedTickets(closedTickets);

  return (
    <div className="p-8" style={containerStyle}>
      {alert && (
        <Alert variant={alert.type === 'error' ? 'destructive' : 'default'} className="mb-4">
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Support Tickets</h1>
        <div className="flex gap-2">
          <Button onClick={() => setIsNewTicketModalOpen(true)}>
            Create New Ticket
          </Button>
          {isWidget && onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.accessorKey}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedActiveTickets.map((ticket) => (
              <TableRow
                key={ticket.id}
                onClick={() => handleTicketClick(ticket)}
                className="cursor-pointer"
              >
                {columns.map((column) => (
                  <TableCell key={`${ticket.id}-${column.accessorKey}`}>
                    {column.cell({ row: { original: ticket } })}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {sortedActiveTickets.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                  No active tickets found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {sortedClosedTickets.length > 0 && (
        <div className="mt-8">
          <Button
            variant="outline"
            className="mb-2 w-full flex justify-between items-center"
            onClick={() => setShowClosedTickets(!showClosedTickets)}
          >
            <span>Closed Tickets ({sortedClosedTickets.length})</span>
            {showClosedTickets ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          
          {showClosedTickets && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead key={column.accessorKey}>
                        {column.header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedClosedTickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      onClick={() => handleTicketClick(ticket)}
                      className="cursor-pointer"
                    >
                      {columns.map((column) => (
                        <TableCell key={`${ticket.id}-${column.accessorKey}`}>
                          {column.cell({ row: { original: ticket } })}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* New Ticket Dialog */}
      <Dialog open={isNewTicketModalOpen} onOpenChange={setIsNewTicketModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Support Ticket</DialogTitle>
            <DialogDescription>
              Fill out the form below to create a new support ticket. We'll get back to you as soon as possible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newTicket.title}
                onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                placeholder="Brief description of your issue"
              />
            </div>
            <div>
              {isCategoryEnabled && (
                <div className="space-y-2">
                  <Label>Issue Category {isCategoryEnabled && <span className="text-red-500">*</span>}</Label>
                  <Select
                    value={newTicket.custom_fields['Issue Category'] || ''}
                    onValueChange={(value) => setNewTicket(prev => ({
                      ...prev,
                      custom_fields: {
                        ...prev.custom_fields,
                        'Issue Category': value
                      }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {issueCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                placeholder="Detailed description of your issue"
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={newTicket.priority}
                onValueChange={(value) => setNewTicket({ ...newTicket, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewTicketModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTicket}>
              Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Details Dialog */}
      <Dialog open={selectedTicket !== null} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ticket Details</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold">{selectedTicket.title}</h3>
                  <div className="flex items-center gap-2">
                    {selectedTicket.status === 'resolved' && !selectedTicket.feedback_rating && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowFeedbackDialog(true)}
                      >
                        Give Feedback
                      </Button>
                    )}
                    {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleResolveTicket}
                      >
                        Mark as Resolved
                      </Button>
                    )}
                    <Badge variant={getStatusVariant(selectedTicket.status)}>
                      {selectedTicket.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {selectedTicket.custom_fields?.['Issue Category'] && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Category:</span>
                      <Badge variant="outline">
                        {selectedTicket.custom_fields['Issue Category']}
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Priority:</span>
                    <Badge variant="secondary">
                      {selectedTicket.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Created:</span>
                    <span className="text-sm">
                      {new Date(selectedTicket.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-4">
                  {selectedTicket.description}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Comments</h4>
                  <div className="space-y-4">
                    {ticketComments.map((comment) => (
                      <div key={comment.id} className="p-4 rounded-lg bg-muted">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">{comment.user?.full_name || 'Unknown'}</span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    ))}
                    {ticketComments.length === 0 && (
                      <p className="text-sm text-muted-foreground">No comments yet</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="newComment">Add Comment</Label>
                  <Textarea
                    id="newComment"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Type your comment here..."
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                  Close
                </Button>
                <Button onClick={handleCreateComment} disabled={!newComment.trim()}>
                  Add Comment
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provide Feedback</DialogTitle>
            <DialogDescription>
              Please rate your support experience and provide any additional comments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rating">Rating</Label>
              <Select
                value={feedback.rating}
                onValueChange={(value) => setFeedback({ ...feedback, rating: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Poor</SelectItem>
                  <SelectItem value="2">2 - Fair</SelectItem>
                  <SelectItem value="3">3 - Good</SelectItem>
                  <SelectItem value="4">4 - Very Good</SelectItem>
                  <SelectItem value="5">5 - Excellent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="feedbackComment">Comments (Optional)</Label>
              <Textarea
                id="feedbackComment"
                value={feedback.comment}
                onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
                placeholder="Share your experience with our support..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitFeedback}>
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerTickets; 