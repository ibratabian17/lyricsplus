
import { AppleMusicService } from "../../shared/services/appleMusic.service.js";
import { MusixmatchService } from "../../shared/services/musixmatch.service.js";
import { SpotifyService } from "../../shared/services/spotify.service.js";
import { LyricsPlusService } from "../../shared/services/lyricsPlus.service.js";
import { FileUtils } from "../../shared/utils/file.util.js";
import { GDRIVE } from "../../shared/config.js";
import GoogleDrive from "../../shared/utils/googleDrive.util.js";

const gd = new GoogleDrive();

export async function fetchSongs(env) {
  let songs = await env.SONGS_KV.get('songList', { type: 'json' });
  if (!songs) {
    console.debug('Song list not found in KV, fetching from Google Drive...');
    const fileContent = await gd.fetchFile(GDRIVE.SONGS_FILE_ID);
    if (typeof fileContent === "string" && (fileContent.trim().startsWith("{") || fileContent.trim().startsWith("["))) {
      songs = JSON.parse(fileContent || "[]");
    } else {
      songs = fileContent || [];
    }
    await env.SONGS_KV.put('songList', JSON.stringify(songs));
    console.debug('Song list fetched from Google Drive and stored in KV.');
  } else {
    console.debug('Song list fetched from KV.');
  }
  return songs;
}

export async function safeFetchSongs(env) {
    try {
        return await fetchSongs(env);
    } catch (error) {
        console.warn("fetchSongs() failed, attempting to reload from cache:", error);
        return [];
    }
}

/**
 * Saves the best lyrics to Google Drive and updates the KV store.
 * @param {string} source - The source of the lyrics (e.g., 'apple', 'musixmatch', 'spotify').
 * @param {string} fileName - The base file name for the lyrics.
 * @param {object|string} rawData - The raw data fetched from the source (e.g., TTML, Spotify JSON, Musixmatch JSON).
 * @param {object} convertedData - The converted lyrics data in LyricsPlus format.
 * @param {object} existingFile - Information about an existing file in Google Drive, if found.
 * @param {object} gd - Google Drive handler.
 * @param {object} songTitle - Song title
 * @param {object} songArtist - Song artist
 * @param {object} songAlbum - Song album
 * @param {object} songDuration - Song duration
 * @param {string|null} songISRC - The ISRC of the song.
 * @param {string|null} songPlatformId - The platform-specific ID of the song.
 * @param {object} songs - Cached songs list
 * @param {object} env - The Hono context environment object.
 */
async function saveBestLyrics(source, fileName, rawData, convertedData, gd, songTitle, songArtist, songAlbum, songDuration, songISRC, songPlatformId, songs, env) {
    let fileId;
    try {
        if (source === 'apple') {
            const existingFile = await FileUtils.findExistingTTML(gd, songTitle, songArtist, songAlbum, songDuration, songISRC, songPlatformId);
            if (existingFile) {
                fileId = await gd.updateFile(existingFile.id, rawData);
            } else {
                fileId = await gd.uploadFile(
                    `${fileName}.ttml`,
                    'application/xml',
                    rawData,
                    GDRIVE.CACHED_TTML
                );
            }
            const newSong = {
                id: convertedData.metadata.appleMusicId, 
                artist: songArtist,
                track_name: songTitle,
                album: songAlbum,
                ttmlFileId: fileId,
                source: 'Apple',
            };

            const songIndex = songs.findIndex(
                s => s && s.track_name?.toLowerCase() === songTitle?.toLowerCase() &&
                    s.artist?.toLowerCase() === songArtist?.toLowerCase() &&
                    (!songAlbum || s.album?.toLowerCase() === songAlbum?.toLowerCase())
            );

            if (songIndex !== -1) {
                songs[songIndex] = newSong;
            } else {
                songs.push(newSong);
            }
            await env.SONGS_KV.put('songList', JSON.stringify(songs));
        } else if (source === 'musixmatch') {
            const existingFile = await FileUtils.findExistingFile(
                gd,
                songTitle,
                songArtist,
                songAlbum,
                songDuration,
                songISRC,
                songPlatformId,
                GDRIVE.CACHED_MUSIXMATCH,
                'application/json'
            );
            if (existingFile) {
                fileId = await gd.updateFile(existingFile.id, JSON.stringify(rawData));
            } else {
                fileId = await gd.uploadFile(
                    `${fileName}.json`,
                    'application/json',
                    JSON.stringify(rawData),
                    GDRIVE.CACHED_MUSIXMATCH
                );
            }
        }
        else if (source === 'spotify') {
            const existingFile = await FileUtils.findExistingFile(
                gd,
                songTitle,
                songArtist,
                songAlbum,
                songDuration,
                songISRC,
                songPlatformId,
                GDRIVE.CACHED_SPOTIFY,
                'application/json'
            );
            if (existingFile) {
                fileId = await gd.updateFile(existingFile.id, JSON.stringify(rawData));
            } else {
                fileId = await gd.uploadFile(
                    `${fileName}.json`,
                    'application/json',
                    JSON.stringify(rawData),
                    GDRIVE.CACHED_SPOTIFY
                );
            }
        }
        console.debug(`Successfully saved best lyrics from ${source} to Google Drive.`);
    } catch (error) {
        console.error(`Failed to save lyrics from ${source}:`, error);
    }
}

