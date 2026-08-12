# Tổng hợp Kiến trúc & Cơ chế hoạt động của Dự án CronMail Pro (Bản chi tiết Công nghệ & Kỹ thuật)

Dưới đây là tổng hợp chi tiết theo từng mốc bạn đã làm trong dự án. Bản cập nhật này đi sâu vào việc liệt kê cụ thể các **Công nghệ**, **Database**, **Model**, **Kỹ thuật** đã sử dụng và giải thích cặn kẽ cơ chế hoạt động của từng phần.

---

### Mốc 1: Xây dựng CRUD, Validate dữ liệu và Custom Validate
*   **Công nghệ & Thư viện:** NestJS (Controllers, Services), `class-validator`, `class-transformer`.
*   **Database & ORM:** PostgreSQL thao tác qua Prisma ORM.
*   **Model áp dụng:** `Employee`, `Task` (Định nghĩa trong `prisma/schema.prisma`).
*   **Kỹ thuật chính:** DTO (Data Transfer Object), NestJS Pipes (Global `ValidationPipe`).
*   **Cơ chế hoạt động chi tiết:**
    *   **Validate cơ bản:** Mọi dữ liệu (Request Body) từ Client gửi lên thông qua API POST/PATCH đều đi qua các class DTO. Tại đây, thư viện `class-validator` dùng các Decorator như `@IsEmail()`, `@IsString()`, `@IsOptional()` để ràng buộc kiểu dữ liệu. Nếu Client gửi sai định dạng, `ValidationPipe` của NestJS sẽ chặn lại ở tầng middleware và ném ra lỗi 400 Bad Request trước khi đi tới Controller.
    *   **Custom Validate (Xử lý nghiệp vụ):** Được xử lý trong tầng Service (`EmployeeService`). Ví dụ khi tạo hoặc cập nhật nhân viên, hệ thống sẽ thực thi lệnh `prisma.employee.findFirst` để quét xem `code` (Mã nhân viên) hoặc `email` đã có trong Database chưa. Prisma dựa vào Model `Employee` định nghĩa thuộc tính `@unique` để tìm kiếm siêu tốc. Nếu bị trùng, Service chủ động ném ra `BadRequestException` để báo lỗi cho người dùng.

### Mốc 2: Import Excel & Xuất file lỗi bằng MinIO
*   **Công nghệ & Thư viện:** `multer` (Upload file), `exceljs` (Xử lý file Excel), `@aws-sdk/client-s3` (Giao tiếp MinIO).
*   **Database & ORM:** PostgreSQL & Prisma ORM.
*   **Model áp dụng:** `Employee`.
*   **Kỹ thuật chính:** Xử lý Stream (Stream Reading), In-memory Batching (Gom lô trong RAM), Pre-signed URLs.
*   **Cơ chế hoạt động chi tiết:**
    *   **Bắt File & Đọc Stream:** Client gửi file qua `FormData`. NestJS dùng `Multer` chặn luồng để lưu file tạm vào thư mục `.tmp`. Thay vì load cả file vào RAM (có thể làm sập server nếu file nặng hàng trăm MB), thư viện `exceljs` sử dụng cơ chế **Stream (`WorkbookReader`)** để đọc lần lượt từng dòng. Thuật toán tự động đọc dòng số 1 (Header) để phân tích xem file bắt đầu bằng cột `ID` (để tự động tịnh tiến dịch cột) hay cột `Code`.
    *   **Lọc & Ghi lỗi:** Dòng đúng được đưa vào mảng RAM (Batch). Khi mảng đạt 1000 phần tử, hệ thống gọi `prisma.employee.createMany({ skipDuplicates: true })` để đổ ào ạt vào PostgreSQL siêu tốc. Các dòng sai (thiếu thông tin, sai email regex, trùng mã) được gom vào mảng lỗi riêng.
    *   **Đẩy MinIO:** Dùng `exceljs` tạo ảo một file Excel báo lỗi. Backend gọi SDK S3 (`PutObjectCommand`) đẩy cục file này qua cổng 9000 lên Bucket `cron-demo` của MinIO. Sau đó, gọi hàm `getSignedUrl(GetObjectCommand)` để sinh ra một đường link tải có gắn chữ ký bảo mật SHA256 (tồn tại trong 1 giờ) trả về cho Client.

