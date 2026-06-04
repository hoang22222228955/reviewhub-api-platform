const { Pool } = require('pg');

const db = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'NEWHUB',
  user: 'postgres',
  password: 'nhatpham12',
});

async function run() {
  // Thêm cột mới vào bảng plans
  await db.query(`
    ALTER TABLE plans
      ADD COLUMN IF NOT EXISTS cycle VARCHAR(50) DEFAULT 'tháng',
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Đang bán',
      ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS features TEXT,
      ADD COLUMN IF NOT EXISTS privileges TEXT
  `);
  console.log('✅ ALTER TABLE plans - OK');

  // Seed 3 gói
  const plans = [
    {
      id: 'starter',
      name: 'Khởi đầu',
      price: 790000,
      quota_limit: 5000,
      duration_days: 30,
      cycle: 'tháng',
      status: 'Đang bán',
      featured: false,
      description: 'Gói cơ bản cho đối tác mới bắt đầu',
      features: JSON.stringify(['1 khóa sandbox + 1 khóa live', 'Đọc dữ liệu public', 'Giới hạn 5.000 request/tháng', 'Bộ lọc cơ bản theo danh mục']),
      privileges: JSON.stringify(['Xem dữ liệu public', 'Có tài liệu API', 'Có dashboard quota']),
    },
    {
      id: 'growth',
      name: 'Tăng trưởng',
      price: 2490000,
      quota_limit: 50000,
      duration_days: 30,
      cycle: 'tháng',
      status: 'Đang bán',
      featured: true,
      description: 'Gói phổ biến nhất, phù hợp doanh nghiệp vừa',
      features: JSON.stringify(['Đọc dữ liệu public + private của chính đối tác', 'Gửi review mới về hub', 'AI moderation văn bản', 'Báo cáo chất lượng dữ liệu']),
      privileges: JSON.stringify(['Xem public/private', 'Gửi review', 'AI moderation text', 'Lịch sử API']),
    },
    {
      id: 'enterprise',
      name: 'Doanh nghiệp',
      price: 9990000,
      quota_limit: 300000,
      duration_days: 30,
      cycle: 'tháng',
      status: 'Liên hệ',
      featured: false,
      description: 'Gói cao cấp cho doanh nghiệp lớn',
      features: JSON.stringify(['Quota lớn + ưu tiên tốc độ', 'Theo dõi SLA', 'Mở rộng domain', 'Hỗ trợ kỹ thuật riêng']),
      privileges: JSON.stringify(['Quota lớn', 'Hỗ trợ riêng', 'Báo cáo nâng cao', 'Mở rộng domain']),
    },
  ];

  for (const p of plans) {
    const res = await db.query(
      `INSERT INTO plans (id, name, price, quota_limit, duration_days, cycle, status, featured, description, features, privileges, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),now())
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, price=EXCLUDED.price, quota_limit=EXCLUDED.quota_limit,
         duration_days=EXCLUDED.duration_days, cycle=EXCLUDED.cycle, status=EXCLUDED.status,
         featured=EXCLUDED.featured, description=EXCLUDED.description,
         features=EXCLUDED.features, privileges=EXCLUDED.privileges, updated_at=now()
       RETURNING xmax`,
      [p.id, p.name, p.price, p.quota_limit, p.duration_days, p.cycle, p.status, p.featured, p.description, p.features, p.privileges]
    );
    const isNew = res.rows[0].xmax === '0';
    console.log(`  ${isNew ? '✓ INSERT' : '↻ UPDATE'} ${p.id} — ${p.name} — ${p.price.toLocaleString()}đ`);
  }

  const total = await db.query('SELECT COUNT(*) FROM plans');
  console.log(`\n📊 Tổng gói trong DB: ${total.rows[0].count}`);
  await db.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
