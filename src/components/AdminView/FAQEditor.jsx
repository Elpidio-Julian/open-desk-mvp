import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Label } from "../ui/label";
import { Pencil, Trash2, Plus, MoveUp, MoveDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function FAQEditor() {
  const [items, setItems] = useState([]);
  const [alert, setAlert] = useState(null);
  const [activeTab, setActiveTab] = useState('faqs');
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({
    name: '',
    content_type: 'faq',
    category: '',
    content: ''
  });
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadItems();
  }, [activeTab]);

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .in('content_type', [activeTab === 'faqs' ? 'faq' : 'article'])
        .order('order_index');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to load items: ' + error.message
      });
    }
  };

  const handleCreateItem = async () => {
    try {
      const { error } = await supabase
        .from('custom_field_definitions')
        .insert([{
          name: newItem.name,
          content_type: activeTab === 'faqs' ? 'faq' : 'article',
          category: newItem.category,
          content: newItem.content,
          field_type: 'text',
          order_index: items.length
        }]);

      if (error) throw error;

      setAlert({
        type: 'success',
        message: `${activeTab === 'faqs' ? 'FAQ' : 'Article'} created successfully!`
      });
      
      setNewItem({
        name: '',
        content_type: activeTab === 'faqs' ? 'faq' : 'article',
        category: '',
        content: ''
      });
      
      loadItems();
    } catch (error) {
      setAlert({
        type: 'error',
        message: `Failed to create ${activeTab === 'faqs' ? 'FAQ' : 'article'}: ` + error.message
      });
    }
  };

  const handleUpdateItem = async () => {
    try {
      const { error } = await supabase
        .from('custom_field_definitions')
        .update({
          name: editingItem.name,
          category: editingItem.category,
          content: editingItem.content
        })
        .eq('id', editingItem.id);

      if (error) throw error;

      setAlert({
        type: 'success',
        message: `${activeTab === 'faqs' ? 'FAQ' : 'Article'} updated successfully!`
      });
      
      setEditingItem(null);
      loadItems();
    } catch (error) {
      setAlert({
        type: 'error',
        message: `Failed to update ${activeTab === 'faqs' ? 'FAQ' : 'article'}: ` + error.message
      });
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      const { error } = await supabase
        .from('custom_field_definitions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAlert({
        type: 'success',
        message: `${activeTab === 'faqs' ? 'FAQ' : 'Article'} deleted successfully!`
      });
      
      loadItems();
    } catch (error) {
      setAlert({
        type: 'error',
        message: `Failed to delete ${activeTab === 'faqs' ? 'FAQ' : 'article'}: ` + error.message
      });
    }
  };

  const handleMoveItem = async (id, direction) => {
    const currentIndex = items.findIndex(item => item.id === id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === items.length - 1)
    ) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newItems = [...items];
    [newItems[currentIndex], newItems[newIndex]] = [newItems[newIndex], newItems[currentIndex]];

    try {
      const updates = newItems.map((item, index) => ({
        id: item.id,
        order_index: index
      }));

      const { error } = await supabase
        .from('custom_field_definitions')
        .upsert(updates);

      if (error) throw error;
      loadItems();
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to reorder items: ' + error.message
      });
    }
  };

  return (
    <div className="space-y-6">
      {alert && (
        <Alert variant={alert.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
          <TabsTrigger value="articles">Articles</TabsTrigger>
        </TabsList>

        <TabsContent value="faqs">
          <Card>
            <CardHeader>
              <CardTitle>Manage FAQs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* New FAQ Form */}
                <div className="space-y-4">
                  <Input
                    placeholder="FAQ Question"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  />
                  <Input
                    placeholder="Category"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  />
                  <Textarea
                    placeholder="Answer (supports markdown)"
                    value={newItem.content}
                    onChange={(e) => setNewItem({ ...newItem, content: e.target.value })}
                    rows={4}
                  />
                  <Button onClick={handleCreateItem} disabled={!newItem.name || !newItem.content}>
                    Add FAQ
                  </Button>
                </div>

                {/* Existing FAQs */}
                <div className="space-y-4">
                  {items.map((item) => (
                    <Card key={item.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2 flex-1">
                          <div className="font-medium">{item.name}</div>
                          {item.category && (
                            <Badge variant="outline">{item.category}</Badge>
                          )}
                          <div className="text-sm text-muted-foreground whitespace-pre-line">
                            {item.content}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveItem(item.id, 'up')}
                          >
                            <MoveUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveItem(item.id, 'down')}
                          >
                            <MoveDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingItem(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="articles">
          <Card>
            <CardHeader>
              <CardTitle>Manage Articles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* New Article Form */}
                <div className="space-y-4">
                  <Input
                    placeholder="Article Title"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  />
                  <Input
                    placeholder="Category"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  />
                  <div className="flex justify-between items-center mb-2">
                    <Label>Content (supports markdown)</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      {showPreview ? 'Edit' : 'Preview'}
                    </Button>
                  </div>
                  {showPreview ? (
                    <Card className="p-4 prose dark:prose-invert max-w-none">
                      <ReactMarkdown>{newItem.content}</ReactMarkdown>
                    </Card>
                  ) : (
                    <Textarea
                      value={newItem.content}
                      onChange={(e) => setNewItem({ ...newItem, content: e.target.value })}
                      rows={8}
                    />
                  )}
                  <Button onClick={handleCreateItem} disabled={!newItem.name || !newItem.content}>
                    Add Article
                  </Button>
                </div>

                {/* Existing Articles */}
                <div className="space-y-4">
                  {items.map((item) => (
                    <Card key={item.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2 flex-1">
                          <div className="font-medium">{item.name}</div>
                          {item.category && (
                            <Badge variant="outline">{item.category}</Badge>
                          )}
                          <Card className="p-4 prose dark:prose-invert max-w-none">
                            <ReactMarkdown>{item.content}</ReactMarkdown>
                          </Card>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveItem(item.id, 'up')}
                          >
                            <MoveUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveItem(item.id, 'down')}
                          >
                            <MoveDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingItem(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit {activeTab === 'faqs' ? 'FAQ' : 'Article'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder={activeTab === 'faqs' ? 'FAQ Question' : 'Article Title'}
              value={editingItem?.name || ''}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
            />
            <Input
              placeholder="Category"
              value={editingItem?.category || ''}
              onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
            />
            <div className="flex justify-between items-center mb-2">
              <Label>Content (supports markdown)</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? 'Edit' : 'Preview'}
              </Button>
            </div>
            {showPreview ? (
              <Card className="p-4 prose dark:prose-invert max-w-none">
                <ReactMarkdown>{editingItem?.content || ''}</ReactMarkdown>
              </Card>
            ) : (
              <Textarea
                value={editingItem?.content || ''}
                onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                rows={8}
              />
            )}
            <Button onClick={handleUpdateItem} disabled={!editingItem?.name || !editingItem?.content}>
              Update {activeTab === 'faqs' ? 'FAQ' : 'Article'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 