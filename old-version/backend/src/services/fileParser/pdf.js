const pdfParse = require('pdf-parse');

function sanitizeText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, 100000);
}

async function parsePDF(buffer) {
  const data = await pdfParse(buffer);
  return sanitizeText(data.text);
}

module.exports = { parsePDF, sanitizeText };
