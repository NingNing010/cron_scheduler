# Cron Scheduler Demo

Dự án NestJS backend demo cơ chế validate Cron Expression và lập lịch động bằng BullMQ + Redis.

## Công nghệ sử dụng

- NestJS
- cron-parser
- BullMQ
- Redis
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

## Demo flow

1. Start Redis.
2. Run NestJS app.
3. Gửi request vào `POST /cron/validate` để kiểm tra cron.
4. Gửi request vào `POST /cron/schedule` để tạo job.
5. Chờ đến đúng thời điểm, Worker sẽ `console.log` và tự tạo lần chạy tiếp theo.

## Ghi chú

- Dự án hiện tập trung vào backend demo.
- Nếu muốn mở rộng thành hệ thống quản lý task đầy đủ, có thể bổ sung database và CRUD task sau.
