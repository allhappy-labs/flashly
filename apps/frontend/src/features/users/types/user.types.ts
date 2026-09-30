/**
 * User Types
 */

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  image: string | null;
  bio: string | null;
  website: string | null;
  twitterHandle: string | null;
  followerCount: number;
  isFollowing?: boolean;
  deckCount: number;
  totalDownloads: number;
}

export interface UserDeck {
  id: string;
  name: string;
  description: string | null;
  cardCount: number;
  downloadCount: number;
  createdAt: Date | string;
}
