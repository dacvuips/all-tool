import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { CartCookieHelper } from "../helpers/cart-cookie.helper";
import { Cart, CartService } from "../repo/cart/cart.repo";
import { useAuth } from "./auth-provider";

interface CartContextValue {
  cartItems: Cart[];
  cartCount: number;
  loading: boolean;
  refreshCart: () => Promise<void>;
  addToCart: (data: any) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  toggleSelection: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue>({
  cartItems: [],
  cartCount: 0,
  loading: false,
  refreshCart: async () => {},
  addToCart: async () => {},
  updateQuantity: async () => {},
  removeItem: async () => {},
  toggleSelection: async () => {},
  clearCart: async () => {},
});

export const useCart = () => useContext(CartContext);

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const { customer } = useAuth();
  const [cartItems, setCartItems] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    refreshCart();
  }, [customer]);

  useEffect(() => {
    // Sync cart when user logs in
    if (customer) {
      syncCartOnLogin();
    }
  }, [customer]);

  const syncCartOnLogin = async () => {
    const sessionId = CartCookieHelper.getSessionId();
    if (sessionId) {
      try {
        await CartService.syncCartFromSession(sessionId);
        CartCookieHelper.clearSessionId();
        await refreshCart();
      } catch (error) {
        console.error("Sync cart error:", error);
      }
    }
  };

  const refreshCart = async () => {
    try {
      setLoading(true);
      const items = await CartService.getMyCart();

      setCartItems(items || []);
    } catch (error) {
      console.error("Load cart error:", error);
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (data: any) => {
    await CartService.addToCart({ ...data });
    await refreshCart();
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    const item = cartItems.find((i) => i.id === itemId);
    if (!item) return;
    await CartService.updateCartItem(itemId, quantity, item.isSelected);
    await refreshCart();
  };

  const removeItem = async (itemId: string) => {
    await CartService.removeCartItem(itemId);
    await refreshCart();
  };

  const toggleSelection = async (itemId: string) => {
    await CartService.toggleCartItemSelection(itemId);
    await refreshCart();
  };

  const clearCart = async () => {
    await CartService.clearCart();
    await refreshCart();
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        loading,
        refreshCart,
        addToCart,
        updateQuantity,
        removeItem,
        toggleSelection,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
