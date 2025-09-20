const { sql } = require("../config/database")

class Product {
  static async create(productData) {
    const {
      farmerId,
      name,
      description,
      category,
      price,
      unit,
      quantityAvailable,
      imageUrl,
      isOrganic,
      harvestDate,
      expiryDate,
      location,
      status,
    } = productData

    const result = await sql`
      INSERT INTO products (
        farmer_id, name, description, category, price, unit, 
        quantity_available, image_url, is_organic, harvest_date, 
        expiry_date, location, status
      )
      VALUES (
        ${farmerId}, ${name}, ${description}, ${category}, ${price}, ${unit},
        ${quantityAvailable}, ${imageUrl}, ${isOrganic}, ${harvestDate},
        ${expiryDate}, ${location}, ${status}
      )
      RETURNING *
    `
    return result[0]
  }

  static async findById(id) {
    const result = await sql`
      SELECT p.*, u.username as farmer_name, u.full_name as farmer_full_name
      FROM products p
      JOIN users u ON p.farmer_id = u.id
      WHERE p.id = ${id}
    `
    return result[0]
  }

  static async findByFarmerId(farmerId) {
    const result = await sql`
      SELECT * FROM products 
      WHERE farmer_id = ${farmerId}
      ORDER BY created_at DESC
    `
    return result
  }

  static async findAll(filters = {}) {
    let query = sql`
      SELECT p.*, u.username as farmer_name, u.full_name as farmer_full_name
      FROM products p
      JOIN users u ON p.farmer_id = u.id
      WHERE p.status = 'active'
    `

    if (filters.category) {
      query = sql`${query} AND p.category = ${filters.category}`
    }

    if (filters.isOrganic !== undefined) {
      query = sql`${query} AND p.is_organic = ${filters.isOrganic}`
    }

    query = sql`${query} ORDER BY p.created_at DESC`

    return await query
  }

  static async update(id, productData) {
    const {
      name,
      description,
      category,
      price,
      unit,
      quantityAvailable,
      imageUrl,
      isOrganic,
      harvestDate,
      expiryDate,
      location,
      status,
    } = productData

    const result = await sql`
      UPDATE products 
      SET name = ${name}, description = ${description}, category = ${category}, 
          price = ${price}, unit = ${unit}, quantity_available = ${quantityAvailable},
          image_url = ${imageUrl}, is_organic = ${isOrganic}, harvest_date = ${harvestDate},
          expiry_date = ${expiryDate}, location = ${location}, status = ${status},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `
    return result[0]
  }

  static async delete(id) {
    const result = await sql`
      DELETE FROM products WHERE id = ${id}
      RETURNING *
    `
    return result[0]
  }
}

module.exports = Product
