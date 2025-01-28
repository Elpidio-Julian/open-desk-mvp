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
  }
}; 