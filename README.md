# API Documentation

## API Routes

POST /api/register — สมัครสมาชิกใหม่ (ต้องกรอกฟิลด์ตาม schema)

POST /api/login — เข้าสู่ระบบด้วย username/password รับ JWT

GET /api/me — ดูโปรไฟล์ของตนเอง (ต้องมี JWT)

PUT /api/me — แก้ไขโปรไฟล์ของตนเอง (ฟิลด์ที่อนุญาตเท่านั้น)

POST /api/me/avatar — อัปโหลด/เปลี่ยนรูปโปรไฟล์ของตนเอง

GET /api/admin/users — แอดมินดึงรายชื่อผู้ใช้ทั้งหมด (รองรับ page/pageSize/search)

GET /api/admin/users/students — รายชื่อผู้ใช้ role STUDENT

GET /api/admin/users/teachers — รายชื่อผู้ใช้ role TEACHER

GET /api/admin/users/students/:id — แอดมินดูข้อมูลนักเรียนรายบุคคล (ตรวจสอบ role = STUDENT)

GET /api/admin/users/teachers/:id — แอดมินดูข้อมูลครูรายบุคคล (ตรวจสอบ role = TEACHER)

GET /api/admin/users/:id — แอดมินดูข้อมูลผู้ใช้ตาม id

PUT /api/admin/users/:id — แอดมินแก้ไขข้อมูลผู้ใช้ตาม id (รวมเปลี่ยน role/rank/isActive/รีเซ็ตรหัสผ่าน)

POST /api/admin/users/:id/avatar — แอดมินอัปโหลด/เปลี่ยนรูปโปรไฟล์ให้ผู้ใช้อื่น

GET /uploads/avatars/:filename — ดึงรูปโปรไฟล์จากเซิร์ฟเวอร์

POST /api/admin/users — สร้างผู้ใช้ใหม่ (โครงสร้าง body เหมือน /api/register)

DELETE /api/admin/users/:id — ปิดการใช้งานผู้ใช้ (soft delete: isActive=false)

PATCH /api/admin/users/:id/activate — เปิดการใช้งานผู้ใช้ (isActive=true)

GET /api/admin/training-reports — สรุปยอดรายงานและการส่งล่าสุดของครูทุกคน (query: `search` สำหรับค้นหา)

GET /api/admin/teacher-leaves/summary — สรุปยอดบัญชีพลครูฝึก (จำนวนครูทั้งหมด / ผู้ที่ลาปัจจุบัน / จุดหมาย)

GET /api/admin/teacher-leaves — รายการคำขอลา (query: `status` = PENDING|APPROVED|REJECTED, `limit`)

PATCH /api/admin/teacher-leaves/:id/status — อนุมัติ/ปฏิเสธคำขอลา (`status` = APPROVED หรือ REJECTED)

POST /api/teacher/training-reports — ครูผู้สอนส่งยอดนักเรียน (subject, participantCount, company, battalion, trainingDate, trainingTime, location, durationHours, notes)

GET /api/teacher/training-reports/latest — ดูประวัติการส่งล่าสุด (ค่าเริ่มต้น 5 รายการ, ปรับจำนวนได้ด้วย query `limit`)

POST /api/teacher/leaves — ครูแจ้งการลา (leaveType, startDate, endDate?, destination, reason)

GET /api/teacher/leaves — ครูดูรายการลาของตนเอง

POST /api/teacher/official-duty-leaves — ครูแจ้งลาไปราชการ (ข้อมูลเหมือนการลา แต่ระบบส่งเข้าช่องทางหัวหน้าแผนกศึกษา)

GET /api/teacher/official-duty-leaves — ครูดูรายการลาไปราชการของตนเอง

GET /api/department/official-duty-leaves — หัวหน้าแผนกศึกษาดูรายการลาไปราชการ (query: `status` = PENDING|APPROVED|REJECTED, `limit`)

PATCH /api/department/official-duty-leaves/:id/status — หัวหน้าแผนกศึกษาอนุมัติ/ปฏิเสธลาไปราชการ

POST /api/evaluations/import — อัปโหลดไฟล์ Excel แบบประเมินครู (ต้องมี JWT)
  - multipart/form-data; file field: `file`
  - body optional: `teacherId` (เชื่อมกับผู้ใช้ role TEACHER ถ้ามี)

