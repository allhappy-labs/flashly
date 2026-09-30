export const CLIENT_ORIGIN = import.meta.env.VITE_CLIENT_ORIGIN || 'http://localhost:3000';

export const AUTH_CALLBACKS = {
    default: `${CLIENT_ORIGIN}/dashboard`, error: `${CLIENT_ORIGIN}/error`, newUser: `${CLIENT_ORIGIN}/welcome`,
};
