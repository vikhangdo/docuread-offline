# 📱 DocuRead Offline - Trình Đọc File PDF & DOCX Không Cần Internet

Ứng dụng Android (APK) và Web đọc tài liệu **Adobe PDF (.pdf)** và **Microsoft Word (.docx)** hoạt động **100% OFFLINE**, hoàn toàn không cần kết nối Internet, không gửi dữ liệu ra máy chủ bên ngoài.

---

## ✨ Điểm Nổi Bật

1. **⚡ Hoàn Toàn Ngoại Tuyến (100% Offline)**:
   - Mọi thư viện phân tích cấu trúc tài liệu (`pdfjs-dist`, `docx-preview`, `jszip`) đều được **nhúng sẵn trực tiếp** vào mã nguồn và tài sản của app (`assets/libs/`).
   - Không sử dụng bất kỳ liên kết CDN hay API ngoài nào. Bật chế độ máy bay (Airplane mode) trên điện thoại vẫn mở và đọc bình thường.
2. **📖 Hỗ Trợ 2 Định Dạng Phổ Biến Nhất**:
   - **PDF (.pdf)**: Hiển thị bằng bộ dựng Canvas độ phân giải cao của Mozilla, hỗ trợ chuyển trang, phóng to/thu nhỏ (Zoom), chuyển đến trang bất kỳ.
   - **Word (.docx)**: Hiển thị đầy đủ bảng biểu (tables), ngắt trang (page breaks), in đậm/nghiêng/màu chữ, tiêu đề, danh sách và hình ảnh đính kèm.
3. **🎨 Giao Diện Hiện Đại & Tối Ưu Mắt Đọc**:
   - 3 chế độ đọc: **Ban đêm (Dark mode)**, **Ban ngày (Light mode)**, **Giấy cổ (Sepia)**.
   - Nút mở tệp nhanh, hỗ trợ kéo thả trên máy tính hoặc chọn từ bộ nhớ điện thoại.
   - Tương thích giao diện điện thoại (Touch / Mobile optimized).

---

## 🚀 3 Cách Sử Dụng & Xuất File APK

### Cách 1: Tự động tạo file APK qua GitHub Actions (Khuyên dùng - Không cần cài Android Studio nặng 15GB)
Dự án đã được cấu hình sẵn tệp CI/CD tại `.github/workflows/build-apk.yml`.
1. Đưa toàn bộ thư mục này lên một kho lưu trữ **GitHub** (công khai hoặc riêng tư đều được):
   ```bash
   git init
   git add .
   git commit -m "Init offline reader app"
   git remote add origin https://github.com/TÊN_BẠN/docuread-offline.git
   git push -u origin main
   ```
2. Vào mục **Actions** trên GitHub repository của bạn.
3. GitHub sẽ tự động biên dịch file `.apk` trong vòng 1-2 phút.
4. Bấm vào lượt build vừa hoàn thành, cuộn xuống mục **Artifacts** để tải trực tiếp file `DocuRead-Offline-Debug-APK` về điện thoại và cài đặt!

---

### Cách 2: Mở và Build APK bằng Android Studio (Nếu máy bạn có Android Studio)
1. Mở phần mềm **Android Studio**.
2. Chọn **Open** -> Trỏ tới thư mục `ReadDocument`.
3. Chờ Gradle đồng bộ (Sync) xong.
4. Vào menu: **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
5. File `.apk` sẽ được tạo tại: `app/build/outputs/apk/debug/app-debug.apk`. Copy file này vào điện thoại để cài đặt.

---

### Cách 3: Chạy và Thử Nghiệm Ngay Lập Tức Trên Trình Duyệt / Điện Thoại
Bạn có thể mở tệp `index.html` trực tiếp bằng trình duyệt (Chrome, Edge) trên máy tính hoặc chạy server cục bộ:
```bash
npx serve .
```
- Trên điện thoại kết nối cùng mạng Wi-Fi: Truy cập địa chỉ IP máy tính (ví dụ `http://192.168.1.x:3000`), sau đó bấm **"Thêm vào màn hình chính" (Add to Home Screen)**. Ứng dụng sẽ hoạt động như một app độc lập trên điện thoại mà không cần mạng!

---

## 📂 Cấu Trúc Dự Án

```
ReadDocument/
├── .github/
│   └── workflows/
│       └── build-apk.yml       # Tự động đóng gói APK trên GitHub Cloud
├── app/
│   ├── build.gradle            # Cấu hình Android Module (compileSdk 34)
│   └── src/main/
│       ├── AndroidManifest.xml # Cấp quyền đọc tệp cục bộ & liên kết mở PDF/DOCX
│       ├── java/com/offline/reader/
│       │   └── MainActivity.java   # WebView native bridge đọc tệp thiết bị
│       ├── res/                # Tài nguyên giao diện (Layout, Màu sắc, Icon)
│       └── assets/             # Toàn bộ mã nguồn & thư viện offline
│           ├── index.html      # Giao diện người dùng
│           ├── style.css       # Phong cách thiết kế Glassmorphism & Themes
│           ├── app.js          # Bộ điều khiển render PDF & DOCX
│           ├── sample.docx     # File mẫu Word để kiểm tra ngay
│           ├── sample.pdf      # File mẫu PDF để kiểm tra ngay
│           └── libs/
│               ├── jszip.min.js
│               ├── docx-preview.min.js
│               ├── pdf.min.js
│               └── pdf.worker.min.js
├── build.gradle                # Cấu hình Gradle gốc
├── settings.gradle             # Định nghĩa module dự án
├── index.html                  # File chạy thử nghiệm trực tiếp trên máy tính
└── README.md                   # Hướng dẫn chi tiết
```
