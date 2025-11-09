import { APPLE_MUSIC, GDRIVE, appleMusicAccountManager } from "../config.js";
import { convertTTMLtoJSON } from "../parsers/ttml.parser.js";
import { SimilarityUtils } from "../utils/similarity.util.js";
import { FileUtils } from "../utils/file.util.js";
import { LyricsPlusService } from "./lyricsPlus.service.js";

const CACHE = { storefront: null, authToken: null };
const MAX_RETRIES = 3;

export class AppleMusicService {

    // --- Public API ---

    static async fetchLyrics(originalSongTitle, originalSongArtist, originalSongAlbum, originalSongDuration, songISRC, songPlatformId, songs, gd, forceReload, sources) {
        try {
            const initialCacheResult = await this._checkCache(originalSongTitle, originalSongArtist, originalSongAlbum, originalSongDuration, songISRC, songPlatformId, songs, gd, forceReload, sources);
            if (initialCacheResult) {
                console.debug('Apple Music lyrics found in cache (initial check).');
                return initialCacheResult;
            }

            console.debug('No cached lyrics found, searching Apple Music...');
            const bestMatch = await this._searchForBestMatch(originalSongTitle, originalSongArtist, originalSongAlbum, originalSongDuration);
            if (!bestMatch) {
                console.warn('No suitable match found in Apple Music search.');
                return null;
            }

            const { name, artistName, albumName, durationInMillis, isrc } = bestMatch.attributes;
            const appleMusicId = bestMatch.id;
            const exactMetadata = { title: name, artist: artistName, album: albumName, durationMs: durationInMillis, isrc: isrc, platformId: appleMusicId };
            console.debug(`Selected match: ${artistName} - ${name} (Album: ${albumName}, Duration: ${durationInMillis / 1000}s, ISRC: ${isrc}, AppleMusicId: ${appleMusicId})`);

            const postSearchCacheResult = await this._checkCache(name, artistName, albumName, durationInMillis / 1000, isrc, appleMusicId, songs, gd, forceReload, sources);
            if (postSearchCacheResult) {
                console.debug('Apple Music lyrics found in cache (post-search check).');
                return postSearchCacheResult;
            }

            const storefront = await this.getStorefront();
            const lyricsResponse = await this.makeAppleMusicRequest(
                `${APPLE_MUSIC.BASE_URL}/catalog/${storefront}/songs/${appleMusicId}/syllable-lyrics?l%5Blyrics%5D=en-US&extend=ttmlLocalizations&l%5Bscript%5D=en-Latn`, {}
            );
            const lyricsData = await lyricsResponse.json();
            const ttml = lyricsData.data?.[0]?.attributes?.ttml || lyricsData.data?.[0]?.attributes?.ttmlLocalizations;

            if (!ttml) {
                console.warn('Lyrics TTML not found in API response.');
                return null;
            }

            const convertedToJson = convertTTMLtoJSON(ttml);
            if (!convertedToJson.lyrics || convertedToJson.lyrics.length === 0) {
                console.warn('Fetched lyrics are empty.');
                return null;
            }

            convertedToJson.metadata = convertedToJson.metadata || {};
            convertedToJson.metadata.source = 'Apple';
            convertedToJson.cached = 'None';

            return { success: true, data: convertedToJson, source: 'apple', rawData: ttml, exactMetadata };

        } catch (error) {
            console.warn('Failed to fetch from Apple Music:', error);
            return null;
        }
    }

    static async searchSong(query, storefront) {
        if (!query) return { results: { songs: { data: [] } } };
        const response = await this.makeAppleMusicRequest(
            `${APPLE_MUSIC.BASE_URL}/catalog/${storefront}/search?types=songs&term=${encodeURIComponent(query)}`, {}
        );
        return response.json();
    }

    // --- Core Request & Auth Logic ---

    static async makeAppleMusicRequest(url, options, retries = 0) {
        try {
            const headers = await this._getAuthHeaders();
            const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });

