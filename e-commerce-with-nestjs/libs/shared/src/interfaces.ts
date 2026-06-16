export interface Inventory {
  id: string;
  name: string;
  quantity: number;
}

export enum OrderStatus {
  PENDING = 'Pending',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}
export interface Order {
  id: string;
  name: string;
  product: string;
  price: number;
  status: OrderStatus;
  quantity: number;
}

export interface OrderProcessPayload {
  orderId: string;
  success: boolean;
  message: string;
}
