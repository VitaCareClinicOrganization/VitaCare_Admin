# fe_clinic_ad

## Deploy Vercel khi backend đang dùng HTTP

Trình duyệt gọi `/api/v1` cùng tên miền HTTPS của admin. Next.js chuyển tiếp
request, cookie đăng nhập và phản hồi API tới backend qua external rewrites.
`/uploads` và `/imageapi` cũng được chuyển tiếp để tránh Mixed Content với ảnh.

Đặt `NEXT_PUBLIC_API_URL=http://3.0.207.60/api/v1` trên Vercel rồi redeploy.
Đây là biến duy nhất cấu hình địa chỉ backend và bắt buộc phải có cả khi chạy local.
Hạ tầng Terraform công khai cổng 80 qua Nginx; cổng 8011 chỉ dùng nội bộ Docker.
Backend phải truy cập được từ server Vercel. Không đặt upstream trỏ về admin.

Proxy này áp dụng cho HTTP API và ảnh; Socket.io/WebRTC signaling vẫn cần backend
HTTPS/WSS hoặc một proxy hỗ trợ WebSocket riêng. Kết nối từ Vercel tới backend
HTTP chưa được mã hóa. Không cache phản hồi `/api/v1`.
