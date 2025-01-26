import { supabase } from '../supabase';
import { routingService } from './routing';

export const ticketsService = {
  // Create operations
  create: async (ticketData) => {
    // Extract custom fields into metadata and rename title to subject
    const { custom_fields, title, ...standardFields } = ticketData;
    const ticketWithMetadata = {
      ...standardFields,
      title,
      metadata: custom_fields || {}
    };

    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert([ticketWithMetadata])
      .select()
      .single();

    if (error) throw error;

    // Attempt auto-assignment
    try {
      await routingService.autoAssignTicket(ticket.id);
    } catch (routingError) {
      console.error('Auto-assignment failed:', routingError);
      // Continue even if auto-assignment fails
    }

    return ticket;
  },

  // Read operations
  getTickets: async ({ view, status, priority, userId, customFieldFilters = {} }) => {
    let query = supabase
      .from('tickets')
      .select(`
        *,
        creator:creator_id(
          id,
          full_name,
          email
        ),
        assigned_agent:assigned_agent_id(
          id,
          full_name,
          email
        ),
        comments:comments(count)
      `);

    // Apply view filters
    switch (view) {
      case 'unassigned':
        query = query.is('assigned_agent_id', null);
        break;
      case 'my_tickets':
        query = query.eq('assigned_agent_id', userId);
        break;
      case 'urgent':
        query = query.eq('priority', 'urgent');
        break;
    }

    // Apply status and priority filters
    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);

    // Apply custom field filters
    Object.entries(customFieldFilters).forEach(([field, value]) => {
      query = query.contains('metadata', { [field]: value });
    });

    // Apply sorting
    query = query.order('priority', { ascending: false })
                .order('created_at', { ascending: false });

    const { data, error } = await query;
    
    return { data, error };
  },

  getByUser: async (userId) => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        title,
        description,
        priority,
        status,
        metadata,
        created_at,
        updated_at,
        creator_id,
        assigned_agent_id
      `)
      .eq('creator_id', userId);


    return { data, error };
  },

  getAssigned: async (agentId) => {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('assigned_agent_id', agentId);
    return { data, error };
  },

  getTicketDetails: async (ticketId) => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        creator:creator_id(
          id,
          full_name,
          email
        ),
        assigned_agent:assigned_agent_id(
          id,
          full_name,
          email
        )
      `)
      .eq('id', ticketId)
      .single();

    return { data, error };
  },

  getCustomerHistory: async (customerId) => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        title,
        status,
        priority,
        created_at,
        resolved_at,
        metadata
      `)
      .eq('creator_id', customerId)
      .order('created_at', { ascending: false });

    return { data, error };
  },

  // Update operations
  updateTicket: async (ticketId, updates) => {
    const { data, error } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', ticketId)
      .select()
      .single();

    return { data, error };
  },

  // Bulk operations
  bulkAssign: async (ticketIds, agentId) => {
    const { data, error } = await supabase
      .from('tickets')
      .update({ assigned_agent_id: agentId })
      .in('id', ticketIds);
    return { data, error };
  },

  bulkUpdateStatus: async (ticketIds, status) => {
    const { data, error } = await supabase
      .from('tickets')
      .update({ status })
      .in('id', ticketIds);
    return { data, error };
  },

  // Comment operations
  addComment: async (ticketId, userId, content, isInternal = false) => {
    const { data, error } = await supabase
      .from('comments')
      .insert([{
        ticket_id: ticketId,
        user_id: userId,
        content,
        is_internal: isInternal
      }]);
    return { data, error };
  },

  // Staff can see all comments including internal notes
  getStaffComments: async (ticketId) => {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        is_internal,
        created_at,
        updated_at,
        user:profiles(id, full_name, email)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    return { data, error };
  },

  // Customers can only see non-internal comments
  getCustomerComments: async (ticketId) => {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        is_internal,
        created_at,
        updated_at,
        user:profiles(id, full_name, email)
      `)
      .eq('ticket_id', ticketId)
      .eq('is_internal', false)
      .order('created_at', { ascending: true });

    return { data, error };
  },

  // Custom field operations
  getCustomFields: async () => {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    return { data, error };
  },

  isIssueCategoryEnabled: async () => {
    try {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('name', 'Issue Category')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    } catch (error) {
      console.error('Error checking issue category status:', error);
      return false;
    }
  },

  getIssueCategories: async () => {
    try {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('options')
        .eq('name', 'Issue Category')
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data?.options || [];
    } catch (error) {
      console.error('Error fetching issue categories:', error);
      return [];
    }
  },
};

/**
 * Bulk update tickets
 */
async function bulkUpdateTickets(ticketIds, updates) {
  // For each unassigned ticket being set to 'open', try auto-assignment
  if (updates.status === 'open' && !updates.assigned_agent_id) {
    await Promise.all(ticketIds.map(async (ticketId) => {
      try {
        const agent = await routingService.autoAssignTicket(ticketId);
        if (agent) {
          // Update individual ticket with assignment
          await supabase
            .from('tickets')
            .update({ ...updates, assigned_agent_id: agent.id })
            .eq('id', ticketId);
          return;
        }
      } catch (routingError) {
        console.error(`Auto-assignment failed for ticket ${ticketId}:`, routingError);
      }
      // If auto-assignment fails, update without assignment
      await supabase
        .from('tickets')
        .update(updates)
        .eq('id', ticketId);
    }));
    return;
  }

  // For other updates, perform bulk update
  const { error } = await supabase
    .from('tickets')
    .update(updates)
    .in('id', ticketIds);

  if (error) throw error;
} 