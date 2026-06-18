export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
}

export interface OrderProcessPayload {
  orderId: string;
  success: boolean;
  message: string;
}
