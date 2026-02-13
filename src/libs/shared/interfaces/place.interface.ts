export type Place = {
  street?: string; // Tên đường
  province?: string; // Tỉnh / thành
  provinceId?: string; // Mã Tỉnh / thành
  district?: string; // Quận / huyện
  districtId?: string; // Mã quận / huyện
  ward?: string; // Phường / xã
  wardId?: string; // Mã phường / xã
  fullAddress?: string; // Địa chỉ đầy đủ
  location?: any; // Toạ độ
  note?: string; // Ghi chú
};
