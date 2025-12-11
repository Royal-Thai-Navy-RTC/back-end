const XLSX = require('xlsx');
const safeString = (value) =>
  value === undefined || value === null ? '' : String(value).trim();
const normalizeText = (value) => safeString(value).toLowerCase().replace(/\s+/g, ' ');
const thaiDigitsToArabic = (value) =>
  value === undefined || value === null
    ? ''
    : String(value)
        .split('')
        .map((char) => {
          const map = {
            ๐: '0',
            ๑: '1',
            ๒: '2',
            ๓: '3',
            ๔: '4',
            ๕: '5',
            ๖: '6',
            ๗: '7',
            ๘: '8',
            ๙: '9',
          };
          return map[char] ?? char;
        })
        .join('');
const workbook = XLSX.readFile('คะแนนทดสอบความรู้  v.2.xlsx', { cellDates: true });
const worksheet = workbook.Sheets['ด้านร่างกาย'];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
const merges = Array.isArray(worksheet['!merges']) ? worksheet['!merges'] : [];
const getMergedCellValue = (rowIndex, colIndex) => {
  const row = rows[rowIndex];
  const direct = row ? row[colIndex] : undefined;
  if (direct !== undefined && direct !== null && direct !== '') {
    return direct;
  }
  for (const merge of merges) {
    if (
      merge.s.r <= rowIndex &&
      rowIndex <= merge.e.r &&
      merge.s.c <= colIndex &&
      colIndex <= merge.e.c
    ) {
      const startAddress = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
      const startCell = worksheet[startAddress];
      if (startCell && startCell.v !== undefined && startCell.v !== null && startCell.v !== '') {
        return startCell.v;
      }
    }
  }
  return direct;
};
const normalizeRow = (rowIndex, maxCols) => {
  const normalized = [];
  for (let col = 0; col < maxCols; col++) {
    normalized.push(normalizeText(getMergedCellValue(rowIndex, col)));
  }
  return normalized;
};
const MAX_COLS = rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
const MIN_HEADER_ROW = 0;
const HEADER_KEYWORDS = [
  'สถานี',
  'หัวข้อ',
  'สังกัด',
  'กองร้อย',
  'กองพัน',
  'คะแนนรวม',
  'หมายเหตุ',
  'ลำดับ',
  'station',
  'topic',
  'company',
  'battalion',
  'score',
  'total',
  'note',
  'remarks',
  'order',
];
const containsAny = (text, keywords) => keywords.some((word) => word && text.includes(word));
let headerRowIndex = -1;
for (let idx = MIN_HEADER_ROW; idx < rows.length; idx++) {
  const normalized = normalizeRow(idx, MAX_COLS);
  if (normalized.some((cell) => containsAny(cell, HEADER_KEYWORDS))) {
    headerRowIndex = idx;
    break;
  }
}
console.log('headerRowIndex', headerRowIndex);
const nextRowIndex = headerRowIndex + 1;
const headerIndices = [headerRowIndex];
const nextNormalized = nextRowIndex < rows.length ? normalizeRow(nextRowIndex, MAX_COLS) : [];
const isSecondary = nextNormalized.some((cell) => containsAny(cell, ['สถานี', 'กอง', 'คะแนน', 'หมายเหตุ']));
if (isSecondary) {
  headerIndices.push(nextRowIndex);
}
const containsAll = (text, keywords) => keywords.every((word) => text.includes(word));
const buildColumnMap = () => {
  const map = {};
  for (let col = 0; col < MAX_COLS; col++) {
    const normalized = headerIndices
      .map((rowIndex) => normalizeText(getMergedCellValue(rowIndex, col)))
      .join(' ');
    if (!normalized) continue;
    if (
      !map.note &&
      containsAny(normalized, ['หมายเหตุ', 'note', 'remarks'])
    ) {
      map.note = col;
      continue;
    }
    if (
      !map.average &&
      containsAny(normalized, ['คะแนนรวมเฉลี่ย', 'เฉลี่ย', 'average'])
    ) {
      map.average = col;
      continue;
    }
    if (!map.total && containsAny(normalized, ['คะแนนรวม', 'total'])) {
      map.total = col;
      continue;
    }
    if (
      !map.sitUp &&
      containsAll(normalized, ['ลุก', 'นั่ง']) &&
      containsAny(normalized, ['สถานี', 'คะแนน', 'sit', 'station'])
    ) {
      map.sitUp = col;
      continue;
    }
    if (!map.pushUp && containsAll(normalized, ['ดัน', 'พื้น'])) {
      map.pushUp = col;
      continue;
    }
    if (!map.run && containsAny(normalized, ['วิ่ง', 'กม', 'กิโล'])) {
      map.run = col;
      continue;
    }
    if (!map.physicalRoutine && containsAny(normalized, ['กายบริหาร'])) {
      map.physicalRoutine = col;
      continue;
    }
    if (
      !map.company &&
      containsAny(normalized, ['กองร้อย', 'สังกัด', 'หน่วย', 'company'])
    ) {
      map.company = col;
      continue;
    }
    if (!map.battalion && containsAny(normalized, ['กองพัน', 'battalion'])) {
      map.battalion = col;
      continue;
    }
    if (!map.order && containsAny(normalized, ['ลำดับ', 'order'])) {
      map.order = col;
      continue;
    }
  }
  return map;
};
const columnMap = buildColumnMap();
console.log('columnMap', columnMap);
NODE
