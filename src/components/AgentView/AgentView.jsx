import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Button from '../SharedComponents/Button/Button';
import Table from '../SharedComponents/Table/Table';
import Modal from '../SharedComponents/Modal/Modal';
import Input from '../SharedComponents/Form/Input';
import Alert from '../SharedComponents/Notification/Alert';

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
  STATUS: ['all', 'open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'],
  PRIORITY: ['all', 'low', 'medium', 'high', 'urgent'],
};

const AgentView = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [currentView, setCurrentView] = useState(TICKET_VIEWS.ALL);
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

  useEffect(() => {
    fetchTickets();
  }, [currentView, statusFilter, priorityFilter]);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('tickets')
        .select(`
          *,
          created_by:users!tickets_created_by_fkey(full_name, email),
          assigned_to:users!tickets_assigned_to_fkey(full_name, email),
          comments(count)
        `);

      // Apply view filters
      switch (currentView) {
        case TICKET_VIEWS.UNASSIGNED:
          query = query.is('assigned_to', null);
          break;
        case TICKET_VIEWS.MY_TICKETS:
          query = query.eq('assigned_to', user.id);
          break;
        case TICKET_VIEWS.URGENT:
          query = query.eq('priority', 'urgent');
          break;
      }

      // Apply status and priority filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      // Order by priority and creation date
      query = query.order('priority', { ascending: false })
                  .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setTickets(data);
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to fetch tickets: ' + error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkAssign = async () => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ assigned_to: user.id })
        .in('id', Array.from(selectedTickets));

      if (error) throw error;

      setAlert({
        type: 'success',
        message: 'Tickets assigned successfully',
      });
      setSelectedTickets(new Set());
      fetchTickets();
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to assign tickets: ' + error.message,
      });
    }
  };

  const handleBulkUpdateStatus = async (status) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status })
        .in('id', Array.from(selectedTickets));

      if (error) throw error;

      setAlert({
        type: 'success',
        message: 'Tickets updated successfully',
      });
      setSelectedTickets(new Set());
      fetchTickets();
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to update tickets: ' + error.message,
      });
    }
  };

  const fetchTicketDetails = async (ticketId) => {
    try {
      // Fetch ticket details with related data
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          *,
          created_by:users!tickets_created_by_fkey(id, full_name, email),
          assigned_to:users!tickets_assigned_to_fkey(id, full_name, email)
        `)
        .eq('id', ticketId)
        .single();

      if (ticketError) throw ticketError;
      setTicketDetails(ticket);

      // Fetch comments
      const { data: comments, error: commentsError } = await supabase
        .from('comments')
        .select(`
          *,
          user:users(full_name, email)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;
      setTicketComments(comments);

      // Fetch customer's ticket history
      const { data: history, error: historyError } = await supabase
        .from('tickets')
        .select(`
          id,
          title,
          status,
          priority,
          created_at,
          resolved_at
        `)
        .eq('created_by', ticket.created_by.id)
        .order('created_at', { ascending: false });

      if (historyError) throw historyError;
      setCustomerHistory(history);

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
      const { error } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', selectedTicket.id);

      if (error) throw error;

      await fetchTicketDetails(selectedTicket.id);
      await fetchTickets(); // Refresh the main list

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

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const { error } = await supabase.from('comments').insert([
        {
          ticket_id: selectedTicket.id,
          user_id: user.id,
          content: newComment.trim(),
          is_internal: isInternalNote,
        },
      ]);

      if (error) throw error;

      await fetchTicketDetails(selectedTicket.id);
      setNewComment('');
      setIsInternalNote(false);
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to add comment: ' + error.message,
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const columns = [
    {
      header: '',
      field: 'select',
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedTickets.has(row.id)}
          onChange={(e) => {
            const newSelected = new Set(selectedTickets);
            if (e.target.checked) {
              newSelected.add(row.id);
            } else {
              newSelected.delete(row.id);
            }
            setSelectedTickets(newSelected);
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-gray-300"
        />
      ),
    },
    { 
      header: 'Priority',
      field: 'priority',
      render: (row) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
          ${row.priority === 'urgent' ? 'bg-red-100 text-red-800' :
            row.priority === 'high' ? 'bg-orange-100 text-orange-800' :
            row.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'}`
        }>
          {row.priority}
        </span>
      ),
    },
    { header: 'Title', field: 'title' },
    { 
      header: 'Customer',
      field: 'created_by',
      render: (row) => row.created_by?.full_name || row.created_by?.email,
    },
    { 
      header: 'Assigned To',
      field: 'assigned_to',
      render: (row) => row.assigned_to?.full_name || 'Unassigned',
    },
    { header: 'Status', field: 'status' },
    {
      header: 'Created',
      field: 'created_at',
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
    {
      header: 'Comments',
      field: 'comments',
      render: (row) => row.comments?.[0]?.count || 0,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {alert && (
        <div className="mb-4">
          <Alert
            type={alert.type}
            message={alert.message}
            onClose={() => setAlert(null)}
          />
        </div>
      )}

      {/* Filters and Views */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-800">Support Queue</h1>
          <div className="flex-1" />
          <Input
            type="search"
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          {/* View Selector */}
          <div className="flex rounded-lg shadow-sm">
            {Object.entries(TICKET_VIEWS).map(([key, value]) => (
              <Button
                key={key}
                variant={currentView === value ? 'primary' : 'secondary'}
                onClick={() => setCurrentView(value)}
                className="first:rounded-l-lg last:rounded-r-lg rounded-none"
              >
                {key.replace('_', ' ')}
              </Button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {TICKET_FILTERS.STATUS.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'All Statuses' : status.replace('_', ' ')}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {TICKET_FILTERS.PRIORITY.map((priority) => (
              <option key={priority} value={priority}>
                {priority === 'all' ? 'All Priorities' : priority}
              </option>
            ))}
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedTickets.size > 0 && (
          <div className="flex items-center space-x-4 bg-gray-50 p-4 rounded-lg">
            <span className="text-sm text-gray-600">
              {selectedTickets.size} tickets selected
            </span>
            <Button
              variant="secondary"
              onClick={handleBulkAssign}
            >
              Assign to Me
            </Button>
            <select
              onChange={(e) => handleBulkUpdateStatus(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Update Status</option>
              {TICKET_FILTERS.STATUS.filter(s => s !== 'all').map((status) => (
                <option key={status} value={status}>
                  {status.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tickets Table */}
      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={tickets}
          onRowClick={handleTicketClick}
        />
      )}

      {/* Ticket Details Modal */}
      {selectedTicket && ticketDetails && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedTicket(null);
            setTicketDetails(null);
            setTicketComments([]);
            setShowPreview(false);
            setShowHistory(false);
          }}
          title={ticketDetails?.title || 'Ticket Details'}
        >
          <div className="space-y-6">
            {/* Ticket Actions */}
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-gray-900">Status</h3>
                <select
                  value={ticketDetails.status}
                  onChange={(e) => handleUpdateTicket({ status: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  {TICKET_FILTERS.STATUS.filter(s => s !== 'all').map((status) => (
                    <option key={status} value={status}>
                      {status.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-gray-900">Priority</h3>
                <select
                  value={ticketDetails.priority}
                  onChange={(e) => handleUpdateTicket({ priority: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  {TICKET_FILTERS.PRIORITY.filter(p => p !== 'all').map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-gray-900">Assignment</h3>
                <Button
                  variant={ticketDetails.assigned_to?.id === user.id ? "secondary" : "primary"}
                  onClick={() => handleUpdateTicket({ 
                    assigned_to: ticketDetails.assigned_to?.id === user.id ? null : user.id 
                  })}
                >
                  {ticketDetails.assigned_to?.id === user.id ? "Unassign" : "Assign to Me"}
                </Button>
              </div>
            </div>

            {/* Ticket Information */}
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Status</h3>
                  <p className="mt-1">{ticketDetails.status}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Priority</h3>
                  <p className="mt-1">{ticketDetails.priority}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory ? 'Hide Customer History' : 'Show Customer History'}
                </Button>
              </div>

              {showHistory && customerHistory.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Customer History</h3>
                  <div className="space-y-3">
                    {customerHistory.map((ticket) => (
                      <div
                        key={ticket.id}
                        className={`p-3 rounded ${
                          ticket.id === ticketDetails.id ? 'bg-blue-50 border border-blue-200' : 'bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium">{ticket.title}</h4>
                            <div className="flex space-x-4 mt-1 text-xs text-gray-500">
                              <span>Status: {ticket.status}</span>
                              <span>Priority: {ticket.priority}</span>
                              <span>Created: {new Date(ticket.created_at).toLocaleDateString()}</span>
                              {ticket.resolved_at && (
                                <span>Resolved: {new Date(ticket.resolved_at).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          {ticket.id !== ticketDetails.id && (
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => handleTicketClick({ id: ticket.id })}
                            >
                              View
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-500">Description</h3>
                <div className="mt-1 prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {ticketDetails.description}
                  </ReactMarkdown>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Created By</h3>
                  <p className="mt-1">
                    {ticketDetails.created_by?.full_name || ticketDetails.created_by?.email}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(ticketDetails.created_at).toLocaleString()}
                  </p>
                </div>
                {ticketDetails.assigned_to && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Assigned To</h3>
                    <p className="mt-1">
                      {ticketDetails.assigned_to?.full_name || ticketDetails.assigned_to?.email}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Comments Section */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Comments & Notes</h3>
              <div className="space-y-4">
                {ticketComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-4 rounded-lg ${
                      comment.is_internal ? 'bg-yellow-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm font-medium">
                          {comment.user?.full_name || comment.user?.email}
                        </span>
                        {comment.is_internal && (
                          <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">
                            Internal Note
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
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
                {ticketComments.length === 0 && (
                  <p className="text-gray-500 text-center">No comments yet</p>
                )}

                {/* New Comment Form */}
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <h4 className="text-sm font-medium text-gray-900">Add Response</h4>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          className="rounded text-blue-600"
                        />
                        <span className="text-sm text-gray-600">Internal Note</span>
                      </label>
                    </div>
                    <div className="space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowMarkdownTips(!showMarkdownTips)}
                      >
                        {showMarkdownTips ? 'Hide Formatting Help' : 'Formatting Help'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowPreview(!showPreview)}
                      >
                        {showPreview ? 'Edit' : 'Preview'}
                      </Button>
                    </div>
                  </div>

                  {showMarkdownTips && (
                    <div className="p-4 bg-gray-50 rounded-lg text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {MARKDOWN_TIPS}
                      </ReactMarkdown>
                    </div>
                  )}

                  {showPreview ? (
                    <div className="min-h-[200px] p-4 bg-gray-50 rounded-lg prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {newComment || '*No content yet*'}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={`Write your ${isInternalNote ? 'internal note' : 'response'}... (Markdown supported)`}
                      className="w-full min-h-[200px] p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || isSubmittingComment}
                    >
                      {isSubmittingComment ? 'Sending...' : isInternalNote ? 'Add Note' : 'Send Response'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AgentView; 