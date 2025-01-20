import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabase } from '../setup/testSetup'
import { createTestTicket, cleanupTestTickets } from '../setup/testHelpers'

describe('Ticket CRUD Operations', () => {
  beforeEach(async () => {
    await cleanupTestTickets()
  })

  afterEach(async () => {
    await cleanupTestTickets()
  })

  it('should create a new ticket', async () => {
    const ticketData = {
      title: 'Test Ticket',
      description: 'Test Description',
      priority: 'high'
    }

    const ticket = await createTestTicket(ticketData)
    
    expect(ticket).toBeDefined()
    expect(ticket.title).toBe(ticketData.title)
    expect(ticket.description).toBe(ticketData.description)
    expect(ticket.priority).toBe(ticketData.priority)
    expect(ticket.status).toBe('open')
  })

  it('should read a ticket by id', async () => {
    const createdTicket = await createTestTicket()
    
    const { data: ticket, error } = await supabase
      .from('tickets')
      .select()
      .eq('id', createdTicket.id)
      .single()
    
    expect(error).toBeNull()
    expect(ticket).toBeDefined()
    expect(ticket.id).toBe(createdTicket.id)
  })

  it('should update a ticket', async () => {
    const ticket = await createTestTicket()
    const updateData = { status: 'in_progress' }
    
    const { data: updatedTicket, error } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', ticket.id)
      .select()
      .single()
    
    expect(error).toBeNull()
    expect(updatedTicket.status).toBe('in_progress')
  })

  it('should delete a ticket', async () => {
    const ticket = await createTestTicket()
    
    const { error: deleteError } = await supabase
      .from('tickets')
      .delete()
      .eq('id', ticket.id)
    
    const { data: deletedTicket } = await supabase
      .from('tickets')
      .select()
      .eq('id', ticket.id)
      .single()
    
    expect(deleteError).toBeNull()
    expect(deletedTicket).toBeNull()
  })
}) 