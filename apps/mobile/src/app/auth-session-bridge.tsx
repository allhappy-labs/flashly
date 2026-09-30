import React, { useEffect } from 'react';
import { authClient } from '../services/auth/auth-client';

function getObjectProperty(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  return Reflect.get(value, key);
}

function getBooleanProperty(value: unknown, key: string): boolean | undefined {
  const property = getObjectProperty(value, key);
  return typeof property === 'boolean' ? property : undefined;
}

function getNullableStringProperty(value: unknown, key: string): string | null | undefined {
  const property = getObjectProperty(value, key);
  if (typeof property === 'string') {
    return property;
  }
  if (property === null) {
    return null;
  }
  return undefined;
}

function getSessionUserId(sessionData: unknown): string | null {
  const user = getObjectProperty(sessionData, 'user');
  const userId = getNullableStringProperty(user, 'id');
  return typeof userId === 'string' ? userId : null;
}

function getSessionTokenInfo(sessionData: unknown): {
  token: string | null;
  sessionToken: string | null;
  userId: string | null;
} {
  const session = getObjectProperty(sessionData, 'session');
  const token = getNullableStringProperty(session, 'token');
  const sessionToken = getNullableStringProperty(session, 'sessionToken');
  const userId = getNullableStringProperty(session, 'userId');

  return {
    token: typeof token === 'string' ? token : null,
    sessionToken: typeof sessionToken === 'string' ? sessionToken : null,
    userId: typeof userId === 'string' ? userId : null,
  };
}

type AuthSessionBridgeProps = {
  onStateChange: (state: {
    isPending: boolean;
    isAuthenticated: boolean;
    userId: string | null;
    sessionToken: string | null;
  }) => void;
};

export function AuthSessionBridge(props: Readonly<AuthSessionBridgeProps>) {
  const onStateChange = props.onStateChange;
  const sessionQuery = authClient.useSession();
  const sessionData = sessionQuery.data ?? null;
  const isPending =
    getBooleanProperty(sessionQuery, 'isPending') ??
    getBooleanProperty(sessionQuery, 'isLoading') ??
    false;
  const sessionUserId = getSessionUserId(sessionData);
  const sessionRecord = getSessionTokenInfo(sessionData);
  const resolvedUserId = sessionUserId ?? sessionRecord.userId;
  const resolvedSessionToken = sessionRecord.token ?? sessionRecord.sessionToken;
  const isAuthenticated = Boolean(sessionUserId || resolvedUserId);

  useEffect(() => {
    onStateChange({
      isPending,
      isAuthenticated,
      userId: resolvedUserId,
      sessionToken: resolvedSessionToken,
    });
  }, [isAuthenticated, isPending, onStateChange, resolvedSessionToken, resolvedUserId]);

  return null;
}
