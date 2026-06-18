import { t } from "../../../helpers/functions/string";

export const AuthorityData = [
  {
    code: "QT",
    name: t("Quản trị"),
    features: [
      {
        code: "AN-1",
        name: t("Thống kê"),
        scopes: [{ code: "AN-1-1", name: t("Truy cập") }],
      },
      {
        code: "QT-1",
        name: t("Tài khoản"),
        scopes: [
          { code: "QT-1-1", name: t("Truy cập") },
          { code: "QT-1-2", name: t("Tạo mới") },
          { code: "QT-1-3", name: t("Cập nhật") },
          { code: "QT-1-4", name: t("Xóa") },
          { code: "QT-1-5", name: t("Cập nhật ngân hàng") },
          { code: "QT-1-6", name: t("Cập nhật giới hạn tài khoản") },
        ],
      },
      {
        code: "QT-2",
        name: t("Cửa hàng"),
        scopes: [
          { code: "QT-2-1", name: t("Truy cập") },
          { code: "QT-2-2", name: t("Tạo mới") },
          { code: "QT-2-3", name: t("Cập nhật") },
          { code: "QT-2-4", name: t("Xóa") },
        ],
      },
      {
        code: "QT-3",
        name: t("Khách hàng"),
        scopes: [
          { code: "QT-3-1", name: t("Truy cập") },
          { code: "QT-3-2", name: t("Tạo mới") },
          { code: "QT-3-3", name: t("Cập nhật") },
          { code: "QT-3-4", name: t("Xóa") },
          { code: "QT-3-5", name: t("Xuất danh sách") },
        ],
      },
      {
        code: "TD-1",
        name: t("Trending"),
        scopes: [
          { code: "TD-1-1", name: t("Truy cập") },
          { code: "TD-1-2", name: t("Tạo mới") },
          { code: "TD-1-3", name: t("Cập nhật") },
          { code: "TD-1-4", name: t("Xóa") },
        ],
      },
      {
        code: "AR-1",
        name: t("Art Style"),
        scopes: [
          { code: "AR-1-1", name: t("Truy cập") },
          { code: "AR-1-2", name: t("Tạo mới") },
          { code: "AR-1-3", name: t("Cập nhật") },
          { code: "AR-1-4", name: t("Xóa") },
        ],
      },
      {
        code: "QT-4",
        name: t("Sản phẩm"),
        scopes: [
          { code: "QT-4-1", name: t("Truy cập") },
          { code: "QT-4-2", name: t("Tạo") },
          { code: "QT-4-3", name: t("Sửa") },
          { code: "QT-4-4", name: t("Xóa") },
        ],
      },
      {
        code: "QT-5",
        name: t("Quản lý Shop video"),
        scopes: [
          { code: "QT-5-1", name: t("Truy cập") },
          { code: "QT-5-2", name: t("Sửa") },
          { code: "QT-5-3", name: t("Xóa") },
        ],
      },
      // {
      //   code: "QT-5",
      //   name: t("Danh mục cửa hàng"),
      //   scopes: [
      //     { code: "QT-5-1", name: t("Truy cập") },
      //     { code: "QT-5-2", name: t("Tạo mới") },
      //     { code: "QT-5-3", name: t("Sửa") },
      //     { code: "QT-5-4", name: t("Xóa") },
      //   ],
      // },
      {
        code: "QT-6",
        name: t("Banner"),
        scopes: [
          { code: "QT-6-1", name: t("Truy cập") },
          { code: "QT-6-2", name: t("Tạo mới") },
          { code: "QT-6-3", name: t("Sửa") },
          { code: "QT-6-4", name: t("Xóa") },
        ],
      },
      {
        code: "QT-8",
        name: t("Popup thông báo"),
        scopes: [
          { code: "QT-8-1", name: t("Truy cập") },
          { code: "QT-8-2", name: t("Tạo mới") },
          { code: "QT-8-3", name: t("Sửa") },
          { code: "QT-8-4", name: t("Xóa") },
        ],
      },
      {
        code: "QT-7",
        name: t("Danh mục"),
        scopes: [
          { code: "QT-7-1", name: t("Truy cập") },
          { code: "QT-7-2", name: t("Tạo mới") },
          { code: "QT-7-3", name: t("Sửa") },
          { code: "QT-7-4", name: t("Xóa") },
        ],
      },
      {
        code: "QT-14",
        name: t("Quản lý stream"),
        scopes: [
          { code: "QT-14-1", name: t("Truy cập") },
          { code: "QT-14-2", name: t("Duyệt") },
          { code: "QT-14-3", name: t("Sửa") },
          { code: "QT-14-4", name: t("Xóa") },
        ],
      },
      {
        code: "QT-15",
        name: t("Quản lý giới thiệu"),
        scopes: [{ code: "QT-15-1", name: t("Truy cập") }],
      },

      {
        code: "UT-1",
        name: t("Tiện ích"),
        scopes: [
          { code: "UT-1-1", name: t("Truy cập") },
          { code: "UT-1-2", name: t("Tạo mới") },
          { code: "UT-1-3", name: t("Sửa") },
          { code: "UT-1-4", name: t("Xóa") },
          { code: "UT-1-5", name: t("Tạo ưu đãi") },
        ],
      },

      {
        code: "GR-1",
        name: t("Nhóm"),
        scopes: [
          { code: "GR-1-1", name: t("Truy cập") },
          { code: "GR-1-2", name: t("Tạo mới") },
          { code: "GR-1-3", name: t("Sửa") },
          { code: "GR-1-4", name: t("Xóa") },
          { code: "GR-1-5", name: t("Cập nhật thành viên") },
          { code: "GR-1-6", name: t("Xem tất cả danh sách") },
        ],
      },
      {
        code: "QT-16",
        name: t("Quản lý đánh giá"),
        scopes: [
          { code: "QT-16-1", name: t("Truy cập") },
          { code: "QT-16-3", name: t("Sửa") },
          { code: "QT-16-4", name: t("Xóa") },
        ],
      },
      {
        code: "QT-17",
        name: t("Quản lý thông báo"),
        scopes: [{ code: "QT-17-1", name: t("Truy cập") }],
      },
      {
        code: "QT-20",
        name: t("Quản lý tố cáo"),
        scopes: [
          { code: "QT-20-1", name: t("Truy cập") },
          { code: "QT-20-2", name: t("Sửa") },
          { code: "QT-20-3", name: t("Xóa") },
        ],
      },
    ],
  },
  {
    code: "AF",
    name: t("Affiliates"),
    features: [
      {
        code: "AFB-1",
        name: t("Gian hàng"),
        scopes: [
          { code: "AFB-1-1", name: t("Truy cập") },
          { code: "AFB-1-2", name: t("Tạo mới") },
          { code: "AFB-1-3", name: t("Sửa") },
          { code: "AFB-1-4", name: t("Xóa") },
        ],
      },
      {
        code: "AFC-1",
        name: t("Danh mục sản phẩm"),
        scopes: [
          { code: "AFC-1-1", name: t("Truy cập") },
          { code: "AFC-1-2", name: t("Tạo mới") },
          { code: "AFC-1-3", name: t("Sửa") },
          { code: "AFC-1-4", name: t("Xóa") },
        ],
      },
      {
        code: "AFP-1",
        name: t("Quản lý sản phẩm"),
        scopes: [
          { code: "AFP-1-1", name: t("Truy cập") },
          { code: "AFP-1-2", name: t("Duyệt") },
        ],
      },
      {
        code: "APP-1",
        name: t("Quản lý File"),
        scopes: [
          { code: "APP-1-1", name: t("Truy cập") },
          { code: "APP-1-2", name: t("Duyệt") },
        ],
      },
      {
        code: "AFR-1",
        name: t("Đơn bị tố cáo"),
        scopes: [
          { code: "AFR-1-1", name: t("Truy cập") },
          { code: "AFR-1-2", name: t("Xử lý") },
        ],
      },
    ],
  },

  {
    code: "GD",
    name: t("Giao dịch"),
    features: [
      {
        code: "GD-1",
        name: t("Đơn giao dịch"),
        scopes: [
          { code: "GD-1-1", name: t("Truy cập") },
          // { code: "GD-1-2", name: t("Gọi khách") },
          { code: "GD-1-3", name: t("Sửa") },
          { code: "GD-1-4", name: t("Xem số điện thoại") },
          { code: "GD-1-5", name: t("Xác nhận giao dịch") },
          { code: "GD-1-6", name: t("Xử lý tố cáo") },
          // { code: "GD-1-7", name: t("Xem mã bảo mật") },
        ],
      },
      {
        code: "XN-1",
        name: t("Chờ xác nhận"),
        scopes: [
          { code: "XN-1-1", name: t("Truy cập") },
          { code: "XN-1-2", name: t("Xác nhận đơn") },
        ],
      },
    ],
  },

  {
    code: "THREAD",
    name: t("Tán gẫu"),
    features: [
      {
        code: "TG-1",
        name: t("Tán gẫu"),
        scopes: [
          { code: "TG-1-1", name: t("Truy cập") },
          { code: "TG-1-2", name: t("Xem tin bị thu hồi và thu hồi tin") },
          { code: "TG-1-3", name: t("Cập nhật") },
          { code: "TG-1-4", name: t("Xóa") },
        ],
      },
    ],
  },
  {
    code: "BANK_WALLET",
    name: t("Ngân hàng và mPoint"),
    features: [
      {
        code: "TH-3",
        name: t("Ngân hàng"),
        scopes: [
          { code: "TH-3-1", name: t("Truy cập") },
          { code: "TH-3-2", name: t("Tạo mới") },
          { code: "TH-3-3", name: t("Cập nhật") },
          { code: "TH-3-4", name: t("Xóa") },
        ],
      },
      {
        code: "BA-1",
        name: t("Ngân hàng xác thực"),
        scopes: [
          { code: "BA-1-1", name: t("Truy cập") },
          { code: "BA-1-3", name: t("Sửa") },
          { code: "BA-1-4", name: t("Xóa") },
        ],
      },
      {
        code: "QT-11",
        name: t("mPoint"),
        scopes: [
          { code: "QT-11-1", name: t("Truy cập") },
          { code: "QT-11-2", name: t("Tạo mới") },
          { code: "QT-11-3", name: t("Sửa") },
          { code: "QT-11-4", name: t("Xóa") },
          { code: "QT-11-5", name: t("Nạp mPoint") },
          { code: "QT-11-6", name: t("Rút mPoint") },
        ],
      },
      {
        code: "QT-12",
        name: t("Giao dịch mPoint"),
        scopes: [
          { code: "QT-12-1", name: t("Truy cập") },
          { code: "QT-12-2", name: t("Tạo mới") },
          { code: "QT-12-3", name: t("Sửa") },
          { code: "QT-12-4", name: t("Xóa") },
        ],
      },
      {
        code: "WD-1",
        name: t("Quản lý rút ví"),
        scopes: [
          { code: "WD-1-1", name: t("Truy cập") },
          { code: "WD-1-2", name: t("Xử lý") },
        ],
      },
    ],
  },

  {
    code: "MARKETING",
    name: t("Truyền thông"),
    features: [
      {
        code: "TT-1",
        name: t("Tin tức"),
        scopes: [
          { code: "TT-1-1", name: t("Truy cập") },
          { code: "TT-1-2", name: t("Tạo mới") },
          { code: "TT-1-3", name: t("Cập nhật") },
          { code: "TT-1-4", name: t("Xóa") },
        ],
      },
    ],
  },

  {
    code: "CONFIG",
    name: t("Cấu hình sàn"),
    features: [
      {
        code: "QT-10",
        name: t("Phân quyền"),
        scopes: [
          { code: "QT-10-1", name: t("Truy cập") },
          { code: "QT-10-2", name: t("Tạo mới") },
          { code: "QT-10-3", name: t("Sửa") },
          { code: "QT-10-4", name: t("Xóa") },
        ],
      },
      {
        code: "QT-18",
        name: t("Báo cáo"),
        scopes: [{ code: "QT-18-1", name: t("Truy cập") }],
      },
      {
        code: "QT-19",
        name: t("Hỗ trợ shop"),
        scopes: [
          { code: "QT-19-1", name: t("Truy cập") },
          { code: "QT-19-2", name: t("Cập nhật") },
          { code: "QT-19-3", name: t("Xóa") },
        ],
      },
      {
        code: "QT-9",
        name: t("Cấu hình"),
        scopes: [
          { code: "QT-9-1", name: t("Truy cập") },
          { code: "QT-9-2", name: t("Sửa") },
        ],
      },
      {
        code: "CR-1",
        name: t("Chứng chỉ"),
        scopes: [
          { code: "CR-1-1", name: t("Truy cập") },
          { code: "CR-1-2", name: t("Sửa") },
        ],
      },
      {
        code: "SP-1",
        name: t("Nhà cung cấp vận chuyển"),
        scopes: [
          { code: "SP-1-1", name: t("Truy cập") },
          { code: "SP-1-2", name: t("Tạo mới") },
          { code: "SP-1-3", name: t("Sửa") },
          { code: "SP-1-4", name: t("Xóa") },
        ],
      },
    ],
  },
];
