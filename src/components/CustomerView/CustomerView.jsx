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
        onRowClick={(row) => {
          // Handle row click - could open ticket details
          console.log('Clicked ticket:', row);
        }}
      />

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
    </div>
  );
};

export default CustomerView; 