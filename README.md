# Cron Scheduler Demo

Dự án NestJS backend demo cơ chế validate Cron Expression, lập lịch động bằng BullMQ + Redis, và lưu trữ Task bằng Prisma + SQLite.

## Công nghệ sử dụng

- NestJS
- cron-parser
- BullMQ
- Redis
- Prisma + SQLite
- class-validator / class-transformer

## Chức năng chính

### 1. Validate Cron Expression
- Nhận 5 trường cron từ người dùng: minute, hour, day, month, weekday.
- Kiểm tra dữ liệu đầu vào.
- Ghép thành Cron Expression.
- Dùng `cron-parser` để tính thời gian chạy tiếp theo.
- Trả về `valid`, `message` lỗi nếu có, và `nextRun`.

### 2. Lập lịch động bằng BullMQ
- Nhận cron expression và `jobName`.
- Tính `nextRun` bằng `cron-parser`.
- Đẩy job vào queue `dynamic-cron-queue` bằng `delay`.
- Không dùng `repeat` của BullMQ.

### 3. Worker tự re-enqueue
- Khi đến thời điểm chạy, Worker xử lý job.
- Mô phỏng thực thi bằng `console.log`.
- Tính lại `nextRun`.
- Tự tạo job mới cho chu kỳ tiếp theo.

### 4. CRUD Task với Prisma + SQLite
- Lưu Task vĩnh viễn vào cơ sở dữ liệu SQLite bằng Prisma.
- Khi tạo Task mới, hệ thống tính `nextRun` và đồng bộ sang BullMQ bằng `jobId = taskId`.
- Khi xóa Task, hệ thống hủy job đang chờ trong queue rồi mới xóa bản ghi trong DB.
- API trả về danh sách Task để Frontend hiển thị trạng thái và thời gian chạy kế tiếp.

## 5. Giao diện demo trên trình duyệt
- Xây dựng một giao diện web đơn giản ngay trong NestJS project để nhập Cron Expression và `jobName`.
- Cho phép người dùng bấm nút kiểm tra Cron ngay trên trình duyệt.
- Hiển thị kết quả validate và kết quả đặt lịch trực tiếp trên giao diện.
- Trang demo được serve tại `http://localhost:3000`.

## 6. Tài liệu
- Bổ sung `README.md` ở root để hướng dẫn cài đặt, chạy ứng dụng và test API.
- Bổ sung các lệnh Prisma để khởi tạo và đồng bộ SQLite.
- Có thể xem bảng database bằng `npx prisma studio` hoặc `npm run prisma:studio`.

## Yêu cầu môi trường

- Node.js
- npm
- Redis đang chạy

Chạy Redis nhanh bằng Docker:

```bash
docker run -d --name my-redis -p 6379:6379 redis:alpine
```

## Cài đặt

```bash
npm install
npm run prisma:generate
npm run prisma:dbpush
npm run prisma:studio
```

## Chạy ứng dụng

```bash
npm run start:dev
```

Ứng dụng mặc định chạy tại:

```bash
http://localhost:3000
```

## API

### 1. Validate Cron

`POST /cron/validate`

Ví dụ body:

```json
{
  "minute": "0",
  "hour": "9",
  "day": "*",
  "month": "*",
  "weekday": "*"
}
```

### 2. Schedule Job

`POST /cron/schedule`

Ví dụ body:

```json
{
  "jobName": "Send Daily Email",
  "minute": "0",
  "hour": "9",
  "day": "*",
  "month": "*",
  "weekday": "*"
}
```

### 3. Task CRUD

`POST /tasks`

Body:

```json
{
  "name": "Send Daily Email",
  "cronExpression": "0 9 * * *"
}
```

`GET /tasks`

Trả về toàn bộ Task đã lưu trong SQLite cùng `nextRun`.

`DELETE /tasks/:id`

Xóa Task khỏi DB và hủy job đang chờ trong BullMQ.

## Xem bảng Database

Để xem dữ liệu trong bảng `Task`, bạn có thể dùng một trong các cách sau:

1. Mở Prisma Studio:

```bash
npm run prisma:studio
```

2. Hoặc dùng lệnh trực tiếp:

```bash
npx prisma studio
```

3. File SQLite đang dùng là `dev.db` ở thư mục gốc dự án.

4. Nếu cần xem bằng công cụ ngoài, có thể mở file `dev.db` bằng SQLite Viewer, DB Browser for SQLite, hoặc extension SQLite trong VS Code.

## Demo flow

1. Start Redis.
2. Run NestJS app.
3. Mở giao diện web tại `http://localhost:3000` để kiểm tra Cron và đặt lịch trực tiếp.
4. Gửi request vào `POST /cron/validate` để kiểm tra cron.
5. Gửi request vào `POST /cron/schedule` để tạo job.
6. Tạo Task bằng `POST /tasks`, xem danh sách bằng `GET /tasks`, rồi thử xóa bằng `DELETE /tasks/:id`.
7. Chờ đến đúng thời điểm, Worker sẽ `console.log` và tự tạo lần chạy tiếp theo.

## Ghi chú

- Dự án hiện tập trung vào backend demo, có thêm giao diện web tối giản để thuận tiện kiểm thử.
- Nếu muốn mở rộng thành hệ thống quản lý task đầy đủ, có thể bổ sung database và CRUD task sau.
