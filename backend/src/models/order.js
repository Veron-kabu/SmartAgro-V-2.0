const { sql } = require("../config/database")

class Order {
  static async create(orderData) {
    const { buyerId, farmerId, totalAmount, deliveryAddress, deliveryDate, notes } = orderData

    const result = await sql`
      INSERT INTO orders (buyer_id, farmer_id, total_amount, delivery_address, delivery_date, notes)
      VALUES (${buyerId}, ${farmerId}, ${totalAmount}, ${deliveryAddress}, ${deliveryDate}, ${notes})
      RETURNING *
    `
    return result[0]
  }

  static async findById(id) {
    const result = await sql`
      SELECT o.*, 
             b.username as buyer_name, b.full_name as buyer_full_name,
             f.username as farmer_name, f.full_name as farmer_full_name
      FROM orders o
      JOIN users b ON o.buyer_id = b.id
      JOIN users f ON o.farmer_id = f.id
      WHERE o.id = ${id}
    `
    return result[0]
  }

  static async findByBuyerId(buyerId) {
    const result = await sql`
      SELECT o.*, f.username as farmer_name, f.full_name as farmer_full_name
      FROM orders o
      JOIN users f ON o.farmer_id = f.id
      WHERE o.buyer_id = ${buyerId}
      ORDER BY o.created_at DESC
    `
    return result
  }

  static async findByFarmerId(farmerId) {
    const result = await sql`
      SELECT o.*, b.username as buyer_name, b.full_name as buyer_full_name
      FROM orders o
      JOIN users b ON o.buyer_id = b.id
      WHERE o.farmer_id = ${farmerId}
      ORDER BY o.created_at DESC
    `
    return result
  }

  static async updateStatus(id, status) {
    const result = await sql`
      UPDATE orders 
      SET status = ${status}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `
    return result[0]
  }

  static async addOrderItem(orderItemData) {
    const { orderId, productId, quantity, unitPrice, totalPrice } = orderItemData

    const result = await sql`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
      VALUES (${orderId}, ${productId}, ${quantity}, ${unitPrice}, ${totalPrice})
      RETURNING *
    `
    return result[0]
  }

  static async getOrderItems(orderId) {
    const result = await sql`
      SELECT oi.*, p.name as product_name, p.unit
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${orderId}
    `
    return result
  }
}

module.exports = Order
