import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { Types } from "mongoose";
import { BaseCommand, BaseUsecase } from "../../core";

import { OrderStatusEnum, PaymentStatus } from "../../dal/order/order.interface";
import { OrderModel } from "../../dal/order/order.model";
import { ShipmentStatusEnum } from "../../dal/shipment/shipment.interface";
import { ShipmentModel } from "../../dal/shipment/shipment.model";
import { shipmentService } from "../../dal/shipment/shipment.service";
import { ShippingProviderModel } from "../../dal/shippingProvider/shippingProvider.model";
import { ShopAddressModel } from "../../dal/shopAddress/shopAddress.model";
import { CreateShippingOrderData } from "../../providers/shipping/shipping-provider.adapter";
import { ShippingProviderFactory } from "../../providers/shipping/shipping-provider.factory";

/**
 * Usecase: Tạo đơn vận chuyển với nhà cung cấp
 *
 * Flow:
 * 1. Validate input (orderId, provider code)
 * 2. Lấy thông tin order từ database
 * 3. Tạo shipment draft trong database
 * 4. Gọi API nhà cung cấp để tạo đơn
 * 5. Cập nhật shipment với tracking code
 * 6. Cập nhật order với shipmentId
 * 7. Trả về kết quả
 */
export namespace CreateShippingOrder {
  /**
   * Command input cho usecase
   */
  export class Command extends BaseCommand {
    @IsNotEmpty({ message: "orderId không được để trống" })
    @IsString({ message: "orderId phải là string" })
    orderId: string;

    @IsNotEmpty({ message: "provider không được để trống" })
    @IsString({ message: "provider phải là string" })
    shippingProviderId: string; //

    @IsNotEmpty()
    @IsString({ message: "shopAddressId phải là string" })
    shopAddressId?: string;

    @IsOptional()
    @IsString({ message: "serviceCode phải là string" })
    serviceCode?: string; // EXPRESS, STANDARD, etc.

    @IsOptional()
    @IsNumber({}, { message: "serviceTypeId phải là số" })
    serviceTypeId?: number; // 2: Hàng nhẹ, 5: Hàng nặng

    @IsOptional()
    @IsNumber({}, { message: "insuranceValue phải là số" })
    insuranceValue?: number;

    @IsOptional()
    @IsString({ message: "note phải là string" })
    note?: string;

    @IsOptional()
    @IsNumber({}, { message: "totalItemsWeight phải là số" })
    totalItemsWeight?: number; // Tổng khối lượng sản phẩm (gram)

    @IsOptional()
    @IsNumber({}, { message: "packageWeight phải là số" })
    packageWeight?: number; // Khối lượng thùng đóng gói (gram)

    @IsOptional()
    @IsNumber()
    length?: number;

    @IsOptional()
    @IsNumber()
    width?: number;

    @IsOptional()
    @IsNumber()
    height?: number;
  }

