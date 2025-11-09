import { DOMParser } from '@xmldom/xmldom';

/**
 * Converts Apple Music's word-synced TTML format to a structured JSON object.
 * Enhanced version with corrected parsing for transliterations to handle
 * complex text node structures, including trailing text.
 * 
 * @param {string} ttml - The raw TTML content as a string.
 * @param {number} [offset=0] - An optional offset in milliseconds to apply to all timestamps.
 * @param {boolean} [separate=false] - A legacy flag to control text node handling (behavior preserved).
 * @returns {object|null} - A JSON object containing metadata and an array of lyric objects, or null on parsing failure.
 */
export function convertTTMLtoJSON(ttml, offset = 0, separate = false) {
  const KPOE = '1.0-ConvertTTMLtoJSON-DOMParser';

  const NS = {
    tt: 'http://www.w3.org/ns/ttml',
    itunes: 'http://music.apple.com/lyric-ttml-internal',
    ttm: 'http://www.w3.org/ns/ttml#metadata',
    xml: 'http://www.w3.org/XML/1998/namespace',
  };

  const timeToMs = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    let totalMs = 0;
    if (parts.length === 3) {
      const [h, m, s] = parts.map(p => parseFloat(p) || 0);
      totalMs = (h * 3600 + m * 60 + s) * 1000;
    } else if (parts.length === 2) {
      const [m, s] = parts.map(p => parseFloat(p) || 0);
      totalMs = (m * 60 + s) * 1000;
    } else {
      totalMs = parseFloat(parts[0]) * 1000;
    }
    return isNaN(totalMs) ? 0 : Math.round(totalMs);
  };

  const decodeHtmlEntities = (text) => {
    if (!text) return text || '';
    const map = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'" };
    return text.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (m) => map[m] || m);
  };

  function getAttr(el, nsUri, localName, prefixedName) {
    if (!el) return null;
    try {
      if (nsUri && el.getAttributeNS) {
        const v = el.getAttributeNS(nsUri, localName);
        if (v !== null && v !== undefined) return v;
      }
    } catch (e) { /* ignore */ }
    if (prefixedName) {
      const v2 = el.getAttribute(prefixedName);
      if (v2 !== null && v2 !== undefined) return v2;
    }
    return el.getAttribute(localName);
  }

  function collectTailText(node) {
    let txt = '';
    let sib = node.nextSibling;
    while (sib && sib.nodeType === 3) { // 3 = TEXT_NODE
      txt += sib.nodeValue || '';
      sib = sib.nextSibling;
    }
    return txt;
  }

  function isInsideBackgroundWrapper(node, paragraph) {
    let current = node.parentNode;
    while (current && current !== paragraph) {
      const roleVal = getAttr(current, NS.ttm, 'role', 'ttm:role');
      if (roleVal === 'x-bg') return true;
      current = current.parentNode;
    }
    return false;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(ttml, 'application/xml');

  if (doc.getElementsByTagName('parsererror').length > 0) {
    console.error('Failed to parse TTML document.');
    return null;
  }

  const root = doc.documentElement;
  const timingMode = getAttr(root, NS.itunes, 'timing', 'itunes:timing') || 'Word';

  const metadata = {
    source: 'Apple Music', songWriters: [], title: '',
    language: getAttr(root, NS.xml, 'lang', 'xml:lang') || '',
    agents: {},
    totalDuration: getAttr(doc.getElementsByTagName('body')[0], null, 'dur', 'dur') || '',
  };

  const headEl = doc.getElementsByTagName('head')[0];
  const itunesMetaEl = headEl ? headEl.getElementsByTagName('iTunesMetadata')[0] : null;

  if (headEl) {
    const agentNodes = headEl.getElementsByTagName('ttm:agent');
    for (let i = 0; i < agentNodes.length; i++) {
      const a = agentNodes[i];
      const agentId = getAttr(a, NS.xml, 'id', 'xml:id');
      if (!agentId) continue;
      const type = getAttr(a, null, 'type', 'type') || 'person';
      let name = '';
      const nameNode = a.getElementsByTagName('ttm:name')[0];
      if (nameNode) {
        name = decodeHtmlEntities(nameNode.textContent.trim());
      }
      metadata.agents[agentId] = { type, name, alias: agentId.replace('voice', 'v') };
    }

    const metaContent = itunesMetaEl || headEl.getElementsByTagName('metadata')[0];
    if (metaContent) {
      const titleEl = metaContent.getElementsByTagName('ttm:title')[0] || metaContent.getElementsByTagName('title')[0];
      if (titleEl) metadata.title = decodeHtmlEntities(titleEl.textContent.trim());

      const songwritersEl = metaContent.getElementsByTagName('songwriters')[0];
      if (songwritersEl) {
        const songwriterNodes = songwritersEl.getElementsByTagName('songwriter');
        for (let i = 0; i < songwriterNodes.length; i++) {
          const name = decodeHtmlEntities(songwriterNodes[i].textContent.trim());
          if (name) metadata.songWriters.push(name);
        }
      }
    }
  }

  const translationMap = {};
  const transliterationMap = {};

  if (itunesMetaEl) {
    const translationsNode = itunesMetaEl.getElementsByTagName('translations')[0];
    if (translationsNode) {
      const translationNodes = translationsNode.getElementsByTagName('translation');
      for (const transNode of translationNodes) {
        const lang = getAttr(transNode, NS.xml, 'lang', 'xml:lang');
        const textNodes = transNode.getElementsByTagName('text');
        for (const textNode of textNodes) {
          const lineId = getAttr(textNode, null, 'for', 'for');
          if (lineId) {
            translationMap[lineId] = {
              lang: lang,
              text: decodeHtmlEntities(textNode.textContent.trim())
            };
          }
        }
      }
    }

    const transliterationsNode = itunesMetaEl.getElementsByTagName('transliterations')[0];
    if (transliterationsNode) {
      const transliterationNodes = transliterationsNode.getElementsByTagName('transliteration');
      for (const translitNode of transliterationNodes) {
        const lang = getAttr(translitNode, NS.xml, 'lang', 'xml:lang');
        const textNodes = translitNode.getElementsByTagName('text');

        for (const textNode of textNodes) {
          const lineId = getAttr(textNode, null, 'for', 'for');
          if (!lineId) continue;

          const syllabus = [];
          let fullText = '';
          const spans = Array.from(textNode.getElementsByTagName('span'));
          const processedSpans = new Set();

          for (const span of spans) {
            if (processedSpans.has(span)) continue;

            let spanText = '';
            for (const child of span.childNodes) {
              if (child.nodeType === 3) { spanText += child.nodeValue || ''; }
              if (child.nodeType === 1) { // Element node, e.g. nested span
                Array.from(child.getElementsByTagName('span')).forEach(s => processedSpans.add(s));
              }
            }
            spanText = decodeHtmlEntities(spanText);

            const tail = collectTailText(span);
            if (tail && !separate) {
              spanText += decodeHtmlEntities(tail);
            }

            if (spanText.trim() === '' && (!tail || tail.trim() === '')) continue;

            processedSpans.add(span);

            const begin = getAttr(span, null, 'begin', 'begin');
            const end = getAttr(span, null, 'end', 'end');

            syllabus.push({
              time: timeToMs(begin) + offset,
              duration: timeToMs(end) - timeToMs(begin),
              text: spanText,
            });

            fullText += spanText;
          }

          if (syllabus.length > 0) {
            transliterationMap[lineId] = {
              lang: lang,
              text: fullText.trim(),
              syllabus: syllabus,
            };
          }
        }
      }
    }
  }

  const lyrics = [];
  const divs = doc.getElementsByTagName('div');

  for (let i = 0; i < divs.length; i++) {
    const div = divs[i];
    const songPart = getAttr(div, NS.itunes, 'song-part', 'itunes:song-part') || getAttr(div, NS.itunes, 'songPart', 'itunes:songPart') || '';
    const ps = div.getElementsByTagName('p');

    for (let j = 0; j < ps.length; j++) {
      const p = ps[j];
      const key = getAttr(p, NS.itunes, 'key', 'itunes:key') || '';
      const singerId = getAttr(p, NS.ttm, 'agent', 'ttm:agent') || '';
      const singer = singerId.replace('voice', 'v');

      // Get timing from paragraph element for line-by-line timing
      const pBegin = getAttr(p, null, 'begin', 'begin');
      const pEnd = getAttr(p, null, 'end', 'end');

      const currentLine = {
        time: 0,
        duration: 0,
        text: '',
        syllabus: [],
        element: { key, songPart, singer }
      };

      // Check if we have word-level spans with timing
      const allSpansInP = Array.from(p.getElementsByTagName('span')).filter(span => getAttr(span, null, 'begin', 'begin'));
      
      if (allSpansInP.length > 0 && timingMode === 'Word') {
        // Word-by-word timing mode
        const processedSpans = new Set();

        for (const sp of allSpansInP) {
          if (processedSpans.has(sp)) continue;

          const isBg = isInsideBackgroundWrapper(sp, p);
          if (isBg) {
            Array.from(sp.getElementsByTagName('span')).forEach(nested => processedSpans.add(nested));
          }
          processedSpans.add(sp);

          const begin = getAttr(sp, null, 'begin', 'begin') || '0';
          const end = getAttr(sp, null, 'end', 'end') || '0';

          let spanText = '';
          for (const child of sp.childNodes) {
            if (child.nodeType === 3) { spanText += child.nodeValue || ''; }
          }
          spanText = decodeHtmlEntities(spanText);

          const tail = collectTailText(sp);
          if (tail && !separate) {
            spanText += decodeHtmlEntities(tail);
          }

          if (spanText.trim() === '' && (!tail || !tail.includes(' '))) continue;

          const syllabusEntry = {
            time: timeToMs(begin) + offset,
            duration: timeToMs(end) - timeToMs(begin),
            text: spanText
          };
          if (isBg) syllabusEntry.isBackground = true;

          currentLine.syllabus.push(syllabusEntry);
          currentLine.text += spanText;
        }
      } else {
        // Line-by-line timing mode - use paragraph timing and extract text
        if (pBegin && pEnd) {
          let lineText = '';
          
          function extractTextFromNode(node) {
            let text = '';
            for (const child of node.childNodes) {
              if (child.nodeType === 3) { 
                text += child.nodeValue || '';
              } else if (child.nodeType === 1) {
                text += extractTextFromNode(child);
              }
            }
            return text;
          }
          
          lineText = extractTextFromNode(p);
          lineText = decodeHtmlEntities(lineText.trim());

          if (lineText) {
            // Create a single syllabus entry for the entire line
            const syllabusEntry = {
              time: timeToMs(pBegin) + offset,
              duration: timeToMs(pEnd) - timeToMs(pBegin),
              text: lineText
            };

            currentLine.syllabus.push(syllabusEntry);
            currentLine.text = lineText;
          }
        }
      }

      if (currentLine.syllabus.length > 0) {
        let earliestTime = Infinity;
        let latestEndTime = 0;

        currentLine.syllabus.forEach(syllable => {
          if (syllable.time < earliestTime) earliestTime = syllable.time;
          const endTime = syllable.time + syllable.duration;
          if (endTime > latestEndTime) latestEndTime = endTime;
        });

        currentLine.time = earliestTime;
        currentLine.duration = latestEndTime - earliestTime;

        // Attach pre-computed translation and transliteration data
        if (key && translationMap[key]) {
          currentLine.translation = translationMap[key];
        }
        if (key && transliterationMap[key]) {
          currentLine.transliteration = transliterationMap[key];
        }

        lyrics.push(currentLine);
      }
    }
  }

  return {
    KpoeTools: KPOE,
    type: timingMode,
    metadata,
    lyrics,
  };
}