            if (!response.ok) {
                if ((response.status === 401 || response.status === 429) && retries < MAX_RETRIES) {
                    console.warn(`Apple Music API call failed with status ${response.status}. Retrying with next account...`);
                    appleMusicAccountManager.switchToNextAccount();
                    CACHE.authToken = null;
                    CACHE.storefront = null;
                    return this.makeAppleMusicRequest(url, options, retries + 1);
                }
                const errorText = await response.text();
                throw new Error(`Apple Music API returned status ${response.status}: ${errorText}`);
            }
            return response;
        } catch (error) {
            console.error("Error in makeAppleMusicRequest:", error);
            throw error;
        }
    }

    static async getAppleMusicAuth() {
        const currentAccount = appleMusicAccountManager.getCurrentAccount();
        if (!currentAccount) throw new Error("No Apple Music account available.");
        if (currentAccount.AUTH_TYPE === "android") return currentAccount.ANDROID_AUTH_TOKEN;

        if (CACHE.authToken) return CACHE.authToken;

        try {
            const response = await fetch("https://music.apple.com/");
            const html = await response.text();
            const scriptTagMatch = html.match(/<script type="module" crossorigin src="(\/assets\/index[^"]+\.js)"><\/script>/);
            if (!scriptTagMatch?.[1]) throw new Error("Could not find Apple Music index script tag.");

            const scriptUrl = new URL(scriptTagMatch[1], "https://music.apple.com/").toString();
            const jsResponse = await fetch(scriptUrl);
            const jsContent = await jsResponse.text();

            const tokenVarMatch = jsContent.match(/e\.headers\.Authorization\s*=\s*`Bearer \${(.*?)}`/);
            if (!tokenVarMatch?.[1]) throw new Error("Could not find authorization token variable in script.");

            const tokenValueMatch = jsContent.match(new RegExp(`const ${tokenVarMatch[1]}\\s*=\\s*"([^"]+)"`));
            if (!tokenValueMatch?.[1]) throw new Error("Could not find authorization token value in script.");

            CACHE.authToken = tokenValueMatch[1];
            return CACHE.authToken;
        } catch (error) {
            console.error("Error scraping Apple Music auth token:", error);
            throw error;
        }
    }

    static async getStorefront() {
        if (CACHE.storefront) return CACHE.storefront;
        const currentAccount = appleMusicAccountManager.getCurrentAccount();
        if (!currentAccount) throw new Error("No Apple Music account available.");

        if (currentAccount.AUTH_TYPE === "android" && currentAccount.STOREFRONT) {
            CACHE.storefront = currentAccount.STOREFRONT;
            return CACHE.storefront;
        }

        try {
            const response = await this.makeAppleMusicRequest("https://api.music.apple.com/v1/me/storefront", {});
            const data = await response.json();
            CACHE.storefront = data.data[0].id;
        } catch (err) {
            CACHE.storefront = currentAccount.STOREFRONT || "us";
            console.warn(`Could not fetch storefront, falling back to: ${CACHE.storefront}`);
        }
        return CACHE.storefront;
    }

    // --- Data Fetching & Normalization ---

    static async fetchIsrc(songId, storefront) {
        try {
            const response = await this.makeAppleMusicRequest(`${APPLE_MUSIC.BASE_URL}/catalog/${storefront}/songs/${songId}`, {});
            const data = await response.json();
            return data.data?.[0]?.attributes || null;
        } catch (error) {
            console.error("Error fetching Apple Music song details:", error);
            return null;
        }
    }

    static async normalizeAppleMusicSong(track, storefront) {
        const attributes = track.attributes;
        const fullSongAttributes = await this.fetchIsrc(track.id, storefront);

        return {
            id: { appleMusic: track.id },
            sourceId: track.id,
            title: attributes.name,
            artist: attributes.artistName,
            album: attributes.albumName,
            albumArtUrl: attributes.artwork?.url.replace('{w}', '300').replace('{h}', '300') || null,
            durationMs: attributes.durationInMillis,
            isrc: fullSongAttributes?.isrc || null,
            songwriters: fullSongAttributes?.songwriterNames || attributes.songwriterNames || [],
            availability: ['Apple Music'],
            externalUrls: { appleMusic: attributes.url }
        };
    }

    // --- Internal Helpers ---

    static async _getAuthHeaders() {
        const currentAccount = appleMusicAccountManager.getCurrentAccount();
        if (!currentAccount) throw new Error("No Apple Music account available.");

        if (currentAccount.AUTH_TYPE === "android") {
            return {
                Authorization: `Bearer ${currentAccount.ANDROID_AUTH_TOKEN}`,
                "x-dsid": currentAccount.ANDROID_DSID,
                "User-Agent": currentAccount.ANDROID_USER_AGENT,
                "Cookie": currentAccount.ANDROID_COOKIE,
                "Accept-Encoding": "gzip"
            };
        } else {
            return {
                Authorization: `Bearer ${await this.getAppleMusicAuth()}`,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
                Origin: 'https://music.apple.com',
                Referer: 'https://music.apple.com',
                'media-user-token': currentAccount.MUSIC_AUTH_TOKEN
            };
        }
    }

    static async _searchForBestMatch(title, artist, album, duration) {
        const storefront = await this.getStorefront();
        const searchQueries = [
            [title, artist, album].filter(Boolean).join(' '),
            [title, artist].filter(Boolean).join(' '),
            `${artist} ${title}`,
            title
        ];

        let candidates = [];
        for (const query of searchQueries) {
            console.debug(`Searching Apple Music with query: "${query}"`);
            const searchData = await this.searchSong(query, storefront);
            candidates.push(...(searchData.results?.songs?.data || []));
            const bestMatch = SimilarityUtils.findBestSongMatch(candidates, title, artist, album, duration);
            if (bestMatch) return bestMatch.candidate;
        }
        return null;
    }

    static async _checkCache(title, artist, album, duration, isrc, platformId, songs, gd, forceReload, sources) {
        if (forceReload) return null;

        const handleCachedContent = async (ttmlContent, cacheType, file) => {
            const converted = convertTTMLtoJSON(ttmlContent);
            if (!converted.lyrics || converted.lyrics.length === 0) {
                console.warn(`Cached lyrics from ${cacheType} are empty, refetching.`);
                return null;
            }
            converted.metadata = converted.metadata || {};
            converted.metadata.source = 'Apple';
            converted.cached = cacheType;

            if (sources.includes('lyricsplus') && !FileUtils.hasSyllableSync(converted)) {
                const lpResult = await LyricsPlusService.fetchLyrics(title, artist, album, duration, isrc, platformId, gd);
                if (lpResult?.success) return lpResult;
            }
            return { success: true, data: converted, source: 'apple', rawData: ttmlContent, existingFile: file };
        };

        const existingFile = await FileUtils.findExistingTTML(gd, title, artist, album, duration, isrc, platformId);
        if (existingFile) {
            try {
                const ttmlContent = await gd.fetchFile(existingFile.id);
                if (ttmlContent) return await handleCachedContent(ttmlContent, 'GDrive', existingFile);
            } catch (error) {
                console.warn('Failed to fetch from GDrive cache:', error);
            }
        }
        return null;
    }
}
