import { gql } from "apollo-server-express";

export default {
  schema: gql`
    type Place {
      "Tên đường"
      street: String
      "Tỉnh / thành"
      province: String
      "Mã Tỉnh / thành"
      provinceId: String
      "Quận / huyện"
      district: String
      "Mã quận / huyện"
      districtId: String
      "Phường / xã"
      ward: String
      "Mã phường / xã"
      wardId: String
      "Địa chỉ đầy đủ"
      fullAddress: String
      "Toạ độ"
      location: Mixed
      "Ghi chú"
      note: String
    }
    input PlaceInput {
      "Tên đường"
      street: String
      "Tỉnh / thành"
      province: String
      "Mã Tỉnh / thành"
      provinceId: String
      "Quận / huyện"
      district: String
      "Mã quận / huyện"
      districtId: String
      "Phường / xã"
      ward: String
      "Mã phường / xã"
      wardId: String
      "Địa chỉ đầy đủ"
      fullAddress: String
      "Toạ độ"
      location: Mixed
      "Ghi chú"
      note: String
    }
  `,
  resolver: {},
};
