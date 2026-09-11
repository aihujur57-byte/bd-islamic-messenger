const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { Pool } = require('pg');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 10000);
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_RENDER';
const DATABASE_URL = process.env.DATABASE_URL || '';

const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.use('/uploads', express.static(uploadDir));

/*
 * IMPORTANT:
 * Do not let express.static automatically serve index.html.
 * The root route below sends index.html explicitly as text/html.
 */
app.use(express.static(__dirname, {
  index: false,
  setHeaders: (res, filePath) => {
    if (path.extname(filePath).toLowerCase() === '.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost')
        ? false
        : { rejectUnauthorized: false }
    })
  : null;

async function query(text, params) {
  if (!pool) {
    const e = new Error('DATABASE_URL is not configured');
    e.statusCode = 503;
    throw e;
  }
  return pool.query(text, params);
}

async function initDb() {
  if (!pool) {
    console.warn('DATABASE_URL is not configured. Add a PostgreSQL DATABASE_URL in Render.');
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      pin_hash TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS friendships (
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY(user_id, friend_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS blocks (
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY(user_id, blocked_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('text','image','video')),
      body TEXT,
      media_url TEXT,
      seen BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
}

function tokenFor(user) {
  return jwt.sign(
    { id: user.id, code: user.code },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    country: u.country,
    phone: u.phone,
    code: u.code
  };
}

function publicMessage(m) {
  return {
    id: m.id,
    senderId: m.sender_id,
    receiverId: m.receiver_id,
    type: m.type,
    body: m.body || '',
    mediaUrl: m.media_url || '',
    seen: !!m.seen,
    createdAt: m.created_at,
    senderName: m.sender_name || '',
    senderCode: m.sender_code || ''
  };
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';

    if (!token) {
      return res.status(401).json({ error: 'লগইন প্রয়োজন' });
    }

    const data = jwt.verify(token, JWT_SECRET);

    const r = await query(
      'SELECT id,name,country,phone,code FROM users WHERE id=$1',
      [data.id]
    );

    if (!r.rowCount) {
      return res.status(401).json({ error: 'অ্যাকাউন্ট পাওয়া যায়নি' });
    }

    req.user = r.rows[0];
    next();
  } catch (e) {
    res.status(e.statusCode || 401).json({ error: 'লগইন সেশন অবৈধ' });
  }
}

async function findByCode(code) {
  const r = await query(
    'SELECT id,name,country,phone,code FROM users WHERE code=$1',
    [String(code || '').trim()]
  );
  return r.rows[0] || null;
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'BD Islamic Messenger',
    databaseConfigured: !!DATABASE_URL
  });
});

app.post('/api/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const country = String(req.body.country || '+880').trim();
    const phone = String(req.body.phone || '').replace(/\s+/g, '');
    const pin = String(req.body.pin || '').trim();

    if (!name || !phone || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        error: 'নাম, ফোন নম্বর এবং ৪ সংখ্যার User Code/PIN দিন'
      });
    }

    const existing = await query(
      'SELECT id FROM users WHERE phone=$1 OR code=$2',
      [phone, pin]
    );

    if (existing.rowCount) {
      return res.status(409).json({
        error: 'এই ফোন নম্বর অথবা User Code আগে থেকেই ব্যবহার করা হয়েছে'
      });
    }

    const pinHash = await bcrypt.hash(pin, 10);

    const r = await query(
      `INSERT INTO users(name,country,phone,pin_hash,code)
       VALUES($1,$2,$3,$4,$5)
       RETURNING id,name,country,phone,code`,
      [name, country, phone, pinHash, pin]
    );

    const user = r.rows[0];

    res.json({
      token: tokenFor(user),
      user: publicUser(user)
    });
  } catch (e) {
    console.error(e);
    res.status(e.statusCode || 500).json({
      error: 'রেজিস্ট্রেশন ব্যর্থ হয়েছে'
    });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const phone = String(req.body.phone || '').replace(/\s+/g, '');
    const pin = String(req.body.pin || '').trim();

    const r = await query(
      'SELECT * FROM users WHERE phone=$1',
      [phone]
    );

    if (!r.rowCount || !(await bcrypt.compare(pin, r.rows[0].pin_hash))) {
      return res.status(401).json({
        error: 'ফোন নম্বর বা User Code ভুল'
      });
    }

    const u = r.rows[0];
    const user = publicUser(u);

    res.json({
      token: tokenFor(user),
      user
    });
  } catch (e) {
    console.error(e);
    res.status(e.statusCode || 500).json({
      error: 'লগইন ব্যর্থ হয়েছে'
    });
  }
});

app.get('/api/me', auth, (req, res) => {
  res.json(publicUser(req.user));
});

