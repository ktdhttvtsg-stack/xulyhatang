const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CSV_FILE = path.join(__dirname, '..', 'baohong_sample.csv');
const CACHE_STATS_FILE = path.join(__dirname, '..', 'data', 'baohong_stats.json');
const CACHE_HEATMAP_FILE = path.join(__dirname, '..', 'data', 'baohong_heatmap.json');

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

let cachedStats = null;
let cachedHeatmap = null;

async function processData(forceReload = false) {
  if (!forceReload && cachedStats && cachedHeatmap) {
    return { stats: cachedStats, heatmap: cachedHeatmap };
  }

  // Check if cache files exist on disk
  if (!forceReload && fs.existsSync(CACHE_STATS_FILE) && fs.existsSync(CACHE_HEATMAP_FILE)) {
    try {
      cachedStats = JSON.parse(fs.readFileSync(CACHE_STATS_FILE, 'utf8'));
      cachedHeatmap = JSON.parse(fs.readFileSync(CACHE_HEATMAP_FILE, 'utf8'));
      console.log('Loaded baohong data from cache successfully.');
      return { stats: cachedStats, heatmap: cachedHeatmap };
    } catch (e) {
      console.warn('Cache corrupted, recomputing...', e.message);
    }
  }

  if (!fs.existsSync(CSV_FILE)) {
    throw new Error('File baohong_sample.csv không tồn tại.');
  }

  console.log('Processing baohong_sample.csv...');
  const fileStream = fs.createReadStream(CSV_FILE, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let totalRows = 0;
  let header = null;
  let mnvCount = 0;
  const ttvtStats = {};
  const tovtMNV = {};
  const kvMNV = {};
  const kyhieuMap = {};
  const heatmapMNV = [];
  const heatmapAll = [];

  for await (const line of rl) {
    if (!header) {
      header = parseCSVLine(line);
      continue;
    }
    if (!line.trim()) continue;

    totalRows++;
    const cols = parseCSVLine(line);

    // Columns
    const ma_loaihong = cols[46] ? cols[46].trim() : '';
    const ma_kv = cols[55] ? cols[55].trim() : 'Chưa xác định';
    const tovt = cols[56] ? cols[56].trim() : 'Chưa xác định';
    const ttvt = cols[57] ? cols[57].trim() : 'Chưa xác định';
    const kyhieu = cols[59] ? cols[59].trim() : '';
    const rawKinhdo = cols[60] ? cols[60].trim().replace(',', '.') : '';
    const rawVido = cols[61] ? cols[61].trim().replace(',', '.') : '';

    if (!ttvtStats[ttvt]) {
      ttvtStats[ttvt] = { name: ttvt, total: 0, mnv: 0 };
    }
    ttvtStats[ttvt].total++;

    const isMNV = (ma_loaihong === '24');
    if (isMNV) {
      mnvCount++;
      ttvtStats[ttvt].mnv++;
      if (tovt) tovtMNV[tovt] = (tovtMNV[tovt] || 0) + 1;
      if (ma_kv) kvMNV[ma_kv] = (kvMNV[ma_kv] || 0) + 1;
    }

    if (kyhieu) {
      if (!kyhieuMap[kyhieu]) {
        kyhieuMap[kyhieu] = { kyhieu, total: 0, mnv: 0 };
      }
      kyhieuMap[kyhieu].total++;
      if (isMNV) {
        kyhieuMap[kyhieu].mnv++;
      }
    }

    const lat = parseFloat(rawVido);
    const lng = parseFloat(rawKinhdo);
    if (!isNaN(lat) && !isNaN(lng) && lat > 8 && lat < 24 && lng > 102 && lng < 115) {
      const p = [Math.round(lat * 100000) / 100000, Math.round(lng * 100000) / 100000];
      if (isMNV) {
        heatmapMNV.push([...p, 1.0]);
      }
      heatmapAll.push([...p, isMNV ? 1.0 : 0.6]);
    }
  }

  // Aggregate TTVT list
  const ttvtList = Object.values(ttvtStats).map(item => ({
    ...item,
    rate: item.total > 0 ? ((item.mnv / item.total) * 100).toFixed(1) : '0.0'
  })).sort((a, b) => b.mnv - a.mnv || b.total - a.total);

  // Top 10 TOVT
  const top10Tovt = Object.entries(tovtMNV)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tovt, count], index) => ({
      rank: index + 1,
      tovt,
      count,
      percent: mnvCount > 0 ? ((count / mnvCount) * 100).toFixed(1) : '0.0'
    }));

  // Top 10 KV
  const top10Kv = Object.entries(kvMNV)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ma_kv, count], index) => ({
      rank: index + 1,
      ma_kv,
      count,
      percent: mnvCount > 0 ? ((count / mnvCount) * 100).toFixed(1) : '0.0'
    }));

  // Top 20 Kyhieu
  const top20Kyhieu = Object.values(kyhieuMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 20)
    .map((item, index) => ({
      rank: index + 1,
      kyhieu: item.kyhieu,
      total: item.total,
      mnv: item.mnv,
      rate: item.total > 0 ? ((item.mnv / item.total) * 100).toFixed(1) : '0.0'
    }));

  cachedStats = {
    totalRows,
    mnvCount,
    mnvRate: totalRows > 0 ? ((mnvCount / totalRows) * 100).toFixed(1) : '0.0',
    validCoordsCount: heatmapAll.length,
    validMNVCoordsCount: heatmapMNV.length,
    ttvtList,
    top10Tovt,
    top10Kv,
    top20Kyhieu,
    updatedAt: new Date().toISOString()
  };

  cachedHeatmap = {
    mnv: heatmapMNV,
    all: heatmapAll
  };

  // Write to disk cache
  try {
    fs.writeFileSync(CACHE_STATS_FILE, JSON.stringify(cachedStats, null, 2), 'utf8');
    fs.writeFileSync(CACHE_HEATMAP_FILE, JSON.stringify(cachedHeatmap), 'utf8');
    console.log('Saved baohong cache to disk.');
  } catch (err) {
    console.error('Error saving cache to disk:', err.message);
  }

  return { stats: cachedStats, heatmap: cachedHeatmap };
}

module.exports = {
  processData,
  getStats: async (force = false) => (await processData(force)).stats,
  getHeatmap: async (type = 'mnv', force = false) => {
    const { heatmap } = await processData(force);
    return type === 'all' ? heatmap.all : heatmap.mnv;
  }
};
