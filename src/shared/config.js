export const GDRIVE = {
    SEARCH_CACHE_FILE_ID: process.env.GDRIVE_SEARCH_CACHE_FILE_ID || "", //obsoleted
    SONGS_FILE_ID: process.env.GDRIVE_SONGS_FILE_ID || "", //quick cache dir
    CACHED_SPOTIFY: process.env.GDRIVE_CACHED_SPOTIFY || "-2D0LTCsP1VSD", //Spotify
    CACHED_TTML: process.env.GDRIVE_CACHED_TTML || "", //Apple Music
    USERTML_JSON: process.env.GDRIVE_USERTML_JSON || "", //Lyrics+
    CACHED_MUSIXMATCH: process.env.GDRIVE_CACHED_MUSIXMATCH || "", //Musixmatch
    API_URL: "https://www.googleapis.com/drive/v3/files/",
    API_URL_UPDATE: "https://www.googleapis.com/upload/drive/v2/files/",
};

export const AUTH_KEY = {
    //your gdrive tokem
    CLIENT_ID: process.env.AUTH_KEY_CLIENT_ID || "",
    CLIENT_SECRET: process.env.AUTH_KEY_CLIENT_SECRET || "",
    REFRESH_TOKEN: process.env.AUTH_KEY_REFRESH_TOKEN || "",
    ROOT: process.env.AUTH_KEY_ROOT || "",
};

export const APPLE_MUSIC = {
    BASE_URL: "https://amp-api.music.apple.com/v1",
    EDGE_BASE_URL: "https://amp-api-edge.music.apple.com/v1",
    ACCOUNTS: [
        {
            NAMEID: "ExampleAndroid",
            AUTH_TYPE: "android", 
            ANDROID_AUTH_TOKEN: process.env.APPLE_MUSIC_ANDROID_AUTH_TOKEN || "",
            ANDROID_DSID: process.env.APPLE_MUSIC_ANDROID_DSID || "",
            ANDROID_USER_AGENT: process.env.APPLE_MUSIC_ANDROID_USER_AGENT || "Music/6.1 Android/15 model/XiaomiPOCOF1 build/1451 (dt:66)",
            ANDROID_COOKIE: process.env.APPLE_MUSIC_ANDROID_COOKIE || "",
            STOREFRONT: "in", //country example: id or en or us or in
        },
        {
            NAMEID: "ExampleWeb",
            AUTH_TYPE: "web",
            MUSIC_AUTH_TOKEN: process.env.APPLE_MUSIC_AUTH_TOKEN || "",
        }
    ]
};

export const SPOTIFY = {
    BASE_URL: "https://api.spotify.com/v1",
    LYRICS_URL: "https://spclient.wg.spotify.com/color-lyrics/v2/track/",
    AUTH_URL: "https://accounts.spotify.com/api/token",
    TOKEN_URL: "https://open.spotify.com/get_access_token?reason=transport&productType=web_player",
    ACCOUNTS: [
        {
            CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || "",
            CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || "",
            COOKIE: process.env.SPOTIFY_COOKIE || ""
        }
    ]
};

export const JWT_SECRET = process.env.JWT_SECRET || "lyricsplus-submit-opensource-yes-yes-yes";

export class AccountManager {
    constructor(accounts) {
        this.accounts = accounts;
        this.currentIndex = 0;
    }

    getCurrentAccount() {
        if (this.accounts.length === 0) {
            return null;
        }
        return this.accounts[this.currentIndex];
    }

    switchToNextAccount() {
        if (this.accounts.length <= 1) {
            console.warn("Only one account available, cannot switch.");
            return false;
        }
        this.currentIndex = (this.currentIndex + 1) % this.accounts.length;
        console.log(`Switched to account index: ${this.currentIndex}`);
        return true;
    }

    resetAccount() {
        this.currentIndex = 0;
        console.log("Account index reset to 0.");
    }
}

export const appleMusicAccountManager = new AccountManager(APPLE_MUSIC.ACCOUNTS);
export const spotifyAccountManager = new AccountManager(SPOTIFY.ACCOUNTS);