app.get('/api/friends', auth, async (req, res) => {
  try {
    const r = await query(`
      SELECT
        u.id, u.name, u.country, u.phone, u.code,
        EXISTS(
          SELECT 1 FROM messages m
          WHERE m.sender_id=u.id
            AND m.receiver_id=$1
            AND m.seen=false
        ) AS unread
      FROM users u
      JOIN friendships f ON f.friend_id=u.id
      WHERE f.user_id=$1
      ORDER BY u.name
    `, [req.user.id]);

    const sockets = new Set(
      [...io.sockets.sockets.values()]
        .filter(s => s.userId)
        .map(s => s.userId)
    );

    res.json(r.rows.map(u => ({
      ...publicUser(u),
      unread: !!u.unread,
      online: sockets.has(u.id)
    })));
  } catch (e) {
    res.status(e.statusCode || 500).json({
      error: 'বন্ধু তালিকা পাওয়া যায়নি'
    });
  }
});

app.get('/api/users/by-code/:code', auth, async (req, res) => {
  try {
    const user = await findByCode(req.params.code);

    if (!user) {
      return res.status(404).json({
        error: 'User Code পাওয়া যায়নি'
      });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({
        error: 'নিজেকে বন্ধু করা যাবে না'
      });
    }

    res.json(publicUser(user));
  } catch (e) {
    res.status(e.statusCode || 500).json({
      error: 'User খোঁজা যায়নি'
    });
  }
});

app.post('/api/friends/add', auth, async (req, res) => {
  try {
    const friend = await findByCode(req.body.code);

    if (!friend) {
      return res.status(404).json({
        error: 'User Code পাওয়া যায়নি'
      });
    }

    if (friend.id === req.user.id) {
      return res.status(400).json({
        error: 'নিজেকে বন্ধু করা যাবে না'
      });
    }

    const blocked = await query(
      `SELECT 1 FROM blocks
       WHERE (user_id=$1 AND blocked_id=$2)
          OR (user_id=$2 AND blocked_id=$1)`,
      [req.user.id, friend.id]
    );

    if (blocked.rowCount) {
      return res.status(403).json({
        error: 'এই ব্যবহারকারীর সাথে Block সম্পর্ক আছে'
      });
    }

    await query(
      `INSERT INTO friendships(user_id,friend_id)
       VALUES($1,$2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, friend.id]
    );

    await query(
      `INSERT INTO friendships(user_id,friend_id)
       VALUES($1,$2)
       ON CONFLICT DO NOTHING`,
      [friend.id, req.user.id]
    );

    res.json({
      ok: true,
      user: publicUser(friend)
    });
  } catch (e) {
    res.status(e.statusCode || 500).json({
      error: 'Friend যোগ করা যায়নি'
    });
  }
});

async function areFriends(a, b) {
  const r = await query(
    'SELECT 1 FROM friendships WHERE user_id=$1 AND friend_id=$2',
    [a, b]
  );
  return !!r.rowCount;
}

async function isBlocked(a, b) {
  const r = await query(
    'SELECT 1 FROM blocks WHERE user_id=$1 AND blocked_id=$2',
    [a, b]
  );
  return !!r.rowCount;
}

async function getMessagesBetween(a, b) {
  const r = await query(`
    SELECT
      m.id,m.sender_id,m.receiver_id,m.type,m.body,m.media_url,
      m.seen,m.created_at,
      u.name AS sender_name,u.code AS sender_code
    FROM messages m
    JOIN users u ON u.id=m.sender_id
    WHERE
      (m.sender_id=$1 AND m.receiver_id=$2)
      OR
      (m.sender_id=$2 AND m.receiver_id=$1)
    ORDER BY m.created_at ASC
  `, [a, b]);

  return r.rows;
}

app.get('/api/chats/:code/messages', auth, async (req, res) => {
  try {
    const friend = await findByCode(req.params.code);

    if (!friend) {
      return res.status(404).json({
        error: 'User পাওয়া যায়নি'
      });
    }

    const messages = await getMessagesBetween(
      req.user.id,
      friend.id
    );

    res.json(messages.map(publicMessage));
  } catch (e) {
    console.error(e);
    res.status(e.statusCode || 500).json({
      error: 'মেসেজ লোড করা যায়নি'
    });
  }
});

app.post('/api/chats/:code/messages', auth, async (req, res) => {
  try {
    const friend = await findByCode(req.params.code);

    if (!friend) {
      return res.status(404).json({
        error: 'User পাওয়া যায়নি'
      });
    }

    if (!(await areFriends(req.user.id, friend.id))) {
      return res.status(403).json({
        error: 'আগে Friend যোগ করুন'
      });
    }

    if (
      await isBlocked(req.user.id, friend.id) ||
      await isBlocked(friend.id, req.user.id)
    ) {
      return res.status(403).json({
        error: 'এই চ্যাটটি Block করা আছে'
      });
    }

    const type = String(req.body.type || 'text');
    const body = String(req.body.body || '');
    const mediaUrl = req.body.mediaUrl
      ? String(req.body.mediaUrl)
      : null;

    if (!['text', 'image', 'video'].includes(type)) {
      return res.status(400).json({
        error: 'অবৈধ মেসেজ টাইপ'
      });
    }

    if (type === 'text' && !body.trim()) {
      return res.status(400).json({
        error: 'মেসেজ খালি'
      });
    }

    if ((type === 'image' || type === 'video') && !mediaUrl) {
      return res.status(400).json({
        error: 'মিডিয়া ফাইলের URL পাওয়া যায়নি'
      });
    }

    const r = await query(`
      INSERT INTO messages(
        sender_id,receiver_id,type,body,media_url
      )
      VALUES($1,$2,$3,$4,$5)
      RETURNING
        id,sender_id,receiver_id,type,body,media_url,
        seen,created_at
    `, [
      req.user.id,
      friend.id,
      type,
      body,
      mediaUrl
    ]);

    const baseMessage = r.rows[0];

    const message = {
      ...baseMessage,
      sender_name: req.user.name,
      sender_code: req.user.code
    };

    const output = publicMessage(message);

    for (const socket of io.sockets.sockets.values()) {
      if (socket.userId === friend.id) {
        socket.emit('message:new', output);
      }
    }

    for (const socket of io.sockets.sockets.values()) {
      if (socket.userId === req.user.id) {
        socket.emit('message:sent', output);
      }
    }

    res.json(output);
  } catch (e) {
    console.error(e);
    res.status(e.statusCode || 500).json({
      error: 'মেসেজ পাঠানো যায়নি'
    });
  }
});

app.post('/api/chats/:code/read', auth, async (req, res) => {
  try {
    const friend = await findByCode(req.params.code);

    if (!friend) {
      return res.status(404).json({
        error: 'User পাওয়া যায়নি'
      });
    }

    await query(
      `UPDATE messages
       SET seen=true
       WHERE sender_id=$1
         AND receiver_id=$2
         AND seen=false`,
      [friend.id, req.user.id]
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(e.statusCode || 500).json({
      error: 'Seen আপডেট করা যায়নি'
    });
  }
});

app.post('/api/block/:code', auth, async (req, res) => {
  try {
    const target = await findByCode(req.params.code);

    if (!target) {
      return res.status(404).json({
        error: 'User পাওয়া যায়নি'
      });
    }

    if (target.id === req.user.id) {
      return res.status(400).json({
        error: 'নিজেকে Block করা যাবে না'
      });
    }

    await query(
      `INSERT INTO blocks(user_id,blocked_id)
       VALUES($1,$2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, target.id]
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(e.statusCode || 500).json({
      error: 'Block করা যায়নি'
    });
  }
});

app.delete('/api/block/:code', auth, async (req, res) => {
  try {
    const target = await findByCode(req.params.code);

    if (!target) {
      return res.status(404).json({
        error: 'User পাওয়া যায়নি'
      });
    }

    await query(
      `DELETE FROM blocks
       WHERE user_id=$1 AND blocked_id=$2`,
      [req.user.id, target.id]
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(e.statusCode || 500).json({
      error: 'Unblock করা যায়নি'
    });
  }
});

app.post('/api/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'ফাইল পাওয়া যায়নি'
      });
    }

    const mime = req.file.mimetype || '';
    let type = null;

    if (mime.startsWith('image/')) {
      type = 'image';
    } else if (mime.startsWith('video/')) {
      type = 'video';
    }

    if (!type) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        error: 'শুধু ছবি বা ভিডিও পাঠানো যাবে'
      });
    }

    res.json({
      ok: true,
      type,
      url: `/uploads/${encodeURIComponent(req.file.filename)}`
    });
  } catch (e) {
    console.error(e);

    if (req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (_) {}
    }

    res.status(500).json({
      error: 'ফাইল আপলোড ব্যর্থ হয়েছে'
    });
  }
});

