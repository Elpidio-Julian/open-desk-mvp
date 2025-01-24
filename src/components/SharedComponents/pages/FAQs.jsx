import React, { useState } from 'react';
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

const FAQs = () => {
  const [activeCategory, setActiveCategory] = useState("getting-started");

  const faqsByCategory = {
    "getting-started": {
      label: "Getting Started",
      items: [
        {
          question: "How do I create a new support ticket?",
          answer: "To create a new ticket, click the 'Create New Ticket' button in your dashboard. Fill in the title, description, and select the appropriate category and priority level. We'll respond to your ticket as soon as possible."
        },
        {
          question: "What information should I include in my ticket?",
          answer: "Include:\n- Clear description of the issue\n- Steps to reproduce the problem\n- Any error messages you've received\n- What you've already tried\n- Impact on your work"
        }
      ]
    },
    "ticket-management": {
      label: "Ticket Management",
      items: [
        {
          question: "What do the different ticket priorities mean?",
          answer: "Low Priority: General inquiries and minor issues\nMedium Priority: Issues affecting your work but with workarounds available\nHigh Priority: Critical issues severely impacting your operations"
        },
        {
          question: "Can I update my ticket after submitting it?",
          answer: "Yes, you can add comments to your ticket at any time. This is helpful for providing additional information or responding to agent questions. You can also mark your ticket as resolved when your issue is fixed."
        },
        {
          question: "How do I view my ticket history?",
          answer: "All your tickets are visible in your dashboard. Active tickets appear at the top, and you can view closed tickets by clicking the 'Closed Tickets' button at the bottom of the list."
        }
      ]
    },
    "response-times": {
      label: "Response Times",
      items: [
        {
          question: "How long will it take to get a response?",
          answer: "Our response times vary based on ticket priority:\nHigh Priority: Within 2 hours\nMedium Priority: Within 8 hours\nLow Priority: Within 24 hours\nThese are estimated times and may vary based on ticket volume."
        },
        {
          question: "What should I do if my issue is urgent?",
          answer: "For urgent issues, create a ticket with 'High' priority and provide as much detail as possible. This helps our support team understand and address your issue quickly."
        },
        {
          question: "What are your support hours?",
          answer: "Our support team is available:\nMonday-Friday: 9:00 AM - 6:00 PM\nUrgent issues are monitored 24/7 for high-priority tickets."
        }
      ]
    },
    "feedback": {
      label: "Feedback & Resolution",
      items: [
        {
          question: "How do I provide feedback on support?",
          answer: "When a ticket is resolved, you'll have the option to provide feedback through a rating system and comments. This helps us improve our support quality."
        },
        {
          question: "What happens after I mark a ticket as resolved?",
          answer: "After marking a ticket as resolved, you'll be prompted to provide feedback. The ticket will then be moved to your closed tickets list, but can be referenced or reopened if needed."
        }
      ]
    }
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1">
          <Header />
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="container mx-auto p-8 max-w-4xl">
              <h1 className="text-2xl font-bold mb-6">Frequently Asked Questions</h1>
              
              <Tabs defaultValue={activeCategory} onValueChange={setActiveCategory}>
                <TabsList className="mb-4">
                  {Object.entries(faqsByCategory).map(([key, category]) => (
                    <TabsTrigger key={key} value={key}>
                      {category.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(faqsByCategory).map(([key, category]) => (
                  <TabsContent key={key} value={key}>
                    <Card className="p-6">
                      <h2 className="text-xl font-semibold mb-4">{category.label}</h2>
                      <Accordion type="single" collapsible className="space-y-2">
                        {category.items.map((faq, index) => (
                          <AccordionItem key={index} value={`item-${index}`}>
                            <AccordionTrigger className="text-left">
                              {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground whitespace-pre-line">
                              {faq.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default FAQs; 