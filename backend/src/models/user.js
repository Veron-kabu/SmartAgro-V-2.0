const { sql } = require("../config/database")

class User {
  static async create(userData) {
    const { clerkUserId, username, email, role, fullName, phone, address } = userData

    const result = await sql`
      INSERT INTO users (clerk_user_id, username, email, role, full_name, phone, address)
      VALUES (${clerkUserId}, ${username}, ${email}, ${role}, ${fullName}, ${phone}, ${address})
      RETURNING *
    `
    return result[0]
  }

  static async findByClerkId(clerkUserId) {
    const result = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId}
    `
    return result[0]
  }

  static async findById(id) {
    const result = await sql`
      SELECT * FROM users WHERE id = ${id}
    `
    return result[0]
  }

  static async update(id, userData) {
    const { fullName, phone, address } = userData

    const result = await sql`
      UPDATE users 
      SET full_name = ${fullName}, phone = ${phone}, address = ${address}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `
    return result[0]
  }

  static async getAllByRole(role) {
    const result = await sql`
      SELECT * FROM users WHERE role = ${role}
      ORDER BY created_at DESC
    `
    return result
  }
}

module.exports = User
