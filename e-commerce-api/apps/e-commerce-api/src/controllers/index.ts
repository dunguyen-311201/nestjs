import {
  IAdminOrderController,
  IAuthController,
  ICartController,
  ICategoryController,
  ICheckoutController,
  IMetricController,
  IOrderController,
  IProductController,
} from './types'
import { IUserController } from './user/type'

export * from './base'
export * from './auth'
export * from './product'
export * from './cart'
export * from './category'
export * from './checkout'
export * from './order'
export * from './admin-order'
export * from './metric'
export * from './user'

export type TControllers = {
  adminOrderController: IAdminOrderController
  authController: IAuthController
  productController: IProductController
  cartController: ICartController
  categoryController: ICategoryController
  checkoutController: ICheckoutController
  orderController: IOrderController
  metricController: IMetricController
  userController: IUserController
}
