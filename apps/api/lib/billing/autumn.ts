import { Autumn } from 'autumn-js';
import { config } from '../../config/app.ts';

export const autumnClient = new Autumn({
    secretKey: config.AUTUMN_SECRET_KEY,
});
