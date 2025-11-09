// utils/similarityUtils.js
export class SimilarityUtils {

    static normalizeString(str) {
        if (!str) return '';
        return str.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    static getNGrams(str, size = 2) {
        if (!str || str.length < size) return new Set();
        const ngrams = new Set();
        for (let i = 0; i <= str.length - size; i++) {
            ngrams.add(str.substring(i, i + size));
        }
        return ngrams;
    }

    static getDiceCoefficient(str1, str2) {
        if (!str1 && !str2) return 1.0;
        if (!str1 || !str2) return 0.0;

        const bigrams1 = this.getNGrams(str1, 2);
        const bigrams2 = this.getNGrams(str2, 2);

        if (bigrams1.size === 0 && bigrams2.size === 0) return 1.0;
        if (bigrams1.size === 0 || bigrams2.size === 0) return 0.0;

        const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
        return (2 * intersection.size) / (bigrams1.size + bigrams2.size);
    }

    static levenshteinDistance(str1, str2) {
        if (str1 === str2) return 0;
        if (!str1.length) return str2.length;
        if (!str2.length) return str1.length;

        if (str1.length > str2.length) {
            [str1, str2] = [str2, str1];
        }

        let prevRow = Array.from({ length: str1.length + 1 }, (_, i) => i);
        let currRow = Array.from({ length: str1.length + 1 }, () => 0);

        for (let j = 1; j <= str2.length; j++) {
            currRow[0] = j;
            for (let i = 1; i <= str1.length; i++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                currRow[i] = Math.min(
                    prevRow[i] + 1,
                    currRow[i - 1] + 1,
                    prevRow[i - 1] + cost
                );
            }
            [prevRow, currRow] = [currRow, prevRow];
        }

        return prevRow[str1.length];
    }

    static analyzeTitle(title) {
        if (!title) return { baseTitle: '', tags: new Set(), featArtists: [] };

        const tags = new Set();
        const featArtists = [];
        let cleanTitle = this.normalizeString(title);

        const featRegex = /(?:\s+(?:feat\.?|ft\.?|featuring|with)\s+([^()[\]]+))(?=\s*[()[\]]|$)/gi;
        let featMatch;
        while ((featMatch = featRegex.exec(cleanTitle)) !== null) {
            const artists = featMatch[1].split(/\s*[&,]\s*/).map(a => a.trim()).filter(Boolean);
            featArtists.push(...artists);
        }

        cleanTitle = cleanTitle.replace(featRegex, ' ');

        const tagPatterns = [
            /(?:[-(]|\s-\s)(remix|mix|rmx)(?:\W|$)/gi,
            /(?:[-(]|\s-\s)(live|concert)(?:\W|$)/gi,
            /(?:[-(]|\s-\s)(acoustic|unplugged)(?:\W|$)/gi,
            /(?:[-(]|\s-\s)(instrumental|karaoke)(?:\W|$)/gi,
            /(?:[-(]|\s-\s)(radio\s?edit|single\s?edit)(?:\W|$)/gi,
            /(?:[-(]|\s-\s)(remaster(?:ed)?|rerecorded?)(?:\W|$)/gi,
            /(?:[-(]|\s-\s)(explicit|clean|censored)(?:\W|$)/gi,
            /(?:[-(]|\s-\s)(demo|rough|rough\s?mix)(?:\W|$)/gi,
            /(?:[-(]|\s-\s)(extended|ext|full)(?:\W|$)/gi,
            /(?:[-(]|\s-\s)(deluxe|anniversary|special)(?:\W|$)/gi,
            /(?:[-(]|\s-\s)(mono|stereo)(?:\W|$)/gi,
            /(?:[-(]|\s-\s)(edit|version|ver\.?)(?:\W|$)/gi
        ];

        tagPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(cleanTitle)) !== null) {
                tags.add(match[1].toLowerCase().replace(/\s+/g, ''));
            }
        });

        cleanTitle = cleanTitle
            .replace(/\[[^\]]*\]/g, ' ')
            .replace(/\([^)]*\)/g, ' ')
            .replace(/\{[^}]*\}/g, ' ')
            .replace(/\s-\s.*$/, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^(?:the\s+|a\s+|an\s+)/i, '')
            .replace(/\s+(?:the|a|an)$/i, '');

        return { baseTitle: cleanTitle, tags, featArtists };
    }

    static normalizeArtistName(artist) {
        if (!artist) return '';

        let normalized = artist.toLowerCase()
            .replace(/\[[^\]]*\]/g, '')
            .replace(/\([^)]*\)/g, '');

        const separatorRegex = /\s*(?:&|and|vs\.?|versus|x|feat\.?|ft\.?|featuring|with|,)\s*/gi;
        const artists = normalized
            .split(separatorRegex)
            .map(name => name.replace(/\bthe\b/g, '').replace(/\s+/g, ' ').trim())
            .filter(name => name.length > 0);

        return artists.sort().join(' ');
    }

    static calculateTitleSimilarity(title1, title2) {
        if (!title1 || !title2) return 0;

        const analysis1 = this.analyzeTitle(title1);
        const analysis2 = this.analyzeTitle(title2);

        if (analysis1.baseTitle === analysis2.baseTitle && analysis1.baseTitle.length > 0) {
            const conflictingTags = [...analysis1.tags].some(tag =>
                analysis2.tags.size > 0 && !analysis2.tags.has(tag) &&
                ['live', 'acoustic', 'remix', 'instrumental'].includes(tag)
            );

            return conflictingTags ? 0.85 : 1.0;
        }

        const diceScore = this.getDiceCoefficient(analysis1.baseTitle, analysis2.baseTitle);
        const maxLength = Math.max(analysis1.baseTitle.length, analysis2.baseTitle.length);
        const levenshteinScore = maxLength > 0 ?
            1 - (this.levenshteinDistance(analysis1.baseTitle, analysis2.baseTitle) / maxLength) : 0;

        let baseSimilarity = (diceScore * 0.7) + (levenshteinScore * 0.3);

        const criticalTags = ['live', 'acoustic', 'remix', 'instrumental', 'karaoke'];
        const tags1Critical = [...analysis1.tags].filter(t => criticalTags.includes(t));
        const tags2Critical = [...analysis2.tags].filter(t => criticalTags.includes(t));

        let tagPenalty = 0;
        if (tags1Critical.length > 0 && tags2Critical.length > 0) {
            const hasConflict = !tags1Critical.some(t => tags2Critical.includes(t));
            if (hasConflict) tagPenalty = 0.4;
        } else if (tags1Critical.length > 0 || tags2Critical.length > 0) {
            tagPenalty = 0.15;
        }

        return Math.max(0, baseSimilarity - tagPenalty);
    }

    static calculateArtistSimilarity(artist1, artist2, title1Analysis = null, title2Analysis = null) {
        if (!artist1 || !artist2) return 0;

        const norm1 = this.normalizeArtistName(artist1);
        const norm2 = this.normalizeArtistName(artist2);

        if (norm1 === norm2) return 1.0;

        const allArtists1 = new Set([norm1]);
        const allArtists2 = new Set([norm2]);

        if (title1Analysis?.featArtists) {
            title1Analysis.featArtists.forEach(feat => {
                allArtists1.add(this.normalizeArtistName(feat));
            });
        }

        if (title2Analysis?.featArtists) {
            title2Analysis.featArtists.forEach(feat => {
                allArtists2.add(this.normalizeArtistName(feat));
            });
        }

        const hasOverlap = [...allArtists1].some(a1 => [...allArtists2].some(a2 => a1 === a2));
        if (hasOverlap) return 0.9;

        return this.getDiceCoefficient(norm1, norm2);
    }

    static calculateDurationSimilarity(duration1, duration2) {
        if (duration1 === undefined || duration2 === undefined ||
            duration1 === null || duration2 === null) {
            return 0.7;
        }

        const diff = Math.abs(duration1 - duration2);
        if (diff === 0) return 1.0;
        if (diff <= 2.0) return 0.95;
        if (diff <= 5) return 0.7;
        if (diff <= 10) return 0.4;
        if (diff <= 15) return 0.2;
        return 0.05;
    }

    static calculateAlbumSimilarity(album1, album2) {
        if (!album1 || !album2) return 0.1;

        const norm1 = this.normalizeString(album1);
        const norm2 = this.normalizeString(album2);

        if (norm1 === norm2) return 1.0;
        return this.getDiceCoefficient(norm1, norm2);
    }

    static calculateSongSimilarity(candidate, queryTitle, queryArtist, queryAlbum, queryDuration) {
        const attrs = candidate?.attributes || candidate;
        if (!attrs) return { score: 0, reason: 'Invalid candidate' };

        const candTitle = attrs.name || attrs.title || '';
        const candArtist = attrs.artistName || attrs.artist || '';
        const candAlbum = attrs.albumName || attrs.album || '';

        if (!candTitle || !candArtist) {
            return { score: 0, reason: 'Missing title or artist' };
        }

        let candDuration;
        if (attrs.durationInMillis) {
            candDuration = attrs.durationInMillis / 1000;
        } else if (attrs.durationMs) {
            candDuration = attrs.durationMs / 1000;
        } else if (attrs.duration) {
            candDuration = attrs.duration > 1000 ? attrs.duration / 1000 : attrs.duration;
        }

        const queryTitleAnalysis = this.analyzeTitle(queryTitle);
        const candTitleAnalysis = this.analyzeTitle(candTitle);

        const titleScore = this.calculateTitleSimilarity(candTitle, queryTitle);
        const artistScore = this.calculateArtistSimilarity(
            candArtist, queryArtist || '', candTitleAnalysis, queryTitleAnalysis
        );
        const albumScore = this.calculateAlbumSimilarity(candAlbum, queryAlbum);
        const durationScore = this.calculateDurationSimilarity(candDuration, queryDuration);

        const titleThreshold = 0.7;
        const artistThreshold = 0.6;

        if (titleScore < titleThreshold) {
            return {
                score: Math.min(0.4, titleScore * 0.5),
                reason: `Title similarity too low: ${titleScore.toFixed(3)}`,
                components: { titleScore, artistScore, albumScore, durationScore },
                durations: { query: queryDuration, candidate: candDuration }
            };
        }

        if (artistScore < artistThreshold) {
            return {
                score: Math.min(0.5, artistScore * 0.7),
                reason: `Artist similarity too low: ${artistScore.toFixed(3)}`,
                components: { titleScore, artistScore, albumScore, durationScore },
                durations: { query: queryDuration, candidate: candDuration }
            };
        }

        if (queryDuration > 0 && candDuration > 0) {
            if (Math.abs(queryDuration - candDuration) > 2.0) {
                return {
                    score: Math.min(0.6, (titleScore + artistScore) / 2 * 0.8),
                    reason: `Duration difference too large: ${Math.abs(queryDuration - candDuration).toFixed(1)}s`,
                    components: { titleScore, artistScore, albumScore, durationScore },
                    durations: { query: queryDuration, candidate: candDuration }
                };
            }
        }

        let weights = { title: 0.5, artist: 0.4, album: 0.05, duration: 0.05 };

        if (queryDuration !== undefined && queryDuration !== null &&
            candDuration !== undefined && candDuration !== null) {
            weights = { title: 0.35, artist: 0.35, album: 0.1, duration: 0.2 };
        }

        if (queryAlbum && candAlbum) {
            if (queryDuration !== undefined && queryDuration !== null &&
                candDuration !== undefined && candDuration !== null) {
                weights = { title: 0.3, artist: 0.3, album: 0.2, duration: 0.2 };
            } else {
                weights = { title: 0.4, artist: 0.4, album: 0.2, duration: 0 };
            }
        }

        let finalScore = (titleScore * weights.title) +
            (artistScore * weights.artist) +
            (albumScore * weights.album) +
            (durationScore * weights.duration);

        let reason = 'Good match';
        if (titleScore === 1.0 && artistScore >= 0.9) {
            finalScore = Math.min(1.0, finalScore + 0.05);
            reason = 'Exact title and artist match';
        }

        return {
            score: Math.min(1.0, Math.max(0, finalScore)),
            reason,
            components: { titleScore, artistScore, albumScore, durationScore },
            weights,
            durations: { query: queryDuration, candidate: candDuration }
        };
    }

    static findBestSongMatch(candidates, queryTitle, queryArtist, queryAlbum, queryDuration) {
        if (!candidates?.length || !queryTitle) return null;

        const validCandidates = candidates.filter(c => {
            const attrs = c?.attributes || c;
            const title = attrs?.name || attrs?.title;
            const artist = attrs?.artistName || attrs?.artist;
            return title && artist;
        });

        if (validCandidates.length === 0) return null;

        console.debug(`🎵 Matching: "${queryArtist || 'Unknown'}" - "${queryTitle}" (${validCandidates.length} candidates)`);

        const scoredCandidates = validCandidates.map(candidate => {
            const scoreInfo = this.calculateSongSimilarity(
                candidate, queryTitle, queryArtist, queryAlbum, queryDuration
            );
            return { candidate, scoreInfo };
        });

        scoredCandidates.sort((a, b) => {
            if (Math.abs(a.scoreInfo.score - b.scoreInfo.score) > 0.001) {
                return b.scoreInfo.score - a.scoreInfo.score;
            }
            if (queryDuration !== undefined) {
                return b.scoreInfo.components.durationScore - a.scoreInfo.components.durationScore;
            }
            return 0;
        });

        const bestMatch = scoredCandidates[0];
        const confidenceThreshold = 0.70;

        if (bestMatch.scoreInfo.score < confidenceThreshold) {
            console.debug(`❌ No match: score ${bestMatch.scoreInfo.score.toFixed(3)} < ${confidenceThreshold}`);
            return null;
        }

        if (scoredCandidates.length > 1) {
            const secondBest = scoredCandidates[1];
            const scoreGap = bestMatch.scoreInfo.score - secondBest.scoreInfo.score;

            if (scoreGap < 0.05 && bestMatch.scoreInfo.score < 0.9) {
                console.debug(`⚠️ Ambiguous match (gap: ${scoreGap.toFixed(3)}), selecting first`);
            }
        }

        const attrs = bestMatch.candidate?.attributes || bestMatch.candidate;
        console.debug(`✅ Match: "${attrs.artistName || attrs.artist}" - "${attrs.name || attrs.title}" [${bestMatch.scoreInfo.score.toFixed(3)}]`);

        return bestMatch;
    }
}