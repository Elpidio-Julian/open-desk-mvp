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

const CustomerTickets = ({ isWidget = false, maxHeight, onClose }) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [isTicketDetailsModalOpen, setIsTicketDetailsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketComments, setTicketComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '' });
  const [alert, setAlert] = useState(null);
  const [showMarkdownTips, setShowMarkdownTips] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedComments, setExpandedComments] = useState(false);
  const INITIAL_COMMENTS_TO_SHOW = 3;

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

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
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          *,
          created_by:users!tickets_created_by_fkey(full_name, email),
          assigned_to:users!tickets_assigned_to_fkey(full_name, email)
        `)
        .eq('id', ticketId)
        .single();

      if (ticketError) throw ticketError;
      setSelectedTicket(ticket);

      const { data: comments, error: commentsError } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          is_internal,
          user:users(id, full_name, email)
        `)
        .eq('ticket_id', ticketId)
        .eq('is_internal', false)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;
      setTicketComments(comments || []);

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

  const handleCreateTicket = async () => {
    try {
      if (!user) throw new Error('You must be logged in to create a ticket');
      
      const { data, error } = await supabase.from('tickets').insert([
        {
          title: newTicket.title,
          description: newTicket.description,
          status: 'open',
          created_by: user.id,
        },
      ]);

      if (error) throw error;

      setAlert({
        type: 'success',
        message: 'Ticket created successfully!',
      });
      setIsNewTicketModalOpen(false);
      setNewTicket({ title: '', description: '' });
      fetchTickets();
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to create ticket: ' + error.message,
      });
    }
  };

  const handleCreateComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const { data, error } = await supabase.from('comments').insert([
        {
          ticket_id: selectedTicket.id,
          user_id: user.id,
          content: newComment.trim(),
          is_internal: false,
        },
      ]);

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

  const columns = [
    { header: 'Title', field: 'title' },
    { header: 'Status', field: 'status' },
    {
      header: 'Created',
      field: 'created_at',
      render: (row) => new Date(row.created_at).toLocaleDateString(),
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

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Support Tickets</h1>
        <div className="flex gap-2">
          <Button
            variant="primary"
            onClick={() => setIsNewTicketModalOpen(true)}
          >
            Create New Ticket
          </Button>
          {isWidget && onClose && (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      <Table
        columns={columns}
        data={tickets}
        onRowClick={handleTicketClick}
      />

      {/* New Ticket Modal */}
      <Modal
        isOpen={isNewTicketModalOpen}
        onClose={() => setIsNewTicketModalOpen(false)}
        title="Create New Support Ticket"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={newTicket.title}
            onChange={(e) =>
              setNewTicket({ ...newTicket, title: e.target.value })
            }
            required
          />
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-gray-700 text-sm font-bold">
                Description
              </label>
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
                  {newTicket.description || '*No content yet*'}
                </ReactMarkdown>
              </div>
            ) : (
              <textarea
                value={newTicket.description}
                onChange={(e) =>
                  setNewTicket({ ...newTicket, description: e.target.value })
                }
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline min-h-[200px]"
                placeholder="Describe your issue... (Markdown supported)"
              />
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="secondary"
              onClick={() => setIsNewTicketModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateTicket}
              disabled={!newTicket.title || !newTicket.description}
            >
              Create Ticket
            </Button>
          </div>
        </div>
      </Modal>

      {/* Ticket Details Modal */}
      <Modal
        isOpen={isTicketDetailsModalOpen}
        onClose={() => {
          setIsTicketDetailsModalOpen(false);
          setSelectedTicket(null);
          setTicketComments([]);
          setShowPreview(false);
        }}
        title={selectedTicket?.title || 'Ticket Details'}
      >
        {selectedTicket && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Status</h3>
                <p className="mt-1">{selectedTicket.status}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Description</h3>
                <div className="mt-1 prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedTicket.description}
                  </ReactMarkdown>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Created</h3>
                <p className="mt-1">
                  {new Date(selectedTicket.created_at).toLocaleString()}
                </p>
              </div>
              {selectedTicket.assigned_to && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Assigned To</h3>
                  <p className="mt-1">
                    {selectedTicket.assigned_to.full_name || selectedTicket.assigned_to.email}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Comments</h3>
              <div className="space-y-4">
                {ticketComments.length === 0 ? (
                  <p className="text-gray-500 text-center">No comments yet</p>
                ) : (
                  <>
                    {(expandedComments ? ticketComments : ticketComments.slice(-INITIAL_COMMENTS_TO_SHOW)).map((comment) => (
                      <div key={comment.id} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-medium">
                            {comment.user?.id === user.id ? (
                              comment.user?.full_name || comment.user?.email
                            ) : (
                              <span className="text-blue-700">
                                (Support Agent) {comment.user?.full_name || comment.user?.email || 'Support Team'}
                              </span>
                            )}
                          </span>
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
                    <h4 className="text-sm font-medium text-gray-900">Add Comment</h4>
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
                    <div className="min-h-[100px] p-4 bg-gray-50 rounded-lg prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {newComment || '*No content yet*'}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write your comment... (Markdown supported)"
                      className="w-full min-h-[100px] p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      onClick={handleCreateComment}
                      disabled={!newComment.trim() || isSubmittingComment}
                    >
                      {isSubmittingComment ? 'Sending...' : 'Add Comment'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CustomerTickets; 