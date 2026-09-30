/**
 * Follow Button - Follow/unfollow a user
 */

import { useTranslation } from 'react-i18next';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useFollow, useUnfollow } from '../hooks/use-follow';

export interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
  onToggle?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
}

export function FollowButton({
  userId,
  isFollowing,
  onToggle,
  variant = 'outline',
}: FollowButtonProps) {
  const { t } = useTranslation();

  const { mutate: follow, isPending: isFollowingLoading } = useFollow({
    onSuccess: onToggle,
  });

  const { mutate: unfollow, isPending: isUnfollowingLoading } = useUnfollow({
    onSuccess: onToggle,
  });

  const isLoading = isFollowingLoading || isUnfollowingLoading;

  const handleToggle = () => {
    if (isFollowing) {
      unfollow(userId);
    } else {
      follow(userId);
    }
  };

  return (
    <Button
      variant={isFollowing ? 'outline' : variant}
      size="sm"
      onClick={handleToggle}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : isFollowing ? (
        <UserMinus className="h-4 w-4 mr-2" />
      ) : (
        <UserPlus className="h-4 w-4 mr-2" />
      )}
      {isFollowing ? t('users.unfollow') : t('users.follow')}
    </Button>
  );
}
