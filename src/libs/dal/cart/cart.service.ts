import { Types } from "mongoose";
import { CRUDService } from "../../../base/crudService";
import { ProductModel } from "../product/product.model";
import { ICart } from "./cart.interface";
import { CartModel } from "./cart.model";

class CartService extends CRUDService(CartModel) {
  async addToCart(data: Partial<ICart>, customerId?: string) {
    const query: any = {
      productId: data.productId,
      sessionId: data.sessionId,
      customerId: customerId ? new Types.ObjectId(customerId) : null,
    };

    if (!data.productId) {
      throw new Error("Product ID is required");
    }

    // Get product to check exist
    const product = await ProductModel.findById(data.productId);
    if (!product) {
      throw new Error("Sản phẩm không tồn tại");
    }

    // Check if item already exists in cart
    const existingItem = await CartModel.findOne(query);

    const requestedQuantity = data.quantity || 1;

    if (existingItem) {
      // Calculate new quantity
      const newQuantity = existingItem.quantity + requestedQuantity;

      // Update quantity
      existingItem.quantity = newQuantity;
      existingItem.price = data.price;
      existingItem.originalPrice = data.originalPrice;
      existingItem.promotion = data.promotion;
      existingItem.isValid = true;
      existingItem.stockCheckedAt = new Date();
      existingItem.priceCheckedAt = new Date();
      return await existingItem.save();
    }

    // Create new cart item
    const cartItem = new CartModel({
      ...data,
      customerId: customerId ? new Types.ObjectId(customerId) : null,
      quantity: requestedQuantity,
      isSelected: true,
      isValid: true,
      stockCheckedAt: new Date(),
      priceCheckedAt: new Date(),
    });

    return await cartItem.save();
  }

  async getMyCart(customerId?: string, sessionId?: string) {
    const query: any = {};

    if (customerId) {
      query.customerId = customerId;
    } else if (sessionId) {
      query.sessionId = sessionId;
      query.customerId = null;
    } else {
      return [];
    }

    return await CartModel.find(query).sort({ createdAt: -1 });
  }

  async updateCartItem(id: string, data: Partial<ICart>) {
    return await CartModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async removeCartItem(id: string) {
    return await CartModel.findByIdAndDelete(id);
  }

  async toggleSelection(id: string) {
    const item = await CartModel.findById(id);
    if (!item) throw new Error("Cart item not found");

    item.set("isSelected", !item.get("isSelected"));
    return await item.save();
  }

  async syncCartFromSession(sessionId: string, customerId: string) {
    // Find all cart items with sessionId
    const sessionItems = await CartModel.find({
      sessionId,
      customerId: null,
    });

    const syncedItems = [];

    for (const item of sessionItems) {
      // Check if customer already has this item
      const existingItem = await CartModel.findOne({
        customerId,
        productId: item.productId,
      });

      if (existingItem) {
        // Update quantity
        existingItem.quantity += item.quantity;
        existingItem.price = item.price;
        existingItem.originalPrice = item.originalPrice;
        existingItem.promotion = item.promotion;
        existingItem.stockCheckedAt = new Date();
        existingItem.priceCheckedAt = new Date();
        await existingItem.save();
        syncedItems.push(existingItem);

        // Remove session item
        await CartModel.findByIdAndDelete(item._id);
      } else {
        // Transfer to customer
        item.customerId = new Types.ObjectId(customerId);
        item.sessionId = null;
        item.stockCheckedAt = new Date();
        item.priceCheckedAt = new Date();
        await item.save();
        syncedItems.push(item);
      }
    }

    return syncedItems;
  }

  async clearCart(customerId?: string, sessionId?: string) {
    const query: any = {};

    if (customerId) {
      query.customerId = customerId;
    } else if (sessionId) {
      query.sessionId = sessionId;
      query.customerId = null;
    }

    return await CartModel.deleteMany(query);
  }
}

const cartService = new CartService();
export { cartService };
