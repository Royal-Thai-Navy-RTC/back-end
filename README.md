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

DELETE /api/admin/users/:id — ปิดการใช้งานผู้ใช้ (soft delete: isActive=false)

PATCH /api/admin/users/:id/activate — เปิดการใช้งานผู้ใช้ (isActive=true)

POST /api/evaluations/import — อัปโหลดไฟล์ Excel แบบประเมินครู (ต้องมี JWT)
  - multipart/form-data; file field: `file`
  - body optional: `teacherId` (เชื่อมกับผู้ใช้ role TEACHER ถ้ามี)

ตัวอย่างผลลัพธ์สำเร็จ:
```
{
  "message": "นำเข้าข้อมูลแบบประเมินสำเร็จ",
  "sheet": {
    "id": 1,
    "subject": "การปืน",
    "teacherName": "กอไก่ ขอไข่",
    "evaluatorName": "พลฯ ภากร เรื่อศรีจันทร์",
    "evaluatorUnit": "กองร้อยฝึกที่ 4 กองพันฝึกที่ 4",
    "evaluatedAt": "2025-11-12T00:00:00.000Z",
    "answers": [
      { "itemCode": "1", "itemText": "ครูสอนเข้าใจง่าย ใช้คำพูดชัดเจน", "rating": 5 },
      ...
    ]
  }
}
```

## Project Structure

- `server.js` — Express app
- `routes/` — แยกเส้นแต่ละฟีเจอร์
  - `routes/auth.js` — สมัคร/เข้าสู่ระบบ
  - `routes/user.js` — โปรไฟล์ผู้ใช้ (me)
  - `routes/admin.js` — จัดการผู้ใช้โดยผู้ดูแลระบบ
  - `routes/evaluation.js` — นำเข้าแบบประเมินจาก Excel
  - `routes/index.js` — รวมและ export router ที่ `server.js` ใช้
- `controllers/` — ตัวจัดการ Request/Response
  - `controllers/authController.js`
  - `controllers/userController.js`
  - `controllers/evaluationController.js`
  - `controllers/admin/userAdminController.js`
- `models/` — Prisma data access (`userModel.js`)
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

- Admin (JWT + สิทธิ์ ADMIN)
  - GET /api/admin/users
  - GET /api/admin/users/:id
  - POST /api/admin/users
  - PUT /api/admin/users/:id
  - DELETE /api/admin/users/deactivate/:id
  - PATCH /api/admin/users/activate/:id
  - POST /api/admin/users/:id/avatar (multipart/form-data; file field: avatar)
