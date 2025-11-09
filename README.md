# LyricsPlus Backend

This is the backend service for LyricsPlus, primarily functioning as a lyrics scraper and provider for Youly+. Its main purpose is to fetch platform-specific lyrics timelines for users.

## Features

*   **Multi-Source Scraping**: Aggregates lyrics from various sources (e.g., Apple Music, Musixmatch, Spotify).
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