## Project Structure

- `server.js` — Express app
- `routes/` — แยกเส้นแต่ละฟีเจอร์
  - `routes/auth.js` — สมัคร/เข้าสู่ระบบ
  - `routes/user.js` — โปรไฟล์ผู้ใช้ (me)
  - `routes/admin.js` — จัดการผู้ใช้โดยผู้ดูแลระบบ
  - `routes/teacher.js` — เส้นทางสำหรับครูส่งยอดนักเรียน
  - `routes/evaluation.js` — นำเข้าแบบประเมินจาก Excel
  - `routes/index.js` — รวมและ export router ที่ `server.js` ใช้
- `controllers/` — ตัวจัดการ Request/Response
  - `controllers/authController.js`
  - `controllers/userController.js`
  - `controllers/teacherReportController.js`
  - `controllers/teacherLeaveController.js`
  - `controllers/evaluationController.js`
  - `controllers/admin/userAdminController.js`
  - `controllers/admin/trainingReportAdminController.js`
  - `controllers/admin/teacherLeaveAdminController.js`
- `models/` — Prisma data access (`userModel.js`, `trainingReportModel.js`, `teacherLeaveModel.js`)
- `middlewares/` — JWT, upload, etc.
  - รองรับอัปโหลดรูป (`middlewares/upload.js` — avatar)
  - รองรับอัปโหลด Excel (`middlewares/upload.js` — excelUploadOne => ไฟล์ `.xlsx`)
- `utils/` — helper ทั่วไป (`utils/avatar.js`)

## Authentication / Headers

- ตัวอย่าง Headers: `Authorization: Bearer <JWT>`
- ส่ง `<token>` ได้เลย แต่สามารถใช้ Bearer ได้
- Token ที่ได้จาก /api/login มี payload เป็น `{ id, role }`

ตัวอย่าง
```
Authorization: Bearer <JWT>
```

## Auth Requirements (สรุป)

- Public (ไม่ต้องใช้ token)
  - POST /api/register
  - POST /api/login

- JWT (ผู้ใช้ล็อกอินทั่วไป)
  - GET /api/me
  - PUT /api/me
  - POST /api/me/avatar (multipart/form-data; file field: avatar)

- Teacher (JWT + สิทธิ์ TEACHER)
  - POST /api/teacher/training-reports
  - GET /api/teacher/training-reports/latest
  - POST /api/teacher/leaves
  - GET /api/teacher/leaves
  - POST /api/teacher/official-duty-leaves
  - GET /api/teacher/official-duty-leaves

- Admin (JWT + สิทธิ์ ADMIN)
  - GET /api/admin/users
  - GET /api/admin/users?role=STUDENT|TEACHER — กรองตาม role ได้จาก query
  - GET /api/admin/users/students — รายชื่อผู้ใช้ role STUDENT
  - GET /api/admin/users/teachers — รายชื่อผู้ใช้ role TEACHER
  - GET /api/admin/users/students/:id — ดึงข้อมูลนักเรียนเฉพาะคน
  - GET /api/admin/users/teachers/:id — ดึงข้อมูลครูเฉพาะคน
  - GET /api/admin/users/:id
  - POST /api/admin/users
  - PUT /api/admin/users/:id
  - DELETE /api/admin/users/deactivate/:id
  - PATCH /api/admin/users/activate/:id
  - POST /api/admin/users/:id/avatar (multipart/form-data; file field: avatar)
  - GET /api/admin/training-reports — dashboard summary + ค้นหา
  - GET /api/admin/teacher-leaves/summary — บัญชีพลครูฝึก (ยอดรวม/ลาปัจจุบัน/จุดหมาย)
  - GET /api/admin/teacher-leaves — รายการคำขอลา (กรองตามสถานะ)
  - PATCH /api/admin/teacher-leaves/:id/status — อนุมัติ/ปฏิเสธคำขอลา

- Department Head (JWT + สิทธิ์ DEPARTMENT_HEAD)
  - GET /api/department/official-duty-leaves — ตรวจคำขอลาไปราชการ
  - PATCH /api/department/official-duty-leaves/:id/status — อนุมัติ/ปฏิเสธลาไปราชการ