### Mốc 3: Bulk Generate & Export danh sách 100.000 data ra Excel
*   **Công nghệ & Thư viện:** `exceljs` (`WorkbookWriter`), Express Response Streaming.
*   **Database & ORM:** PostgreSQL & Prisma ORM.
*   **Model áp dụng:** `Employee`.
*   **Kỹ thuật chính:** Mock Data Generation, Pagination/Cursor-based Processing, Stream Piping.
*   **Cơ chế hoạt động chi tiết:**
    *   **Bulk Generate:** Thuật toán vòng lặp `for` tạo ra một mảng object chứa 1000 - 100.000 bản ghi giả (Mock data) ngay trong RAM, sau đó đưa thẳng vào `prisma.employee.createMany`. Nhờ khả năng xử lý bulk insert của Postgres, tốc độ chèn dữ liệu nhanh hơn hàng chục lần so với vòng lặp lưu từng dòng.
    *   **Cơ chế Export chống tràn RAM:** Nếu lấy 100.000 dòng từ Database bằng lệnh `findMany` thông thường, RAM Node.js sẽ bị quá tải (Out Of Memory). Để giải quyết, Service sử dụng vòng lặp **Cursor / Limit**: lấy từng gói 2000 dòng. Thư viện `exceljs` sử dụng luồng **Stream Writer** nối trực tiếp (`pipe`) vào đối tượng `Response` của Express. Mỗi khi lấy xong 2000 dòng, nó biến đổi thành định dạng Excel và xả thẳng (flush) xuống trình duyệt của người dùng. Server luôn rảnh rang RAM, file Excel cứ thế tải dần trên máy khách.

### Mốc 4: Tích hợp MinIO Build Local
*   **Công nghệ & Thư viện:** Docker Compose, MinIO Server, AWS S3 Client SDK.
*   **Database/Storage:** MinIO Object Storage (Không dùng cơ sở dữ liệu quan hệ).
*   **Model áp dụng:** File Objects (Chứa trong Bucket `cron-demo`).
*   **Kỹ thuật chính:** S3-Compatible API, Bucket Policies.
*   **Cơ chế hoạt động chi tiết:**
    *   Từ file `docker-compose.yml`, dựng lên một image MinIO (hàng nhái hoạt động y hệt Amazon S3). Nó tách rời việc lưu trữ file vật lý khỏi mã nguồn dự án.
    *   Backend NestJS coi MinIO như một dịch vụ Cloud S3 thực thụ, gọi qua cổng 9000 (API Port). Cơ chế đẩy/lấy file sử dụng phương thức mã hóa AWS-Signature-V4. Ngoài ra, quản trị viên có thể vào cổng 9001 (Console UI) bằng tài khoản `minioadmin` để giám sát toàn bộ tài nguyên bằng giao diện đồ họa.

### Mốc 5: Kết nối Đa Database (Postgres & MariaDB) & Health Check
*   **Công nghệ & Thư viện:** Prisma ORM (Multiple Schemas/Clients), `@nestjs/terminus`.
*   **Database & ORM:** PostgreSQL 16 (DB Chính), MariaDB 11.4 (DB Đồng bộ).
*   **Model áp dụng:** Model `Employee` được định nghĩa độc lập ở 2 file (`prisma/schema.prisma` và `prisma/mariadb/schema.prisma`).
*   **Kỹ thuật chính:** Multiple DB Connections, NestJS Dependency Injection, Ping Indicators.
*   **Cơ chế hoạt động chi tiết:**
    *   **Đa kết nối:** Cấu hình 2 `datasource` với 2 provider khác nhau (`postgresql` và `mysql`). Chạy 2 lệnh `prisma generate` để sinh ra 2 bộ thư viện Client riêng rẽ. Trong NestJS, tạo ra 2 class `PrismaService` (trỏ tới Postgres) và `MariaDbPrismaService` (trỏ tới MariaDB). Thông qua Dependency Injection, các controller/service khác có thể gọi tới bất kỳ DB nào. Trong MariaDB schema, các cột chứa Link dài (như `avatarUrl`) được sử dụng ép kiểu `@db.Text` để vượt qua giới hạn độ dài mặc định `VARCHAR(191)` của MySQL.
    *   **Health Check:** Sử dụng `TerminusModule`. Các Indicator gọi lệnh ping nội bộ ngầm (VD: `SELECT 1`) tới 2 Prisma Client. Nếu cả 2 đều trả về thành công trong thời gian cho phép (timeout), hệ thống gộp kết quả thành khối JSON báo cáo `status: "ok"`. Nếu 1 bên chết, hệ thống báo lỗi 503.

