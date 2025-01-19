import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useRole } from '../../../contexts/RoleContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Bell, Settings, HelpCircle } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const Header = () => {
  const { user, signOut } = useAuth();
  const { userRole } = useRole();
  const [showSearch, setShowSearch] = useState(false);
  const { isMobile } = useSidebar();

  const getHeaderActions = () => {
    const commonActions = [
      {
        label: 'Search',
        icon: Search,
        onClick: () => setShowSearch(true),
        show: !showSearch,
      }
    ];

    switch (userRole) {
      case 'admin':
        return [
          ...commonActions,
          {
            label: 'Settings',
            icon: Settings,
            onClick: () => {/* Add settings handler */},
          },
          {
            label: 'Notifications',
            icon: Bell,
            onClick: () => {/* Add notifications handler */},
          }
        ];
      case 'agent':
        return [
          ...commonActions,
          {
            label: 'Notifications',
            icon: Bell,
            onClick: () => {/* Add notifications handler */},
          }
        ];
      case 'customer':
        return [
          ...commonActions,
          {
            label: 'Help',
            icon: HelpCircle,
            onClick: () => {/* Add help handler */},
          }
        ];
      default:
        return commonActions;
    }
  };
  
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex items-center gap-2 px-4">
        {isMobile ? <SidebarTrigger /> : null}
      </div>
      
      <div className="ml-auto flex items-center gap-2 px-4">
        {/* Search Input */}
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="w-[300px] pl-8"
              autoFocus
              onBlur={() => setShowSearch(false)}
            />
          </div>
        )}

        {/* Header Actions */}
        {getHeaderActions().map((action, index) => (
          action.show !== false && (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 btn-icon"
                  onClick={action.onClick}
                >
                  <action.icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{action.label}</TooltipContent>
            </Tooltip>
          )
        ))}

        {/* Profile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full bg-primary/10 btn-ghost"
            >
              <span className="flex h-full w-full items-center justify-center text-xs font-medium">
                {user?.email?.[0].toUpperCase()}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-muted-foreground">
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={signOut}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header; 