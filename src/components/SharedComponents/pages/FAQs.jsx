import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../ui/accordion";
import { Card } from "../../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { SidebarProvider } from "../../ui/sidebar";
import AppSidebar from "../Layout/AppSidebar";
import Header from "../Layout/Header";
import { Alert, AlertDescription } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import ReactMarkdown from 'react-markdown';

const FAQs = () => {
  const [activeTab, setActiveTab] = useState("faqs");
  const [items, setItems] = useState([]);
  const [alert, setAlert] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    loadItems();
  }, [activeTab]);

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('content_type', activeTab === 'faqs' ? 'faq' : 'article')
        .order('order_index');

      if (error) throw error;

      // Extract unique categories
      const uniqueCategories = [...new Set(data.map(item => item.category).filter(Boolean))];
      setCategories(uniqueCategories);
      
      // If no category is selected, select the first one
      if (!selectedCategory && uniqueCategories.length > 0) {
        setSelectedCategory(uniqueCategories[0]);
      }

      setItems(data || []);
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Failed to load content: ' + error.message
      });
    }
  };

  const filteredItems = selectedCategory
    ? items.filter(item => item.category === selectedCategory)
    : items;

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1">
          <Header />
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="container mx-auto p-8 max-w-4xl">
              <h1 className="text-2xl font-bold mb-6">Help Center</h1>
              
              {alert && (
                <Alert variant={alert.type === 'error' ? 'destructive' : 'default'} className="mb-6">
                  <AlertDescription>{alert.message}</AlertDescription>
                </Alert>
              )}

              <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="faqs">FAQs</TabsTrigger>
                  <TabsTrigger value="articles">Articles</TabsTrigger>
                </TabsList>

                <TabsContent value="faqs">
                  {categories.length > 0 && (
                    <div className="flex gap-2 mb-4">
                      {categories.map(category => (
                        <Badge
                          key={category}
                          variant={selectedCategory === category ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => setSelectedCategory(category)}
                        >
                          {category}
                        </Badge>
                      ))}
                      <Badge
                        variant={selectedCategory === null ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => setSelectedCategory(null)}
                      >
                        All
                      </Badge>
                    </div>
                  )}

                  <Card className="p-6">
                    <Accordion type="single" collapsible className="space-y-2">
                      {filteredItems.map((faq, index) => (
                        <AccordionItem key={faq.id} value={`item-${index}`}>
                          <AccordionTrigger className="text-left">
                            {faq.name}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground whitespace-pre-line">
                            <ReactMarkdown>{faq.content}</ReactMarkdown>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </Card>
                </TabsContent>

                <TabsContent value="articles">
                  <div className="space-y-6">
                    {categories.length > 0 && (
                      <div className="flex gap-2">
                        {categories.map(category => (
                          <Badge
                            key={category}
                            variant={selectedCategory === category ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => setSelectedCategory(category)}
                          >
                            {category}
                          </Badge>
                        ))}
                        <Badge
                          variant={selectedCategory === null ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => setSelectedCategory(null)}
                        >
                          All
                        </Badge>
                      </div>
                    )}

                    {filteredItems.map((article) => (
                      <Card key={article.id} className="p-6">
                        <h2 className="text-xl font-semibold mb-2">{article.name}</h2>
                        {article.category && (
                          <Badge variant="outline" className="mb-4">
                            {article.category}
                          </Badge>
                        )}
                        <div className="prose dark:prose-invert max-w-none">
                          <ReactMarkdown>{article.content}</ReactMarkdown>
                        </div>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default FAQs; 