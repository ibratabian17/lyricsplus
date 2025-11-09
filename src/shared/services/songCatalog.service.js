import { SpotifyService } from "./spotify.service.js";
import { AppleMusicService } from "./appleMusic.service.js";
import { MusixmatchService } from "./musixmatch.service.js";

export class SongCatalogService {
    /**
     * Searches for songs across Apple Music, Spotify, and Musixmatch, then merges
     * the results into a single, deduplicated list.
     *
     * The process prioritizes results from Apple Music, then Spotify, then Musixmatch
     * during the merge. Songs are matched primarily by their ISRC, falling back to a
     * composite key of title, artist, and album.
     *
     * @param {string} query - The search query (e.g., song title and/or artist).
     * @param {object} env - Environment variables, required for Musixmatch authentication.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of normalized song metadata.
     */
    static async search(query, env) {
        const [appleMusicResult, spotifyResult, musixmatchResult] = await Promise.allSettled([
            this._searchAppleMusic(query),
            this._searchSpotify(query),
            this._searchMusixmatch(query, env)
        ]);

        const allResults = [];
        if (appleMusicResult.status === 'fulfilled') allResults.push(...appleMusicResult.value);
        if (spotifyResult.status === 'fulfilled') allResults.push(...spotifyResult.value);
        if (musixmatchResult.status === 'fulfilled') allResults.push(...musixmatchResult.value);

        return this._mergeSearchResults(allResults);
    }

    /**
     * @private
     * Merges and deduplicates normalized song results from various services.
     * @param {Array<object>} results - A flat array of normalized songs.
     * @returns {Array<object>} A deduplicated array of merged songs.
     */
    static _mergeSearchResults(results) {
        const finalResultsMap = new Map();
        const sourceOrder = { 'Apple Music': 1, 'Spotify': 2, 'Musixmatch': 3 };

        const sortedResults = results.sort((a, b) => {
            const sourceA = a.availability[0];
            const sourceB = b.availability[0];
            return sourceOrder[sourceA] - sourceOrder[sourceB];
        });

        for (const song of sortedResults) {
            const key = song.isrc || `${song.title}-${song.artist}-${song.album}`;
            const existingSong = finalResultsMap.get(key);

            if (existingSong) {
                Object.assign(existingSong.id, song.id);
                Object.assign(existingSong.externalUrls, song.externalUrls);
                existingSong.songwriters = [...new Set([...(existingSong.songwriters || []), ...(song.songwriters || [])])];
                existingSong.availability = [...new Set([...existingSong.availability, ...song.availability])];
                existingSong.albumArtUrl ??= song.albumArtUrl;
                existingSong.durationMs ??= song.durationMs;
            } else {
                finalResultsMap.set(key, { ...song });
            }
        }

        return Array.from(finalResultsMap.values());
    }

    /**
     * @private
     * Searches Apple Music and normalizes the results.
     */
    static async _searchAppleMusic(query) {
        try {
            const dev_token = await AppleMusicService.getAppleMusicAuth();
            const storefront = await AppleMusicService.getStorefront();
            const searchData = await AppleMusicService.searchSong(query, dev_token, storefront);
            const songsData = searchData.results?.songs?.data || [];
            
            return Promise.all(
                songsData.map(song => AppleMusicService.normalizeAppleMusicSong(song, dev_token, storefront))
            );
        } catch (error) {
            console.error("Error searching Apple Music:", error);
            return [];
        }
    }

    /**
     * @private
     * Searches Spotify and normalizes the results.
     */
    static async _searchSpotify(query) {
        try {
            // Note: Spotify's search is more effective with an artist, but we use the query for the title.
            const spotifyTracks = await SpotifyService.searchSpotifySong(query, "");
            return Promise.all(
                spotifyTracks.map(track => SpotifyService.normalizeSpotifySong(track))
            );
        } catch (error) {
            console.error("Error searching Spotify:", error);
            return [];
        }
    }

    /**
     * @private
     * Searches Musixmatch and normalizes the results.
     */
    static async _searchMusixmatch(query, env) {
        try {
            const userToken = await MusixmatchService.getUserToken(env);
            const searchData = await MusixmatchService.searchTrack(query, userToken);
            const tracksData = searchData.message?.body?.track_list || [];
            
            return Promise.all(
                tracksData.map(trackResult => MusixmatchService.normalizeMusixmatchSong(trackResult.track, userToken))
            );
        } catch (error) {
            console.error("Error searching Musixmatch:", error);
            return [];
        }
    }
}