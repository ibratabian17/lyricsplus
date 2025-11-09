// services/lyricsPlusService.js
import { FileUtils } from "../utils/file.util.js";
import { v1Tov2 } from "../parsers/kpoe.parser.js";
import { GDRIVE } from "../config.js";

export class LyricsPlusService {

    /**
     * Fetches lyrics and automatically converts them to v2 format if necessary.
     */
    static async fetchLyrics(songTitle, songArtist, songAlbum, songDuration, songISRC, songPlatformId, gd) {
        try {
            const userJsonFile = await FileUtils.findUserJSON(gd, songTitle, songArtist, songAlbum, songDuration, songISRC, songPlatformId);
            if (userJsonFile) {
                const jsonContent = await gd.fetchFile(userJsonFile.id);
                if (jsonContent) {
                    let parsedJson = JSON.parse(jsonContent);

                    const isV1Format = parsedJson.lyrics && parsedJson.lyrics.length > 0 &&
                                       typeof parsedJson.lyrics[0].syllabus === 'undefined';

                    let lyricsData = parsedJson;
                    if (isV1Format) {
                        console.debug("V1 lyrics format detected. Converting to V2 automatically.");
                        lyricsData = v1Tov2(parsedJson); 
                    }

                    if (FileUtils.hasSyllableSync(lyricsData) || FileUtils.hasLineSync(lyricsData)) {
                        lyricsData.metadata = lyricsData.metadata || {};
                        lyricsData.metadata.source = 'Lyrics+';
                        lyricsData.cached = 'UserJSON';
                        return { success: true, data: lyricsData, source: 'lyricsplus' };
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to check user JSON:', error);
        }
        return null;
    }

    /**
     * Upload or update timeline lyrics to Google Drive.
     * This function now expects lyricsData to be in v2 format.
     *
     * @param {object} gd - Google Drive handler.
     * @param {string} songTitle - Title of the song.
     * @param {string} songArtist - Artist name.
     * @param {string} songAlbum - Album name.
     * @param {number} songDuration - Duration of the song.
     * @param {object} lyricsData - v2 format lyrics data.
     * @param {boolean} forceUpload - Flag to force update if file exists.
     * @param {string|null} songISRC - The ISRC of the song.
     * @param {string|null} songPlatformId - The platform-specific ID of the song.
     *
     * @returns {object} Result object with success flag and error message if any.
     */
    static async uploadTimelineLyrics(gd, songTitle, songArtist, songAlbum, songDuration, lyricsData, forceUpload = false, songISRC = null, songPlatformId = null) {
        try {
            if (!lyricsData.type || !lyricsData.metadata || !lyricsData.lyrics) {
                return { success: false, error: "Missing required fields: type or lyrics" };
            }

            const fileName = await FileUtils.generateUniqueFileName(songTitle, songArtist, songAlbum, songDuration, songISRC, songPlatformId);
            const fullFileName = `${fileName}.json`;
            
            const existingUGCFile = await FileUtils.findExistingFile(
                gd,
                songTitle,
                songArtist,
                songAlbum,
                songDuration,
                songISRC,
                songPlatformId,
                GDRIVE.USERTML_JSON,
                'application/json'
            );

            const isExactMatch = existingUGCFile && existingUGCFile.name === fullFileName;

            if (existingUGCFile && isExactMatch && forceUpload) {
                const previousContent = await gd.fetchFile(existingUGCFile.id);
                if (previousContent) {
                    const previousData = JSON.parse(previousContent);
                    if (this.isVandalismUpdate(previousData, lyricsData)) {
                        console.warn("Vandalism detected in the update. Update aborted.");
                        return { success: false, error: "Vandalism detected. Update aborted." };
                    }
                }
                
                await gd.updateFile(existingUGCFile.id, JSON.stringify(lyricsData));
                console.debug(`Updated existing file: ${fullFileName}`);
            } else if (!existingUGCFile || !isExactMatch) {
                await gd.uploadFile(
                    fullFileName,
                    'application/json',
                    JSON.stringify(lyricsData),
                    GDRIVE.USERTML_JSON
                );
                console.debug(`Uploaded new file: ${fullFileName}`);
            } else {
                console.debug("File already exists and forceUpload is false. No upload performed.");
                return { success: false, error: "File exists. Set forceUpload to true to update." };
            }
            return { success: true };
        } catch (error) {
            console.error("Error uploading timeline lyrics:", error);
            return { success: false, error };
        }
    }

    /**
     * Check if the lyrics update might be vandalism.
     */
    static isVandalismUpdate(previousData, newData) {
        return false; //i disabled this cuz i don't know
    }

    /**
     * Converts a v1 lyrics object to a v2 lyrics object.
     * @param {object} data - The v1 lyrics data.
     * @returns {object} The converted v2 lyrics data.
     */
}
