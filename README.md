# Hệ Thống Quản Lý & Xử Lý Hạ Tầng Viễn Thông

Ứng dụng Web App quản lý, cập nhật xử lý hiện trường hạ tầng viễn thông được thiết kế theo đúng mẫu biểu và danh mục từ Google Sheet.

## 🚀 Tính năng nổi bật

1. **Phân quyền người dùng theo Sheet `user`:**
   - **`kythuat` / `123456`** (PKT): Quyền **ADMIN** - Toàn quyền thêm, sửa, xóa, phê duyệt giải pháp, xuất Excel.
   - **`editor` / `123456`** (TTVT An Đông): Quyền **EDITOR** - Thêm mới phiếu, cập nhật hiện trạng, upload ảnh before/after, cập nhật kết quả xử lý.
   - **`guest` / `123456`** (guest): Quyền **VIEW** - Tra cứu, lọc tìm kiếm, xem chi tiết và xem bản đồ trực quan.

2. **Bản đồ tương tác Leaflet (OpenStreetMap):**
   - Định vị GPS tự động từ thiết bị bằng nút **"📍 Lấy vị trí GPS hiện tại"**.
   - Click chọn trực tiếp vị trí trên bản đồ để tự động điền Kinh độ và Vĩ độ.
   - Chế độ xem **Bản đồ tổng quan** hiển thị toàn bộ các điểm xử lý hạ tầng với màu sắc trực quan theo tình trạng.

3. **Danh mục chuẩn hóa đồng bộ từ Sheet:**
   - **Phòng Hạ tầng (`pht`)**: 13 Phòng HT (Bình Chánh, Chợ Lớn, Củ Chi, Hóc Môn, Nam Sài Gòn, Sài Gòn, Tân Bình, Thủ Đức, Bến Cát, Thủ Dầu Một, Thuận An, Châu Đức, Vũng Tàu).
   - **Tên TTVT (`ttvt`)**: 29 Trung tâm Viễn thông.
   - **Loại hạng mục (`hangmuc`)**: Tuyến cáp, Tủ cáp, Hộp cáp/tập điểm, Măng xông/mối nối, OLT mini, Cáp độc đạo,...
   - **Nhóm giải pháp (`giaiphap`)**: Sửa chữa/bảo dưỡng, Thay thế/di dời, Nâng tuyến/cải tạo, Đầu tư mới,...
   - **Mức ưu tiên (`uutien`)**: UT1 - Khẩn cấp, UT2 - Ưu tiên, UT3 - Kế hoạch.

4. **Quản lý Hình ảnh Hiện trường (Before & After):**
   - Hỗ trợ tải lên tối đa **5 hình ảnh Before** (Hiện trạng trước xử lý).
   - Hỗ trợ tải lên tối đa **5 hình ảnh After** (Hiện trạng sau xử lý).
   - Xem trước thumbnail thu nhỏ và Lightbox phóng to ảnh sắc nét.

5. **Xuất Báo Cáo Excel Chuẩn:**
   - Xuất file `.xlsx` đúng theo định dạng, thứ tự cột và các tab danh mục như trên Google Sheet gốc.

## 📦 Hướng dẫn cài đặt & Khởi chạy

```bash
# 1. Cài đặt các gói phụ thuộc (nếu chưa có)
npm install

# 2. Khởi động Web App
node server.js
```

Truy cập trên trình duyệt máy tính hoặc điện thoại:
👉 **http://localhost:3000**
