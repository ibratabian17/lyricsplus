# LyricsPlus Backend

This is the backend service for LyricsPlus, primarily functioning as a lyrics scraper and provider for Youly+. Its main purpose is to fetch platform-specific lyrics timelines for users.

Due too high request traffic, the main server `https://lyricsplus.prjktla.my.id` unable to serve the lyrics properly. this project requires funding to run on a better server. I'm currently unable to cover the costs due to financial constraints. If you're interested in lending us your server, please feel free to do so.

## Features

*   **Multi-Source Scraping**: Aggregates lyrics from various sources (e.g., Apple Music, Musixmatch, Spotify, QQ Music).
*   **Platform-Specific Timelines**: Provides synchronized lyrics tailored for specific platforms.
*   **User Submissions**: Supports user contributions for synchronized lyrics.
*   **Song Catalog Search**: Provides a search functionality for the song catalog.
*   **Advanced Similarity Matching**: Matches songs across different services.
*   **Caching**: Caches lyrics on Google Drive to optimize response times.
*   **Multi-Environment Support**: Built with Hono.js for deployment across Node.js, Cloudflare Workers, and Vercel Edge Functions.

## How It Works

The backend operates by exposing a set of API endpoints that allow clients to fetch lyrics, metadata, and interact with the song catalog. It intelligently queries various supported sources, processes the retrieved data, and returns the most accurate and synchronized lyrics available. To optimize performance and reduce redundant scraping, uncached lyrics are stored on Google Drive after their initial retrieval.

## API Endpoints

For a detailed list and explanation of all API endpoints, please refer to [docs/endpoints.md](docs/endpoints.md).

## Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ibratabian17/lyricsplus
   cd lyricsplus
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configuration / Environment Variables**:
   We will modify the `src/shared/config.js` file for configuration. Using a `.env` file is **optional** and is recommended if you do not want your authentication keys/tokens leaked when sharing the codebase.

   *   **Google Drive Setup** (For caching):
       *   Requires obtaining the `AUTH_KEY` details using `rsync` to get the necessary authentication keys for the service account to cache and fetch lyrics.
       *   Fields to configure: `AUTH_KEY_CLIENT_ID`, `AUTH_KEY_CLIENT_SECRET`, `AUTH_KEY_REFRESH_TOKEN`, `AUTH_KEY_ROOT`.
       *   File configuration IDs: `GDRIVE_SEARCH_CACHE_FILE_ID`, `GDRIVE_SONGS_FILE_ID`, `GDRIVE_CACHED_SPOTIFY`, `GDRIVE_CACHED_TTML`, `GDRIVE_USERTML_JSON`, `GDRIVE_CACHED_MUSIXMATCH`, `GDRIVE_CACHED_QQ`.

   *   **Apple Music Accounts**:
       *   **MANDATORY**: An active Apple Music subscription is required to fetch syllable-synced lyrics (`.ttml`).
       *   **Auth Type**: Choose either `web` OR `android` authentication per account; you only need to fill the fields for your chosen method.
           *   For `web`: configure `APPLE_MUSIC_AUTH_TOKEN`.
           *   For `android`: configure `APPLE_MUSIC_ANDROID_AUTH_TOKEN`, `APPLE_MUSIC_ANDROID_DSID`, `APPLE_MUSIC_ANDROID_USER_AGENT`, `APPLE_MUSIC_ANDROID_COOKIE`.

   *   **Spotify Accounts**:
       *   **MANDATORY**: Per 9 March 2026, Spotify has blocked all API access for non-premium users. You must provide an account to use it.
       *   You need to provide your account cookie and a developer token to fetch lyrics.
       *   Fields: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_COOKIE`.

   *   **Musixmatch Accounts**:
       *   You must provide an account to avoid frequent API rate limits.
       *   **Auth Type**: Choose either `web` OR `android` authentication per account.
           *   For `web`: configure `MUSIXMATCH_USER_AGENT`, `MUSIXMATCH_COOKIE`.
           *   For `android`: configure `MUSIXMATCH_ANDROID_EMAIL`, `MUSIXMATCH_ANDROID_PASSWORD`.

   *   **General**:
       *   `JWT_SECRET`: Used for API keys to protect upload endpoints.

4. **Run the server**:
   To start the application locally:
   ```bash
   npm start
   ```
   For development with Wrangler (Cloudflare Workers):
   ```bash
   npm run dev
   ```

## Deployment

Configured for flexible deployment:

*   **Vercel**: Via `vercel.json`.
*   **Cloudflare Workers**: Via `wrangler.toml`.

## Documentation

For codebase details, architecture, and contribution guidelines, refer to the `docs/` directory.

## Contributing

We welcome contributions to the LyricsPlus Backend. Please refer to the [docs/contributing.md](docs/contributing.md) for detailed guidelines on how to contribute, including code structure, style, and submission process.

## License

This project is licensed under the Apache License 2.0.
