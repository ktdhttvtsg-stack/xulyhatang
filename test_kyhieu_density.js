const fs = require('fs');
const readline = require('readline');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

const rl = readline.createInterface({
  input: fs.createReadStream('baohong_sample.csv', { encoding: 'utf8' })
});

let header = null;
const kyhieuPoints = {};

rl.on('line', (line) => {
  if (!header) {
    header = parseCSVLine(line);
    return;
  }
  const cols = parseCSVLine(line);
  const kyhieu = cols[59] ? cols[59].trim() : '';
  const ma_loaihong = cols[46] ? cols[46].trim() : '';
  const ttvt = cols[57] ? cols[57].trim() : '';
  const tovt = cols[56] ? cols[56].trim() : '';
  const ma_kv = cols[55] ? cols[55].trim() : '';
  let kinhdo = cols[60] ? cols[60].trim().replace(',', '.') : '';
  let vido = cols[61] ? cols[61].trim().replace(',', '.') : '';
  const lat = parseFloat(vido);
  const lng = parseFloat(kinhdo);

  if (kyhieu && !isNaN(lat) && !isNaN(lng) && lat > 8 && lat < 24 && lng > 102 && lng < 115) {
    if (!kyhieuPoints[kyhieu]) {
      kyhieuPoints[kyhieu] = {
        kyhieu,
        count: 0,
        mnvCount: 0,
        latSum: 0,
        lngSum: 0,
        ttvt,
        tovt,
        ma_kv
      };
    }
    kyhieuPoints[kyhieu].count++;
    if (ma_loaihong === '24') kyhieuPoints[kyhieu].mnvCount++;
    kyhieuPoints[kyhieu].latSum += lat;
    kyhieuPoints[kyhieu].lngSum += lng;
  }
});

rl.on('close', () => {
  const list = Object.values(kyhieuPoints)
    .map(k => ({
      kyhieu: k.kyhieu,
      count: k.count,
      mnvCount: k.mnvCount,
      lat: Math.round((k.latSum / k.count) * 100000) / 100000,
      lng: Math.round((k.lngSum / k.count) * 100000) / 100000,
      ttvt: k.ttvt,
      tovt: k.tovt,
      ma_kv: k.ma_kv
    }))
    .sort((a, b) => b.count - a.count);

  console.log('Total unique kyhieu with coords:', list.length);
  console.log('Top 20 with coords:');
  console.table(list.slice(0, 20));
  
  const highDensity = list.filter(k => k.count >= 3);
  console.log('Kyhieu with count >= 3 (high density hot spots):', highDensity.length);
  const mnvHighDensity = list.filter(k => k.mnvCount >= 2);
  console.log('Kyhieu with mnvCount >= 2:', mnvHighDensity.length);
});
