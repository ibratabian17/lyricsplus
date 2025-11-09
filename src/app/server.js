import app from './app.js';
import { serve } from '@hono/node-server';
import { KvEmulator } from '../shared/utils/kv.emulator.js';

// Create in-memory KV emulators for the Node.js environment
const SONGS_KV = new KvEmulator('SONGS_KV');
const LYRICSPLUS = new KvEmulator('LYRICSPLUS');

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: (req) => app.fetch(req, { SONGS_KV, LYRICSPLUS }),
  port
});