# Cấu trúc thư mục
├── _templates : Chứa code mẫu geneate tự động bằng hygen
├── config: Chứa các file cấu hình
├── hooks: Chứa script hook sử dụng cho docker hub autobuild
├── next: Chứa code giao diện reactjs
│   ├── components: Các code chi tiết cho từng page
│   ├── config: Cấu hình code giao diện
│   ├── layouts: Các layout chính 
│   ├── lib: Code thư viện và service
│   ├── pages: Cấu hình routing các page chính
│   ├── public: Asset public
│   └── style: Code chung style css
├── public: Asset public từ server backend
├── script: Các script js fix data
├── src: Mã nguồn backend bằng typescript
│   ├── base: Chứa các class kế thừa
│   ├── constants: Chứa các file chuỗi constants
│   ├── events: Chứa file xử lý event emitter
│   ├── graphql: Chứa các module graphql resovler, schema, model, service
│   ├── helpers: Chứa các code kết nối và thư viện
│   ├── routers: Khai báo rest API
│   ├── scheduler: Khai báo script xử lý job schedule
│   └── types: Khai báo type typescript
