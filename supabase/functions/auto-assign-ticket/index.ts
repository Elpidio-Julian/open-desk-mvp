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

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabaseClient
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single()

    if (ticketError) throw ticketError

    // Get matching rule with highest weight
    const { data: rules, error: rulesError } = await supabaseClient
      .from('routing_rules')
      .select('*')
      .eq('is_active', true)
      .order('weight', { ascending: false })
      .limit(1)

    if (rulesError) throw rulesError
    if (!rules.length) {
      return new Response(
        JSON.stringify({ message: 'No matching routing rules found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rule = rules[0]
    const requiredSkills = rule.target_skills?.required || []

    // Find best agent
    const { data: agents, error: agentsError } = await supabaseClient
      .from('users')
      .select(`
        *,
        agent_skills (*),
        agent_workload_metrics (*)
      `)
      .eq('role', 'agent')
      .eq('is_active', true)

    if (agentsError) throw agentsError

    // Filter and sort agents
    const availableAgents = agents
      .filter(agent => {
        if (!requiredSkills.length) return true
        const agentSkills = agent.agent_skills?.map(s => s.skill_name) || []
        return requiredSkills.every(skill => agentSkills.includes(skill))
      })
      .sort((a, b) => {
        const aMetrics = a.agent_workload_metrics[0] || {}
        const bMetrics = b.agent_workload_metrics[0] || {}
        return (aMetrics.active_tickets || 0) - (bMetrics.active_tickets || 0)
      })

    if (!availableAgents.length) {
      return new Response(
        JSON.stringify({ message: 'No available agents found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const bestAgent = availableAgents[0]

    // Update ticket assignment
    const { error: updateError } = await supabaseClient
      .from('tickets')
      .update({
        assigned_to: bestAgent.id,
        routing_attempts: (ticket.routing_attempts || 0) + 1,
        auto_assigned: true,
        routing_rule_id: rule.id
      })
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