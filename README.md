# Kiểm kho Barcode

Webapp kiểm kho local-first, tối ưu cho điện thoại:

- Quét barcode để thêm sản phẩm và chống barcode trùng.
- Cho phép tạo sản phẩm không có barcode.
- Quét hoặc chọn sản phẩm từ danh mục để ghi số lượng thực tế hiện tại, hỗ trợ số thập phân.
- Cho phép hoàn tất phiên đang làm và tạo phiên kiểm kho tiếp theo.
- Tự lưu danh mục và phiên hiện tại trong `localStorage`, đồng thời có thể đồng bộ qua file `data/inventory.json` trên GitHub.
- Xuất kết quả kiểm kho thành Excel, xuất/nhập danh mục bằng JSON.

## Đồng bộ dữ liệu

Ứng dụng đọc dữ liệu công khai từ `data/inventory.json` qua GitHub API. Để ghi
dữ liệu từ trình duyệt, nhập fine-grained personal access token có quyền
**Contents: Read and write** cho repo `nguyenthu29102001/app-kiem-kho` trong
tab **Sản phẩm**. Token chỉ được lưu trong `localStorage` của thiết bị và không
được ghi vào repository.

Mỗi thay đổi được tự đồng bộ sau khoảng 1,2 giây. Workflow Pages bỏ qua các
commit chỉ thay đổi `data/inventory.json` để tránh build lại website sau mỗi lần
kiểm kho.

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
