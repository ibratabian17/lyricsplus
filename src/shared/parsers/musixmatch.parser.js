// --- Data Parsing & Conversion ---

export function convertMusixmatchToJSON(musixmatchData, requireWordSync = false) {
    let v1Lyrics = [], lyricsCopyright = '', lyricsType = "Line";

    if (musixmatchData.lyrics?.message?.body?.richsync) {
        const richsync = musixmatchData.lyrics.message.body.richsync;
        v1Lyrics = parseRichsyncLyrics(richsync.richsync_body, requireWordSync);
        lyricsCopyright = richsync.lyrics_copyright;
        lyricsType = requireWordSync ? "Word" : "Line";
    } else if (musixmatchData.lyrics?.message?.body?.subtitle) {
        const subtitle = musixmatchData.lyrics.message.body.subtitle;
        v1Lyrics = parseSubtitleLyrics(subtitle.subtitle_body);
        lyricsCopyright = subtitle.lyrics_copyright;
    } else {
        return null;
    }

    const groupedLyrics = (lyricsType === "Word") ? this.groupWordsIntoLines(v1Lyrics) : v1Lyrics;

    return {
        type: lyricsType,
        KpoeTools: "2.0-LPlusBcknd",
        metadata: {
            source: "Musixmatch",
            songWriters: extractSongwriters(lyricsCopyright),
            leadingSilence: "0.000"
        },
        lyrics: groupedLyrics
    };
}

export function parseSubtitleLyrics(subtitleBody) {
    return subtitleBody.split('\n').map((line, index, lines) => {
        const match = line.match(/\[(\d{2}):(\d{2}\.\d{2})\](.*)/);
        if (!match) return null;

        const [, minutes, seconds, text] = match;
        const time = Math.round((parseInt(minutes, 10) * 60 + parseFloat(seconds)) * 1000);

        let duration = 3000;
        const nextLine = lines[index + 1];
        if (nextLine) {
            const nextMatch = nextLine.match(/\[(\d{2}):(\d{2}\.\d{2})\]/);
            if (nextMatch) {
                const nextTime = Math.round((parseInt(nextMatch[1], 10) * 60 + parseFloat(nextMatch[2])) * 1000);
                duration = nextTime - time;
            }
        }
        return { time, duration, text: text.trim(), element: {} };
    }).filter(line => line && line.text.trim() !== '');
}

export function parseRichsyncLyrics(richsyncBody, wordLevel = false) {
    try {
        const richsyncData = JSON.parse(richsyncBody);
        const lyrics = [];
        richsyncData.forEach(lineData => {
            const lineStart = Math.round(lineData.ts * 1000);
            const lineEnd = Math.round(lineData.te * 1000);
            if (wordLevel) {
                lineData.l.forEach((word, i, words) => {
                    const wordStart = lineStart + Math.round(word.o * 1000);
                    const nextWord = words[i + 1];
                    const wordEnd = nextWord ? lineStart + Math.round(nextWord.o * 1000) : lineEnd;
                    lyrics.push({ time: wordStart, duration: wordEnd - wordStart, text: word.c, isLineEnding: !nextWord });
                });
            } else {
                lyrics.push({ time: lineStart, duration: lineEnd - lineStart, text: lineData.x, isLineEnding: true, element: {} });
            }
        });
        return lyrics;
    } catch (error) {
        console.error('Error parsing richsync body:', error);
        return [];
    }
}

export function _groupWordsIntoLines(wordLyrics) {
    const lines = [];
    let currentLine = null;
    wordLyrics.forEach(word => {
        if (!currentLine) {
            currentLine = { time: word.time, text: "", syllabus: [], element: {} };
        }
        currentLine.text += word.text;
        currentLine.syllabus.push({ time: word.time, duration: word.duration, text: word.text });
        if (word.isLineEnding) {
            const firstWord = currentLine.syllabus[0];
            const lastWord = currentLine.syllabus[currentLine.syllabus.length - 1];
            currentLine.duration = (lastWord.time + lastWord.duration) - firstWord.time;
            lines.push(currentLine);
            currentLine = null;
        }
    });
    if (currentLine && currentLine.text.trim() != "") lines.push(currentLine);
    return lines;
}

export function extractSongwriters(copyrightString) {
    if (!copyrightString) return [];
    const match = copyrightString.match(/Writer\(s\):\s*([^\n]+)/i);
    return match ? match[1].split(',').map(name => name.trim()) : [];
}
