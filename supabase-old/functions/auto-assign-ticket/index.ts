import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get request body
    const { ticketId } = await req.json()
    
    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: 'ticketId is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get ticket details including custom fields
    const { data: ticket, error: ticketError } = await supabaseClient
      .from('tickets')
      .select(`
        *,
        created_by:users!tickets_created_by_fkey(id, full_name, email, role)
      `)
      .eq('id', ticketId)
      .single()

    if (ticketError) throw ticketError

    // Skip auto-assignment if ticket was created by an agent
    if (ticket.created_by?.role === 'agent') {
      return new Response(
        JSON.stringify({ message: 'Skipping auto-assignment for agent-created ticket' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get matching rules based on custom fields
    const { data: rules, error: rulesError } = await supabaseClient
      .from('routing_rules')
      .select('*')
      .eq('is_active', true)
      .order('weight', { ascending: false })

    if (rulesError) throw rulesError

    // Find the best matching rule based on custom fields
    let bestRule = null
    for (const rule of rules) {
      if (rule.conditions?.category && ticket.custom_fields?.['Issue Category']) {
        if (rule.conditions.category === ticket.custom_fields['Issue Category']) {
          bestRule = rule
          break
        }
      } else if (!rule.conditions || Object.keys(rule.conditions).length === 0) {
        // Use as fallback if no other rules match
        bestRule = rule
      }
    }

    if (!bestRule) {
      return new Response(
        JSON.stringify({ message: 'No matching routing rules found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get available agents based on rule requirements
    const { data: agents, error: agentsError } = await supabaseClient
      .from('users')
      .select(`
        *,
        agent_skills(*),
        agent_workload_metrics(*)
      `)
      .eq('role', 'agent')
      .eq('is_active', true)

    if (agentsError) throw agentsError

    // Filter and sort agents based on skills and workload
    const eligibleAgents = agents
      .filter(agent => {
        if (!bestRule.required_skills?.length) return true
        const agentSkills = agent.agent_skills?.map(s => s.skill_name) || []
        return bestRule.required_skills.every(skill => agentSkills.includes(skill))
      })
      .sort((a, b) => {
        const aMetrics = a.agent_workload_metrics[0] || {}
        const bMetrics = b.agent_workload_metrics[0] || {}
        return (aMetrics.active_tickets || 0) - (bMetrics.active_tickets || 0)
      })

    if (!eligibleAgents.length) {
      return new Response(
        JSON.stringify({ message: 'No eligible agents found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const bestAgent = eligibleAgents[0]

    // Assign ticket to the best agent
    const { error: updateError } = await supabaseClient
      .from('tickets')
      .update({ assigned_to: bestAgent.id })
      .eq('id', ticketId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({
        success: true,
        agent: {
          id: bestAgent.id,
          full_name: bestAgent.full_name,
          email: bestAgent.email
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}) 