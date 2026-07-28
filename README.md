# Kiểm kho Barcode

Webapp kiểm kho local-first, tối ưu cho điện thoại:

- Quét barcode để thêm sản phẩm và chống barcode trùng.
- Cho phép tạo sản phẩm không có barcode.
- Quét hoặc chọn sản phẩm từ danh mục để nhập số lượng.
- Mỗi lần bắt đầu phiên mới đều yêu cầu xác nhận xoá dữ liệu kiểm kho cũ.
- Tự lưu danh mục và phiên hiện tại trong `localStorage`.
- Xuất kết quả kiểm kho thành Excel, xuất/nhập danh mục bằng JSON.

## Dữ liệu sản phẩm

Danh mục mẫu nằm tại `public/products.json`. Trong app, danh mục được cache bằng
`localStorage`. Khi cập nhật danh mục, chọn **Xuất JSON** rồi thay file
`public/products.json` trong repo nếu muốn lưu phiên bản mới cùng mã nguồn.

## Chạy local

```bash
npm install
npm run dev
```

## GitHub Pages

Workflow `.github/workflows/deploy-pages.yml` tự build và deploy khi push vào
nhánh `main`. Trong phần **Settings → Pages** của repo, chọn Source:
**GitHub Actions**.
