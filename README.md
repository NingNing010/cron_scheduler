# CronMail Pro & Employee Sync System

Dự án NestJS Backend nâng cao kết hợp giao diện Frontend Dashboard, quản lý lập lịch động bằng **BullMQ + Redis**, cơ sở dữ liệu kép bằng **Prisma (PostgreSQL & MariaDB)**, phân quyền **RBAC (Role-Based Access Control)**, và lưu trữ file đám mây nội bộ qua **MinIO**.

## Công nghệ cốt lõi

- **Framework**: NestJS (v11)
- **Database**: PostgreSQL (Main DB) & MariaDB (Sync DB) qua Prisma ORM
- **Background Jobs**: BullMQ + Redis
- **Authentication**: JWT (JSON Web Tokens), Passport.js (Google OAuth 2.0) với phân quyền Role-Based (Admin, Manager, Employee)
- **Storage**: MinIO (S3-Compatible Object Storage)
- **Mailing**: Nodemailer (SMTP)
- **File Processing**: ExcelJS (Streaming) & Multer
- **Frontend**: HTML5, Vanilla JavaScript, CSS3 (Giao diện Production Dashboard tích hợp sẵn)
- **Infrastructure**: Docker Compose

## Chức năng chính

### 1. Xác Thực, Phân quyền và Bảo mật (Auth, RBAC & OAuth 2.0)
- **Đăng nhập Google (OAuth 2.0)**: Tích hợp xác thực qua Google, tự động điều hướng và đồng bộ token mượt mà với giao diện Frontend.
- **Quên mật khẩu an toàn**: Hỗ trợ gửi email khôi phục mật khẩu. Điểm nhấn kiến trúc là thuật toán chống **Replay Attack** bằng cách đính kèm *Password Hash* trực tiếp vào JWT Payload, khiến link khôi phục bị vô hiệu hoá ngay lập tức khi mật khẩu được cập nhật thành công.
- **RBAC**: Hệ thống Role-Based (Admin, Manager, Employee) kiểm soát quyền truy cập qua Guard và Decorators, tự động ẩn/hiện các chức năng tương ứng trên giao diện UI mà không cần truy vấn DB liên tục.
- Tính năng `Seed Database` tạo tài khoản admin và thiết lập Roles mặc định nhanh chóng.

### 2. Lập lịch động (Dynamic Cron) với BullMQ
- Quản lý các tác vụ (Tasks) gửi email tự động với lịch trình linh hoạt (Cron expressions 6 trường - có giây).
- Worker tự động tính toán thời gian chạy kế tiếp (`nextRun`) và tự đẩy lại vào Queue (Re-enqueue) sau mỗi chu kỳ mà không dùng tính năng lặp mặc định của BullMQ để kiểm soát chặt chẽ hơn.
- Ghi Log chi tiết từng lần chạy (Thành công/Thất bại/Phản hồi SMTP).

### 3. Quản lý Nhân viên (Employee CRUD, Import/Export & MinIO)
- Các thao tác Thêm, Sửa, Xóa, Xem danh sách nhân viên phân trang (Pagination).
- **Bulk Generate**: Tự động tạo hàng ngàn dữ liệu giả (Mock data) ngay lập tức.
- **Excel Export/Import bằng Stream**: Ứng dụng Node.js Stream đọc/ghi file Excel từng phần, giải quyết bài toán chống tràn RAM (OOM) khi xử lý hàng vạn nhân sự.
- **MinIO Object Storage**: Hỗ trợ upload Avatar và sinh link ảnh bảo mật (Pre-signed URL). Khi tiến trình Import Excel gặp lỗi ở vài dòng, hệ thống tự động sinh một file Excel chứa chi tiết lỗi, đẩy lên MinIO và cấp link tải xuống để người dùng khắc phục.

### 4. Đồng bộ Dữ liệu Hệ thống (Database Synchronization)
- Tính năng đồng bộ (Sync) dữ liệu nhân viên từ cơ sở dữ liệu lõi (PostgreSQL) sang cơ sở dữ liệu báo cáo (MariaDB) thông qua cờ trạng thái ngầm định (`isSynced`).
- Áp dụng lệnh `upsert` thông qua Unique Code (Mã NV) để đảm bảo tính nhất quán của dữ liệu đa DB mà không cần dùng Trigger Database.
- Xử lý mượt mà **Row-level Exceptions**: Bắt lỗi (`try...catch`) trên từng dòng dữ liệu. Nếu một dòng bị lỗi, dòng đó sẽ bị bỏ qua (Skip) và đợi Retry ở chu kỳ sau, hoàn toàn không làm sập (Crash) tiến trình đồng bộ của cả Batch.

### 5. Health Checks
- Tích hợp `@nestjs/terminus` để tự động ping kiểm tra trạng thái hoạt động của cả PostgreSQL, MariaDB, SMTP Mailer và các dịch vụ khác.

---

## Hướng dẫn cài đặt & Chạy ứng dụng

### 1. Yêu cầu môi trường
- Node.js (>= 18)
- npm hoặc yarn
- Docker & Docker Compose (Bắt buộc để chạy DB, Redis và MinIO)

### 2. Khởi chạy Hạ tầng (Databases, Redis, MinIO)
Chạy lệnh sau để khởi động toàn bộ hạ tầng qua Docker Compose:

```bash
docker-compose up -d
```
*(Lưu ý: Truy cập Console MinIO tại `http://localhost:9001` với `minioadmin` / `minioadmin`)*

### 3. Cấu hình môi trường (.env)
Copy file `.env.example` thành `.env` và cập nhật các thông số quan trọng (Đặc biệt là `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, cấu hình `MAIL_USER`, và `JWT_RESET_SECRET`).

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
2. Bấm nút **Seed Database** ở màn hình đăng nhập để tạo Role và tài khoản `admin` / `password123`.
3. Test tính năng Auth: Bấm **Đăng nhập bằng Google** hoặc thử tính năng **Quên mật khẩu** (Kiểm tra email nhận link).
4. Đăng nhập bằng `admin` và trải nghiệm:
   - **Tab Cron Mail**: Tạo thử một task gửi email định kỳ 10 giây 1 lần (`*/10 * * * * *`). Bấm "Làm mới" để xem log gửi mail thực tế.
   - **Tab Employee**: Bấm "Tạo hàng loạt" 1000 nhân viên. Thử tính năng Export Excel, sửa lỗi cố tình trong file Excel đó và Import ngược lại để test cơ chế văng file lỗi MinIO.
   - **Tab Health/Sync**: Chạy Health Check. Bấm Đồng bộ ngay để đưa 1000 nhân viên từ Postgres sang MariaDB. Hệ thống Upsert cực nhanh và an toàn.
5. Đăng xuất, tạo một tài khoản mới và đăng nhập lại để xem giao diện ẩn đi các quyền Admin.

---
*Dự án kiến trúc phần mềm kết hợp chặt chẽ giữa sức mạnh xử lý nền (Background Processing), Streaming I/O, và quản lý tài nguyên linh hoạt cấp độ Enterprise của NestJS.*
