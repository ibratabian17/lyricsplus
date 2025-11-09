import { handleSongLyrics, safeFetchSongs } from "./lyrics.controller.js";
import { v2Tov1 } from "../../shared/parsers/kpoe.parser.js";
import { convertJsonToTTML } from "../../shared/parsers/ttml.parser.js";
import GoogleDrive from "../../shared/utils/googleDrive.util.js";

const gd = new GoogleDrive();

export async function handleLyricsRequest(c) {
    const startTime = Date.now();
    const query = c.req.query();
    const songTitle = query.title;
    const songArtist = query.artist;
    const format = query.format || 'v2';

    if (!songTitle || !songArtist ) {
        return c.json(
            { error: "Missing required parameters: title and artist" },
            400
        );
    }

    const songAlbum = query.album || "";
    const songDuration = query.duration;
    const songISRC = query.isrc;
    const songPlatformId = query.platformId;
    const source = query.source;
    const forceReload = query.forceReload === "true";

    const songs = await safeFetchSongs(c.env);

    const result = await handleSongLyrics(
        songTitle,
        songArtist,
        songAlbum,
        songDuration,
        songISRC,
        songPlatformId,
        songs,
        gd,
        source ? source.split(",") : undefined,
        forceReload,
        c.env
    );

    let data;
    if (result.success) {
        switch (format) {
            case 'v1':
                data = v2Tov1(result.data);
                break;
            case 'ttml':
                try {
                    data = { ttml: convertJsonToTTML(result.data) };
                } catch (e) {
                    console.error("Error converting to TTML:", e);
                    data = result.data;
                }
                break;
            case 'v2':
            default:
                data = result.data;
                break;
        }
    } else {
        data = { error: result.data };
    }

    data.processingTime = {
        timeElapsed: Date.now() - startTime,
        lastProcessed: Date.now(),
    };

    const headers = result.success ? { "Cache-Control": "public, max-age=3600, immutable" } : { "Cache-Control": "no-store" };

    return c.json(data, result.status || (result.success ? 200 : 400), headers);
}
