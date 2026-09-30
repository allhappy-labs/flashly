/**
 * Author Badge - Display author info with link to profile
 */

import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { User, ExternalLink } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface AuthorBadgeProps {
  userId: string;
  userName: string;
  userImage?: string | null;
  showLink?: boolean;
}

export function AuthorBadge({
  userId,
  userName,
  userImage,
  showLink = true,
}: AuthorBadgeProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (showLink) {
      navigate({ to: `/users/${userId}` });
    }
  };

  return (
    <div
      className={`flex items-center gap-2 ${showLink ? 'cursor-pointer hover:underline' : ''}`}
      onClick={handleClick}
    >
      <Avatar className="h-6 w-6">
        <AvatarImage src={userImage || undefined} alt={userName} />
        <AvatarFallback>
          <User className="h-3 w-3" />
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{userName}</span>
      {showLink && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
    </div>
  );
}
