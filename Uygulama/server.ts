import express from 'express';
import cors from 'cors';
import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcrypt';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// SQL Server Configuration
const sqlConfig = {
  user: process.env.DB_USER || 'TestUser',
  password: process.env.DB_PASSWORD || 'Steeldesk59',
  database: process.env.DB_DATABASE || 'BarcodeDB',
  server: process.env.DB_SERVER || 'app-server-services.database.windows.net',
  port: parseInt(process.env.DB_PORT || '1433'),
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: true, // for azure
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' // change to true for local dev / self-signed certs
  }
};

// Create a connection pool
const pool = new sql.ConnectionPool(sqlConfig);
const poolConnect = pool.connect();

pool.on('error', err => {
  console.error('SQL Pool Error:', err);
});

// Initialize Database Schema
async function initDb() {
  try {
    await poolConnect;
    // Create Campaigns Table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Campaigns' and xtype='U')
      CREATE TABLE Campaigns (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        agencyId INT NOT NULL,
        startDate DATETIME2 NOT NULL,
        endDate DATETIME2 NOT NULL,
        isActive BIT DEFAULT 1,
        createdAt DATETIME2 DEFAULT GETDATE()
      )
    `);

    // Add campaignId to Codes if not exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Codes') AND name = 'campaignId')
      BEGIN
        ALTER TABLE Codes ADD campaignId INT;
      END
    `);
    console.log('Database schema updated successfully.');
  } catch (err) {
    console.error('DB Init Error:', err);
  }
}
initDb();

// API Routes
// 1. Agencies
app.get('/api/agencies', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query('SELECT * FROM Agencies ORDER BY createdAt DESC');
    res.json(result.recordset || []);
  } catch (err) {
    console.error('Agencies API Error:', err);
    res.status(500).json({ error: 'Database error', details: 'Could not fetch agencies. Check SQL Server connection.' });
  }
});

app.post('/api/agencies', async (req, res) => {
  const { name, contact } = req.body;
  try {
    await poolConnect;
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('contact', sql.NVarChar, contact)
      .query('INSERT INTO Agencies (name, contact) OUTPUT INSERTED.* VALUES (@name, @contact)');
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Agencies POST Error:', err);
    res.status(500).json({ error: 'Database error', details: 'Could not add agency.' });
  }
});

