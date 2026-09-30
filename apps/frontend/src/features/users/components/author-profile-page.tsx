/**
 * Author Profile Page - Display author profile with decks
 */

import * as React from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { User, Link as LinkIcon, Twitter } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AuthorStats } from './author-stats';
import { AuthorDecksGrid } from './author-decks-grid';
import { FollowButton } from './follow-button';
import { useAuthorProfile } from '../hooks/use-author-profile';
import { useFollow, useUnfollow } from '../hooks/use-follow';

export function AuthorProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const userId = typeof params.id === 'string' ? params.id : null;

  const { data: profile, error, isLoading, refetch } = useAuthorProfile(userId ?? '', {
    executeOnMount: Boolean(userId),
  });

  const { mutate: follow } = useFollow({
    onSuccess: () => {
      toast.success(t('users.follow.success'));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || t('users.follow.error'));
    },
  });

  const { mutate: unfollow } = useUnfollow({
    onSuccess: () => {
      toast.success(t('users.unfollow.success'));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || t('users.unfollow.error'));
    },
  });

  React.useEffect(() => {
    if (!userId) {
      navigate({ to: '/marketplace' });
    }
  }, [navigate, userId]);

  if (!userId) {
    return null;
  }

  const handleFollowToggle = () => {
    if (profile?.isFollowing) {
      unfollow(userId);
    } else {
      follow(userId);
    }
  };

  const handleDeckClick = (deckId: string) => {
    navigate({ to: `/marketplace/${deckId}` });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-32 bg-muted rounded animate-pulse" />
          <div className="h-48 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <p className="text-destructive">{error?.message || t('users.notFound')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <button
            onClick={() => navigate({ to: '/marketplace' })}
            className="text-muted-foreground hover:text-foreground"
          >
            ← {t('common.back')}
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Profile Header */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                {/* Avatar */}
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile.image || undefined} alt={profile.name} />
                  <AvatarFallback>
                    <User className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-2xl font-bold">{profile.name}</h1>
                      {profile.username && (
                        <p className="text-sm text-muted-foreground">@{profile.username}</p>
                      )}
                    </div>
                    <FollowButton
                      userId={userId}
                      isFollowing={profile.isFollowing || false}
                      onToggle={handleFollowToggle}
                    />
                  </div>

                  {/* Bio */}
                  {profile.bio && (
                    <p className="text-sm text-muted-foreground">{profile.bio}</p>
                  )}

                  {/* Links */}
                  <div className="flex items-center gap-4 text-sm">
                    {profile.website && (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <LinkIcon className="h-4 w-4" />
                        {t('users.website')}
                      </a>
                    )}
                    {profile.twitterHandle && (
                      <a
                        href={`https://twitter.com/${profile.twitterHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Twitter className="h-4 w-4" />
                        @{profile.twitterHandle}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Stats */}
              <AuthorStats
                deckCount={profile.deckCount}
                downloadCount={profile.totalDownloads}
                followerCount={profile.followerCount}
              />
            </CardContent>
          </Card>

          {/* Decks Section */}
          <div>
            <h2 className="text-xl font-semibold mb-4">{t('users.decks.title')}</h2>
            <AuthorDecksGrid userId={userId} onDeckClick={handleDeckClick} />
          </div>
        </div>
      </div>
    </div>
  );
}
