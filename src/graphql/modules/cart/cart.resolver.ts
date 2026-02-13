import { TOKEN_ROLES } from "../../../constants/role.const";
import { cartService } from "../../../libs/dal/cart";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllCart: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return cartService.fetch(args.q);
  },
  getOneCart: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await cartService.findOne({ _id: id });
  },
  getMyCart: async (root: any, args: any, context: Context) => {
    const customerId = context.isCustomer ? context.customerId : null;
    const sessionId = context.req.cookies?.cartSessionId;

    return await cartService.getMyCart(customerId, sessionId);
  },
};

const Mutation = {
  addToCart: async (root: any, args: any, context: Context) => {
    const { data } = args;
    const customerId = context.isCustomer ? context.customerId : null;

    // Use sessionId from cookie if not provided
    if (!data.sessionId) {
      data.sessionId = context.req.cookies?.cartSessionId;
      if (!data.sessionId) {
        throw new Error("Session ID is required for guest users");
      }
    }

    return await cartService.addToCart(data, customerId);
  },
  updateCartItem: async (root: any, args: any, context: Context) => {
    const { id, data } = args;
    const customerId = context.isCustomer ? context.customerId : null;
    const sessionId = context.req.cookies?.cartSessionId;

    // Verify ownership
    const cartItem = await cartService.findOne({ _id: id });
    if (!cartItem) {
      throw new Error("Cart item not found");
    }

    const isOwner = customerId
      ? cartItem.customerId?.toString() === customerId
      : cartItem.sessionId === sessionId;

    if (!isOwner) {
      throw new Error("Unauthorized");
    }

    return await cartService.updateCartItem(id, data);
  },
  removeCartItem: async (root: any, args: any, context: Context) => {
    const { id } = args;
    const customerId = context.isCustomer ? context.customerId : null;
    const sessionId = context.req.cookies?.cartSessionId;

    // Verify ownership
    const cartItem = await cartService.findOne({ _id: id });
    if (!cartItem) {
      throw new Error("Cart item not found");
    }

    const isOwner = customerId
      ? cartItem.customerId?.toString() === customerId
      : cartItem.sessionId === sessionId;

    if (!isOwner) {
      throw new Error("Unauthorized");
    }

    return await cartService.removeCartItem(id);
  },
  toggleCartItemSelection: async (root: any, args: any, context: Context) => {
    const { id } = args;
    const customerId = context.isCustomer ? context.customerId : null;
    const sessionId = context.req.cookies?.cartSessionId;

    // Verify ownership
    const cartItem = await cartService.findOne({ _id: id });
    if (!cartItem) {
      throw new Error("Cart item not found");
    }

    const isOwner = customerId
      ? cartItem.customerId?.toString() === customerId
      : cartItem.sessionId === sessionId;

    if (!isOwner) {
      throw new Error("Unauthorized");
    }

    return await cartService.toggleSelection(id);
  },
  syncCartFromSession: async (root: any, args: any, context: Context) => {
    const { sessionId } = args;
    const customerId = context.isCustomer ? context.customerId : null;

    if (!customerId) {
      throw new Error("Must be logged in to sync cart");
    }

    return await cartService.syncCartFromSession(sessionId, customerId);
  },
  clearCart: async (root: any, args: any, context: Context) => {
    const customerId = context.isCustomer ? context.customerId : null;
    const sessionId = context.req.cookies?.cartSessionId;

    await cartService.clearCart(customerId, sessionId);
    return { success: true };
  },
};

const Cart = {};

export default {
  Query,
  Mutation,
  Cart,
};