// 2. Campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query(`
      SELECT c.*, a.name as agencyName 
      FROM Campaigns c 
      JOIN Agencies a ON c.agencyId = a.id 
      ORDER BY c.createdAt DESC
    `);
    res.json(result.recordset || []);
  } catch (err) {
    console.error('Campaigns API Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/campaigns', async (req, res) => {
  const { name, agencyId, startDate, endDate } = req.body;
  try {
    await poolConnect;
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('agencyId', sql.Int, agencyId)
      .input('startDate', sql.DateTime2, new Date(startDate))
      .input('endDate', sql.DateTime2, new Date(endDate))
      .query(`
        INSERT INTO Campaigns (name, agencyId, startDate, endDate, isActive) 
        OUTPUT INSERTED.* 
        VALUES (@name, @agencyId, @startDate, @endDate, 1)
      `);
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Campaigns POST Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/campaigns/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  try {
    await poolConnect;
    await pool.request()
      .input('id', sql.Int, id)
      .input('isActive', sql.Bit, isActive)
      .query('UPDATE Campaigns SET isActive = @isActive WHERE id = @id');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// 3. Codes
app.get('/api/codes', async (req, res) => {
  try {
    await poolConnect;

    // Önce süresi dolmuş ama hala 'active' görünen kodları 'expired' olarak güncelleyelim
    await pool.request().query(`
      UPDATE Codes 
      SET status = 'expired' 
      WHERE status = 'active' AND expirationDate < GETDATE()
    `);

    // Sonra güncel listeyi çekelim
    const result = await pool.request().query(`
      SELECT c.*, a.name as agencyName, cmp.name as campaignName
      FROM Codes c 
      JOIN Agencies a ON c.agencyId = a.id 
      LEFT JOIN Campaigns cmp ON c.campaignId = cmp.id
      ORDER BY c.createdAt DESC`);

    res.json(result.recordset || []);
  } catch (err) {
    console.error('Codes API Error:', err);
    res.status(500).json({ error: 'Database error', details: 'Could not fetch codes.' });
  }
});

app.post('/api/codes/bulk', async (req, res) => {
  const { codes, agencyId, campaignId, expirationDate } = req.body;
  console.log(`Bulk insert started for Agency ID: ${agencyId}, Campaign ID: ${campaignId}, Count: ${codes?.length}`);

  try {
    await poolConnect;

    const expDate = new Date(expirationDate);
    const aId = parseInt(agencyId);
    const cmpId = parseInt(campaignId);

    if (isNaN(aId) || isNaN(cmpId)) {
      throw new Error('Geçersiz Acenta veya Kampanya ID');
    }

    // Verileri JSON formatında hazırlıyoruz
    const payload = codes.map((c: string) => ({
      code: c.toUpperCase().trim(),
      agencyId: aId,
      campaignId: cmpId,
      expirationDate: expDate.toISOString(),
      status: 'active'
    }));

    const request = pool.request();
    // JSON verisini tek bir parametre olarak SQL'e gönderiyoruz
    request.input('jsonPayload', sql.NVarChar(sql.MAX), JSON.stringify(payload));

    // OPENJSON ile SQL Server tarafında güvenli bir şekilde tabloya aktarıyoruz
    await request.query(`
      INSERT INTO Codes (code, agencyId, campaignId, expirationDate, status)
      SELECT code, agencyId, campaignId, expirationDate, status
      FROM OPENJSON(@jsonPayload)
      WITH (
        code NVARCHAR(50) '$.code',
        agencyId INT '$.agencyId',
        campaignId INT '$.campaignId',
        expirationDate DATETIME2 '$.expirationDate',
        status NVARCHAR(20) '$.status'
      )
    `);

    console.log('Bulk insert successful');
    res.json({ success: true, count: codes.length });
  } catch (err: any) {
    console.error('Bulk insert error details:', err);
    res.status(500).json({
      error: 'Kodlar kaydedilemedi',
      details: err.message
    });
  }
});

// Two-Step Validation: Step 1 - Check
app.post('/api/codes/check', async (req, res) => {
  const { code } = req.body;
  try {
    await poolConnect;
    const result = await pool.request()
      .input('code', sql.NVarChar, code.toUpperCase().trim())
      .query(`
        SELECT c.*, a.name as agencyName, cmp.name as campaignName, cmp.isActive as campaignActive, cmp.startDate, cmp.endDate
        FROM Codes c 
        JOIN Agencies a ON c.agencyId = a.id 
        LEFT JOIN Campaigns cmp ON c.campaignId = cmp.id
        WHERE c.code = @code`);

    if (result.recordset.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Geçersiz kod. Sistemde bulunamadı.' });
    }

    const codeData = result.recordset[0];
    const now = new Date();

    if (codeData.status === 'used') {
      return res.json({ status: 'warning', message: 'Bu kod daha önce kullanılmış.', code: codeData });
    }

    if (codeData.campaignActive === false) {
      return res.json({ status: 'error', message: 'Bu kodun ait olduğu kampanya pasif durumda.', code: codeData });
    }

    if (codeData.startDate && new Date(codeData.startDate) > now) {
      return res.json({ status: 'error', message: 'Bu kampanya henüz başlamadı.', code: codeData });
    }

    if (new Date(codeData.expirationDate) < now || (codeData.endDate && new Date(codeData.endDate) < now)) {
      return res.json({ status: 'error', message: 'Bu kodun veya kampanyanın süresi dolmuş.', code: codeData });
    }

    // If all good, return success but DO NOT mark as used yet
    res.json({ status: 'success', message: 'Kod geçerli ve kullanıma uygun.', code: codeData });
  } catch (err) {
    console.error('Check Error:', err);
    res.status(500).json({ error: 'Validation error' });
  }
});

// Two-Step Validation: Step 2 - Use
app.post('/api/codes/use', async (req, res) => {
  const { id } = req.body;
  try {
    await poolConnect;
    const now = new Date();

    // Concurrency safe update: Only update if it is still 'active'
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('now', sql.DateTime2, now)
      .query(`
        UPDATE Codes 
        SET status = 'used', usedAt = @now 
        OUTPUT INSERTED.*
        WHERE id = @id AND status = 'active'
      `);

    if (result.recordset.length === 0) {
      // If no rows returned, it means it was already used by someone else in the last millisecond
      return res.status(400).json({ success: false, message: 'Bu kod az önce başka bir gişe tarafından kullanıldı!' });
    }

    res.json({ success: true, message: 'Kod başarıyla kullanıldı.', code: result.recordset[0] });
  } catch (err) {
    console.error('Use Error:', err);
    res.status(500).json({ error: 'Kullanım hatası' });
  }
});

// 4. Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log(`Login attempt for username: ${username}`);
  try {
    await poolConnect;
    const result = await pool.request()
      .input('username', sql.NVarChar, username.trim())
      .query('SELECT id, username, password, role FROM Users WHERE LTRIM(RTRIM(username)) = @username');

    if (result.recordset.length > 0) {
      const user = result.recordset[0];
      console.log('User found in database, comparing passwords...');

      const isMatch = await bcrypt.compare(password, user.password.trim());
      console.log(`Password match result: ${isMatch}`);

      if (isMatch) {
        const { password: _, ...userWithoutPassword } = user;
        res.json({ success: true, user: userWithoutPassword });
      } else {
        console.log('Password does not match');
        res.status(401).json({ success: false, error: 'Geçersiz kullanıcı adı veya şifre' });
      }
    } else {
      console.log('User not found in database');
      res.status(401).json({ success: false, error: 'Geçersiz kullanıcı adı veya şifre' });
    }
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Giriş hatası' });
  }
});

// Helper to generate hash (for initial setup)
app.post('/api/auth/hash', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  const hash = await bcrypt.hash(password, 10);
  res.json({ hash });
});

// Vite Setup
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

async function start() {
  await setupVite();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

start();
