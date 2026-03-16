import { useRouter } from "next/router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiMinus, HiPlus, HiShoppingCart, HiTrash } from "react-icons/hi";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useCart } from "../../../lib/providers/cart-provider";

import { useToast } from "../../../lib/providers/toast-provider";
import { Cart } from "../../../lib/repo/cart";
import { Order, orderService, PaymentMethod } from "../../../lib/repo/order/order.repo";
import { Button, Checkbox, Field, Form, Input, Textarea } from "../../shared/utilities/form";
import { Img, Spinner } from "../../shared/utilities/misc";
import { CheckoutProvider, useCheckoutContext } from "../checkout/provider/checkout-provider";
import { AddressSelector } from "./address-selector";

export default function CartPage() {
  return (
    <CheckoutProvider>
      <CartComponent />
    </CheckoutProvider>
  );
}
const CartComponent = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { customer } = useAuth();
  const { cartItems, loading, updateQuantity, toggleSelection, removeItem } = useCart();
  const { createOrder, loading: orderLoading } = useCheckoutContext();

  const [updating, setUpdating] = useState<string | null>(null);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestInfo, setGuestInfo] = useState({
    recipientName: "",
    phone: "",
    email: "",
    address: "",
    note: "",
    province: "",
    district: "",
    ward: "",
  });

  // Update guestInfo when customer data is loaded
  // useEffect(() => {
  //   setGuestInfo((prev) => ({
  //     ...prev,
  //     recipientName: customer?.name || guestCustomerName || "",
  //     phone: customer?.phoneNumber || guestCustomerPhone || "",
  //     email: customer?.email || guestCustomerEmail || "",
  //     address: customer?.address || guestCustomerAddress || "",
  //     province: customer?.province || guestCustomerProvince || "",
  //     district: customer?.district || guestCustomerDistrict || "",
  //     ward: customer?.ward || guestCustomerWard || "",
  //   }));
  // }, [customer, guestCustomerEmail, guestCustomerName, guestCustomerPhone]);

  const handleQuantityChange = async (item: Cart, newQuantity: number) => {
    if (newQuantity < 1) return;
    if (item.maxQuantity && newQuantity > item.maxQuantity) {
      toast.error(t("Số lượng vượt quá tồn kho"));
      return;
    }

    try {
      setUpdating(item.id);
      await updateQuantity(item.id, newQuantity);
    } catch (error) {
      console.error("Update quantity error:", error);
      toast.error(t("Không thể cập nhật số lượng"));
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleSelection = async (item: Cart) => {
    try {
      setUpdating(item.id);
      await toggleSelection(item.id);
    } catch (error) {
      console.error("Toggle selection error:", error);
      toast.error(t("Không thể cập nhật"));
    } finally {
      setUpdating(null);
    }
  };

  const handleRemoveItem = async (item: Cart) => {
    try {
      setUpdating(item.id);
      await removeItem(item.id);
      toast.success(t("Đã xóa sản phẩm khỏi giỏ hàng"));
    } catch (error) {
      console.error("Remove item error:", error);
      toast.error(t("Không thể xóa sản phẩm"));
    } finally {
      setUpdating(null);
    }
  };

  const handleGuestCheckout = async (data: any) => {
    await createOrderAndRedirect(data);
  };

  const createOrderAndRedirect = async (data?: Order) => {
    try {
      const selectedItems = cartItems.filter((item) => item.isSelected);
      const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const orderData: Order = {
        items: selectedItems.map((item) => ({
          variantId: item.variantId,
          sku: item.sku,
          productName: item.productName,
          variantName: item.variantName,
          thumbnail: item.thumbnail,
          price: item.price,
          originalPrice: item.originalPrice,
          quantity: item.quantity,
          subtotal,
        })),
        shippingAddress: {
          recipientName: data.recipientName,
          phone: data.phone,
          email: data.email,
          address: data.address, // Will be filled in checkout page
          province: data.province,
          district: data.district,
          ward: data.ward,

          country: "Vietnam",
          note: data.note,
        },
        productId: selectedItems[0]?.productId,
        paymentMethod: PaymentMethod.BANK,
        shippingFee: 0,
        cartIds: selectedItems.map((item) => item.id),
      };
      await orderService.clearStore();
      // const result = await createOrder(orderData);
      // // Set cookie phone and email for guest checkout

      // if (result && result.order) {
      //   // Navigate to checkout page with order ID
      //   router.push(`/checkout?orderId=${result.order.id}`);
      // }
    } catch (error: any) {
      console.error("Create order error:", error);
      toast.error(error.message || t("Không thể tạo đơn hàng"));
    }
  };

  const selectedItems = cartItems.filter((item) => item.isSelected);
  const totalAmount = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleSelectAll = async () => {
    const allSelected = cartItems.every((item) => item.isSelected);
    try {
      for (const item of cartItems) {
        if (item.isSelected === allSelected) {
          await toggleSelection(item.id);
        }
      }
    } catch (error) {
      console.error("Select all error:", error);
      toast.error(t("Không thể cập nhật"));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center px-4 min-h-screen">
        <HiShoppingCart className="w-24 h-24 text-gray-300" />
        <h2 className="text-2xl font-semibold text-gray-600">{t("Giỏ hàng trống")}</h2>
        <Button primary text={t("Tiếp tục mua sắm")} onClick={() => router.push("/")} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-7xl">
        <h1 className="-mt-7 mb-6 text-xl font-bold lg:mt-0">{t("Giỏ hàng")}</h1>

        {/* Desktop Layout */}
        <div className="hidden lg:block">
          <div className="mb-4 bg-white rounded-lg shadow-sm">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 p-4 font-semibold text-gray-700 border-b">
              <div className="flex col-span-6 items-center">
                <Checkbox
                  value={cartItems.every((item) => item.isSelected)}
                  onChange={handleSelectAll}
                  className="mr-2"
                />
                {t("Sản phẩm")}
              </div>
              <div className="col-span-2 text-center">{t("Đơn giá")}</div>
              <div className="col-span-2 text-center">{t("Số lượng")}</div>
              <div className="col-span-2 text-right">{t("Số tiền")}</div>
            </div>

            {/* Cart Items */}
            {cartItems.map((item) => (
              <div
                key={item.id}
                className={`grid grid-cols-12 gap-4 p-4 border-b items-center ${
                  updating === item.id ? "opacity-50" : ""
                }`}
              >
                <div className="flex col-span-6 gap-4">
                  <div className="flex items-center">
                    <Checkbox
                      value={item.isSelected}
                      onChange={() => handleToggleSelection(item)}
                      readOnly={updating === item.id}
                    />
                    <Img
                      src={item.thumbnail}
                      className="object-cover w-20 h-20 rounded"
                      alt={item.productName}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{item.productName}</h3>
                    {item.variantName && (
                      <p className="text-sm text-gray-500">
                        {t("Phân loại")}: {item.variantName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="col-span-2 text-center">
                  <div className="font-semibold text-primary">{item.price.toLocaleString()}đ</div>
                  {item.originalPrice && item.originalPrice > item.price && (
                    <div className="text-sm text-gray-400 line-through">
                      {item.originalPrice.toLocaleString()}đ
                    </div>
                  )}
                </div>

                <div className="flex col-span-2 gap-2 justify-center items-center">
                  <button
                    className="flex justify-center items-center w-8 h-8 rounded border hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => handleQuantityChange(item, item.quantity - 1)}
                    disabled={item.quantity <= 1 || updating === item.id}
                  >
                    <HiMinus />
                  </button>
                  <span className="w-12 text-center">{item.quantity}</span>
                  <button
                    className="flex justify-center items-center w-8 h-8 rounded border hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => handleQuantityChange(item, item.quantity + 1)}
                    disabled={
                      (item.maxQuantity && item.quantity >= item.maxQuantity) ||
                      updating === item.id
                    }
                  >
                    <HiPlus />
                  </button>
                </div>

                <div className="flex col-span-2 gap-4 justify-end items-center">
                  <span className="font-bold text-primary">
                    {(item.price * item.quantity).toLocaleString()}đ
                  </span>
                  <button
                    className="text-red-500 hover:text-red-700 disabled:opacity-50"
                    onClick={() => handleRemoveItem(item)}
                    disabled={updating === item.id}
                  >
                    <HiTrash className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="space-y-4 lg:hidden">
          {cartItems.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-lg shadow-sm p-4 ${
                updating === item.id ? "opacity-50" : ""
              }`}
            >
              <div className="flex gap-3 mb-3">
                <div className="flex items-center">
                  <Checkbox
                    value={item.isSelected}
                    onChange={() => handleToggleSelection(item)}
                    readOnly={updating === item.id}
                    className="mt-1"
                  />
                  <Img
                    src={item.thumbnail}
                    className="object-cover flex-shrink-0 w-20 h-20 rounded"
                    alt={item.productName}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Xuống 2 hàng mới ... */}

                  <h3 className="font-semibold text-gray-800 overflow-ellipsis text-ellipsis-2">
                    {item.productName}
                  </h3>
                  {item.variantName && (
                    <p className="text-sm text-gray-500 truncate">
                      {t("Phân loại")}: {item.variantName}
                    </p>
                  )}
                  <div className="flex gap-2 items-center mt-1">
                    <span className="font-semibold text-primary">
                      {item.price.toLocaleString()}đ
                    </span>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span className="text-xs text-gray-400 line-through">
                        {item.originalPrice.toLocaleString()}đ
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex gap-2 items-center">
                  <button
                    className="flex justify-center items-center w-8 h-8 rounded border hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => handleQuantityChange(item, item.quantity - 1)}
                    disabled={item.quantity <= 1 || updating === item.id}
                  >
                    <HiMinus />
                  </button>
                  <span className="w-12 text-center">{item.quantity}</span>
                  <button
                    className="flex justify-center items-center w-8 h-8 rounded border hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => handleQuantityChange(item, item.quantity + 1)}
                    disabled={
                      (item.maxQuantity && item.quantity >= item.maxQuantity) ||
                      updating === item.id
                    }
                  >
                    <HiPlus />
                  </button>
                </div>

                <div className="flex gap-3 items-center">
                  <span className="font-bold text-primary">
                    {(item.price * item.quantity).toLocaleString()}đ
                  </span>
                  <button
                    className="p-2 text-red-500 hover:text-red-700 disabled:opacity-50"
                    onClick={() => handleRemoveItem(item)}
                    disabled={updating === item.id}
                  >
                    <HiTrash className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Checkout Section */}
        <div className="sticky bottom-0 p-4 mt-4 bg-white rounded-lg shadow-sm lg:static">
          <Form onSubmit={handleGuestCheckout} defaultValues={guestInfo}>
            {/* Guest Information Form */}
            {showGuestForm && <DeliveryInfoField note={guestInfo.note} />}
            <div className="flex flex-row flex-wrap gap-4 justify-between items-center">
              <div className="flex gap-2 items-center">
                <Checkbox
                  value={cartItems.every((item) => item.isSelected)}
                  onChange={handleSelectAll}
                  className="whitespace-nowrap"
                  placeholder={`${t("Chọn tất cả")} (${cartItems.length})`}
                />
              </div>

              <div className="flex flex-wrap gap-4 justify-end items-center w-full sm:w-auto">
                <div className="flex-1 text-right whitespace-nowrap sm:flex-none">
                  <div className="text-sm text-gray-600">
                    {t("Tổng thanh toán")} ({totalItems} {t("sản phẩm")}):
                  </div>
                  <div className="text-xl font-bold text-primary">
                    {totalAmount.toLocaleString()}đ
                  </div>
                </div>
                {showGuestForm ? (
                  <div className={showGuestForm ? "w-48" : ""}>
                    <Form.Footer
                      cancelText={showGuestForm ? t("Hủy") : ""}
                      cancelProps={{
                        onClick: () => {
                          setShowGuestForm(false);
                        },
                      }}
                      submitProps={{
                        disabled: selectedItems.length === 0 || orderLoading,
                        isLoading: orderLoading,
                      }}
                      submitText={t("Thanh toán")}
                    />
                  </div>
                ) : (
                  <Button primary text={t("Mua hàng")} onClick={() => setShowGuestForm(true)} />
                )}
              </div>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
};

const DeliveryInfoField = ({ note }: { note: string }) => {
  const { t } = useTranslation();

  return (
    <>
      <h2 className="mb-4 text-lg font-semibold">{t("Thông tin giao hàng")}</h2>
      <div className="grid grid-cols-12 gap-x-4">
        <Field
          name="recipientName"
          label={t("Họ và tên")}
          required
          className="col-span-12 md:col-span-4"
        >
          <Input placeholder={t("Nhập họ và tên")} />
        </Field>
        <Field
          name="phone"
          label={t("Số điện thoại")}
          required
          className="col-span-12 md:col-span-4"
          validation={{ phone: true }}
        >
          <Input placeholder={t("Nhập số điện thoại")} />
        </Field>
        <Field
          name="email"
          label="Email"
          validation={{ email: true }}
          required
          className="col-span-12 md:col-span-4"
        >
          <Input type="email" placeholder={t("Nhập email")} />
        </Field>

        <AddressSelector />

        <Field name="note" label={t("Ghi chú cho đơn hàng")} className="col-span-12">
          <Textarea value={note} placeholder={t("Nhập ghi chú cho đơn hàng")} />
        </Field>
      </div>
    </>
  );
};
