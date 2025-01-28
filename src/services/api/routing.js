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
 * Get available agents
 */
async function getAvailableAgents(requiredSkills = []) {
    try {
        console.log('Fetching available agents...');
        const { data: agents, error } = await supabase
            .from('agents')
            .select(`
                id,
                metadata,
                profile:profile_id (
                    id,
                    full_name,
                    email,
                    role
                )
            `);

        if (error) {
            console.error('Error fetching agents:', error);
            throw error;
        }

        console.log('Raw agents data:', agents);

        if (!agents || agents.length === 0) {
            console.log('No agents found in the database');
            return { data: [], error: null };
        }

        // Filter agents based on skills
        const filteredAgents = agents.filter(agent => {
            if (!requiredSkills.length) return true;
            
            const agentSkills = agent.metadata?.skills || [];
            return requiredSkills.every(required => 
                agentSkills.some(agentSkill => 
                    agentSkill.category === required.category && 
                    agentSkill.skill_name === required.skill_name
                )
            );
        });

        console.log('Filtered agents:', filteredAgents);
        return { data: filteredAgents, error: null };
    } catch (err) {
        console.error('Error in getAvailableAgents:', err);
        return { data: null, error: err };
    }
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
    
    if (!agents.data.length) {
        console.log('No agents available with required skills');
        return null;
    }

    // Return agent with lowest workload
    return agents.data[0];
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
        .from('agents')
        .select(`
            id,
            metadata,
            profile:profile_id (
                id,
                full_name,
                email,
                role
            )
        `)
        .eq('profile_id', agentId)
        .single();

    if (error) throw error;
    return data?.metadata?.skills || [];
}

/**
 * Update agent skills
 */
async function updateAgentSkills(agentId, skills) {
    // First get the current agent data to preserve other metadata
    const { data: currentAgent } = await supabase
        .from('agents')
        .select('metadata')
        .eq('profile_id', agentId)
        .single();

    const { error } = await supabase
        .from('agents')
        .update({
            metadata: {
                ...(currentAgent?.metadata || {}),
                skills: skills
            }
        })
        .eq('profile_id', agentId);

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
    upsertRoutingRule,
    getAvailableAgents
}; 