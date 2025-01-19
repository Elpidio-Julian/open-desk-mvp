import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRole } from '../../../contexts/RoleContext';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  useSidebar
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole } = useRole();
  
  const isActive = (path) => location.pathname === path;

  const getMainNavItem = () => {
    switch (userRole) {
      case 'customer':
        return {
          label: 'My Tickets',
          path: '/dashboard',
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          ),
        };
      case 'agent':
        return {
          label: 'Support Queue',
          path: '/dashboard',
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
        };
      case 'admin':
        return {
          label: 'Dashboard',
          path: '/dashboard',
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ),
        };
      default:
        return null;
    }
  };

  const mainNavItem = getMainNavItem();

  return (
    <Sidebar 
      variant="inset"
      className="flex w-14 border-r bg-sidebar text-sidebar-foreground"
      collapsible="icon"
    >
      <SidebarHeader className="flex h-14 items-center justify-center border-b">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate('/')}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Home</TooltipContent>
        </Tooltip>
      </SidebarHeader>
      <SidebarContent className="flex flex-col items-center gap-1 py-1">
        {mainNavItem && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isActive(mainNavItem.path) ? "secondary" : "ghost"}
                size="icon"
                className={cn(
                  "h-8 w-8",
                  isActive(mainNavItem.path) && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
                onClick={() => navigate(mainNavItem.path)}
              >
                <div className="flex h-4 w-4 items-center justify-center">
                  {mainNavItem.icon}
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{mainNavItem.label}</TooltipContent>
          </Tooltip>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

export default AppSidebar; 