import { supabase } from '../supabase';

export const customFieldsService = {
  listFields: async () => {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('content_type', 'field')
      .order('name');
    return { data, error };
  },

  createField: async (fieldData) => {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .insert({
        name: fieldData.name,
        description: fieldData.description,
        content_type: fieldData.contentType,
        field_type: fieldData.fieldType,
        options: fieldData.options,
        is_required: fieldData.isRequired,
        is_active: fieldData.isActive
      })
      .select()
      .single();
    return { data, error };
  },

  updateField: async (id, fieldData) => {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .update({
        name: fieldData.name,
        description: fieldData.description,
        field_type: fieldData.fieldType,
        options: fieldData.options,
        is_required: fieldData.isRequired,
        is_active: fieldData.isActive
      })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  deleteField: async (id) => {
    const { error } = await supabase
      .from('custom_field_definitions')
      .delete()
      .eq('id', id);
    return { error };
  },

  getFieldByName: async (name) => {
    try {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('name', name)
        .maybeSingle();
      
      if (!data) {
        return { data: null, error: { code: 'PGRST116', message: 'No data found' } };
      }

      return { data, error };
    } catch (err) {
      console.error('Error fetching custom field:', err);
      return { data: null, error: err };
    }
  },

  // Routing rules specific methods
  getRoutingRules: async () => {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('content_type', 'routing_rules')
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    return data?.map(rule => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      is_active: rule.is_active,
      conditions: rule.options?.conditions || {},
      target_skills: rule.options?.target_skills || {},
      weight: rule.options?.weight || 1
    })) || [];
  },

  createRoutingRule: async (ruleData) => {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .insert({
        name: ruleData.name,
        description: ruleData.description,
        content_type: 'routing_rules',
        field_type: 'metadata',
        options: {
          conditions: ruleData.conditions || {},
          target_skills: ruleData.target_skills || {},
          weight: ruleData.weight || 1
        },
        is_active: ruleData.is_active
      })
      .select()
      .single();

    return { data, error };
  },

  updateRoutingRule: async (ruleId, ruleData) => {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .update({
        name: ruleData.name,
        description: ruleData.description,
        options: {
          conditions: ruleData.conditions || {},
          target_skills: ruleData.target_skills || {},
          weight: ruleData.weight || 1
        },
        is_active: ruleData.is_active
      })
      .eq('id', ruleId)
      .select()
      .single();

    return { data, error };
  }
}; 