import { Column, Entity, OneToMany } from 'typeorm'

import { Base, type BaseProps } from './Base'
import { Product } from './Product'

@Entity({ name: 'categories' })
export class Category extends Base {
  @Column({ unique: true, type: 'varchar' })
  name: string

  @Column({ type: 'varchar', nullable: true })
  description: string | null

  @OneToMany(() => Product, (product) => product.category)
  products?: Product[]

  constructor(category: BaseProps<Category>) {
    super()
    if (category) {
      Object.assign(this, {
        ...category,
        products: category.products || [],
      })
    }
  }
}
