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

## Example Header

```
Authorization: <token>
```
