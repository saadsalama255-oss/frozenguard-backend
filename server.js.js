const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// الاتصال بقاعدة البيانات PostgreSQL على Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// إنشاء الجدول الخاص بتخزين بيانات البرنامج إذا لم يكن موجوداً
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_data (
      id VARCHAR(50) PRIMARY KEY,
      content JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
initDB().catch(console.error);

// 1. رابط استقبال البيانات ومزامنتها من أي جهاز (POST)
app.post('/api/sync', async (req, res) => {
  try {
    const payload = req.body;
    await pool.query(
      `INSERT INTO app_data (id, content, updated_at) 
       VALUES ('main_db', $1, NOW()) 
       ON CONFLICT (id) 
       DO UPDATE SET content = $1, updated_at = NOW();`,
      [JSON.stringify(payload)]
    );
    res.json({ success: true, message: 'تمت المزامنة بنجاح' });
  } catch (err) {
    console.error('Sync Error:', err);
    res.status(500).json({ error: 'فشلت عملية المزامنة' });
  }
});

// 2. رابط جلب أحدث البيانات لتطبيق FrozenGuard عند الفتح (GET)
app.get('/api/sync', async (req, res) => {
  try {
    const result = await pool.query(`SELECT content FROM app_data WHERE id = 'main_db';`);
    if (result.rows.length > 0) {
      res.json(result.rows[0].content);
    } else {
      res.json({});
    }
  } catch (err) {
    console.error('Fetch Error:', err);
    res.status(500).json({ error: 'فشل جلب البيانات' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));