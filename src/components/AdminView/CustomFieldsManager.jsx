import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Pencil, Trash2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { supabase } from '../../services/supabase';

export default function CustomFieldsManager() {
  const [fields, setFields] = useState([]);
  const [alert, setAlert] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [deleteConfirmField, setDeleteConfirmField] = useState(null);
  const [issueCategoriesEnabled, setIssueCategoriesEnabled] = useState(false);
  const [newField, setNewField] = useState({
    name: '',
    field_type: 'text',
    is_required: false,
    options: []
  });
  const [newOption, setNewOption] = useState('');

  const FIELD_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'boolean', label: 'Yes/No' },
    { value: 'select', label: 'Select' }
  ];

  const DEFAULT_CATEGORIES = [
    'Technical Issue',
    'Account Access',
    'Billing',
    'Feature Request',
    'General Inquiry'
  ];

  useEffect(() => {
    loadFields();
    checkIssueCategoriesEnabled();
  }, []);

  const checkIssueCategoriesEnabled = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('name', 'Issue Category')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setIssueCategoriesEnabled(!!data);
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to check issue categories status: ' + error.message
      });
    }
  };

  const handleToggleIssueCategories = async (enabled) => {
    try {
      if (enabled) {
        // Create the Issue Category field
        const { error } = await supabase
          .from('custom_field_definitions')
          .insert([{
            name: 'Issue Category',
            field_type: 'select',
            is_required: true,
            options: DEFAULT_CATEGORIES
          }]);

        if (error) throw error;

        setAlert({
          type: 'success',
          message: 'Issue categories enabled successfully!'
        });
      } else {
        // Find and delete the Issue Category field
        const { data: categoryField } = await supabase
          .from('custom_field_definitions')
          .select('id')
          .eq('name', 'Issue Category')
          .single();

        if (categoryField) {
          const { error } = await supabase
            .from('custom_field_definitions')
            .delete()
            .eq('id', categoryField.id);

          if (error) throw error;
        }

        setAlert({
          type: 'success',
          message: 'Issue categories disabled successfully!'
        });
      }

      setIssueCategoriesEnabled(enabled);
      loadFields();
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to toggle issue categories: ' + error.message
      });
    }
  };

  const loadFields = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .order('name');

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to load custom fields: ' + error.message
      });
    }
  };

  const handleCreateField = async () => {
    try {
      const { error } = await supabase
        .from('custom_field_definitions')
        .insert([{
          name: newField.name,
          field_type: newField.field_type,
          is_required: newField.is_required,
          options: newField.field_type === 'select' ? newField.options : null
        }]);

      if (error) throw error;

      setAlert({
        type: 'success',
        message: 'Custom field created successfully!'
      });
      
      setNewField({
        name: '',
        field_type: 'text',
        is_required: false,
        options: []
      });
      
      loadFields();
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to create custom field: ' + error.message
      });
    }
  };

  const handleUpdateField = async () => {
    try {
      const { error } = await supabase
        .from('custom_field_definitions')
        .update({
          name: editingField.name,
          field_type: editingField.field_type,
          is_required: editingField.is_required,
          options: editingField.field_type === 'select' ? editingField.options : null
        })
        .eq('id', editingField.id);

      if (error) throw error;

      setAlert({
        type: 'success',
        message: 'Custom field updated successfully!'
      });
      
      setEditingField(null);
      loadFields();
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to update custom field: ' + error.message
      });
    }
  };

  const handleDeleteField = async (id) => {
    try {
      const { error } = await supabase
        .from('custom_field_definitions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAlert({
        type: 'success',
        message: 'Custom field deleted successfully!'
      });
      
      setDeleteConfirmField(null);
      loadFields();
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to delete custom field: ' + error.message
      });
    }
  };

  const addOption = (isNewField = true) => {
    if (!newOption.trim()) return;
    
    if (isNewField) {
      setNewField(prev => ({
        ...prev,
        options: [...(prev.options || []), newOption.trim()]
      }));
    } else {
      setEditingField(prev => ({
        ...prev,
        options: [...(prev.options || []), newOption.trim()]
      }));
    }
    
    setNewOption('');
  };

  const removeOption = (optionToRemove, isNewField = true) => {
    if (isNewField) {
      setNewField(prev => ({
        ...prev,
        options: prev.options.filter(opt => opt !== optionToRemove)
      }));
    } else {
      setEditingField(prev => ({
        ...prev,
        options: prev.options.filter(opt => opt !== optionToRemove)
      }));
    }
  };

  return (
    <div className="space-y-6">
      {alert && (
        <Alert variant={alert.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      {/* Issue Categories Toggle */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Issue Categories</h3>
            <p className="text-sm text-muted-foreground">
              Enable predefined categories for support tickets
            </p>
          </div>
          <Switch
            checked={issueCategoriesEnabled}
            onCheckedChange={handleToggleIssueCategories}
          />
        </div>
      </Card>

      {/* Create New Field */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Create Custom Field</h3>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Field Name</Label>
              <Input
                value={newField.name}
                onChange={(e) => setNewField(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter field name"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select
                value={newField.field_type}
                onValueChange={(value) => setNewField(prev => ({ 
                  ...prev, 
                  field_type: value,
                  options: value === 'select' ? [] : null
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field type" />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="required"
              checked={newField.is_required}
              onCheckedChange={(checked) => setNewField(prev => ({ ...prev, is_required: checked }))}
            />
            <Label htmlFor="required">Required Field</Label>
          </div>

          {newField.field_type === 'select' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Enter option"
                />
                <Button 
                  variant="outline"
                  onClick={() => addOption(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Option
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {newField.options?.map((option, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    {option}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0"
                      onClick={() => removeOption(option, true)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleCreateField}
            disabled={!newField.name || (newField.field_type === 'select' && (!newField.options || newField.options.length === 0))}
          >
            Create Field
          </Button>
        </div>
      </Card>

      {/* Existing Fields */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Custom Fields</h3>
        <div className="space-y-4">
          {fields.map((field) => (
            <Card key={field.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium">{field.name}</h4>
                  <div className="flex gap-2 mt-1">
                    <Badge>{field.field_type}</Badge>
                    {field.is_required && (
                      <Badge variant="secondary">Required</Badge>
                    )}
                  </div>
                  {field.field_type === 'select' && field.options && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {field.options.map((option, index) => (
                        <Badge key={index} variant="outline">
                          {option}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingField(field)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirmField(field)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      {/* Edit Field Dialog */}
      <Dialog open={!!editingField} onOpenChange={() => setEditingField(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Custom Field</DialogTitle>
          </DialogHeader>
          
          {editingField && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Field Name</Label>
                <Input
                  value={editingField.name}
                  onChange={(e) => setEditingField(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-required"
                  checked={editingField.is_required}
                  onCheckedChange={(checked) => setEditingField(prev => ({ ...prev, is_required: checked }))}
                />
                <Label htmlFor="edit-required">Required Field</Label>
              </div>

              {editingField.field_type === 'select' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder="Enter option"
                    />
                    <Button 
                      variant="outline"
                      onClick={() => addOption(false)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {editingField.options?.map((option, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="flex items-center gap-2"
                      >
                        {option}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => removeOption(option, false)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingField(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateField}
              disabled={!editingField?.name || (editingField?.field_type === 'select' && (!editingField?.options || editingField?.options.length === 0))}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmField} onOpenChange={() => setDeleteConfirmField(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Custom Field</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the field "{deleteConfirmField?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmField(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteField(deleteConfirmField.id)}
            >
              Delete Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 