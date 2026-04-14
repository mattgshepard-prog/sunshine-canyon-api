// api/debug-env.js — TEMPORARY: check env var status (delete after debugging)
export default function handler(req, res) {
  const vars = [
    'GUESTY_CLIENT_ID',
    'GUESTY_CLIENT_SECRET',
    'GUESTY_BEAPI_CLIENT_ID',
    'GUESTY_BEAPI_CLIENT_SECRET',
    'GUESTY_LISTING_ID'
  ];
  
  const result = {};
  for (const key of vars) {
    const val = process.env[key];
    if (!val) {
      result[key] = 'MISSING';
    } else {
      // Show first 6 and last 4 chars, length, and check for whitespace
      const trimmed = val.trim();
      result[key] = {
        preview: val.substring(0, 6) + '...' + val.substring(val.length - 4),
        length: val.length,
        trimmedLength: trimmed.length,
        hasLeadingSpace: val !== val.trimStart(),
        hasTrailingSpace: val !== val.trimEnd(),
        hasNewline: val.includes('\n') || val.includes('\r'),
        firstCharCode: val.charCodeAt(0),
        lastCharCode: val.charCodeAt(val.length - 1),
      };
    }
  }
  
  return res.status(200).json(result);
}
