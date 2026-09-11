/**
 * XỬ LÝ HẠ TẦNG VIỄN THÔNG - CLIENT LOGIC (app.js)
 */

// Application State
const state = {
  currentUser: {
    username: 'kythuat',
    donvi: 'PKT',
    role: 'admin' // admin | editor | view
  },
  categories: {
    pht: [],
    ttvt: [],
    hangmuc: [],
    giaiphap: [],
    uutien: []
  },
  items: [],
  currentViewingItem: null,
  formImagesBefore: [],
  formImagesAfter: [],
  overallMap: null,
  overallMarkersLayer: null,
  formMap: null,
  activeView: 'list', // 'list' | 'map'
  baohongHeatmapMap: null,
  baohongHeatLayer: null,
  baohongHotspotsLayer: null,
  showKyhieuHotspots: true,
  currentHeatType: 'mnv',
  heatRadius: 25,
  baohongHotspotsData: []
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', async () => {
  loadStoredUser();
  updateUserUI();
  await loadCategories();
  await loadStats();
  await loadItems();
  initOverallMap();
});

// Load User from LocalStorage
function loadStoredUser() {
  try {
    const saved = localStorage.getItem('xuly_user');
    if (saved) {
      state.currentUser = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error reading localStorage', e);
  }
}

function saveStoredUser(user) {
  state.currentUser = user;
  try {
    localStorage.setItem('xuly_user', JSON.stringify(user));
  } catch (e) {}
  updateUserUI();
}

// Update UI based on User Role
function updateUserUI() {
  const user = state.currentUser;
  const nameEl = document.getElementById('userNameDisplay');
  const badgeEl = document.getElementById('userRoleBadge');
  const avatarEl = document.getElementById('userAvatar');
  const addBtn = document.getElementById('addNewBtn');

  if (nameEl) nameEl.textContent = `${user.username} (${user.donvi || ''})`;
  if (avatarEl) avatarEl.textContent = (user.username || 'KT').substring(0, 2).toUpperCase();

  if (badgeEl) {
    badgeEl.className = 'user-role-badge';
    if (user.role === 'admin') {
      badgeEl.classList.add('role-admin');
      badgeEl.textContent = 'ADMIN';
    } else if (user.role === 'editor') {
      badgeEl.classList.add('role-editor');
      badgeEl.textContent = 'EDITOR';
    } else {
      badgeEl.classList.add('role-view');
      badgeEl.textContent = 'XEM (VIEW)';
    }
  }

  // Permission: Only admin and editor can add items
  if (addBtn) {
    if (user.role === 'view') {
      addBtn.style.display = 'none';
    } else {
      addBtn.style.display = 'inline-flex';
    }
  }
}

// ================= DATA FETCHING =================
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    if (data.success) {
      state.categories = data.categories;
      populateCategorySelects();
    }
  } catch (err) {
    showToast('Không thể tải danh mục chuẩn: ' + err.message, 'error');
  }
}

function populateCategorySelects() {
  const { pht, ttvt, hangmuc, giaiphap, uutien } = state.categories;

  // Filter dropdowns
  populateSelect('filterPht', pht, '-- Tất cả Phòng HT --');
  populateSelect('filterTtvt', ttvt, '-- Tất cả TTVT --');
  populateSelect('filterHangmuc', hangmuc, '-- Tất cả Hạng mục --');

  // Form dropdowns
  populateSelect('formPht', pht, '-- Chọn Phòng HT --');
  populateSelect('formTtvt', ttvt, '-- Chọn TTVT --');
  populateSelect('formHangmuc', hangmuc, '-- Chọn Loại Hạng mục --');
  populateSelect('formGiaiphap', giaiphap, '-- Chọn giải pháp đề xuất --');
  populateSelect('formUutien', uutien, null);
}

