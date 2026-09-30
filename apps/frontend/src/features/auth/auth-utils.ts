import { authClient } from './auth-client';
import { AUTH_CALLBACKS } from './auth-constants';

export function handleMagicLinkAuth(props: { email: string; name?: string }) {
    return authClient.signIn.magicLink({
        email: props.email, // required
        name: props.name,
        callbackURL: AUTH_CALLBACKS.default,
        newUserCallbackURL: AUTH_CALLBACKS.newUser,
        errorCallbackURL: AUTH_CALLBACKS.error,
    });
}
