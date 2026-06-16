export const SECTION_ORDER = [
  'project_summary',
  'features',
  'risks',
  'timeline',
  'effort',
  'market',
  'impact',
]

function findValueStart(text, index) {
  let cursor = index

  while (cursor < text.length && /\s/.test(text[cursor])) {
    cursor += 1
  }

  return cursor < text.length ? cursor : -1
}

function extractJsonString(text, startIndex) {
  let escaped = false

  for (let index = startIndex + 1; index < text.length; index += 1) {
    const char = text[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      return text.slice(startIndex, index + 1)
    }
  }

  return null
}

function extractBalancedJson(text, startIndex) {
  const openingChar = text[startIndex]
  const closingChar = openingChar === '[' ? ']' : '}'
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === openingChar) {
      depth += 1
    } else if (char === closingChar) {
      depth -= 1
      if (depth === 0) {
        return text.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

function extractPrimitive(text, startIndex) {
  for (let index = startIndex; index < text.length; index += 1) {
    if (/[,\n\r}]/.test(text[index])) {
      return text.slice(startIndex, index).trim()
    }
  }

  return text.slice(startIndex).trim()
}

function extractJsonValue(text, startIndex) {
  const firstChar = text[startIndex]

  if (firstChar === '"') {
    return extractJsonString(text, startIndex)
  }

  if (firstChar === '[' || firstChar === '{') {
    return extractBalancedJson(text, startIndex)
  }

  if (
    firstChar === '-' ||
    /\d/.test(firstChar) ||
    text.startsWith('true', startIndex) ||
    text.startsWith('false', startIndex) ||
    text.startsWith('null', startIndex)
  ) {
    return extractPrimitive(text, startIndex)
  }

  return null
}

export function extractPartialSections(rawBuffer) {
  const sections = {}

  for (const section of SECTION_ORDER) {
    const keyIndex = rawBuffer.indexOf(`"${section}"`)
    if (keyIndex === -1) continue

    const colonIndex = rawBuffer.indexOf(':', keyIndex)
    if (colonIndex === -1) continue

    const valueStart = findValueStart(rawBuffer, colonIndex + 1)
    if (valueStart === -1) continue

    const rawValue = extractJsonValue(rawBuffer, valueStart)
    if (!rawValue) continue

    try {
      sections[section] = JSON.parse(rawValue)
    } catch {
      // Ignore incomplete values until more of the stream arrives.
    }
  }

  return sections
}
