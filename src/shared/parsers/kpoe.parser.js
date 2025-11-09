export function v1Tov2(data) {
  const groupedLyrics = [];
  let currentGroup = null;

  if (data.type === "Line") {
    data.lyrics.forEach(segment => {
      const lineItem = {
        time: segment.time,
        duration: segment.duration,
        text: segment.text,
        syllabus: [],
        element: segment.element || { key: "", songPart: "", singer: "" }
      };
      groupedLyrics.push(lineItem);
    });
  } else {
    data.lyrics.forEach(segment => {
      if (!currentGroup) {
        currentGroup = {
          time: segment.time,
          duration: 0,
          text: "",
          syllabus: [],
          element: segment.element || { key: "", songPart: "", singer: "" }
        };
      }

      currentGroup.text += segment.text;

      const syllabusEntry = {
        time: segment.time,
        duration: segment.duration,
        text: segment.text
      };

      if (segment.element && segment.element.isBackground === true) {
        syllabusEntry.isBackground = true;
      }

      currentGroup.syllabus.push(syllabusEntry);

      if (segment.isLineEnding === 1) {
        let earliestTime = Infinity;
        let latestEndTime = 0;

        currentGroup.syllabus.forEach(syllable => {
          if (syllable.time < earliestTime) {
            earliestTime = syllable.time;
          }

          const endTime = syllable.time + syllable.duration;
          if (endTime > latestEndTime) {
            latestEndTime = endTime;
          }
        });

        currentGroup.time = earliestTime;
        currentGroup.duration = latestEndTime - earliestTime;

        currentGroup.text = currentGroup.text.trim();

        groupedLyrics.push(currentGroup);
        currentGroup = null;
      }
    });

    if (currentGroup) {
      let earliestTime = Infinity;
      let latestEndTime = 0;

      currentGroup.syllabus.forEach(syllable => {
        if (syllable.time < earliestTime) {
          earliestTime = syllable.time;
        }

        const endTime = syllable.time + syllable.duration;
        if (endTime > latestEndTime) {
          latestEndTime = endTime;
        }
      });

      currentGroup.time = earliestTime;
      currentGroup.duration = latestEndTime - earliestTime;

      currentGroup.text = currentGroup.text.trim();
      groupedLyrics.push(currentGroup);
    }
  }

  return {
    type: data.type == "syllable" ? "Word" : data.type,
    KpoeTools: '2.0-LPlusBcknd,' + data.KpoeTools,
    metadata: data.metadata,
    ignoreSponsorblock: data.ignoreSponsorblock || undefined,
    lyrics: groupedLyrics,
    cached: data.cached || 'None'
  };
}

/**
 * Converts a v2 lyrics object back to a legacy v1 object.
 * This is useful for compatibility with older systems that expect a flat lyrics array.
 *
 * @param {object} data - The v2 lyrics data, with grouped lines and a 'syllabus' array.
 * @returns {object} The converted v1 lyrics data with a flat 'lyrics' array.
 */
export function v2Tov1(data) {
  if (data.lyrics && data.lyrics.length > 0 && typeof data.lyrics[0].syllabus === 'undefined') {
    console.warn("Data is already in V1 format. No conversion needed.");
    return data;
  }

  const flatLyrics = [];

  if (data.type === "Line") {
    data.lyrics.forEach(line => {
      flatLyrics.push({
        time: line.time,
        duration: line.duration,
        text: line.text,
        isLineEnding: 1,
        element: line.element || { key: "", songPart: "", singer: "" }
      });
    });
  } else {
    data.lyrics.forEach(line => {
      if (!line.syllabus || line.syllabus.length === 0) {
        flatLyrics.push({
          time: line.time,
          duration: line.duration,
          text: line.text,
          isLineEnding: 1,
          element: line.element
        });
        return;
      }

      line.syllabus.forEach((syllable, index) => {
        const isLastSyllableInLine = index === line.syllabus.length - 1;

        const v1Segment = {
          time: syllable.time,
          duration: syllable.duration,
          text: syllable.text,
          isLineEnding: isLastSyllableInLine ? 1 : 0,
          element: { ...line.element }
        };

        if (syllable.isBackground) {
          v1Segment.element.isBackground = true;
        }

        flatLyrics.push(v1Segment);
      });
    });
  }

  return {
    type: data.type === "Word" ? "syllable" : data.type,
    KpoeTools: `2.0-V2toV1,${data.KpoeTools}`,
    metadata: data.metadata,
    ignoreSponsorblock: data.ignoreSponsorblock,
    lyrics: flatLyrics,
    cached: data.cached || 'None'
  };
}