/**
 * JSON to Apple TTML Converter
 * Enhanced version that properly handles Apple's TTML specifications
 * 
 * @param {Object} jsonLyrics - The JSON lyrics object
 * @returns {String} - The TTML formatted XML string
 */
export function convertJsonToTTML(jsonLyrics) {
  const formatTime = (ms) => {
    if (isNaN(ms) || ms < 0) ms = 0;
    const totalSeconds = ms / 1000;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.round((totalSeconds % 1) * 1000);
    const ss = seconds.toString().padStart(2, '0');
    const mmm = milliseconds.toString().padStart(3, '0');
    if (hours > 0) {
      const hh = hours.toString().padStart(2, '0');
      const mm = minutes.toString().padStart(2, '0');
      return `${hh}:${mm}:${ss}.${mmm}`;
    }
    if (minutes > 0) {
      const mm = minutes.toString().padStart(2, '0');
      return `${mm}:${ss}.${mmm}`;
    }
    return `${seconds}.${mmm}`;
  };

  const escapeHtml = (text) => {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  };

  const extractTextAndSpace = (fullText) => {
    if (!fullText) return { text: '', space: '' };
    const trimmedText = fullText.trimEnd();
    const space = fullText.substring(trimmedText.length);
    return { text: trimmedText, space: space };
  };

  const finalAgents = { ...(jsonLyrics.metadata?.agents || {}) };
  const existingAliases = new Set(Object.values(finalAgents).map(agent => agent.alias));
  if (jsonLyrics.lyrics) {
    const singerAliases = new Set(jsonLyrics.lyrics.map(line => line.element?.singer).filter(Boolean));
    singerAliases.forEach(alias => {
      if (!existingAliases.has(alias)) {
        const isGroup = alias.endsWith('000');
        const type = isGroup ? 'group' : 'person';
        const idNum = alias.substring(1);
        const agentId = `voice${idNum}`;
        const name = isGroup ? `Group ${idNum}` : `Singer ${idNum}`;
        if (!finalAgents[agentId]) {
          finalAgents[agentId] = { type, name, alias };
        }
      }
    });
  }

  const findAgentId = (singerAlias) => {
    if (!singerAlias) return 'voice1';
    for (const [id, data] of Object.entries(finalAgents)) {
      if (data.alias === singerAlias) return id;
    }
    return singerAlias.startsWith('v') ? 'voice' + singerAlias.substring(1) : singerAlias;
  };

  const timingMode = jsonLyrics.type || "Word";
  const language = jsonLyrics.metadata?.language || "en";
  let ttml = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" itunes:timing="${timingMode}" xml:lang="${language}">`;

  ttml += '<head>';
  ttml += '<metadata>';
  if (jsonLyrics.metadata?.title) {
    ttml += `<ttm:title>${escapeHtml(jsonLyrics.metadata.title)}</ttm:title>`;
  }
  for (const [agentId, agentData] of Object.entries(finalAgents)) {
    ttml += `<ttm:agent type="${escapeHtml(agentData.type || 'person')}" xml:id="${escapeHtml(agentId)}"><ttm:name>${escapeHtml(agentData.name)}</ttm:name></ttm:agent>`;
  }
  ttml += '</metadata>';

  const leadingSilence = jsonLyrics.metadata?.leadingSilence || "0.020";
  ttml += `<itunes:metadata leadingSilence="${leadingSilence}">`;
  if (Array.isArray(jsonLyrics.metadata?.songWriters) && jsonLyrics.metadata.songWriters.length > 0) {
    ttml += '<songwriters>';
    jsonLyrics.metadata.songWriters.forEach(sw => { ttml += `<songwriter>${escapeHtml(sw)}</songwriter>`; });
    ttml += '</songwriters>';
  }
  ttml += '</itunes:metadata>';
  ttml += '</head>';

  let totalDurationMs = 0;
  if (jsonLyrics.lyrics?.length > 0) {
    const lastLine = jsonLyrics.lyrics[jsonLyrics.lyrics.length - 1];
    totalDurationMs = lastLine.time + lastLine.duration;
  }
  const formattedDuration = formatTime(totalDurationMs);
  ttml += `<body dur="${formattedDuration}">`;

  if (jsonLyrics.lyrics?.length > 0) {
    const groups = [];
    let currentGroup = null;
    jsonLyrics.lyrics.forEach(line => {
      const songPart = line.element?.songPart || '';
      if (!currentGroup || currentGroup.songPart !== songPart) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          songPart: songPart,
          lines: [line],
          startTime: line.time,
          endTime: line.time + line.duration
        };
      } else {
        currentGroup.lines.push(line);
        currentGroup.endTime = Math.max(currentGroup.endTime, line.time + line.duration);
      }
    });
    if (currentGroup) groups.push(currentGroup);

    groups.forEach(group => {
      ttml += `<div begin="${formatTime(group.startTime)}" end="${formatTime(group.endTime)}"`;
      if (group.songPart) ttml += ` itunes:song-part="${escapeHtml(group.songPart)}"`;
      ttml += '>';

      group.lines.forEach(line => {
        const agentId = findAgentId(line.element?.singer);
        const key = line.element?.key || "";
        ttml += `<p begin="${formatTime(line.time)}" end="${formatTime(line.time + line.duration)}"`;
        if (key) ttml += ` itunes:key="${escapeHtml(key)}"`;
        if (agentId) ttml += ` ttm:agent="${escapeHtml(agentId)}"`;
        ttml += '>';

        if (timingMode === 'Line') {
          ttml += escapeHtml(line.text);
        } else if (line.syllabus?.length > 0) {
          const bgSyllables = line.syllabus.filter(s => s.isBackground);
          const mainSyllables = line.syllabus.filter(s => !s.isBackground);
          if (bgSyllables.length > 0) {
            ttml += '<span ttm:role="x-bg">';
            bgSyllables.forEach(syl => {
              const { text, space } = extractTextAndSpace(syl.text);
              ttml += `<span begin="${formatTime(syl.time)}" end="${formatTime(syl.time + syl.duration)}">${escapeHtml(text)}</span>${space}`;
            });
            ttml += '</span>';
          }
          mainSyllables.forEach(syl => {
            const { text, space } = extractTextAndSpace(syl.text);
            ttml += `<span begin="${formatTime(syl.time)}" end="${formatTime(syl.time + syl.duration)}">${escapeHtml(text)}</span>${space}`;
          });
        } else {
          ttml += escapeHtml(line.text);
        }
        ttml += '</p>';
      });
      ttml += '</div>';
    });
  }

  ttml += '</body></tt>';
  return ttml;
}