function populateSelect(elemId, items, placeholder) {
  const select = document.getElementById(elemId);
  if (!select) return;

  select.innerHTML = '';
  if (placeholder) {
    const defaultOpt = document.createElement('option');
    defaultOpt.value = elemId.startsWith('filter') ? 'all' : '';
    defaultOpt.textContent = placeholder;
    select.appendChild(defaultOpt);
  }

  (items || []).forEach(item => {
    const opt = document.createElement('option');
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    if (data.success && data.stats) {
      document.getElementById('statTotal').textContent = data.stats.total || 0;
      document.getElementById('statChuaXuLy').textContent = data.stats.chuaXuLy || 0;
      document.getElementById('statDangXuLy').textContent = data.stats.dangXuLy || 0;
      document.getElementById('statDaHoanThanh').textContent = data.stats.daHoanThanh || 0;
    }
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

async function loadItems() {
  try {
    const params = new URLSearchParams();
    const search = document.getElementById('filterSearch').value;
    const pht = document.getElementById('filterPht').value;
    const ttvt = document.getElementById('filterTtvt').value;
    const hangmuc = document.getElementById('filterHangmuc').value;
    const tinhTrang = document.getElementById('filterTinhTrang').value;

    if (search) params.append('search', search);
    if (pht && pht !== 'all') params.append('pht', pht);
    if (ttvt && ttvt !== 'all') params.append('ttvt', ttvt);
    if (hangmuc && hangmuc !== 'all') params.append('hangmuc', hangmuc);
    if (tinhTrang && tinhTrang !== 'all') params.append('tinhTrang', tinhTrang);

    const res = await fetch(`/api/items?${params.toString()}`);
    const data = await res.json();

    if (data.success) {
      state.items = data.items || [];
      renderItemsTable(state.items);
      updateOverallMapMarkers(state.items);
    }
  } catch (err) {
    showToast('Lỗi khi tải danh sách phiếu: ' + err.message, 'error');
  }
}

async function reloadAllData() {
  await loadStats();
  await loadItems();
  showToast('Đã làm mới dữ liệu thành công!', 'success');
}

// ================= TABLE RENDERING =================
function renderItemsTable(items) {
  const tbody = document.getElementById('itemsTableBody');
  const emptyState = document.getElementById('emptyTableState');

  if (!items || items.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  const role = state.currentUser.role;

  tbody.innerHTML = items.map((item, idx) => {
    // Status Badge
    let statusClass = 'badge-status-chua';
    if (item.tinhTrang === 'Đang xử lý') statusClass = 'badge-status-dang';
    else if (item.tinhTrang === 'Đã hoàn thành') statusClass = 'badge-status-xong';

    // Priority Badge
    let utBadge = '';
    if (item.uutien) {
      let utClass = 'badge-ut-2';
      if (item.uutien.includes('UT1')) utClass = 'badge-ut-1';
      else if (item.uutien.includes('UT3')) utClass = 'badge-ut-3';
      utBadge = `<span class="badge ${utClass}" style="margin-top: 4px; font-size: 0.68rem;">${escapeHtml(item.uutien)}</span>`;
    }

    // Images Thumbnail Group
    const beforeImgs = (item.imagesBefore || []);
    const afterImgs = (item.imagesAfter || []);
    let imgThumbHtml = '';

    if (beforeImgs.length > 0 || afterImgs.length > 0) {
      imgThumbHtml = '<div class="table-thumb-group">';
      if (beforeImgs[0]) {
        imgThumbHtml += `<img src="${beforeImgs[0]}" class="table-thumb" title="Trước xử lý (${beforeImgs.length} ảnh)" onclick="openLightbox('${beforeImgs[0]}')">`;
      }
      if (afterImgs[0]) {
        imgThumbHtml += `<img src="${afterImgs[0]}" class="table-thumb" title="Sau xử lý (${afterImgs.length} ảnh)" onclick="openLightbox('${afterImgs[0]}')">`;
      }
      const totalImgs = beforeImgs.length + afterImgs.length;
      imgThumbHtml += `<span style="font-size: 0.725rem; color: var(--text-muted); font-weight:600;">+${totalImgs}</span></div>`;
    } else {
      imgThumbHtml = '<span style="color: #cbd5e1; font-size: 0.8rem;">Chưa có ảnh</span>';
    }

    // GPS Display
    let gpsText = '<span style="color: #cbd5e1; font-size: 0.8rem;">Chưa có GPS</span>';
    if (item.kinhDo && item.viDo) {
      gpsText = `<a href="https://maps.google.com/?q=${item.viDo},${item.kinhDo}" target="_blank" style="color: var(--accent); text-decoration: none; font-size: 0.775rem; font-weight: 500;" title="Mở Google Maps">📍 ${item.viDo.toFixed(4)}, ${item.kinhDo.toFixed(4)}</a>`;
    }

    // Action buttons based on Role
    let actionButtons = `
      <button class="btn btn-sm btn-outline" onclick="openDetailModal('${item.id}')" title="Xem chi tiết">
        👁️
      </button>
    `;

    if (role === 'admin' || role === 'editor') {
      actionButtons += `
        <button class="btn btn-sm btn-secondary" onclick="openEditModal('${item.id}')" title="Chỉnh sửa phiếu">
          ✏️
        </button>
      `;
    }

    if (role === 'admin') {
      actionButtons += `
        <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.id}')" title="Xóa phiếu">
          🗑️
        </button>
      `;
    }

    return `
      <tr>
        <td style="font-weight: 700; color: var(--text-muted); text-align: center;">${item.stt || (idx + 1)}</td>
        <td>
          <div style="font-weight: 700; color: var(--primary);">${escapeHtml(item.id)}</div>
          <div style="font-size: 0.825rem; font-weight: 600;">${escapeHtml(item.tenTuyenCap || '---')}</div>
        </td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(item.ttvt || '---')}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(item.pht || '---')}</div>
        </td>
        <td>
          <div><span class="badge" style="background: #f1f5f9; color: var(--text-main); font-weight: 600;">${escapeHtml(item.hangmuc || 'Chưa chọn')}</span></div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 3px;">${escapeHtml(item.giaiphap || '---')}</div>
          ${utBadge}
        </td>
        <td>
          <div style="font-weight: 500;">${escapeHtml(item.khuVuc || '---')}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.35;" title="${escapeHtml(item.diaChi || '')}">${escapeHtml(item.diaChi || '---')}</div>
        </td>
        <td>${gpsText}</td>
        <td>
          <span class="badge ${statusClass}">
            ● ${escapeHtml(item.tinhTrang || 'Chưa xử lý')}
          </span>
        </td>
        <td>
          <div style="font-size: 0.775rem; line-height: 1.45;">
            ${item.moTaHienTrang ? `<div style="margin-bottom: 3px;"><strong style="color:#b45309;">⚠️ Hiện trạng:</strong> <span>${escapeHtml(item.moTaHienTrang)}</span></div>` : ''}
            ${item.phuongAn ? `<div style="margin-bottom: 3px;"><strong style="color:#1d4ed8;">💡 Phương án:</strong> <span>${escapeHtml(item.phuongAn)}</span></div>` : ''}
            ${item.ketQua ? `<div><strong style="color:#047857;">✅ Kết quả:</strong> <span>${escapeHtml(item.ketQua)}</span></div>` : ''}
            ${(!item.moTaHienTrang && !item.phuongAn && !item.ketQua) ? '<span style="color:#cbd5e1; font-style:italic;">Chưa có mô tả/phương án</span>' : ''}
          </div>
        </td>
        <td>${imgThumbHtml}</td>
        <td style="text-align: right;">
          <div class="table-actions" style="justify-content: flex-end;">
            ${actionButtons}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ================= FILTER & SEARCH =================
let filterTimeout = null;
function debounceFilter() {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(() => {
    loadItems();
  }, 350);
}

function applyFilters() {
  loadItems();
}

function resetFilters() {
  document.getElementById('filterSearch').value = '';
  document.getElementById('filterPht').value = 'all';
  document.getElementById('filterTtvt').value = 'all';
  document.getElementById('filterHangmuc').value = 'all';
  document.getElementById('filterTinhTrang').value = 'all';
  loadItems();
}

// ================= VIEW SWITCHER (LIST / MAP / BAOHONG) =================
function switchView(viewName) {
  state.activeView = viewName;
  const listContainer = document.getElementById('listViewContainer');
  const mapContainer = document.getElementById('mapViewContainer');
  const baohongContainer = document.getElementById('baohongViewContainer');
  const infraStatsGrid = document.getElementById('infraStatsGrid');
  const infraActionCard = document.getElementById('infraActionCard');

  const listTab = document.getElementById('tabListViewBtn');
  const mapTab = document.getElementById('tabMapViewBtn');
  const baohongTab = document.getElementById('tabBaohongViewBtn');

  // Reset all tabs
  [listTab, mapTab, baohongTab].forEach(btn => btn && btn.classList.remove('active'));

  if (viewName === 'map') {
    listContainer.style.display = 'none';
    if (baohongContainer) baohongContainer.style.display = 'none';
    if (infraStatsGrid) infraStatsGrid.style.display = 'grid';
    if (infraActionCard) infraActionCard.style.display = 'block';

    mapContainer.classList.add('active');
    mapTab.classList.add('active');
    
    // Invalidate map size so tiles render properly
    setTimeout(() => {
      if (state.overallMap) {
        state.overallMap.invalidateSize();
        fitOverallMapBounds();
      }
    }, 100);
  } else if (viewName === 'baohong') {
    listContainer.style.display = 'none';
    mapContainer.classList.remove('active');
    if (infraStatsGrid) infraStatsGrid.style.display = 'none';
    if (infraActionCard) infraActionCard.style.display = 'none';

    if (baohongContainer) baohongContainer.style.display = 'flex';
    if (baohongTab) baohongTab.classList.add('active');

    loadBaohongData();
    setTimeout(() => {
      if (state.baohongHeatmapMap) {
        state.baohongHeatmapMap.invalidateSize();
      }
    }, 150);
  } else {
    // Default 'list'
    mapContainer.classList.remove('active');
    if (baohongContainer) baohongContainer.style.display = 'none';
    if (infraStatsGrid) infraStatsGrid.style.display = 'grid';
    if (infraActionCard) infraActionCard.style.display = 'block';

    listContainer.style.display = 'block';
    listTab.classList.add('active');
  }
}

// ================= LEAFLET OVERALL MAP =================
function initOverallMap() {
  if (state.overallMap) return;

  // Center around Ho Chi Minh City coordinates
  state.overallMap = L.map('overallMap').setView([10.7769, 106.6953], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap hạ tầng viễn thông'
  }).addTo(state.overallMap);

  state.overallMarkersLayer = L.featureGroup().addTo(state.overallMap);
  updateOverallMapMarkers(state.items);
}

function updateOverallMapMarkers(items) {
  if (!state.overallMap || !state.overallMarkersLayer) return;

  state.overallMarkersLayer.clearLayers();

  items.forEach(item => {
    if (!item.viDo || !item.kinhDo) return;

    let markerColor = '#ef4444'; // Red (Chưa xử lý)
    if (item.tinhTrang === 'Đang xử lý') markerColor = '#f59e0b'; // Amber
    else if (item.tinhTrang === 'Đã hoàn thành') markerColor = '#10b981'; // Green

    const marker = L.circleMarker([item.viDo, item.kinhDo], {
      radius: 9,
      fillColor: markerColor,
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    });

    const popupHtml = `
      <div style="font-family: inherit; font-size: 0.85rem; max-width: 250px;">
        <div style="font-weight: 700; color: #1d4ed8; margin-bottom: 2px;">${escapeHtml(item.id)} - ${escapeHtml(item.tenTuyenCap || '')}</div>
        <div style="font-size: 0.775rem; color: #64748b; margin-bottom: 4px;">${escapeHtml(item.ttvt || '')} (${escapeHtml(item.pht || '')})</div>
        <div style="margin-bottom: 4px;"><strong>Hạng mục:</strong> ${escapeHtml(item.hangmuc || '---')}</div>
        <div style="margin-bottom: 4px;"><strong>Địa chỉ:</strong> ${escapeHtml(item.diaChi || item.khuVuc || '---')}</div>
        <div style="margin-bottom: 6px;"><strong>Tình trạng:</strong> <span style="font-weight: 600; color: ${markerColor}">${escapeHtml(item.tinhTrang || '')}</span></div>
        <button class="btn btn-sm btn-primary" onclick="openDetailModal('${item.id}')" style="width: 100%;">
          👁️ Xem chi tiết phiếu
        </button>
      </div>
    `;

    marker.bindPopup(popupHtml);
    state.overallMarkersLayer.addLayer(marker);
  });
}

function fitOverallMapBounds() {
  if (state.overallMarkersLayer && state.overallMarkersLayer.getLayers().length > 0) {
    state.overallMap.fitBounds(state.overallMarkersLayer.getBounds(), { padding: [50, 50] });
  }
}

// ================= FORM LEAFLET MAP (COORDINATE PICKER) =================
function initFormMap(lat = 10.7769, lng = 106.6953, hasPin = false) {
  if (!state.formMap) {
    state.formMap = L.map('formMap').setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(state.formMap);

    state.formMap.on('click', (e) => {
      setFormCoordinates(e.latlng.lat, e.latlng.lng);
    });
  } else {
    state.formMap.setView([lat, lng], 14);
  }

  if (hasPin) {
    setFormCoordinates(lat, lng, false);
  } else if (state.formMarker) {
    state.formMap.removeLayer(state.formMarker);
    state.formMarker = null;
    document.getElementById('mapPickerCoords').textContent = 'Tọa độ: Chưa chọn';
  }

  setTimeout(() => {
    state.formMap.invalidateSize();
  }, 200);
}

function setFormCoordinates(lat, lng, updateInputs = true) {
  if (updateInputs) {
    document.getElementById('formViDo').value = lat.toFixed(6);
    document.getElementById('formKinhDo').value = lng.toFixed(6);
  }

  document.getElementById('mapPickerCoords').textContent = `Tọa độ: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  if (state.formMarker) {
    state.formMarker.setLatLng([lat, lng]);
  } else {
    state.formMarker = L.marker([lat, lng], { draggable: true }).addTo(state.formMap);
    state.formMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      setFormCoordinates(pos.lat, pos.lng);
    });
  }
  state.formMap.panTo([lat, lng]);
}

function updateFormMarkerFromInputs() {
  const lat = parseFloat(document.getElementById('formViDo').value);
  const lng = parseFloat(document.getElementById('formKinhDo').value);

  if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    setFormCoordinates(lat, lng, false);
  }
}

// GPS Location from browser
function getCurrentGPSLocation() {
  if (!navigator.geolocation) {
    showToast('Trình duyệt không hỗ trợ định vị GPS!', 'error');
    return;
  }

  showToast('Đang lấy tọa độ GPS hiện tại...', 'info');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setFormCoordinates(lat, lng);
      showToast(`Đã lấy vị trí GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, 'success');
    },
    (err) => {
      console.warn('GPS Error:', err);
      showToast('Không lấy được GPS: ' + err.message + '. Bạn có thể click trực tiếp trên bản đồ.', 'warning');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ================= FORM MODAL (CREATE / EDIT) =================
function openCreateModal() {
  if (state.currentUser.role === 'view') {
    showToast('Tài khoản quyền Xem (View) không được tạo phiếu mới!', 'warning');
    return;
  }

  document.getElementById('itemModalTitle').textContent = '➕ Tạo Phiếu Xử Lý Hạ Tầng Mới';
  document.getElementById('formItemId').value = '';
  document.getElementById('itemForm').reset();
  if (document.getElementById('formMoTaHienTrang')) {
    document.getElementById('formMoTaHienTrang').value = '';
  }

  state.formImagesBefore = [];
  state.formImagesAfter = [];
  renderFormImagesPreview();

  document.getElementById('itemFormModal').classList.add('active');

  // Default coordinate: HCMC
  initFormMap(10.7769, 106.6953, false);
}

async function openEditModal(id) {
  if (state.currentUser.role === 'view') {
    showToast('Tài khoản quyền Xem (View) không được chỉnh sửa phiếu!', 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/items/${id}`);
    const data = await res.json();
    if (!data.success || !data.item) {
      showToast('Không tìm thấy thông tin phiếu!', 'error');
      return;
    }

    const item = data.item;
    document.getElementById('itemModalTitle').textContent = `✏️ Chỉnh Sửa Phiếu: ${item.id}`;
    document.getElementById('formItemId').value = item.id;

    document.getElementById('formPht').value = item.pht || '';
    document.getElementById('formTtvt').value = item.ttvt || '';
    document.getElementById('formHangmuc').value = item.hangmuc || '';
    document.getElementById('formUutien').value = item.uutien || 'UT2 - Ưu tiên';

    document.getElementById('formTenTuyenCap').value = item.tenTuyenCap || '';
    document.getElementById('formKhuVuc').value = item.khuVuc || '';
    document.getElementById('formDiaChi').value = item.diaChi || '';

    document.getElementById('formKinhDo').value = item.kinhDo || '';
    document.getElementById('formViDo').value = item.viDo || '';

    document.getElementById('formGiaiphap').value = item.giaiphap || '';
    document.getElementById('formTinhTrang').value = item.tinhTrang || 'Chưa xử lý';
    if (document.getElementById('formMoTaHienTrang')) {
      document.getElementById('formMoTaHienTrang').value = item.moTaHienTrang || '';
    }
    document.getElementById('formPhuongAn').value = item.phuongAn || '';
    document.getElementById('formKetQua').value = item.ketQua || '';

    state.formImagesBefore = [...(item.imagesBefore || [])];
    state.formImagesAfter = [...(item.imagesAfter || [])];
    renderFormImagesPreview();

    document.getElementById('itemFormModal').classList.add('active');

    // Init Map with item's coordinates
    const lat = item.viDo || 10.7769;
    const lng = item.kinhDo || 106.6953;
    const hasPin = Boolean(item.viDo && item.kinhDo);
    initFormMap(lat, lng, hasPin);

  } catch (err) {
    showToast('Lỗi mở form sửa: ' + err.message, 'error');
  }
}

function closeItemModal() {
  document.getElementById('itemFormModal').classList.remove('active');
}

// Save Item (Create or Update)
async function handleSaveItem(e) {
  e.preventDefault();

  const id = document.getElementById('formItemId').value;
  const isEdit = Boolean(id);

  const payload = {
    pht: document.getElementById('formPht').value,
    ttvt: document.getElementById('formTtvt').value,
    hangmuc: document.getElementById('formHangmuc').value,
    uutien: document.getElementById('formUutien').value,
    tenTuyenCap: document.getElementById('formTenTuyenCap').value,
    khuVuc: document.getElementById('formKhuVuc').value,
    diaChi: document.getElementById('formDiaChi').value,
    kinhDo: parseFloat(document.getElementById('formKinhDo').value) || 0,
    viDo: parseFloat(document.getElementById('formViDo').value) || 0,
    giaiphap: document.getElementById('formGiaiphap').value,
    tinhTrang: document.getElementById('formTinhTrang').value,
    moTaHienTrang: document.getElementById('formMoTaHienTrang') ? document.getElementById('formMoTaHienTrang').value : '',
    phuongAn: document.getElementById('formPhuongAn').value,
    ketQua: document.getElementById('formKetQua').value,
    imagesBefore: state.formImagesBefore,
    imagesAfter: state.formImagesAfter,
    nguoiTao: state.currentUser.username
  };

  const submitBtn = document.getElementById('saveItemSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ Đang lưu...';

  try {
    const url = isEdit ? `/api/items/${id}` : '/api/items';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      showToast(isEdit ? 'Đã cập nhật phiếu xử lý thành công!' : 'Đã tạo phiếu xử lý mới thành công!', 'success');
      closeItemModal();
      
      // Also sync to Google Sheet via active browser session
      const savedUrl = document.getElementById('googleSheetUrlInput') ? document.getElementById('googleSheetUrlInput').value.trim() : '';
      if (savedUrl && data.item) {
        submitToGoogleSheetDirect(savedUrl, 'addOrUpdate', { item: data.item });
      }

      await loadStats();
      await loadItems();
    } else {
      showToast('Lưu thất bại: ' + data.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi hệ thống: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Lưu Phiếu Xử Lý';
  }
}

// Delete Item
async function deleteItem(id) {
  if (state.currentUser.role !== 'admin') {
    showToast('Chỉ Quản trị viên (Admin) mới có quyền xóa phiếu!', 'warning');
    return;
  }

  if (!confirm(`Bạn có chắc chắn muốn xóa phiếu [${id}] không? Thao tác này không thể hoàn tác!`)) {
    return;
  }

  try {
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Đã xóa phiếu thành công!', 'success');
      await loadStats();
      await loadItems();
    } else {
      showToast('Xóa thất bại: ' + data.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi xóa phiếu: ' + err.message, 'error');
  }
}

// ================= IMAGE UPLOADS & MANAGEMENT =================
function triggerFileInput(type) {
  const inputId = type === 'after' ? 'inputUploadAfter' : 'inputUploadBefore';
  document.getElementById(inputId).click();
}

async function handleFileSelected(event, type) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const currentList = type === 'after' ? state.formImagesAfter : state.formImagesBefore;
  const maxAllowed = 5 - currentList.length;

  if (maxAllowed <= 0) {
    showToast(`Đã đạt giới hạn tối đa 5 ảnh ${type}!`, 'warning');
    event.target.value = '';
    return;
  }

  const filesToUpload = Array.from(files).slice(0, maxAllowed);
  const formData = new FormData();
  filesToUpload.forEach(f => formData.append('images', f));

  showToast(`Đang tải lên ${filesToUpload.length} hình ảnh...`, 'info');

  try {
    const res = await fetch(`/api/upload?type=${type}`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success && data.urls) {
      if (type === 'after') {
        state.formImagesAfter = [...state.formImagesAfter, ...data.urls].slice(0, 5);
      } else {
        state.formImagesBefore = [...state.formImagesBefore, ...data.urls].slice(0, 5);
      }
      renderFormImagesPreview();
      showToast('Tải ảnh thành công!', 'success');
    } else {
      showToast('Tải ảnh thất bại: ' + data.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi tải ảnh: ' + err.message, 'error');
  } finally {
    event.target.value = '';
  }
}

function removeFormImage(type, index) {
  if (type === 'after') {
    state.formImagesAfter.splice(index, 1);
  } else {
    state.formImagesBefore.splice(index, 1);
  }
  renderFormImagesPreview();
}

function renderFormImagesPreview() {
  // Before
  const beforeGrid = document.getElementById('previewGridBefore');
  const beforeCountText = document.getElementById('beforeCountText');
  beforeCountText.textContent = `(${state.formImagesBefore.length}/5 ảnh)`;

  beforeGrid.innerHTML = state.formImagesBefore.map((url, idx) => `
    <div class="image-preview-item">
      <img src="${url}" alt="Before ${idx+1}" onclick="openLightbox('${url}')">
      <button type="button" class="remove-img-btn" onclick="removeFormImage('before', ${idx})" title="Xóa ảnh">&times;</button>
    </div>
  `).join('');

  // After
  const afterGrid = document.getElementById('previewGridAfter');
  const afterCountText = document.getElementById('afterCountText');
  afterCountText.textContent = `(${state.formImagesAfter.length}/5 ảnh)`;

  afterGrid.innerHTML = state.formImagesAfter.map((url, idx) => `
    <div class="image-preview-item">
      <img src="${url}" alt="After ${idx+1}" onclick="openLightbox('${url}')">
      <button type="button" class="remove-img-btn" onclick="removeFormImage('after', ${idx})" title="Xóa ảnh">&times;</button>
    </div>
  `).join('');
}

// ================= DETAIL MODAL =================
async function openDetailModal(id) {
  try {
    const res = await fetch(`/api/items/${id}`);
    const data = await res.json();
    if (!data.success || !data.item) {
      showToast('Không tìm thấy phiếu xử lý!', 'error');
      return;
    }

    const item = data.item;
    state.currentViewingItem = item;

    document.getElementById('detailModalTitle').textContent = `🔍 Phiếu Xử Lý: ${item.id} - ${item.tenTuyenCap || ''}`;

    let statusBadge = '<span class="badge badge-status-chua">Chưa xử lý</span>';
    if (item.tinhTrang === 'Đang xử lý') statusBadge = '<span class="badge badge-status-dang">Đang xử lý</span>';
    else if (item.tinhTrang === 'Đã hoàn thành') statusBadge = '<span class="badge badge-status-xong">Đã hoàn thành</span>';

    const beforeImgs = (item.imagesBefore || []).map(img => `
      <img src="${img}" style="width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 8px; cursor: pointer; border: 1px solid var(--border-color);" onclick="openLightbox('${img}')" title="Click để phóng to">
    `).join('') || '<div style="color: var(--text-muted); font-size: 0.85rem;">Chưa có hình ảnh Before</div>';

    const afterImgs = (item.imagesAfter || []).map(img => `
      <img src="${img}" style="width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 8px; cursor: pointer; border: 1px solid var(--border-color);" onclick="openLightbox('${img}')" title="Click để phóng to">
    `).join('') || '<div style="color: var(--text-muted); font-size: 0.85rem;">Chưa có hình ảnh After</div>';

    const gpsDisplay = (item.viDo && item.kinhDo)
      ? `<a href="https://maps.google.com/?q=${item.viDo},${item.kinhDo}" target="_blank" style="color: var(--primary); font-weight: 600;">📍 ${item.viDo}, ${item.kinhDo} (Mở Google Maps)</a>`
      : 'Chưa có tọa độ GPS';

    const html = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
          <div style="font-size: 0.775rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Thông tin cơ bản</div>
          <div style="margin-top: 0.5rem; line-height: 1.6; font-size: 0.875rem;">
            <div><strong>Phòng Hạ tầng:</strong> ${escapeHtml(item.pht || '---')}</div>
            <div><strong>Tên TTVT:</strong> ${escapeHtml(item.ttvt || '---')}</div>
            <div><strong>Loại hạng mục:</strong> ${escapeHtml(item.hangmuc || '---')}</div>
            <div><strong>Mức ưu tiên:</strong> ${escapeHtml(item.uutien || '---')}</div>
            <div><strong>Trạng thái:</strong> ${statusBadge}</div>
          </div>
        </div>

        <div style="background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
          <div style="font-size: 0.775rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Địa bàn & Tọa độ</div>
          <div style="margin-top: 0.5rem; line-height: 1.6; font-size: 0.875rem;">
            <div><strong>Tuyến cáp/kết cuối:</strong> ${escapeHtml(item.tenTuyenCap || '---')}</div>
            <div><strong>Khu vực/Địa bàn:</strong> ${escapeHtml(item.khuVuc || '---')}</div>
            <div><strong>Địa chỉ:</strong> ${escapeHtml(item.diaChi || '---')}</div>
            <div><strong>Tọa độ GPS:</strong> ${gpsDisplay}</div>
            <div><strong>Người tạo:</strong> ${escapeHtml(item.nguoiTao || '---')} (${item.ngayTao || ''})</div>
          </div>
        </div>
      </div>

      <div style="background: #ffffff; padding: 1.15rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1.25rem;">
        <div style="font-size: 0.85rem; font-weight: 700; color: var(--primary); margin-bottom: 0.85rem;">
          💡 NHÓM GIẢI PHÁP ĐỀ XUẤT: ${escapeHtml(item.giaiphap || '---')}
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 0.75rem;">
          <!-- 1. Mô tả hiện trạng -->
          <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 0.75rem 1rem; border-radius: 4px;">
            <div style="font-weight: 700; font-size: 0.825rem; color: #b45309; margin-bottom: 0.25rem;">
              ⚠️ 1. MÔ TẢ HIỆN TRẠNG (Chi tiết hư hỏng / khiếm khuyết thực tế)
            </div>
            <div style="font-size: 0.875rem; color: #1e293b; white-space: pre-wrap;">
              ${escapeHtml(item.moTaHienTrang || 'Chưa cập nhật mô tả hiện trạng')}
            </div>
          </div>

          <!-- 2. Phương án đề xuất -->
          <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 0.75rem 1rem; border-radius: 4px;">
            <div style="font-weight: 700; font-size: 0.825rem; color: #1d4ed8; margin-bottom: 0.25rem;">
              💡 2. PHƯƠNG ÁN ĐỀ XUẤT (Giải pháp kỹ thuật / biện pháp thi công)
            </div>
            <div style="font-size: 0.875rem; color: #1e293b; white-space: pre-wrap;">
              ${escapeHtml(item.phuongAn || 'Chưa có nội dung phương án')}
            </div>
          </div>

          <!-- 3. Kết quả xử lý -->
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 0.75rem 1rem; border-radius: 4px;">
            <div style="font-weight: 700; font-size: 0.825rem; color: #047857; margin-bottom: 0.25rem;">
              ✅ 3. KẾT QUẢ XỬ LÝ (Nội dung đã hoàn thành / tiến độ thực tế)
            </div>
            <div style="font-size: 0.875rem; color: #1e293b; white-space: pre-wrap;">
              ${escapeHtml(item.ketQua || 'Chưa cập nhật kết quả xử lý')}
            </div>
          </div>
        </div>
      </div>

      <!-- Images galleries -->
      <div style="margin-bottom: 1rem;">
        <h4 style="font-size: 0.85rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--secondary);">📷 Hình ảnh Before (Hiện trạng):</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.75rem;">
          ${beforeImgs}
        </div>
      </div>

      <div>
        <h4 style="font-size: 0.85rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--secondary);">📸 Hình ảnh After (Sau xử lý):</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.75rem;">
          ${afterImgs}
        </div>
      </div>
    `;

    document.getElementById('detailModalBody').innerHTML = html;

    // Check permissions for Edit button
    const editBtn = document.getElementById('detailEditBtn');
    if (state.currentUser.role === 'view') {
      editBtn.style.display = 'none';
    } else {
      editBtn.style.display = 'inline-flex';
    }

    document.getElementById('viewDetailModal').classList.add('active');
  } catch (err) {
    showToast('Lỗi xem chi tiết: ' + err.message, 'error');
  }
}

function closeDetailModal() {
  document.getElementById('viewDetailModal').classList.remove('active');
  state.currentViewingItem = null;
}

function editFromDetail() {
  if (!state.currentViewingItem) return;
  const id = state.currentViewingItem.id;
  closeDetailModal();
  openEditModal(id);
}

// ================= AUTHENTICATION & LOGIN MODAL =================
function handleAuthClick() {
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginModal').classList.add('active');
}

function closeLoginModal() {
  document.getElementById('loginModal').classList.remove('active');
}

async function handleLoginForm(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  await executeLogin(username, password);
}

async function quickLogin(username, password) {
  await executeLogin(username, password);
}

async function executeLogin(username, password) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (data.success && data.user) {
      saveStoredUser(data.user);
      closeLoginModal();
      showToast(`Đăng nhập thành công với quyền [${data.user.role.toUpperCase()}]!`, 'success');
      renderItemsTable(state.items); // re-render table buttons
    } else {
      showToast('Đăng nhập thất bại: ' + data.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi đăng nhập: ' + err.message, 'error');
  }
}

// ================= EXCEL EXPORT =================
function exportToExcel() {
  showToast('Đang tạo và tải file Excel theo mẫu Google Sheet...', 'info');
  window.location.href = '/api/export/excel';
}

// ================= LIGHTBOX MODAL =================
function openLightbox(imgUrl) {
  const modal = document.getElementById('lightboxModal');
  const img = document.getElementById('lightboxImage');
  img.src = imgUrl;
  modal.classList.add('active');
}

function closeLightbox() {
  document.getElementById('lightboxModal').classList.remove('active');
}

// ================= UTILITIES & TOAST =================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  else if (type === 'error') icon = '❌';
  else if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ================= GOOGLE SHEET SYNC MANAGEMENT =================
const APPS_SCRIPT_CODE = `var SPREADSHEET_ID = "1lrZfpO-Rl51PchFukqr3ushwbt3Ara3_F1mmQDheKKw";

function setup() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("xuly") || ss.insertSheet("xuly");
  sheet.appendRow(["TEST", "Kết nối Apps Script thành công lúc: " + new Date().toLocaleString()]);
  Logger.log("Đã ghi thành công dòng TEST vào Sheet!");
  return "OK";
}

function doPost(e) {
  try {
    var contents = null;
    if (e && e.parameter && e.parameter.data) {
      contents = e.parameter.data;
    } else if (e && e.postData && e.postData.contents) {
      contents = e.postData.contents;
    }
    if (!contents) return responseOutput("No data");
    
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("xuly") || ss.insertSheet("xuly");
    var action = data.action || "addOrUpdate";

    if (action === "addOrUpdate") {
      var item = data.item;
      var row = [
        item.stt || "",
        item.pht || "",
        item.ttvt || "",
        item.hangmuc || "",
        item.tenTuyenCap || "",
        item.khuVuc || "",
        item.diaChi || "",
        item.kinhDo || "",
        item.viDo || "",
        item.giaiphap || "",
        item.tinhTrang || "",
        item.moTaHienTrang || "",
        item.phuongAn || "",
        Array.isArray(item.imagesBefore) ? item.imagesBefore.join(" ; ") : (item.imagesBefore || ""),
        Array.isArray(item.imagesAfter) ? item.imagesAfter.join(" ; ") : (item.imagesAfter || ""),
        item.ketQua || ""
      ];
      var lastRow = sheet.getLastRow();
      var foundRow = -1;
      if (lastRow > 1) {
        var sttCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < sttCol.length; i++) {
          if (String(sttCol[i][0]).trim() === String(item.stt).trim() && item.stt !== "") {
            foundRow = i + 2;
            break;
          }
        }
      }
      if (foundRow > 1) {
        sheet.getRange(foundRow, 1, 1, row.length).setValues([row]);
      } else {
        sheet.appendRow(row);
      }
      return responseOutput("OK");
    } else if (action === "syncAll") {
      var items = data.items || [];
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      if (items.length > 0) {
        var rows = items.map(function(item, idx) {
          return [
            item.stt || (idx + 1),
            item.pht || "",
            item.ttvt || "",
            item.hangmuc || "",
            item.tenTuyenCap || "",
            item.khuVuc || "",
            item.diaChi || "",
            item.kinhDo || "",
            item.viDo || "",
            item.giaiphap || "",
            item.tinhTrang || "",
            item.moTaHienTrang || "",
            item.phuongAn || "",
            Array.isArray(item.imagesBefore) ? item.imagesBefore.join(" ; ") : (item.imagesBefore || ""),
            Array.isArray(item.imagesAfter) ? item.imagesAfter.join(" ; ") : (item.imagesAfter || ""),
            item.ketQua || ""
          ];
        });
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      }
      return responseOutput("OK");
    }
    return responseOutput("Unknown action");
  } catch (err) {
    return responseOutput("Error: " + err.toString());
  }
}

function responseOutput(text) {
  return HtmlService.createHtmlOutput("<html><body>" + text + "</body></html>")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}`;

async function openGoogleSheetModal() {
  document.getElementById('appsScriptCodeText').value = APPS_SCRIPT_CODE;
  
  try {
    const res = await fetch('/api/settings/google-sheet');
    const data = await res.json();
    const urlInput = document.getElementById('googleSheetUrlInput');
    const statusText = document.getElementById('googleSheetStatusText');
    
    if (data.googleSheetUrl) {
      urlInput.value = data.googleSheetUrl;
      statusText.innerHTML = '🟢 <strong style="color:#059669;">Đã cấu hình URL kết nối Google Sheet</strong> (Tự động đồng bộ mỗi khi lưu phiếu)';
    } else {
      urlInput.value = '';
      statusText.innerHTML = '🟡 <span style="color:#d97706;">Chưa cấu hình URL. Vui lòng dán Web App URL theo hướng dẫn trên.</span>';
    }
  } catch (err) {
    console.warn(err);
  }

  document.getElementById('googleSheetModal').classList.add('active');
}

function closeGoogleSheetModal() {
  document.getElementById('googleSheetModal').classList.remove('active');
}

async function saveGoogleSheetUrl() {
  const url = document.getElementById('googleSheetUrlInput').value.trim();
  if (!url) {
    showToast('Vui lòng nhập URL Web App của Google Apps Script!', 'warning');
    return;
  }
  if (!url.startsWith('https://script.google.com/')) {
    showToast('URL không đúng định dạng Google Apps Script (phải bắt đầu bằng https://script.google.com/)!', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/settings/google-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleSheetUrl: url })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Đã lưu URL kết nối Google Sheet thành công!', 'success');
      document.getElementById('googleSheetStatusText').innerHTML = '🟢 <strong style="color:#059669;">Đã cấu hình và kết nối thành công!</strong>';
    } else {
      showToast('Lỗi lưu cấu hình: ' + data.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối: ' + err.message, 'error');
  }
}

function copyAppsScriptCode() {
  const textarea = document.getElementById('appsScriptCodeText');
  textarea.select();
  navigator.clipboard.writeText(textarea.value).then(() => {
    showToast('Đã sao chép mã nguồn Google Apps Script vào bộ nhớ tạm!', 'success');
  }).catch(() => {
    document.execCommand('copy');
    showToast('Đã sao chép mã nguồn Google Apps Script!', 'success');
  });
}

// Helper to submit directly from browser using user's active Google session
function submitToGoogleSheetDirect(url, action, payload) {
  const form = document.getElementById('googleSheetSyncForm');
  const input = document.getElementById('googleSheetSyncFormData');
  const iframe = document.getElementById('googleSheetHiddenIframe');

  form.action = url;
  input.value = JSON.stringify({ action, ...payload });
  
  return new Promise((resolve) => {
    let resolved = false;
    const handleLoad = () => {
      if (!resolved) {
        resolved = true;
        resolve(true);
      }
    };
    iframe.onload = handleLoad;
    form.submit();

    // Fallback timer in case iframe doesn't fire load cross-origin
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(true);
      }
    }, 2000);
  });
}

async function syncAllToGoogleSheet() {
  const syncBtn = document.getElementById('syncGoogleSheetBtn');
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = '⏳ Đang đồng bộ lên Sheet...';
  }

  showToast('Đang gửi dữ liệu đồng bộ lên Google Sheet...', 'info');

  let scriptUrl = document.getElementById('googleSheetUrlInput') ? document.getElementById('googleSheetUrlInput').value.trim() : '';
  if (!scriptUrl) {
    try {
      const sRes = await fetch('/api/settings/google-sheet');
      const sData = await sRes.json();
      scriptUrl = sData.googleSheetUrl || '';
    } catch (e) {}
  }

  if (!scriptUrl) {
    showToast('Chưa có URL Google Apps Script! Vui lòng bấm Kết nối Google Sheet để dán URL.', 'warning');
    openGoogleSheetModal();
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = '🔄 Đẩy lên Sheet';
    }
    return;
  }

  try {
    // 1. First attempt: Direct browser submission (Uses active Google Login session, bypasses 401 corporate block)
    await submitToGoogleSheetDirect(scriptUrl, 'syncAll', { items: state.items });

    // 2. Also save URL to server settings
    await fetch('/api/settings/google-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleSheetUrl: scriptUrl })
    });

    showToast('✅ Đã đồng bộ thành công toàn bộ dữ liệu vào sheet "xuly" trên Google Sheet!', 'success');
  } catch (err) {
    showToast('Lỗi khi gửi dữ liệu: ' + err.message, 'error');
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = '🔄 Đẩy lên Sheet';
    }
  }
}

// ================= PHÂN TÍCH BÁO HỎNG & BẢN ĐỒ NHIỆT MNV =================
let ttvtDataCache = [];

async function loadBaohongData(force = false) {
  try {
    const btnRefresh = document.getElementById('btnRefreshBaohong');
    if (btnRefresh) {
      btnRefresh.disabled = true;
      btnRefresh.innerHTML = '⏳ Đang nạp dữ liệu...';
    }

    const res = await fetch(`/api/baohong/stats${force ? '?force=true' : ''}`);
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || 'Không tải được dữ liệu thống kê');
    }

    const stats = data.data;
    state.baohongStats = stats;

    // Render KPI Cards
    document.getElementById('bhTotalTickets').textContent = Number(stats.totalRows).toLocaleString('vi-VN');
    document.getElementById('bhMnvTickets').textContent = Number(stats.mnvCount).toLocaleString('vi-VN');
    document.getElementById('bhMnvRate').textContent = stats.mnvRate + '%';
    document.getElementById('bhGpsPoints').textContent = Number(stats.validCoordsCount).toLocaleString('vi-VN');

    // 1. Render TTVT Table
    ttvtDataCache = stats.ttvtList || [];
    renderTtvtTable(ttvtDataCache);

    // 2. Render Top 10 TOVT Table
    renderTovtTable(stats.top10Tovt || []);

    // 3. Render Top 10 KV Table
    renderKvTable(stats.top10Kv || []);

    // 4. Render Top 20 Kyhieu Table
    renderKyhieuTable(stats.top20Kyhieu || []);

    // 5. Init and Load Heatmap
    initBaohongHeatmap();
    await loadHeatmapLayer(state.currentHeatType || 'mnv');

    if (force) {
      showToast('Đã làm mới dữ liệu báo hỏng thành công', 'success');
    }
  } catch (err) {
    console.error('Lỗi nạp dữ liệu báo hỏng:', err);
    showToast('Lỗi nạp dữ liệu báo hỏng: ' + err.message, 'error');
  } finally {
    const btnRefresh = document.getElementById('btnRefreshBaohong');
    if (btnRefresh) {
      btnRefresh.disabled = false;
      btnRefresh.innerHTML = '🔄 Làm mới số liệu';
    }
  }
}

function renderTtvtTable(list) {
  const tbody = document.getElementById('ttvtTableBody');
  if (!tbody) return;
  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Không tìm thấy dữ liệu TTVT phù hợp</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((item, idx) => {
    const rateNum = parseFloat(item.rate) || 0;
    return `
      <tr>
        <td style="text-align: center; font-weight: 600; color: #64748b;">${idx + 1}</td>
        <td style="font-weight: 600; color: #1e293b;">${escapeHtml(item.name)}</td>
        <td style="text-align: right; font-weight: 600;">${Number(item.total).toLocaleString('vi-VN')}</td>
        <td style="text-align: right; font-weight: 700; color: #dc2626;">${Number(item.mnv).toLocaleString('vi-VN')}</td>
        <td style="text-align: right; font-weight: 700; color: ${rateNum > 15 ? '#dc2626' : rateNum > 10 ? '#d97706' : '#2563eb'};">
          ${item.rate}%
        </td>
        <td>
          <div class="mini-progress" title="Tỷ lệ MNV: ${item.rate}%">
            <div class="mini-progress-bar progress-mnv" style="width: ${Math.min(rateNum * 3, 100)}%;"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterTtvtTable(query) {
  if (!query) {
    renderTtvtTable(ttvtDataCache);
    return;
  }
  const q = query.toLowerCase().trim();
  const filtered = ttvtDataCache.filter(item => item.name.toLowerCase().includes(q));
  renderTtvtTable(filtered);
}

function renderTovtTable(list) {
  const tbody = document.getElementById('tovtTableBody');
  if (!tbody) return;
  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Không có dữ liệu</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((item, idx) => {
    const rank = idx + 1;
    let rankBadgeClass = 'rank-badge-other';
    if (rank === 1) rankBadgeClass = 'rank-badge-1';
    else if (rank === 2) rankBadgeClass = 'rank-badge-2';
    else if (rank === 3) rankBadgeClass = 'rank-badge-3';

    return `
      <tr>
        <td style="text-align: center;">
          <span class="rank-badge ${rankBadgeClass}">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</span>
        </td>
        <td style="font-weight: 600; color: #1e293b;">${escapeHtml(item.tovt)}</td>
        <td style="text-align: right; font-weight: 700; color: #dc2626;">${Number(item.count).toLocaleString('vi-VN')}</td>
        <td style="text-align: right; color: #64748b; font-size: 0.825rem; font-weight: 600;">${item.percent}%</td>
      </tr>
    `;
  }).join('');
}

function renderKvTable(list) {
  const tbody = document.getElementById('kvTableBody');
  if (!tbody) return;
  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Không có dữ liệu</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((item, idx) => {
    const rank = idx + 1;
    let rankBadgeClass = 'rank-badge-other';
    if (rank === 1) rankBadgeClass = 'rank-badge-1';
    else if (rank === 2) rankBadgeClass = 'rank-badge-2';
    else if (rank === 3) rankBadgeClass = 'rank-badge-3';

    return `
      <tr>
        <td style="text-align: center;">
          <span class="rank-badge ${rankBadgeClass}">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</span>
        </td>
        <td style="font-weight: 700; color: #0284c7; font-family: monospace;">${escapeHtml(item.ma_kv)}</td>
        <td style="text-align: right; font-weight: 700; color: #dc2626;">${Number(item.count).toLocaleString('vi-VN')}</td>
        <td style="text-align: right; color: #64748b; font-size: 0.825rem; font-weight: 600;">${item.percent}%</td>
      </tr>
    `;
  }).join('');
}

function renderKyhieuTable(list) {
  const tbody = document.getElementById('kyhieuTableBody');
  if (!tbody) return;
  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 1.5rem;">Không có dữ liệu</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((item, idx) => {
    const rank = idx + 1;
    let rankBadgeClass = 'rank-badge-other';
    if (rank === 1) rankBadgeClass = 'rank-badge-1';
    else if (rank === 2) rankBadgeClass = 'rank-badge-2';
    else if (rank === 3) rankBadgeClass = 'rank-badge-3';

    const rateNum = parseFloat(item.rate) || 0;
    const hasLocation = (item.lat && item.lng);
    return `
      <tr ${hasLocation ? `style="cursor: pointer;" onclick="focusKyhieuOnMap('${escapeHtml(item.kyhieu)}', ${item.lat}, ${item.lng})"` : ''} title="${hasLocation ? 'Nhấn để định vị ký hiệu này trên bản đồ nhiệt' : ''}">
        <td style="text-align: center;">
          <span class="rank-badge ${rankBadgeClass}">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</span>
        </td>
        <td style="font-weight: 600; color: #1e293b; font-family: monospace; font-size: 0.825rem;">
          ${escapeHtml(item.kyhieu)} ${hasLocation ? '<span style="font-size: 11px; color: #3b82f6;">📍</span>' : ''}
        </td>
        <td style="text-align: right; font-weight: 600;">${Number(item.total).toLocaleString('vi-VN')}</td>
        <td style="text-align: right; font-weight: 700; color: #dc2626;">${Number(item.mnv).toLocaleString('vi-VN')}</td>
        <td style="text-align: right; font-weight: 600; color: ${rateNum > 50 ? '#dc2626' : '#2563eb'};">
          ${item.rate}%
        </td>
        <td>
          <div class="mini-progress" title="MNV: ${item.rate}%">
            <div class="mini-progress-bar progress-mnv" style="width: ${rateNum}%;"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function focusKyhieuOnMap(kyhieu, lat, lng) {
  if (!state.baohongHeatmapMap) return;
  state.baohongHeatmapMap.setView([lat, lng], 15);
  setTimeout(() => {
    renderKyhieuHotspotMarkers();
    // Smooth scroll back up to map
    const mapSection = document.getElementById('baohongHeatmap');
    if (mapSection) {
      mapSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 200);
}

// ================= LEAFLET HEATMAP LOGIC =================
function initBaohongHeatmap() {
  if (state.baohongHeatmapMap) return;

  const mapEl = document.getElementById('baohongHeatmap');
  if (!mapEl) return;

  // Center around Ho Chi Minh / Southeastern Vietnam
  state.baohongHeatmapMap = L.map('baohongHeatmap').setView([10.7769, 106.6953], 10);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(state.baohongHeatmapMap);

  // Group layer for Kyhieu hotspots markers
  state.baohongHotspotsLayer = L.layerGroup().addTo(state.baohongHeatmapMap);

  // When zooming or panning, refresh visible markers if needed
  state.baohongHeatmapMap.on('zoomend moveend', () => {
    if (state.showKyhieuHotspots) {
      renderKyhieuHotspotMarkers();
    }
  });
}

async function loadHeatmapLayer(type = 'mnv') {
  if (!state.baohongHeatmapMap) {
    initBaohongHeatmap();
  }

  state.currentHeatType = type;

  // Update button states
  const btnMnv = document.getElementById('btnHmFilterMnv');
  const btnAll = document.getElementById('btnHmFilterAll');
  if (btnMnv && btnAll) {
    if (type === 'mnv') {
      btnMnv.classList.add('active');
      btnAll.classList.remove('active');
    } else {
      btnAll.classList.add('active');
      btnMnv.classList.remove('active');
    }
  }

  try {
    const res = await fetch(`/api/baohong/heatmap?type=${type}`);
    const result = await res.json();
    if (!result.success) throw new Error(result.message);

    const points = result.data || [];

    if (state.baohongHeatLayer) {
      state.baohongHeatmapMap.removeLayer(state.baohongHeatLayer);
    }

    const radius = state.heatRadius || 25;

    // Check if L.heatLayer exists
    if (typeof L.heatLayer === 'function') {
      state.baohongHeatLayer = L.heatLayer(points, {
        radius: radius,
        blur: Math.round(radius * 0.6),
        maxZoom: 16,
        max: 1.0,
        gradient: {
          0.2: '#3b82f6',
          0.4: '#06b6d4',
          0.6: '#10b981',
          0.8: '#f59e0b',
          1.0: '#ef4444'
        }
      }).addTo(state.baohongHeatmapMap);
    } else {
      console.warn('L.heatLayer is not loaded');
    }

    // Load Kyhieu Hotspots
    await loadKyhieuHotspots();

  } catch (err) {
    console.error('Lỗi tải dữ liệu heatmap:', err);
    showToast('Lỗi tải dữ liệu bản đồ nhiệt: ' + err.message, 'error');
  }
}

// ================= KYHIEU HOTSPOTS ON HEATMAP =================
async function loadKyhieuHotspots() {
  try {
    const res = await fetch('/api/baohong/kyhieu-hotspots?min=3');
    const result = await res.json();
    if (result.success && Array.isArray(result.data)) {
      state.baohongHotspotsData = result.data;
      const countEl = document.getElementById('kyhieuHotspotsCountDisplay');
      if (countEl) countEl.textContent = result.data.length.toLocaleString('vi-VN');
      renderKyhieuHotspotMarkers();
    }
  } catch (err) {
    console.error('Lỗi tải kyhieu hotspots:', err);
  }
}

function renderKyhieuHotspotMarkers() {
  if (!state.baohongHotspotsLayer || !state.baohongHeatmapMap) return;
  state.baohongHotspotsLayer.clearLayers();

  if (!state.showKyhieuHotspots) return;

  const spots = state.baohongHotspotsData || [];
  if (spots.length === 0) return;

  const currentZoom = state.baohongHeatmapMap.getZoom();
  const bounds = state.baohongHeatmapMap.getBounds();

  // Dynamic threshold based on zoom level:
  // Zoom <= 10: only top severe spots (count >= 12 or mnv >= 8)
  // Zoom 11-12: count >= 6 or mnv >= 4
  // Zoom 13-14: count >= 3 or mnv >= 2
  // Zoom >= 15: show all available hotspots
  let minCount = 10;
  if (currentZoom >= 15) minCount = 2;
  else if (currentZoom >= 13) minCount = 3;
  else if (currentZoom >= 11) minCount = 6;
  else minCount = 12;

  // Filter spots inside visible bounds and meeting threshold
  let visibleSpots = spots.filter(s => {
    if (!bounds.contains([s.lat, s.lng])) return false;
    if (state.currentHeatType === 'mnv') {
      return s.mnv >= Math.max(2, Math.floor(minCount / 2));
    }
    return s.total >= minCount || s.mnv >= 3;
  });

  // Limit max rendered markers to 120 for smooth performance
  if (visibleSpots.length > 120) {
    visibleSpots.sort((a, b) => (state.currentHeatType === 'mnv' ? b.mnv - a.mnv : b.total - a.total));
    visibleSpots = visibleSpots.slice(0, 120);
  }

  visibleSpots.forEach(spot => {
    const isHighMNV = (spot.mnv >= 3);
    const countBadge = state.currentHeatType === 'mnv' 
      ? `⚡ ${spot.mnv} MNV` 
      : `${spot.total} sự cố${spot.mnv > 0 ? ` (${spot.mnv} MNV)` : ''}`;

    const iconHtml = `
      <div class="kyhieu-marker-badge ${isHighMNV ? 'high-mnv' : ''}" title="${escapeHtml(spot.kyhieu)}">
        <span>${escapeHtml(spot.kyhieu)}</span>
        <span class="kyhieu-badge-count">${countBadge}</span>
      </div>
    `;

    const customIcon = L.divIcon({
      className: 'kyhieu-map-marker',
      html: iconHtml,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });

    const marker = L.marker([spot.lat, spot.lng], { icon: customIcon });

    const popupHtml = `
      <div class="kyhieu-popup-content">
        <div class="kyhieu-popup-title">🏷️ ${escapeHtml(spot.kyhieu)}</div>
        <div class="kyhieu-popup-row">
          <span>🏢 Trung tâm VT:</span>
          <strong>${escapeHtml(spot.ttvt || 'Chưa rõ')}</strong>
        </div>
        <div class="kyhieu-popup-row">
          <span>🛠️ Tổ KTĐB:</span>
          <strong>${escapeHtml(spot.tovt || 'Chưa rõ')}</strong>
        </div>
        <div class="kyhieu-popup-row">
          <span>📍 Mã khu vực:</span>
          <strong style="color:#0284c7; font-family:monospace;">${escapeHtml(spot.ma_kv || 'Chưa rõ')}</strong>
        </div>
        <div class="kyhieu-popup-row" style="margin-top: 5px; padding-top: 4px; border-top: 1px dashed #cbd5e1;">
          <span>📋 Tổng số lần hư:</span>
          <strong style="font-size: 13px; color: #1e293b;">${spot.total} lần</strong>
        </div>
        <div class="kyhieu-popup-row">
          <span>⚡ Hư do MNV (mã 24):</span>
          <strong style="font-size: 13px; color: #dc2626;">${spot.mnv} lần (${spot.rate}%)</strong>
        </div>
        <div class="kyhieu-popup-row">
          <span>🌐 Tọa độ:</span>
          <span style="font-size: 10px; color: #64748b;">${spot.lat}, ${spot.lng}</span>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml, { maxWidth: 280 });
    state.baohongHotspotsLayer.addLayer(marker);
  });
}

function toggleKyhieuHotspots() {
  state.showKyhieuHotspots = !state.showKyhieuHotspots;
  const btn = document.getElementById('btnToggleKyhieuLabels');
  if (btn) {
    if (state.showKyhieuHotspots) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
  renderKyhieuHotspotMarkers();
  showToast(state.showKyhieuHotspots ? 'Đã bật hiển thị ký hiệu trên vùng mật độ cao' : 'Đã ẩn ký hiệu trên bản đồ nhiệt', 'info');
}

function switchHeatmapType(type) {
  loadHeatmapLayer(type);
}

function updateHeatmapRadius(val) {
  const radius = parseInt(val, 10);
  state.heatRadius = radius;
  const label = document.getElementById('radiusValue');
  if (label) label.textContent = radius;

  if (state.baohongHeatLayer) {
    state.baohongHeatLayer.setOptions({
      radius: radius,
      blur: Math.round(radius * 0.6)
    });
  }
}

function jumpHeatmap(loc) {
  if (!state.baohongHeatmapMap) return;
  if (loc === 'hcm') {
    state.baohongHeatmapMap.setView([10.8231, 106.6297], 12);
  } else if (loc === 'bd') {
    state.baohongHeatmapMap.setView([10.9800, 106.6700], 12);
  } else if (loc === 'vt') {
    state.baohongHeatmapMap.setView([10.5000, 107.2500], 11);
  } else {
    state.baohongHeatmapMap.setView([10.7769, 106.6953], 10);
  }
  setTimeout(renderKyhieuHotspotMarkers, 200);
}

