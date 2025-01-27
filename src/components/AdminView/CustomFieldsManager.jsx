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
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { supabase } from '../../services/supabase';
import { customFieldsService } from '../../services/api/customFields';

const PREDEFINED_FIELDS = {
  'Issue Category': {
    fieldType: 'select',
    description: 'Categories for classifying support tickets',
    contentType: 'field',
    isRequired: true
  },
  'Agent Tags': {
    fieldType: 'metadata',
    description: 'Tags for classifying and filtering agents',
    contentType: 'field',
    isRequired: false
  },
  'Team Tags': {
    fieldType: 'metadata',
    description: 'Tags for classifying and filtering teams',
    contentType: 'field',
    isRequired: false
  },
  'Focus Areas': {
    fieldType: 'metadata',
    description: 'Areas of expertise or responsibility for teams',
    contentType: 'field',
    isRequired: false
  },
  'Team Skills': {
    fieldType: 'metadata',
    description: 'Skills and capabilities associated with teams',
    contentType: 'field',
    isRequired: false
  },
  'Agent Skills': {
    fieldType: 'metadata',
    description: 'Skills and capabilities of agents',
    contentType: 'field',
    isRequired: false
  }
};

export default function CustomFieldsManager() {
  const [fields, setFields] = useState([]);
  const [error, setError] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [deleteConfirmField, setDeleteConfirmField] = useState(null);
  const [issueCategoriesEnabled, setIssueCategoriesEnabled] = useState(false);
  const [newField, setNewField] = useState({
    name: '',
    description: '',
    fieldType: '',
    options: [],
    isRequired: false,
    isActive: true
  });
  const [newOption, setNewOption] = useState('');
  const [loading, setLoading] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState({ key: '', value: '' });
  const [editKeyValue, setEditKeyValue] = useState({ key: '', value: '' });

  const FIELD_TYPES = [
    { value: 'metadata', label: 'Metadata' },
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
    fetchFields();
    checkIssueCategoriesEnabled();
  }, []);

  const checkIssueCategoriesEnabled = async () => {
    try {
      const { data, error } = await customFieldsService.getFieldByName('Issue Category');
      if (error && error.code !== 'PGRST116') throw error;
      setIssueCategoriesEnabled(!!data);
    } catch (err) {
      console.error('Error checking issue categories:', err);
      setError(err.message);
    }
  };

  const handleToggleIssueCategories = async (enabled) => {
    try {
      setLoading(true);
      if (enabled) {
        const { error } = await customFieldsService.createField({
          name: 'Issue Category',
          description: 'Category of the support ticket',
          contentType: 'field',
          fieldType: 'select',
          options: DEFAULT_CATEGORIES,
          isRequired: true,
          isActive: true
        });
        if (error) throw error;
      } else {
        const { data: categoryField } = await customFieldsService.getFieldByName('Issue Category');
        if (categoryField) {
          const { error } = await customFieldsService.deleteField(categoryField.id);
          if (error) throw error;
        }
      }

      setIssueCategoriesEnabled(enabled);
      await fetchFields();
    } catch (err) {
      console.error('Error toggling issue categories:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await customFieldsService.listFields();
      if (error) throw error;
      setFields(data || []);
    } catch (err) {
      console.error('Error fetching fields:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (value) => {
    const predefinedField = PREDEFINED_FIELDS[value];
    if (predefinedField) {
      setNewField({
        ...newField,
        name: value,
        fieldType: predefinedField.fieldType,
        description: predefinedField.description,
        contentType: predefinedField.contentType,
        isRequired: predefinedField.isRequired
      });
    }
  };

  // Get available field names (not yet created)
  const getAvailableFieldNames = () => {
    const existingFieldNames = new Set(fields.map(field => field.name));
    return Object.keys(PREDEFINED_FIELDS).filter(name => !existingFieldNames.has(name));
  };

  const createField = async () => {
    try {
      setLoading(true);
      setError(null);

      // Prepare options based on field type
      let processedOptions = null;
      if (newField.fieldType === 'select') {
        processedOptions = newField.options;
      } else if (newField.fieldType === 'metadata') {
        // Convert key-value pairs to object
        processedOptions = newField.options.reduce((acc, pair) => {
          acc[pair.key] = pair.value;
          return acc;
        }, {});
      }

      const fieldData = {
        ...newField,
        options: processedOptions
      };

      const { error } = await customFieldsService.createField(fieldData);
      if (error) throw error;

      await fetchFields();
      setNewField({
        name: '',
        description: '',
        fieldType: '',
        options: [],
        isRequired: false,
        isActive: true
      });
    } catch (err) {
      console.error('Error creating field:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditField = (field) => {
    // Convert options object to array of key-value pairs for metadata fields
    if (field.field_type === 'metadata' && field.options) {
      const optionsArray = Object.entries(field.options).map(([key, value]) => ({
        key,
        value: value.toString()
      }));
      setEditingField({
        ...field,
        options: optionsArray
      });
    } else {
      setEditingField(field);
    }
  };

  const handleUpdateField = async () => {
    try {
      setLoading(true);
      setError(null);

      // Prepare options based on field type
      let processedOptions = null;
      if (editingField.field_type === 'select') {
        processedOptions = editingField.options;
      } else if (editingField.field_type === 'metadata') {
        // Convert key-value pairs to object
        processedOptions = editingField.options.reduce((acc, pair) => {
          acc[pair.key] = pair.value;
          return acc;
        }, {});
      }

      const { error } = await customFieldsService.updateField(editingField.id, {
        name: editingField.name,
        description: editingField.description,
        field_type: editingField.field_type,
        options: processedOptions,
        is_required: editingField.is_required,
        is_active: editingField.is_active
      });

      if (error) throw error;
      
      setEditingField(null);
      await fetchFields();
    } catch (err) {
      console.error('Error updating field:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteField = async (id) => {
    try {
      setLoading(true);
      const { error } = await customFieldsService.deleteField(id);
      if (error) throw error;
      
      setDeleteConfirmField(null);
      await fetchFields();
    } catch (err) {
      console.error('Error deleting field:', err);
      setError(err.message);
    } finally {
      setLoading(false);
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

  const addKeyValuePair = () => {
    if (!newKeyValue.key.trim() || !newKeyValue.value.trim()) {
      setError("Please enter both key and value");
      return;
    }

    // Check for duplicate key
    if (newField.options?.some(pair => pair.key === newKeyValue.key.trim())) {
      setError("This key already exists");
      return;
    }

    setNewField(prev => ({
      ...prev,
      options: [...(prev.options || []), { 
        key: newKeyValue.key.trim(), 
        value: newKeyValue.value.trim() 
      }]
    }));
    setNewKeyValue({ key: '', value: '' });
  };

  const removeKeyValuePair = (keyToRemove) => {
    setNewField(prev => ({
      ...prev,
      options: prev.options.filter(opt => opt.key !== keyToRemove)
    }));
  };

  const addEditKeyValuePair = () => {
    if (!editKeyValue.key.trim() || !editKeyValue.value.trim()) {
      setError("Please enter both key and value");
      return;
    }

    // Check for duplicate key
    if (editingField.options?.some(pair => pair.key === editKeyValue.key.trim())) {
      setError("This key already exists");
      return;
    }

    setEditingField(prev => ({
      ...prev,
      options: [...(prev.options || []), { 
        key: editKeyValue.key.trim(), 
        value: editKeyValue.value.trim() 
      }]
    }));
    setEditKeyValue({ key: '', value: '' });
  };

  const removeEditKeyValuePair = (keyToRemove) => {
    setEditingField(prev => ({
      ...prev,
      options: prev.options.filter(opt => opt.key !== keyToRemove)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
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
              <Select
                value={newField.name}
                onValueChange={handleNameChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Field Name" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableFieldNames().map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select
                value={newField.fieldType}
                disabled={true}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Field type" />
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
              checked={newField.isRequired}
              disabled={true}
            />
            <Label htmlFor="required" className={!newField.isRequired ? "text-muted-foreground" : ""}>
              Required Field
            </Label>
          </div>

          {/* Options Section */}
          {newField.fieldType === 'select' && (
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

          {/* Metadata Key-Value Pairs Section */}
          {newField.fieldType === 'metadata' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Key</Label>
                  <Input
                    value={newKeyValue.key}
                    onChange={(e) => setNewKeyValue(prev => ({ ...prev, key: e.target.value }))}
                    placeholder="Enter key"
                  />
                </div>
                <div className="flex-1">
                  <Label>Value</Label>
                  <Input
                    value={newKeyValue.value}
                    onChange={(e) => setNewKeyValue(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="Enter value"
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    variant="outline"
                    onClick={addKeyValuePair}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {newField.options?.map((pair, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    <span className="font-medium">{pair.key}:</span> {pair.value}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0"
                      onClick={() => removeKeyValuePair(pair.key)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={createField}
            disabled={!newField.name || (newField.fieldType === 'select' && (!newField.options || newField.options.length === 0))}
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
                  {field.field_type === 'metadata' && field.options && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(field.options).map(([key, value], index) => (
                        <Badge key={index} variant="outline">
                          <span className="font-medium">{key}:</span> {value}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditField(field)}
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
                  disabled={true}
                />
              </div>

              <div className="space-y-2">
                <Label>Field Type</Label>
                <Input
                  value={editingField.field_type}
                  disabled={true}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-required"
                  checked={editingField.is_required}
                  disabled={true}
                />
                <Label 
                  htmlFor="edit-required"
                  className={!editingField.is_required ? "text-muted-foreground" : ""}
                >
                  Required Field
                </Label>
              </div>

              {/* Edit Options Section */}
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

              {/* Edit Metadata Key-Value Pairs Section */}
              {editingField.field_type === 'metadata' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label>Key</Label>
                      <Input
                        value={editKeyValue.key}
                        onChange={(e) => setEditKeyValue(prev => ({ ...prev, key: e.target.value }))}
                        placeholder="Enter key"
                      />
                    </div>
                    <div className="flex-1">
                      <Label>Value</Label>
                      <Input
                        value={editKeyValue.value}
                        onChange={(e) => setEditKeyValue(prev => ({ ...prev, value: e.target.value }))}
                        placeholder="Enter value"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        variant="outline"
                        onClick={addEditKeyValuePair}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {editingField.options?.map((pair, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="flex items-center gap-2"
                      >
                        <span className="font-medium">{pair.key}:</span> {pair.value}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => removeEditKeyValuePair(pair.key)}
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
              disabled={
                !editingField?.name || 
                (editingField?.field_type === 'select' && (!editingField?.options || editingField?.options.length === 0))
              }
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