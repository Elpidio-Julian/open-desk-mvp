import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { 
  Ticket,
  Users,
  BarChart,
  MessageSquare,
  Clock,
  Shield
} from 'lucide-react';

export default function Landing() {
  const features = [
    {
      title: "Smart Ticket Management",
      description: "Efficiently manage support tickets with automatic routing, priority handling, and status tracking.",
      icon: Ticket
    },
    {
      title: "Team Collaboration",
      description: "Work together seamlessly with shared ticket views, internal notes, and agent assignments.",
      icon: Users
    },
    {
      title: "Performance Analytics",
      description: "Track response times, resolution rates, and team performance with detailed analytics.",
      icon: BarChart
    },
    {
      title: "Customer Communication",
      description: "Keep customers informed with email notifications and a dedicated customer portal.",
      icon: MessageSquare
    },
    {
      title: "SLA Management",
      description: "Set and monitor Service Level Agreements to maintain high-quality support standards.",
      icon: Clock
    },
    {
      title: "Role-Based Access",
      description: "Secure your support system with role-based permissions for admins, agents, and customers.",
      icon: Shield
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="text-2xl font-bold">Better Ticket Master</div>
            <Link to="/login">
              <Button variant="outline">Sign In / Sign Up</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold sm:text-5xl">
            Modern Customer Support Solution
          </h1>
          <p className="mt-4 text-xl text-muted-foreground max-w-3xl mx-auto">
            Streamline your customer support with our intelligent ticketing system. 
            Automate ticket routing, track performance, and deliver exceptional customer service.
          </p>
          <div className="mt-8">
            <Link to="/login">
              <Button size="lg">Get Started</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="p-6">
              <feature.icon className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-muted-foreground">
            © 2025 Better Ticket Master. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
} 