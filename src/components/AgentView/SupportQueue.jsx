import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Button from '../SharedComponents/Button/Button';
import Table from '../SharedComponents/Table/Table';
import Modal from '../SharedComponents/Modal/Modal';
import Input from '../SharedComponents/Form/Input';
import Alert from '../SharedComponents/Notification/Alert';
import { ticketsService } from '../../services/api/tickets';

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
    try {
      const { error } = await ticketsService.addComment(ticketId, user.id, content, isInternal);
      if (error) throw error;
      await fetchTickets();
      setAlert({ type: 'success', message: 'Comment added successfully' });
    } catch (error) {
      setAlert({ type: 'error', message: error.message });
    }
  };

  const fetchTicketDetails = async (ticketId) => {
    try {
      const [ticketResponse, commentsResponse] = await Promise.all([
        ticketsService.getTicketDetails(ticketId),
        ticketsService.getComments(ticketId)
      ]);

      if (ticketResponse.error) throw ticketResponse.error;
      if (commentsResponse.error) throw commentsResponse.error;

      setTicketDetails(ticketResponse.data);
      setTicketComments(commentsResponse.data);

      // Fetch customer history if ticket has a creator
      if (ticketResponse.data.created_by?.id) {
        const { data: history, error: historyError } = await ticketsService.getCustomerHistory(
          ticketResponse.data.created_by.id
        );
        if (historyError) throw historyError;
        setCustomerHistory(history);
      }
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

  const containerStyle = {
    maxHeight: maxHeight || 'auto',
    overflow: 'auto',
    ...(isWidget && {
      border: '1px solid #e5e7eb',
      borderRadius: '0.5rem',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    }),
  };

  return (
    <div className="px-4 py-8" style={containerStyle}>
      {alert && (
        <div className="mb-4">
          <Alert
            type={alert.type}
            message={alert.message}
            onClose={() => setAlert(null)}
          />
        </div>
      )}

      <div className="mb-6 space-y-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-800">
            {currentView === TICKET_VIEWS.MY_TICKETS ? 'My Tickets' : 'Support Queue'}
          </h1>
          <div className="flex-1" />
          <Input
            type="search"
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          {isWidget && onClose && (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )}
        </div>

        {!hideViewSelector && (
          <div className="flex flex-wrap gap-4">
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
        )}

        {!hideViewSelector && selectedTickets.size > 0 && (
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
              onChange={(e) => handleBulkStatusUpdate(e.target.value)}
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

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={tickets}
          onRowClick={handleTicketClick}
        />
      )}

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

            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Comments & Notes</h3>
              <div className="space-y-4">
                {ticketComments.length === 0 ? (
                  <p className="text-gray-500 text-center">No comments yet</p>
                ) : (
                  <>
                    {(expandedComments ? ticketComments : ticketComments.slice(-INITIAL_COMMENTS_TO_SHOW)).map((comment) => (
                      <div
                        key={comment.id}
                        className={`p-4 rounded-lg ${
                          comment.is_internal ? 'bg-yellow-50' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-sm font-medium">
                              {comment.user_id === ticketDetails.created_by.id ? (
                                comment.user?.full_name || comment.user?.email
                              ) : (
                                <span className="text-blue-700">
                                  (Support Agent) {comment.user?.full_name || comment.user?.email || 'Support Team'}
                                </span>
                              )}
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
                    {ticketComments.length > INITIAL_COMMENTS_TO_SHOW && (
                      <div className="text-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setExpandedComments(!expandedComments)}
                        >
                          {expandedComments ? 'Show Less' : `Show ${ticketComments.length - INITIAL_COMMENTS_TO_SHOW} More Comments`}
                        </Button>
                      </div>
                    )}
                  </>
                )}

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
                      onClick={() => handleAddComment(selectedTicket.id, newComment, isInternalNote)}
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

export default SupportQueue; 