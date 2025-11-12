# API Documentation

## API Routes

POST /api/register — สมัครสมาชิกใหม่ (ต้องกรอกฟิลด์ตาม schema)

POST /api/login — เข้าสู่ระบบด้วย username/password รับ JWT

GET /api/me — ดูโปรไฟล์ของตนเอง (ต้องมี JWT)

PUT /api/me — แก้ไขโปรไฟล์ของตนเอง (ฟิลด์ที่อนุญาตเท่านั้น)

POST /api/me/avatar — อัปโหลด/เปลี่ยนรูปโปรไฟล์ของตนเอง

GET /api/admin/users — แอดมินดึงรายชื่อผู้ใช้ทั้งหมด (รองรับ page/pageSize/search)

GET /api/admin/users/:id — แอดมินดูข้อมูลผู้ใช้ตาม id

PUT /api/admin/users/:id — แอดมินแก้ไขข้อมูลผู้ใช้ตาม id (รวมเปลี่ยน role/rank/isActive/รีเซ็ตรหัสผ่าน)

POST /api/admin/users/:id/avatar — แอดมินอัปโหลด/เปลี่ยนรูปโปรไฟล์ให้ผู้ใช้อื่น

GET /uploads/avatars/:filename — ดึงรูปโปรไฟล์จากเซิร์ฟเวอร์

POST /api/admin/users — สร้างผู้ใช้ใหม่ (โครงสร้าง body เหมือน /api/register)

DELETE /api/admin/users/:id — ลบผู้ใช้แบบถาวร (hard delete)

## Project Structure

- `server.js` — Express app bootstrap
- `routes/` — แยกเส้นทางตามกลุ่มฟีเจอร์
  - `routes/auth.js` — สมัคร/เข้าสู่ระบบ
  - `routes/user.js` — โปรไฟล์ผู้ใช้ (me)
  - `routes/admin.js` — จัดการผู้ใช้โดยผู้ดูแลระบบ
  - `routes/index.js` — รวมและ export router กลางที่ `server.js` ใช้
- `controllers/` — ตัวจัดการธุรกิจแยกตามโดเมน
  - `controllers/authController.js`
  - `controllers/userController.js`
  - `controllers/admin/userAdminController.js`
- `models/` — Prisma data access (`userModel.js`)
- `middlewares/` — JWT, upload, etc.
- `utils/` — helper ทั่วไป (`utils/avatar.js`)

## Authentication / Headers

- แนะนำใช้รูปแบบหัวข้อ: `Authorization: Bearer <JWT>`
- ระบบยังยอมรับรูปแบบเดิมที่ส่งเฉพาะ `<token>` ได้ แต่ควรใช้ Bearer เพื่อความมาตรฐาน
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

- Admin (JWT + สิทธิ์ ADMIN)
  - GET /api/admin/users
  - GET /api/admin/users/:id
  - POST /api/admin/users
  - PUT /api/admin/users/:id
  - DELETE /api/admin/users/:id
  - POST /api/admin/users/:id/avatar (multipart/form-data; file field: avatar)
