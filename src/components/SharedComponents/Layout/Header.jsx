import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useRole } from '../../../contexts/RoleContext';
import { notificationsService } from '../../../services/api/notifications';
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
import { Badge } from "@/components/ui/badge";

const Header = () => {
  const { user, signOut } = useAuth();
  const { userRole } = useRole();
  const [showSearch, setShowSearch] = useState(false);
  const { isMobile } = useSidebar();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user && userRole === 'agent') {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [user, userRole]);
  
  const handleHelpClick = () => {
    window.location.href = '/faqs';
  };

  const loadNotifications = async () => {
    try {
      const [notificationsResult, countResult] = await Promise.all([
        notificationsService.getNotifications(user.id, { limit: 5 }),
        notificationsService.getUnreadCount(user.id)
      ]);

      if (!notificationsResult.error && !countResult.error) {
        setNotifications(notificationsResult.data || []);
        setUnreadCount(countResult.count || 0);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const { error } = await notificationsService.markAsRead(notificationId);
      if (!error) {
        loadNotifications();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { error } = await notificationsService.markAllAsRead(user.id);
      if (!error) {
        loadNotifications();
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };
  
  const renderNotificationsDropdown = () => {
    if (userRole !== 'agent' && userRole !== 'admin') return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex justify-between items-center">
            Notifications
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-xs"
              >
                Mark all as read
              </Button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex flex-col items-start p-3 cursor-pointer"
                onClick={() => handleMarkAsRead(notification.id)}
              >
                <div className="font-medium">{notification.title}</div>
                <div className="text-sm text-muted-foreground">{notification.content}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(notification.created_at).toLocaleString()}
                </div>
                {!notification.is_read && (
                  <Badge className="mt-1" variant="secondary">New</Badge>
                )}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const getHeaderActions = () => {
    const commonActions = [
      {
        label: 'Search',
        icon: Search,
        onClick: () => setShowSearch(true),
        show: !showSearch,
      },
      {
        label: 'Help',
        icon: HelpCircle,
        onClick: () => {handleHelpClick()},
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
          }
        ];
      case 'agent':
        return [
          ...commonActions,
        ];
      case 'customer':
        return [
          ...commonActions,
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
        {renderNotificationsDropdown()}
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