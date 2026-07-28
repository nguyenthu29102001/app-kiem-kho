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

## Xuất sang Google Sheet

Khi xuất Excel, ứng dụng có thể đồng thời gửi phiên kiểm kho sang Google Sheet.
Link Sheet và link Apps Script chỉ được lưu trong `localStorage` của thiết bị,
không được ghi vào GitHub.

Thiết lập Apps Script:

1. Mở [Google Apps Script](https://script.google.com/) và tạo project mới.
2. Sao chép nội dung `google-apps-script/Code.gs` vào file `Code.gs`.
3. Mở **Project Settings → Script Properties** và thêm:
   - `INVENTORY_SPREADSHEET_ID`: phần ID nằm giữa `/d/` và `/edit` trong link Sheet.
   - `INVENTORY_SHARED_SECRET`: chuỗi ngẫu nhiên tối thiểu 24 ký tự, nên tạo bằng
     password manager.
4. Chọn **Deploy → New deployment → Web app**.
5. Chọn **Execute as: Me** và **Who has access: Anyone** để trình duyệt có thể
   gửi dữ liệu mà không cần đăng nhập Google trong ứng dụng. Chỉ chia sẻ URL
   Web App và shared secret với các thiết bị kiểm kho.
6. Deploy, cấp quyền truy cập Google Sheet, rồi sao chép URL kết thúc bằng `/exec`.
7. Trong tab **Sản phẩm** của ứng dụng, nhập link file Google Sheet, URL Web App
   và đúng shared secret trong Script Properties, sau đó bấm **Lưu cấu hình**.

Apps Script chỉ mở Spreadsheet ID đã cố định trong Script Properties, xác thực
shared secret, giới hạn tối đa 10.000 dòng, khoá ghi đồng thời và escape dữ liệu
có thể bị hiểu là công thức. Khi cập nhật `Code.gs`, phải tạo deployment version
mới trong **Deploy → Manage deployments**.

Ứng dụng gửi dữ liệu bằng form ẩn thay vì `fetch`, tránh lỗi CORS/redirect
`Load failed` trên Safari và trình duyệt mobile.

Mỗi phiên tạo một tab có tên `KIỂM KHO - DD-MM-YYYY`. Nếu có nhiều phiên cùng
ngày, các tab tiếp theo nhận hậu tố `(2)`, `(3)`. Xuất lại cùng một phiên sẽ cập
nhật tab đã tạo thay vì tạo tab mới.

## Chạy local

```bash
npm install
npm run dev
```

## GitHub Pages

Workflow `.github/workflows/deploy-pages.yml` tự build và deploy khi push vào
nhánh `main`. Trong phần **Settings → Pages** của repo, chọn Source:
**GitHub Actions**.
