const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const UPLOAD_BEFORE_DIR = path.join(UPLOAD_DIR, 'before');
const UPLOAD_AFTER_DIR = path.join(UPLOAD_DIR, 'after');

[DATA_DIR, UPLOAD_DIR, UPLOAD_BEFORE_DIR, UPLOAD_AFTER_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve static
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// Helper: Read / Write Database
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return { pht: [], ttvt: [], hangmuc: [], giaiphap: [], uutien: [], users: [], items: [], settings: {} };
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.settings) parsed.settings = {};
    return parsed;
  } catch (err) {
    console.error('Error reading DB:', err);
    return { pht: [], ttvt: [], hangmuc: [], giaiphap: [], uutien: [], users: [], items: [], settings: {} };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing DB:', err);
    return false;
  }
}

// Helper: Synchronize with Google Sheet via Apps Script Webhook
async function syncToGoogleSheet(action, data) {
  try {
    const db = readDB();
    const scriptUrl = db.settings ? db.settings.googleSheetUrl : null;
    if (!scriptUrl || !scriptUrl.startsWith('http')) {
      return { synced: false, message: 'Chưa cấu hình Google Apps Script URL' };
    }

    const payload = { action, ...data };
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      if (text.includes('Không thể mở tệp') || text.includes('Không tìm thấy trang') || text.includes('accounts.google.com')) {
        return {
          synced: false,
          error: 'Google báo lỗi phân quyền: Khi Triển khai (Deploy) trong Apps Script, mục "Người có quyền truy cập (Who has access)" cần chọn là "Bất kỳ ai" (Anyone) và phải hoàn tất bước bấm Cho phép (Authorize).'
        };
      }
      return { synced: false, error: 'Google phản hồi lỗi: ' + text.substring(0, 120) };
    }

    console.log(`[GoogleSheet Sync] Action: ${action} - Result:`, result);
    return { synced: true, result };
  } catch (err) {
    console.warn(`[GoogleSheet Sync] Warning:`, err.message);
    return { synced: false, error: err.message };
  }
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const type = req.query.type === 'after' ? 'after' : 'before';
    const targetDir = type === 'after' ? UPLOAD_AFTER_DIR : UPLOAD_BEFORE_DIR;
    cb(null, targetDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e6);
    cb(null, `${cleanName}_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max per image
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ cho phép tải lên file hình ảnh!'));
    }
  }
});

// ================= API ROUTES =================

// 1. Auth Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!' });
  }

  const db = readDB();
  const user = db.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password.trim());

  if (!user) {
    return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
  }

  // Success response
  res.json({
    success: true,
    user: {
      username: user.username,
      donvi: user.donvi,
      role: user.role
    }
  });
});

// 2. Get Reference Categories
app.get('/api/categories', (req, res) => {
  const db = readDB();
  res.json({
    success: true,
    categories: {
      pht: db.pht || [],
      ttvt: db.ttvt || [],
      hangmuc: db.hangmuc || [],
      giaiphap: db.giaiphap || [],
      uutien: db.uutien || []
    }
  });
});

// 3. Stats Dashboard
app.get('/api/stats', (req, res) => {
  const db = readDB();
  const items = db.items || [];
  const total = items.length;
  const chuaXuLy = items.filter(i => i.tinhTrang === 'Chưa xử lý').length;
  const dangXuLy = items.filter(i => i.tinhTrang === 'Đang xử lý').length;
  const daHoanThanh = items.filter(i => i.tinhTrang === 'Đã hoàn thành').length;

  // By Hangmuc
  const byHangmuc = {};
  items.forEach(i => {
    const k = i.hangmuc || 'Khác';
    byHangmuc[k] = (byHangmuc[k] || 0) + 1;
  });

  // By PHT
  const byPht = {};
  items.forEach(i => {
    const k = i.pht || 'Chưa phân loại';
    byPht[k] = (byPht[k] || 0) + 1;
  });

  res.json({
    success: true,
    stats: {
      total,
      chuaXuLy,
      dangXuLy,
      daHoanThanh,
      byHangmuc,
      byPht
    }
  });
});

// 4. Get Items list with filtering
app.get('/api/items', (req, res) => {
  const db = readDB();
  let items = [...(db.items || [])];

  const { search, pht, ttvt, hangmuc, tinhTrang, giaiphap, uutien } = req.query;

  if (pht && pht !== 'all') {
    items = items.filter(i => i.pht === pht);
  }
  if (ttvt && ttvt !== 'all') {
    items = items.filter(i => i.ttvt === ttvt);
  }
  if (hangmuc && hangmuc !== 'all') {
    items = items.filter(i => i.hangmuc === hangmuc);
  }
  if (tinhTrang && tinhTrang !== 'all') {
    items = items.filter(i => i.tinhTrang === tinhTrang);
  }
  if (giaiphap && giaiphap !== 'all') {
    items = items.filter(i => i.giaiphap === giaiphap);
  }
  if (uutien && uutien !== 'all') {
    items = items.filter(i => i.uutien === uutien);
  }

  if (search && search.trim()) {
    const kw = search.trim().toLowerCase();
    items = items.filter(i =>
      (i.id && i.id.toLowerCase().includes(kw)) ||
      (i.tenTuyenCap && i.tenTuyenCap.toLowerCase().includes(kw)) ||
      (i.khuVuc && i.khuVuc.toLowerCase().includes(kw)) ||
      (i.diaChi && i.diaChi.toLowerCase().includes(kw)) ||
      (i.moTaHienTrang && i.moTaHienTrang.toLowerCase().includes(kw)) ||
      (i.phuongAn && i.phuongAn.toLowerCase().includes(kw)) ||
      (i.ketQua && i.ketQua.toLowerCase().includes(kw)) ||
      (i.pht && i.pht.toLowerCase().includes(kw)) ||
      (i.ttvt && i.ttvt.toLowerCase().includes(kw))
    );
  }

  // Sort descending by ID or STT
  items.sort((a, b) => (b.stt || 0) - (a.stt || 0));

  res.json({
    success: true,
    total: items.length,
    items
  });
});

// 5. Get Item detail by ID
app.get('/api/items/:id', (req, res) => {
  const db = readDB();
  const item = (db.items || []).find(i => i.id === req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu xử lý!' });
  }
  res.json({ success: true, item });
});

// 6. Create new Item
app.post('/api/items', (req, res) => {
  const db = readDB();
  const items = db.items || [];

  const maxStt = items.reduce((max, i) => Math.max(max, i.stt || 0), 0);
  const newStt = maxStt + 1;
  const newId = `XL-${String(newStt).padStart(4, '0')}`;

  const now = new Date();
  const formattedDate = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0');

  const newItem = {
    id: newId,
    stt: newStt,
    pht: req.body.pht || '',
    ttvt: req.body.ttvt || '',
    hangmuc: req.body.hangmuc || '',
    tenTuyenCap: req.body.tenTuyenCap || '',
    khuVuc: req.body.khuVuc || '',
    diaChi: req.body.diaChi || '',
    kinhDo: parseFloat(req.body.kinhDo) || 0,
    viDo: parseFloat(req.body.viDo) || 0,
    giaiphap: req.body.giaiphap || '',
    uutien: req.body.uutien || 'UT2 - Ưu tiên',
    tinhTrang: req.body.tinhTrang || 'Chưa xử lý',
    moTaHienTrang: req.body.moTaHienTrang || '',
    phuongAn: req.body.phuongAn || '',
    imagesBefore: Array.isArray(req.body.imagesBefore) ? req.body.imagesBefore.slice(0, 5) : [],
    imagesAfter: Array.isArray(req.body.imagesAfter) ? req.body.imagesAfter.slice(0, 5) : [],
    ketQua: req.body.ketQua || '',
    nguoiTao: req.body.nguoiTao || 'Người dùng',
    ngayTao: formattedDate
  };

  items.unshift(newItem);
  db.items = items;
  writeDB(db);

  // Auto-sync to Google Sheet in background
  syncToGoogleSheet('addOrUpdate', { item: newItem });

  res.status(201).json({ success: true, message: 'Tạo phiếu xử lý thành công!', item: newItem });
});

// 7. Update Item
app.put('/api/items/:id', (req, res) => {
  const db = readDB();
  const items = db.items || [];
  const index = items.findIndex(i => i.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu cần cập nhật!' });
  }

  const existing = items[index];
  const updatedItem = {
    ...existing,
    pht: req.body.pht !== undefined ? req.body.pht : existing.pht,
    ttvt: req.body.ttvt !== undefined ? req.body.ttvt : existing.ttvt,
    hangmuc: req.body.hangmuc !== undefined ? req.body.hangmuc : existing.hangmuc,
    tenTuyenCap: req.body.tenTuyenCap !== undefined ? req.body.tenTuyenCap : existing.tenTuyenCap,
    khuVuc: req.body.khuVuc !== undefined ? req.body.khuVuc : existing.khuVuc,
    diaChi: req.body.diaChi !== undefined ? req.body.diaChi : existing.diaChi,
    kinhDo: req.body.kinhDo !== undefined ? (parseFloat(req.body.kinhDo) || 0) : existing.kinhDo,
    viDo: req.body.viDo !== undefined ? (parseFloat(req.body.viDo) || 0) : existing.viDo,
    giaiphap: req.body.giaiphap !== undefined ? req.body.giaiphap : existing.giaiphap,
    uutien: req.body.uutien !== undefined ? req.body.uutien : existing.uutien,
    tinhTrang: req.body.tinhTrang !== undefined ? req.body.tinhTrang : existing.tinhTrang,
    moTaHienTrang: req.body.moTaHienTrang !== undefined ? req.body.moTaHienTrang : existing.moTaHienTrang,
    phuongAn: req.body.phuongAn !== undefined ? req.body.phuongAn : existing.phuongAn,
    imagesBefore: Array.isArray(req.body.imagesBefore) ? req.body.imagesBefore.slice(0, 5) : existing.imagesBefore,
    imagesAfter: Array.isArray(req.body.imagesAfter) ? req.body.imagesAfter.slice(0, 5) : existing.imagesAfter,
    ketQua: req.body.ketQua !== undefined ? req.body.ketQua : existing.ketQua,
    ngayCapNhat: new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
  };

  items[index] = updatedItem;
  db.items = items;
  writeDB(db);

  // Auto-sync to Google Sheet in background
  syncToGoogleSheet('addOrUpdate', { item: updatedItem });

  res.json({ success: true, message: 'Cập nhật phiếu xử lý thành công!', item: updatedItem });
});

// 7.1 Settings: Google Sheet Apps Script URL
app.get('/api/settings/google-sheet', (req, res) => {
  const db = readDB();
  const url = (db.settings && db.settings.googleSheetUrl) || '';
  res.json({ success: true, googleSheetUrl: url });
});

app.post('/api/settings/google-sheet', (req, res) => {
  const { googleSheetUrl } = req.body;
  const db = readDB();
  if (!db.settings) db.settings = {};
  db.settings.googleSheetUrl = (googleSheetUrl || '').trim();
  writeDB(db);
  res.json({ success: true, message: 'Đã lưu cấu hình Google Sheet URL!', googleSheetUrl: db.settings.googleSheetUrl });
});

// 7.2 Manual Push all items to Google Sheet
app.post('/api/sync/google-sheet', async (req, res) => {
  const db = readDB();
  const items = db.items || [];
  const scriptUrl = db.settings ? db.settings.googleSheetUrl : null;

  if (!scriptUrl || !scriptUrl.startsWith('http')) {
    return res.status(400).json({
      success: false,
      message: 'Chưa cấu hình URL Google Apps Script! Vui lòng vào Cài đặt để dán URL.'
    });
  }

  const syncRes = await syncToGoogleSheet('syncAll', { items });
  if (syncRes.synced) {
    res.json({ success: true, message: 'Đồng bộ toàn bộ dữ liệu lên Google Sheet thành công!', result: syncRes.result });
  } else {
    res.status(500).json({ success: false, message: 'Lỗi khi đồng bộ lên Google Sheet: ' + (syncRes.error || syncRes.message) });
  }
});

// 8. Delete Item (Admin only)
app.delete('/api/items/:id', (req, res) => {
  const db = readDB();
  const items = db.items || [];
  const index = items.findIndex(i => i.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu để xóa!' });
  }

  const deleted = items.splice(index, 1)[0];
  db.items = items;
  writeDB(db);

  res.json({ success: true, message: 'Đã xóa phiếu thành công!', item: deleted });
});

// 9. Upload Images (Max 5 images per request)
app.post('/api/upload', upload.array('images', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có file hình ảnh nào được gửi lên!' });
    }

    const type = req.query.type === 'after' ? 'after' : 'before';
    const urls = req.files.map(f => `/uploads/${type}/${f.filename}`);

    res.json({
      success: true,
      message: `Đã tải lên ${urls.length} hình ảnh thành công!`,
      urls
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải ảnh: ' + err.message });
  }
});

// 10. Export to Excel matching the exact Google Sheet template
app.get('/api/export/excel', (req, res) => {
  try {
    const db = readDB();
    const items = db.items || [];

    // Header matches the Google Sheet:
    // STT | Phòng Hạ tầng | Tên TTVT | Loại hạng mục | Tên tuyến cáp/kết cuối | Khu vực/địa bàn | Địa chỉ chi tiết | Kinh độ | Vĩ độ | Nhóm giải pháp đề xuất | tình trạng | Mô tả hiện trạng | phương án để xuất | hình ảnh before | hình ảnh after | kết quả xử lý
    const exportRows = items.map((item, idx) => ({
      'STT': item.stt || (idx + 1),
      'Phòng Hạ tầng': item.pht || '',
      'Tên TTVT': item.ttvt || '',
      'Loại hạng mục': item.hangmuc || '',
      'Tên tuyến cáp/kết cuối': item.tenTuyenCap || '',
      'Khu vực/địa bàn': item.khuVuc || '',
      'Địa chỉ chi tiết': item.diaChi || '',
      'Kinh độ': item.kinhDo || '',
      'Vĩ độ': item.viDo || '',
      'Nhóm giải pháp đề xuất': item.giaiphap || '',
      'tình trạng': item.tinhTrang || '',
      'Mô tả hiện trạng': item.moTaHienTrang || '',
      'phương án để xuất': item.phuongAn || '',
      'hình ảnh before': (item.imagesBefore || []).join(' ; '),
      'hình ảnh after': (item.imagesAfter || []).join(' ; '),
      'kết quả xử lý': item.ketQua || ''
    }));

    const ws = xlsx.utils.json_to_sheet(exportRows);

    // Set column widths
    const colWidths = [
      { wch: 6 },  // STT
      { wch: 18 }, // Phòng Hạ tầng
      { wch: 20 }, // Tên TTVT
      { wch: 22 }, // Loại hạng mục
      { wch: 28 }, // Tên tuyến cáp
      { wch: 22 }, // Khu vực
      { wch: 35 }, // Địa chỉ
      { wch: 12 }, // Kinh độ
      { wch: 12 }, // Vĩ độ
      { wch: 24 }, // Nhóm giải pháp
      { wch: 15 }, // tình trạng
      { wch: 35 }, // Mô tả hiện trạng
      { wch: 35 }, // phương án
      { wch: 25 }, // hình ảnh before
      { wch: 25 }, // hình ảnh after
      { wch: 35 }  // kết quả
    ];
    ws['!cols'] = colWidths;

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'xuly');

    // Also include reference sheets as in the original
    if (db.pht) {
      const phtWs = xlsx.utils.json_to_sheet(db.pht.map(p => ({ 'PHÒNG HT': p })));
      xlsx.utils.book_append_sheet(wb, phtWs, 'pht');
    }
    if (db.ttvt) {
      const ttvtWs = xlsx.utils.json_to_sheet(db.ttvt.map(t => ({ 'TTVT': t })));
      xlsx.utils.book_append_sheet(wb, ttvtWs, 'ttvt');
    }
    if (db.hangmuc) {
      const hmWs = xlsx.utils.json_to_sheet(db.hangmuc.map(h => ({ 'Loại hạng mục': h })));
      xlsx.utils.book_append_sheet(wb, hmWs, 'hangmuc');
    }
    if (db.giaiphap) {
      const gpWs = xlsx.utils.json_to_sheet(db.giaiphap.map(g => ({ 'Nhóm giải pháp đề xuất': g })));
      xlsx.utils.book_append_sheet(wb, gpWs, 'giaiphap');
    }

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="xuly_hatang_export.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, message: 'Lỗi xuất Excel: ' + err.message });
  }
});

// Baohong Service APIs
const baohongService = require('./services/baohongService');

// API: Get Baohong Stats
app.get('/api/baohong/stats', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const stats = await baohongService.getStats(force);
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Error getting baohong stats:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Get Baohong Heatmap points
app.get('/api/baohong/heatmap', async (req, res) => {
  try {
    const type = req.query.type || 'mnv'; // 'mnv' or 'all'
    const points = await baohongService.getHeatmap(type);
    res.json({ success: true, count: points.length, type, data: points });
  } catch (err) {
    console.error('Error getting heatmap:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Get Kyhieu Hotspots (markers for high-density areas)
app.get('/api/baohong/kyhieu-hotspots', async (req, res) => {
  try {
    const minCount = parseInt(req.query.min || '3', 10);
    const spots = await baohongService.getKyhieuHotspots(minCount);
    res.json({ success: true, count: spots.length, data: spots });
  } catch (err) {
    console.error('Error getting kyhieu hotspots:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// API: Refresh Baohong Data
app.post('/api/baohong/refresh', async (req, res) => {
  try {
    const stats = await baohongService.getStats(true);
    res.json({ success: true, message: 'Đã làm mới dữ liệu báo hỏng thành công', data: stats });
  } catch (err) {
    console.error('Error refreshing baohong data:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fallback to SPA index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Hệ thống Xử lý Hạ tầng Viễn thông đang hoạt động:`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
