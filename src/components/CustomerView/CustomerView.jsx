import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../SharedComponents/Button/Button';
import Table from '../SharedComponents/Table/Table';
import Modal from '../SharedComponents/Modal/Modal';
import Input from '../SharedComponents/Form/Input';
import Alert from '../SharedComponents/Notification/Alert';

const CustomerView = () => {
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
      // Fetch ticket comments
      const { data: comments, error: commentsError } = await supabase
        .from('comments')
        .select(`
          *,
          user:users(full_name, email)
        `)
        .eq('ticket_id', ticketId)
        .eq('is_internal', false)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;
      setTicketComments(comments);

      // Fetch ticket history
      const { data: history, error: historyError } = await supabase
        .from('ticket_history')
        .select(`
          *,
          user:users(full_name, email)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (historyError) throw historyError;
      setSelectedTicket(prev => ({ ...prev, history }));

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

      // Refresh comments
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

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Support Tickets</h1>
        <Button
          variant="primary"
          onClick={() => setIsNewTicketModalOpen(true)}
        >
          Create New Ticket
        </Button>
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
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Description
            </label>
            <textarea
              value={newTicket.description}
              onChange={(e) =>
                setNewTicket({ ...newTicket, description: e.target.value })
              }
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              rows="4"
            />
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
        }}
        title={selectedTicket?.title || 'Ticket Details'}
      >
        {selectedTicket && (
          <div className="space-y-6">
            {/* Ticket Information */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Status</h3>
                <p className="mt-1">{selectedTicket.status}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Description</h3>
                <p className="mt-1 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Created</h3>
                <p className="mt-1">
                  {new Date(selectedTicket.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Comments Section */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Comments</h3>
              <div className="space-y-4">
                {ticketComments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium">
                        {comment.user.full_name || comment.user.email}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-gray-600 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))}
                {ticketComments.length === 0 && (
                  <p className="text-gray-500 text-center">No comments yet</p>
                )}

                {/* New Comment Form */}
                <div className="mt-4 space-y-3">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full min-h-[100px] p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
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

            {/* Ticket History */}
            {selectedTicket.history && selectedTicket.history.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">History</h3>
                <div className="space-y-2">
                  {selectedTicket.history.map((event) => (
                    <div key={event.id} className="text-sm text-gray-600">
                      <span className="font-medium">{event.user.full_name || event.user.email}</span>
                      {' '}
                      {event.field_name === 'ticket_created' ? (
                        'created this ticket'
                      ) : (
                        <>
                          changed {event.field_name} from{' '}
                          <span className="font-medium">{event.old_value || 'none'}</span>
                          {' '}to{' '}
                          <span className="font-medium">{event.new_value}</span>
                        </>
                      )}
                      <span className="text-gray-400 ml-2">
                        {new Date(event.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CustomerView; 