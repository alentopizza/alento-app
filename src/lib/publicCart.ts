import type { OrderLineConfiguration } from "@/lib/orderConfiguration";

export const PUBLIC_CART_STORAGE_KEY = "alento-cart-v1";

export type PublicCartItem = {
  key: string;
  productId: number;
  name: string;
  imageUrl: string | null;
  detail?: string;
  unitPrice: number;
  quantity: number;
  configuration?: OrderLineConfiguration;
  notes?: string;
};
