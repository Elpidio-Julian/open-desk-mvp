import { supabase } from '../supabase';
import { customFieldsService } from './customFields';

/**
 * Get matching routing rules for a ticket based on its properties
 */
async function getMatchingRules(ticket) {
    const rules = await customFieldsService.getRoutingRules();
    
    // Filter rules based on conditions
    return rules.filter(rule => {
        if (!rule.is_active) return false;
        
        const conditions = rule.conditions;
        
        // Check priority match
        if (conditions.priority && conditions.priority !== ticket.priority) {
            return false;
        }

        // Check tag matches
        if (conditions.tags && conditions.tags.length > 0) {
            const ticketTags = ticket.tags || [];
            if (!conditions.tags.some(tag => ticketTags.includes(tag))) {
                return false;
            }
        }

        // Check custom field matches
        if (conditions.custom_fields) {
            const ticketFields = ticket.custom_fields || {};
            for (const [field, value] of Object.entries(conditions.custom_fields)) {
                if (ticketFields[field] !== value) {
                    return false;
                }
            }
        }

        return true;
    }).sort((a, b) => b.weight - a.weight);
}

/**
 * Get available agents based on skills and workload
 */
async function getAvailableAgents(requiredSkills = []) {
    console.log('Searching for agents with required skills:', requiredSkills);
    
    // First check what roles exist in the database
    const { data: allUsers, error: roleError } = await supabase
        .from('users')
        .select('id, full_name, role');

    if (roleError) {
        console.error('Error checking roles:', roleError);
        throw roleError;
    }
    console.log('All users and their roles:', allUsers);

    // Get agents with required skills
    const { data: agents, error } = await supabase
        .from('users')
        .select(`
            *,
            agent_skills(*),
            agent_workload_metrics(*)
        `)
        .eq('role', 'support_agent') // Try support_agent instead of agent
        .eq('is_active', true);

    if (error) {
        console.error('Error fetching agents:', error);
        throw error;
    }

    console.log('Found agents before filtering:', agents);

    // Filter agents based on skills and sort by workload
    const filteredAgents = agents
        .filter(agent => {
            if (!requiredSkills.length) {
                console.log('No skills required, including agent:', agent.full_name);
                return true;
            }
            
            const agentSkills = agent.agent_skills?.map(s => s.skill_name) || [];
            console.log('Agent skills for', agent.full_name, ':', agentSkills);
            
            const hasRequiredSkills = requiredSkills.every(skill => agentSkills.includes(skill));
            console.log('Agent', agent.full_name, hasRequiredSkills ? 'has' : 'does not have', 'required skills');
            
            return hasRequiredSkills;
        })
        .sort((a, b) => {
            const aMetrics = a.agent_workload_metrics[0] || {};
            const bMetrics = b.agent_workload_metrics[0] || {};
            
            // Sort by active tickets (ascending)
            return (aMetrics.active_tickets || 0) - (bMetrics.active_tickets || 0);
        });

    console.log('Filtered and sorted agents:', filteredAgents);
    return filteredAgents;
}

/**
 * Find the best agent for a ticket based on routing rules and workload
 */
async function findBestAgent(ticket) {
    // Get matching routing rules
    const rules = await getMatchingRules(ticket);
    console.log('Found matching rules:', rules);
    
    if (!rules.length) {
        console.log('No matching rules found');
        return null;
    }

    // Get required skills from highest weight matching rule
    const targetSkills = rules[0].target_skills?.required || [];
    console.log('Target skills required:', targetSkills);
    
    // Get available agents
    const agents = await getAvailableAgents(targetSkills);
    console.log('Available agents:', agents);
    
    if (!agents.length) {
        console.log('No agents available with required skills');
        return null;
    }

    // Return agent with lowest workload
    return agents[0];
}

/**
 * Attempt to automatically assign a ticket
 */
async function autoAssignTicket(ticketId) {
    console.log('Starting auto-assignment for ticket:', ticketId);
    
    // Call edge function to handle assignment
    const { data, error } = await supabase.functions.invoke('auto-assign-ticket', {
        body: { ticketId }
    });

    if (error) {
        console.error('Failed to auto-assign ticket:', error);
        throw error;
    }

    console.log('Auto-assignment result:', data);
    return data;
}

/**
 * Get agent skills
 */
async function getAgentSkills(agentId) {
    const { data, error } = await supabase
        .from('agent_skills')
        .select('*')
        .eq('agent_id', agentId);

    if (error) throw error;
    return data;
}

/**
 * Update agent skills
 */
async function updateAgentSkills(agentId, skills) {
    const { error } = await supabase
        .from('agent_skills')
        .upsert(
            skills.map(skill => ({
                agent_id: agentId,
                ...skill
            }))
        );

    if (error) throw error;
}

/**
 * Get routing rules
 */
async function getRoutingRules() {
    const { data, error } = await supabase
        .from('routing_rules')
        .select('*')
        .order('weight', { ascending: false });

    if (error) throw error;
    return data;
}

/**
 * Create or update routing rule
 */
async function upsertRoutingRule(rule) {
    if (rule.id) {
        return customFieldsService.updateRoutingRule(rule.id, rule);
    } else {
        return customFieldsService.createRoutingRule(rule);
    }
}

export const routingService = {
    autoAssignTicket,
    getAgentSkills,
    updateAgentSkills,
    getRoutingRules: customFieldsService.getRoutingRules,
    upsertRoutingRule
}; 