### Mốc 6: Logic Đồng bộ Data & Job lập lịch động bằng Cron/BullMQ
*   **Công nghệ & Thư viện:** BullMQ, Redis, `cron-parser`.
*   **Database & ORM:** PostgreSQL & MariaDB.
*   **Model áp dụng:** `Employee`, `SyncRunLog` (Ghi lại lịch sử các đợt đồng bộ).
*   **Kỹ thuật chính:** Background Processing (Xử lý nền), Distributed Message Queue (Hàng đợi phân tán), Upsert Logic, Dynamic Job Scheduling (Lên lịch động).
*   **Cơ chế hoạt động chi tiết:**
    *   **Logic Thay đổi trạng thái:** Mọi bản ghi `Employee` trên Postgres có thêm trường cờ hiệu `isSynced` mặc định là `false`. Khi CRUD, nó lại bị gán về `false`.
    *   **Thuật toán Sync:** Quét tối đa 1000 người có `isSynced = false` bằng `take: 1000`. 
        *   Nếu là bản ghi đang sống: Gọi hàm `prisma.employee.upsert` trên MariaDB. Upsert hoạt động theo cơ chế: Tìm bằng khoá duy nhất (`code`), nếu Đã tồn tại -> Chạy lệnh `update`. Nếu Chưa tồn tại -> Chạy lệnh `create`.
        *   Nếu là bản ghi đã xóa mềm bên Postgres (`deletedAt != null`): Gọi `deleteMany` để xóa cứng bên MariaDB.
        *   Kết thúc lô, gọi UpdateMany set `isSynced = true` bên Postgres, ghi log đợt chạy vào `SyncRunLog`.
    *   **BullMQ & Dynamic Cron:** Thay vì dùng cú pháp cron tĩnh của Nest (`@Cron`), bạn dùng hàng đợi (Queue) đẩy vào Redis. Khi tới giờ, `CronWorker` lấy Job ra chạy. Điểm đặc biệt: Worker chạy xong sẽ lấy chuỗi Cron (`*/10 * * * * *`), dùng thuật toán của `cron-parser` để tính toán chính xác số Mili-giây (delay) còn lại cho đến lần chạy tiếp theo (`nextRun - Date.now()`). Sau đó nó tự động nhét 1 Job mới vào hàng đợi với tham số `delay` đó. Job cũ hoàn thành sẽ tự động bị Redis xóa khỏi bộ nhớ (`removeOnComplete`). Cơ chế này giúp lập lịch cực kỳ động và linh hoạt.

### Mốc 7: Phân quyền Hệ thống (RBAC - Role Based Access Control)
*   **Công nghệ & Thư viện:** `@nestjs/jwt`, `bcryptjs`, NestJS Guards & Reflectors, Vanilla JS (DOM manipulation).
*   **Database & ORM:** PostgreSQL & Prisma ORM.
*   **Model áp dụng:** `User`, `Role`, `Permission` (Quan hệ Many-to-Many).
*   **Kỹ thuật chính:** Stateless Authentication (Xác thực không lưu trạng thái), Hash Mật khẩu, Custom Decorators, DOM Manipulation.
*   **Cơ chế hoạt động chi tiết:**
    *   **Tại Backend (Bảo vệ API):** Mật khẩu người dùng được băm (Hash) một chiều bằng thuật toán `bcrypt` trước khi lưu. Khi đăng nhập thành công, Server dùng JwtService tạo ra thẻ Token, nhồi vào Payload danh sách toàn bộ `Roles` và `Permissions` của User. Mỗi Endpoint API (Controller) được gắn Decorator `@Permissions('employee:create')`. Khi Request bay vào, lớp khiên `RbacGuard` sử dụng `Reflector` để đọc yêu cầu quyền của API đó, đối chiếu với danh sách Quyền trong Token (đã giải mã). Thỏa mãn thì cho qua, nếu không ném lỗi HTTP 403 Forbidden.
    *   **Tại Frontend (Điều hướng UI):** Trình duyệt lưu Token vào `localStorage`. Khi load trang, hàm `checkGateway()` đọc token, bẻ khóa Base64 (`atob`) để trích xuất quyền. Sau đó, nó áp dụng các câu lệnh `if-else` của JavaScript thuần tác động thẳng vào cây DOM. Các phần tử HTML không hợp lệ (Ví dụ: Nút Xóa, Nút Import, hoặc toàn bộ khối Form Thêm mới) sẽ bị gán thuộc tính `style.display = 'none'` để tàng hình trước mắt các nhân viên cấp thấp (Employee). Quyền năng cao nhất (Admin) sẽ vượt qua mọi rào cản và hiển thị đầy đủ giao diện.
