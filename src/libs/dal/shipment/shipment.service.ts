import { CRUDService } from "../../../base/crudService";
import { IShipment } from "./shipment.interface";
import { ShipmentModel } from "./shipment.model";

/**
 * Service xử lý nghiệp vụ cho Shipment (đơn vận chuyển)
 */
class ShipmentService extends CRUDService(ShipmentModel) {
  /**
   * Lấy tất cả shipments theo orderId
   * @param orderId - ID của đơn hàng
   * @returns Danh sách shipments
   */
  async getShipmentsByOrderId(orderId: string): Promise<IShipment[]> {
    return await this.model.find({ orderId }).sort({ createdAt: -1 });
  }

  /**
   * Lấy shipment theo tracking code
   * @param trackingCode - Mã vận đơn
   * @returns Shipment tìm được
   */
  async getShipmentByTrackingCode(trackingCode: string): Promise<IShipment | null> {
    return await this.model.findOne({ trackingCode });
  }

  /**
   * Cập nhật trạng thái shipment
   * @param shipmentId - ID của shipment
   * @param status - Trạng thái mới
   * @param note - Ghi chú (optional)
   * @returns Shipment đã cập nhật
   */
  async updateShipmentStatus(
    shipmentId: string,
    status: string,
    note?: string
  ): Promise<IShipment | null> {
    const shipment = await this.model.findById(shipmentId);
    if (!shipment) return null;

    shipment.status = status as any;
    if (note) shipment.note = note;

    return await shipment.save();
  }

  /**
   * Cập nhật tracking code sau khi tạo đơn thành công
   * @param shipmentId - ID của shipment
   * @param trackingCode - Mã vận đơn từ nhà cung cấp
   * @param providerResponse - Response từ API nhà cung cấp
   * @returns Shipment đã cập nhật
   */
  async updateTrackingCode(
    shipmentId: string,
    trackingCode: string,
    providerResponse?: any
  ): Promise<IShipment | null> {
    return await this.model.findByIdAndUpdate(
      shipmentId,
      {
        trackingCode,
        providerResponse,
        status: "created", // Cập nhật trạng thái sang "created"
      },
      { new: true }
    );
  }

  /**
   * Thêm log cho shipment
   * @param shipmentId - ID của shipment
   * @param log - Thông tin log
   * @returns Shipment đã cập nhật
   */
  async addShipmentLog(
    shipmentId: string,
    log: {
      status: string;
      description?: string;
      location?: string;
      note?: string;
      metadata?: any;
    }
  ): Promise<IShipment | null> {
    return await this.model.findByIdAndUpdate(
      shipmentId,
      {
        $push: {
          logs: {
            ...log,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );
  }
}

export const shipmentService = new ShipmentService();
