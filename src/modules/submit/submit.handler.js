import { SignJWT, jwtVerify } from "jose";
import { LyricsPlusService } from "../../shared/services/lyricsPlus.service.js";
import { JWT_SECRET } from "../../shared/config.js";
import GoogleDrive from "../../shared/utils/googleDrive.util.js";

const gd = new GoogleDrive();

const POW_DIFFICULTY = 5; 
const POW_CHALLENGE_EXPIRATION = '240s';

async function createChallengeToken(challenge, secret) {
    const secretKey = new TextEncoder().encode(secret);
    return await new SignJWT({ challenge })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(POW_CHALLENGE_EXPIRATION)
        .sign(secretKey);
}

async function verifyChallengeToken(token, secret) {
    try {
        const secretKey = new TextEncoder().encode(secret);
        const { payload } = await jwtVerify(token, secretKey);
        return payload;
    } catch (error) {
        return null;
    }
}

async function verifyProofOfWork(challenge, nonce, difficulty) {
    const textEncoder = new TextEncoder();
    const data = textEncoder.encode(challenge + nonce);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const requiredPrefix = '0'.repeat(difficulty);
    return hashHex.startsWith(requiredPrefix);
}

export async function handleChallenge(c) {
    if (!JWT_SECRET) {
        console.error("CRITICAL: JWT_SECRET is not configured in config.js.");
        return c.json({ error: "Server configuration error" }, 500);
    }

    const challenge = crypto.randomUUID();
    const token = await createChallengeToken(challenge, JWT_SECRET);

    return c.json({
        token,
        difficulty: POW_DIFFICULTY
    }, 200);
}

export async function handleSubmit(c) {
    try {
        const payload = await c.req.json();
        const { proofOfWorkToken, nonce, ...lyricsSubmitData } = payload;

        if (!proofOfWorkToken || nonce === undefined) {
            return c.json({ error: "Missing proof of work" }, 400);
        }

        if (!JWT_SECRET) {
            console.error("CRITICAL: JWT_SECRET is not configured in config.js.");
            return c.json({ error: "Server configuration error" }, 500);
        }

        const challengePayload = await verifyChallengeToken(proofOfWorkToken, JWT_SECRET);
        if (!challengePayload) {
            return c.json({ error: "Invalid or expired proof of work token" }, 400);
        }

        const isProofValid = await verifyProofOfWork(challengePayload.challenge, nonce, POW_DIFFICULTY);
        if (!isProofValid) {
            return c.json({ error: "Invalid proof of work solution" }, 400);
        }

        const { songTitle, songArtist, songAlbum, songDuration, lyricsData, forceUpload } = lyricsSubmitData;
        if (!songTitle || !songArtist || !songDuration || !lyricsData) {
            return c.json({ error: "Missing required parameters" }, 400);
        }

        const result = await LyricsPlusService.uploadTimelineLyrics(
            gd,
            songTitle,
            songArtist,
            songAlbum || "",
            songDuration,
            lyricsData,
            forceUpload || false,
            c.env
        );

        return c.json(result, result.success ? 200 : 400);
    } catch (error) {
        console.error("Error in /v1/lyricsplus/submit:", error);
        return c.json({ error: error.message }, 500);
    }
}