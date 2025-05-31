
const { Pool } = require('pg');

const DATABASE_URL = "postgresql://neondb_owner:npg_8XSnYfLRq9ZH@ep-square-dew-a8jtw0jo-pooler.eastus2.azure.neon.tech/neondb?sslmode=require";

async function testConnection() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    console.log('Подключение к базе данных...');
    const client = await pool.connect();
    
    // Проверяем существование таблицы users
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    
    console.log('Таблица users существует:', tableCheck.rows[0].exists);
    
    // Проверяем количество пользователей
    if (tableCheck.rows[0].exists) {
      const userCount = await client.query('SELECT COUNT(*) FROM users');
      console.log('Количество пользователей:', userCount.rows[0].count);
    }
    
    client.release();
    console.log('Подключение успешно!');
    
  } catch (error) {
    console.error('Ошибка подключения:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();