  /**
   * Usecase implementation
   */
  class CreateShippingOrderUsecase extends BaseUsecase {
    async execute(cmd: Command) {
      const {
        orderId,
        shippingProviderId,
        serviceCode,
        serviceTypeId,
        insuranceValue,
        note,
        totalItemsWeight,
        packageWeight,
        length,
        width,
        height,
      } = cmd;

      try {
        // 1. Validate và lấy thông tin order
        const order = await OrderModel.findById(orderId).populate("productId");
        if (!order) {
          throw new Error("Đơn hàng không tồn tại");
        }
        if (order.paymentStatus !== PaymentStatus.PAYMENT_SUCCESS) {
          throw new Error("Đơn hàng chưa thanh toán");
        }
        const provider = await ShippingProviderModel.findById(shippingProviderId);

        // 2. Kiểm tra xem provider có được hỗ trợ không
        if (!ShippingProviderFactory.isSupportedProvider(provider.code)) {
          throw new Error(`Nhà cung cấp ${provider.name} chưa được hỗ trợ`);
        }
        const shopAddress = await ShopAddressModel.findById(cmd.shopAddressId);
        if (!shopAddress || !shopAddress.isActive) {
          throw new Error("Địa chỉ shop không tồn tại");
        }

        // 3. Chuẩn bị dữ liệu để tạo shipment draft
        const shipmentData = {
          orderId: new Types.ObjectId(orderId),
          provider: provider.code,
          serviceCode: serviceCode,
          status: ShipmentStatusEnum.DRAFT,
          codAmount: 0,
          shippingFee: order.shippingFee,
          insuranceValue: insuranceValue || order.totalAmount,

          // Thông tin người gửi (từ shop)
          sender: {
            name: shopAddress.recipientName,
            phone: shopAddress.phone,
            address: shopAddress.address,
            ward: shopAddress.ward,
            district: shopAddress.district,
            province: shopAddress.province,
          },

          // Thông tin người nhận (từ shipping address của order)
          receiver: {
            name: order.shippingAddress.recipientName,
            phone: order.shippingAddress.phone,
            address: order.shippingAddress.address,
            ward: order.shippingAddress.ward,
            district: order.shippingAddress.district,
            province: order.shippingAddress.province,
          },

          note: note || order.customerNote || "",
        };

        // 4. Tạo shipment draft trong database
        const shipment = await ShipmentModel.create(shipmentData);

        // 5. Tạo adapter cho provider
        const adapter = await ShippingProviderFactory.createAdapter(provider.code);

        // 6. Chuẩn bị data để gọi API nhà cung cấp
        const createOrderData: CreateShippingOrderData = {
          fromName: shipmentData.sender.name,
          fromPhone: shipmentData.sender.phone,
          fromAddress: shipmentData.sender.address,
          fromWard: shipmentData.sender.ward,
          fromDistrict: shipmentData.sender.district,
          fromProvince: shipmentData.sender.province,

          toName: shipmentData.receiver.name,
          toPhone: shipmentData.receiver.phone,
          toAddress: shipmentData.receiver.address,
          toWard: shipmentData.receiver.ward,
          toDistrict: shipmentData.receiver.district,
          toProvince: shipmentData.receiver.province,

          codAmount: shipmentData.codAmount,
          insuranceValue: shipmentData.insuranceValue,
          serviceCode: serviceCode,
          serviceTypeId: serviceTypeId || 2, // Mặc định: 2 = Hàng nhẹ
          note: shipmentData.note,
          weight: totalItemsWeight || 0,
          packageWeight: packageWeight || 0,
          length: length || 0,
          width: width || 0,
          height: height || 0,
        };

        // 7. Gọi API nhà cung cấp
        const result = await adapter.createShippingOrder(createOrderData);

        // 8. Cập nhật shipment dựa trên kết quả
        if (result.success && result.trackingCode) {
          // Chuẩn bị dữ liệu cập nhật cơ bản
          const updateData: any = {
            trackingCode: result.trackingCode,
            providerResponse: result.data,
            status: ShipmentStatusEnum.CREATED,
          };

          // Sử dụng standardizedData nếu có (đã được chuẩn hóa từ adapter)
          if (result.standardizedData) {
            const std = result.standardizedData;

            // Cập nhật các thông tin đã được chuẩn hóa
            if (std.orderCode) updateData.orderCode = std.orderCode;
            if (std.sortCode) updateData.sortCode = std.sortCode;
            if (std.transType) updateData.transType = std.transType;
            if (std.wardEncode) updateData.wardEncode = std.wardEncode;
            if (std.districtEncode) updateData.districtEncode = std.districtEncode;

            // Cập nhật chi tiết phí
            if (std.feeBreakdown) {
              updateData.feeBreakdown = std.feeBreakdown;
            }

            // Cập nhật tổng phí
            if (std.totalFee) {
              updateData.totalFee = std.totalFee;
            }

            // Cập nhật thời gian giao hàng dự kiến
            if (std.estimatedDeliveryDate) {
              updateData.estimatedDeliveryDate = std.estimatedDeliveryDate;
            }
          }

          // Cập nhật shipment
          await ShipmentModel.findByIdAndUpdate(shipment.id, updateData);

          // Cập nhật order với shipmentId
          await OrderModel.findByIdAndUpdate(orderId, {
            $set: {
              shipmentId: shipment.id,
              status: OrderStatusEnum.SHIPPING_STARTED,
            },
            $push: {
              shipmentIds: shipment._id,
              orderLogs: {
                status: OrderStatusEnum.SHIPPING_STARTED,
                des: "Cửa hàng đã tạo đơn vận chuyển",
                createdAt: new Date(),
              },
            },
          });

          return {
            success: true,
            message: "Tạo đơn vận chuyển thành công",
            shipmentId: shipment.id,
            trackingCode: result.trackingCode,
            data: result.data,
          };
        } else {
          // Nếu tạo đơn thất bại, cập nhật trạng thái shipment
          await shipmentService.updateShipmentStatus(
            shipment.id,
            ShipmentStatusEnum.FAILED,
            result.message
          );

          throw new Error(result.message || "Tạo đơn vận chuyển thất bại");
        }
      } catch (error: any) {
        throw new Error(error.message || "Có lỗi xảy ra khi tạo đơn vận chuyển");
      }
    }

    /**
     * Tính tổng khối lượng từ items + thùng đóng gói
     * Ưu tiên sử dụng giá trị từ frontend (totalItemsWeight + packageWeight)
     * Nếu không có thì tính mặc định
     */
    private calculateTotalWeight(
      items: any[],
      totalItemsWeight?: number,
      packageWeight?: number
    ): number {
      // Nếu có totalItemsWeight từ frontend, sử dụng luôn
      if (totalItemsWeight !== undefined && totalItemsWeight !== null) {
        const packageWt = packageWeight || 0;
        return totalItemsWeight + packageWt;
      }

      // Nếu không có, tính mặc định (mỗi sản phẩm 500g)
      const itemsWeight = items.reduce((total, item) => {
        return total + item.quantity * item.weight;
      }, 0);

      return itemsWeight + (packageWeight || 0);
    }
  }

  export const usecase = new CreateShippingOrderUsecase();
}