io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth &&
      socket.handshake.auth.token;

    if (!token) {
      return next(new Error('unauthorized'));
    }

    const data = jwt.verify(token, JWT_SECRET);
    socket.userId = Number(data.id);

    next();
  } catch (e) {
    next(new Error('unauthorized'));
  }
});

io.on('connection', socket => {
  socket.emit('presence', {
    userId: socket.userId,
    online: true
  });

  socket.broadcast.emit('presence', {
    userId: socket.userId,
    online: true
  });

  socket.on('disconnect', () => {
    socket.broadcast.emit('presence', {
      userId: socket.userId,
      online: false
    });
  });
});

/*
 * IMPORTANT:
 * Serve the repository root index.html explicitly as HTML.
 * This prevents the browser from displaying the JavaScript/HTML source as text.
 */
app.get('/', (req, res) => {
  res.setHeader(
    'Content-Type',
    'text/html; charset=utf-8'
  );
  res.sendFile(path.join(__dirname, 'index.html'));
});

/*
 * Keep API and Socket.IO requests from falling through to index.html.
 */
app.use((req, res, next) => {
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/socket.io/')
  ) {
    return res.status(404).json({
      error: 'Not found'
    });
  }

  res.setHeader(
    'Content-Type',
    'text/html; charset=utf-8'
  );

  res.sendFile(path.join(__dirname, 'index.html'));
});

initDb()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(
        `BD Islamic Messenger listening on ${PORT}`
      );
    });
  })
  .catch(err => {
    console.error(
      'Database initialization failed:',
      err
    );

    /*
     * Keep the web service alive so Render can show
     * the health page/logs even if database startup fails.
     */
    server.listen(PORT, '0.0.0.0', () => {
      console.log(
        `BD Islamic Messenger listening on ${PORT} without database`
      );
    });
  });
