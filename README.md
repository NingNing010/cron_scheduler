# CronMail Pro & Employee Sync System

Dự án NestJS Backend nâng cao kết hợp giao diện Frontend Dashboard, quản lý lập lịch động bằng **BullMQ + Redis**, cơ sở dữ liệu kép bằng **Prisma (PostgreSQL & MariaDB)**, phân quyền **RBAC (Role-Based Access Control)**, và lưu trữ file đám mây nội bộ qua **MinIO**.

## Công nghệ cốt lõi

- **Framework**: NestJS (v11)
- **Database**: PostgreSQL (Main DB) & MariaDB (Sync DB) qua Prisma ORM
- **Background Jobs**: BullMQ + Redis
- **Authentication**: JWT (JSON Web Tokens) với phân quyền Role-Based (Admin, Manager, Employee)
- **Storage**: MinIO (S3-Compatible Object Storage)
- **Mailing**: Nodemailer (SMTP)
- **File Processing**: ExcelJS & Multer
- **Frontend**: HTML5, Vanilla JavaScript, CSS3 (Giao diện Production Dashboard tích hợp sẵn)
- **Infrastructure**: Docker Compose

## Chức năng chính

### 1. Phân quyền và Bảo mật (RBAC + JWT)
- Đăng ký, Đăng nhập và tạo tài khoản với Token JWT.
- Hệ thống Role-Based (Admin, Manager, Employee) kiểm soát quyền truy cập API và tự động ẩn/hiện các chức năng tương ứng trên giao diện Frontend.
- Tính năng `Seed Database` tạo tài khoản admin và thiết lập Roles mặc định nhanh chóng.

### 2. Lập lịch động (Dynamic Cron) với BullMQ
- Quản lý các tác vụ (Tasks) gửi email tự động với lịch trình linh hoạt (Cron expressions 6 trường - có giây).
- Worker tự động tính toán thời gian chạy kế tiếp (`nextRun`) và tự đẩy lại vào Queue (Re-enqueue) sau mỗi chu kỳ mà không dùng tính năng lặp mặc định của BullMQ để kiểm soát chặt chẽ hơn.
- Ghi Log chi tiết từng lần chạy (Thành công/Thất bại/Phản hồi SMTP).

### 3. Quản lý Nhân viên (Employee CRUD & Bulk)
- Các thao tác Thêm, Sửa, Xóa, Xem danh sách nhân viên phân trang (Pagination).
- **Bulk Generate**: Tự động tạo hàng ngàn dữ liệu giả (Mock data) ngay lập tức.
- **Excel Export/Import**: Hỗ trợ xuất dữ liệu ra file Excel và nạp dữ liệu từ file Excel. Thuật toán Import thông minh tự động đọc Header để phân bổ cột và bắt lỗi (trùng mã, sai định dạng email).

### 4. Đồng bộ Dữ liệu (Database Synchronization)
- Tính năng đồng bộ (Sync) dữ liệu nhân viên từ cơ sở dữ liệu chính (PostgreSQL) sang cơ sở dữ liệu dự phòng/báo cáo (MariaDB).
- Thiết lập lịch đồng bộ tự động định kỳ bằng Cron Queue.
- Chia lô (Batching) để xử lý lượng dữ liệu lớn mà không bị nghẽn RAM.

### 5. Lưu trữ đám mây cục bộ (MinIO - S3)
- Kết nối tới MinIO để upload file (vd: Avatar nhân viên).
- Khi chức năng Import Excel gặp lỗi, hệ thống tự động sinh ra một file Excel chứa chi tiết lỗi từng dòng, đẩy lên MinIO và trả về một đường dẫn an toàn (Pre-signed URL) để người dùng tải xuống.

### 6. Health Checks
- Tích hợp `@nestjs/terminus` để tự động ping kiểm tra trạng thái hoạt động của cả PostgreSQL và MariaDB.

---

## Hướng dẫn cài đặt & Chạy ứng dụng

### 1. Yêu cầu môi trường
- Node.js (>= 18)
- npm hoặc yarn
- Docker & Docker Compose (Bắt buộc để chạy DB và Redis)

### 2. Khởi chạy Hạ tầng (Databases, Redis, MinIO)
Hệ thống cần Redis, Postgres, MariaDB và MinIO để hoạt động. Chạy lệnh sau để khởi động toàn bộ qua Docker Compose:

```bash
docker-compose up -d
```
*(Lưu ý: Bạn có thể truy cập Console quản lý của MinIO tại `http://localhost:9001` với tài khoản `minioadmin` / `minioadmin`)*

### 3. Cấu hình môi trường (.env)
Đảm bảo file `.env` đã được cấu hình các thông số kết nối cơ sở dữ liệu, Redis, MinIO và thông tin SMTP để gửi Mail. (Tham khảo `.env.example` nếu có).

### 4. Cài đặt thư viện & Database
Tải các thư viện và đẩy cấu trúc Prisma xuống 2 cơ sở dữ liệu:

```bash
npm install
npm run prisma:generate
npx prisma db push --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/mariadb/schema.prisma
```

### 5. Chạy Backend & Frontend
```bash
npm run start:dev
```

Truy cập giao diện Web Dashboard tại:
👉 **http://localhost:3000**

---

## Hướng dẫn trải nghiệm nhanh (Demo Flow)

1. Mở trình duyệt vào `http://localhost:3000`.
2. Bấm nút **Seed Database** ở màn hình đăng nhập (Nhập Secret Key mặc định nếu được yêu cầu) để tạo tài khoản `admin` / `admin123`.
3. Đăng nhập bằng `admin` và trải nghiệm:
   - **Tab Cron Mail**: Tạo thử một task gửi email định kỳ 10 giây 1 lần (`*/10 * * * * *`). Bấm "Xem Log" để xem hệ thống gửi mail theo thời gian thực.
   - **Tab Employee**: Bấm "Tạo hàng loạt" 1000 nhân viên. Thử tính năng Export Excel, sửa dữ liệu trong file Excel đó và Import ngược lại.
   - **Tab Health/Sync**: Bấm "Chạy health check" để kiểm tra kết nối 2 DB. Đặt lịch (hoặc bấm Đồng bộ ngay) để bơm 1000 nhân viên từ Postgres sang MariaDB.
4. Đăng xuất và đăng ký một tài khoản `Employee` thông thường. Đăng nhập lại để thấy giao diện tự động ẩn các tính năng quản trị cao cấp (RBAC in action).

---
*Dự án kết hợp chặt chẽ giữa sức mạnh xử lý nền (Background Processing) và quản lý tài nguyên linh hoạt của NestJS.*
