import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleLyricsRequest } from '../modules/lyrics/lyrics.handler.js';
import { handleSonglistSearch } from '../modules/songCatalog/songCatalog.handler.js';
import { handleMetadataGet } from '../modules/metadata/metadata.handler.js';
import { handleChallenge, handleSubmit } from '../modules/submit/submit.handler.js';
import { handleMusixmatchTest } from '../modules/test/test.handler.js';

const app = new Hono();

//add cors
app.use('*', cors());
app.get('/', (c) => c.text('Seems, you trying to find out about our api huh?'));

// Lyrics routes
app.get('/v1/lyrics/get', (c) => {
    c.req.query().format = 'v1';
    return handleLyricsRequest(c);
});
app.get('/v2/lyrics/get', handleLyricsRequest);
app.get('/v1/ttml/get', (c) => {
    c.req.query().format = 'ttml';
    return handleLyricsRequest(c);
});

// Song Catalog routes
app.get('/v1/songlist/search', handleSonglistSearch);

// Metadata routes
app.get('/v1/metadata/get', handleMetadataGet);

// Submit routes
app.get('/v1/lyricsplus/challenge', handleChallenge);
app.post('/v1/lyricsplus/submit', handleSubmit);

// Test routes
app.get('/v1/test/musixmatch', handleMusixmatchTest);

export default app;