export async function handleSongLyrics(
    songTitle = "",
    songArtist = "",
    songAlbum = "",
    songDuration = "",
    songISRC = null,
    songPlatformId = null,
    songs,
    gd,
    preferredSources = [],
    forceReload = false,
    env
) {
    const initialFileName = await FileUtils.generateUniqueFileName(songTitle, songArtist, songAlbum, songDuration, songISRC, songPlatformId);
    console.debug('Looking for:', initialFileName, forceReload ? '(Force reload enabled)' : '');

    const sources = preferredSources.length > 0 ? preferredSources : ['apple', 'lyricsplus', 'musixmatch-word', 'musixmatch', 'spotify'];
    
    const promises = [];
    sources.forEach(source => {
        let promise;
        switch (source) {
            case 'apple':
                console.debug('Queueing AppleMusic Fetch');
                promise = AppleMusicService.fetchLyrics(songTitle, songArtist, songAlbum, songDuration, songISRC, songPlatformId, songs, gd, forceReload, sources);
                break;
            case 'lyricsplus':
                console.debug('Queueing LyricsPlus Fetch');
                promise = LyricsPlusService.fetchLyrics(songTitle, songArtist, songAlbum, songDuration, songISRC, songPlatformId, gd);
                break;
            case 'musixmatch-word':
                console.debug('Queueing MusixMatch (Word Sync) Fetch');
                promise = MusixmatchService.fetchLyrics(songTitle, songArtist, songAlbum, songDuration, songISRC, songPlatformId, gd, forceReload, env, true);
                break;
            case 'musixmatch':
                console.debug('Queueing MusixMatch (Line/Any Sync) Fetch');
                promise = MusixmatchService.fetchLyrics(songTitle, songArtist, songAlbum, songDuration, songISRC, songPlatformId, gd, forceReload, env, false);
                break;
            case 'spotify':
                console.debug('Queueing Spotify (as MusixMatch alt) Fetch');
                promise = SpotifyService.fetchLyrics(songTitle, songArtist, songAlbum, songDuration, songISRC, songPlatformId, gd, forceReload);
                break;
        }
        if (promise) {
            promises.push(promise.catch(e => {
                console.error(`Error fetching from ${source}:`, e);
                return null;
            }));
        }
    });

    const results = await Promise.all(promises);
    const successfulResults = results.filter(r => r && r.success && r.data && r.data.lyrics && r.data.lyrics.length > 0);

    if (successfulResults.length > 0) {
        const getSyncPriority = (result) => {
            if (!result || !result.data) return 0;

            const sourceType = result.source ? result.source.toLowerCase() : '';
            const data = result.data;

            if (sourceType.includes('musixmatch') || sourceType.includes('spotify')) {
                const syncType = data.type ? data.type.toUpperCase() : '';
                if (syncType === 'WORD' || syncType === 'SYLLABLE') return 3;
                if (syncType === 'LINE') return 2;
                return 1;
            }

            if (sourceType.includes('apple') || sourceType.includes('lyricsplus')) {
                return FileUtils.hasSyllableSync(data) ? 3 : 2;
            }

        };

        const bestResult = successfulResults.reduce((best, current) => {
            const bestPriority = getSyncPriority(best);
            const currentPriority = getSyncPriority(current);
            return currentPriority > bestPriority ? current : best;
        });

        const exactSongTitle = bestResult.exactMetadata?.title || bestResult.data.metadata.title || songTitle;
        const exactSongArtist = bestResult.exactMetadata?.artist || bestResult.data.metadata.artist || songArtist;
        const exactSongAlbum = bestResult.exactMetadata?.album || bestResult.data.metadata.album || songAlbum;
        const exactSongDuration = bestResult.exactMetadata?.durationMs ? bestResult.exactMetadata.durationMs / 1000 : (bestResult.data.metadata.durationMs ? bestResult.data.metadata.durationMs / 1000 : songDuration);
        const exactSongISRC = bestResult.exactMetadata?.isrc || bestResult.data.metadata.isrc || songISRC;
        const exactSongPlatformId = bestResult.exactMetadata?.platformId || bestResult.data.metadata.platformId || songPlatformId;

        const finalFileName = await FileUtils.generateUniqueFileName(exactSongTitle, exactSongArtist, exactSongAlbum, exactSongDuration, exactSongISRC, exactSongPlatformId);

        if (bestResult.rawData && bestResult.data.cached !== 'GDrive' && bestResult.data.cached !== 'Database') {
            saveBestLyrics(
                bestResult.source.toLowerCase().replace('-word', ''),
                finalFileName, 
                bestResult.rawData,
                bestResult.data,
                gd,
                exactSongTitle, 
                exactSongArtist,
                exactSongAlbum,
                exactSongDuration,
                exactSongISRC,
                exactSongPlatformId,
                songs,
                env
            );
        }

        return bestResult;
    }

    return {
        success: false,
        status: 404,
        data: {
            message: `Lyrics not found in sources: ${sources.join(', ')}`,
            status: 404,
            details: {
                searchedSources: sources,
                songInfo: {
                    title: songTitle,
                    artist: songArtist, 
                    album: songAlbum
                }
            }
        }
    };
}
