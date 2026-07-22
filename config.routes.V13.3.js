const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Config = require('../models/config.model');
const { HttpsProxyAgent } = require('https-proxy-agent');
const db = require('../database/connection').getConnection();

// Create proxies table on startup
db.run(`
  CREATE TABLE IF NOT EXISTS proxies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proxy TEXT UNIQUE NOT NULL,
    ping INTEGER,
    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
  )
`, (err) => {
  if (err) console.error('Error creating proxies table:', err);
});

// Add delete_video_on_success column to config if not exists
db.run(`ALTER TABLE config ADD COLUMN delete_video_on_success INTEGER DEFAULT 0`, (err) => {
  // Ignore error if column already exists
  if (err && !err.message.includes('duplicate column')) {
    console.error('Error adding delete_video_on_success column:', err);
  }
});

// Add video_deleted column to video_tasks if not exists (to track cleaned up files)
db.run(`ALTER TABLE video_tasks ADD COLUMN video_deleted INTEGER DEFAULT 0`, (err) => {
  if (err && !err.message.includes('duplicate column')) {
    console.error('Error adding video_deleted column:', err);
  }
});

// GET /api/config/running-time-again
router.get('/running-time-again', async (req, res) => {
  try {
    const runningTime = await Config.getRunningTimeAgain();
    res.json({ runningTimeAgain: runningTime });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/config/running-time-again
router.post('/running-time-again', async (req, res) => {
  try {
    const { runningTimeAgain } = req.body;
    await Config.updateRunningTimeAgain(runningTimeAgain);
    res.json({ success: true, message: 'Lưu thời gian chạy lại thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/config/crawler-cookies
router.get('/crawler-cookies', async (req, res) => {
  try {
    const cookies = await Config.getAllCookies();
    res.json({ cookies: cookies || [] });
  } catch (err) {
    console.error('Error getting crawler cookies:', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy cookies' });
  }
});

// POST /api/config/crawler-cookies
router.post('/crawler-cookies', async (req, res) => {
  try {
    const { cookies } = req.body;
    if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách cookies không hợp lệ' });
    }
    const validCookies = cookies.filter(c => c && c.trim() !== '');
    if (validCookies.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có cookie hợp lệ' });
    }
    await Config.updateAllCookies(validCookies);
    res.json({ success: true, message: 'Lưu cookies thành công' });
  } catch (err) {
    console.error('Lỗi khi lưu cookies:', err);
    res.status(500).json({ success: false, message: 'Lỗi khi lưu cookies' });
  }
});

// GET /api/config/credit
router.get('/credit', async (req, res) => {
  try {
    const settings = await Config.getCreditSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/config/credit
router.post('/credit', async (req, res) => {
  try {
    const { credit_url, credit_key } = req.body;
    if (!credit_url || !credit_key) {
      return res.status(400).json({ success: false, message: 'URL và Key không được để trống' });
    }
    await Config.updateCreditSettings(credit_url, credit_key);
    res.json({ success: true, message: 'Lưu cài đặt credit thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/config/blacklist
router.get('/blacklist', async (req, res) => {
  try {
    const keywords = await Config.getBlacklistKeywords();
    res.json({ blacklist_keywords: keywords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/config/blacklist
router.post('/blacklist', async (req, res) => {
  try {
    const { blacklist_keywords } = req.body;
    await Config.updateBlacklistKeywords(blacklist_keywords || '');
    res.json({ success: true, message: 'Lưu từ khoá blacklist thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/config/api-url-key1
router.get('/api-url-key1', async (req, res) => {
  try {
    const apiUrlKey1 = await Config.getApiUrlKey1();
    res.json({ api_url_key1: apiUrlKey1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/config/api-url-key1
router.post('/api-url-key1', async (req, res) => {
  try {
    const { api_url_key1 } = req.body;
    await Config.updateApiUrlKey1(api_url_key1);
    res.json({ success: true, message: 'Lưu API URL Key 1 thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/config/credit-balance
router.get('/credit-balance', async (req, res) => {
  try {
    const settings = await Config.getCreditSettings();
    if (!settings.credit_url || !settings.credit_key) {
      return res.json({ success: false, error: 'Chưa cài đặt Credit API' });
    }
    const cleanUrl = settings.credit_url.replace(/\/api\/sign\/?$/, '');
    const balanceUrl = cleanUrl + '/api/me';
    const response = await axios.get(balanceUrl, {
      headers: { 'X-API-Key': settings.credit_key },
      timeout: 10000
    });
    if (response.data?.code === 0 && response.data?.data) {
      return res.json({
        success: true,
        username: response.data.data.username,
        credits: response.data.data.credits,
        is_active: response.data.data.is_active
      });
    }
    res.json({ success: false, error: response.data?.message || 'API Key không hợp lệ' });
  } catch (err) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      return res.json({ success: false, error: 'API Key không hợp lệ' });
    }
    res.json({ success: false, error: err.message });
  }
});

// GET /api/config/saved-proxies
router.get('/saved-proxies', (req, res) => {
  db.all('SELECT proxy FROM proxies', [], (err, rows) => {
    if (err) {
      console.error('Error fetching saved proxies:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    const proxies = rows ? rows.map(r => r.proxy) : [];
    res.json({ success: true, proxies });
  });
});

// POST /api/config/import-proxy
router.post('/import-proxy', async (req, res) => {
  try {
    const { proxies } = req.body;
    if (!proxies || !Array.isArray(proxies) || proxies.length === 0) {
      return res.status(400).json({ success: false, error: 'Danh sách proxy trống' });
    }

    const validProxies = [];
    for (const p of proxies) {
      const proxyStr = (p || '').trim();
      if (!proxyStr) continue;
      const parts = proxyStr.split(':');
      if (parts.length < 2) continue;
      validProxies.push(proxyStr);
    }

    if (validProxies.length === 0) {
      return res.status(400).json({ success: false, error: 'Không tìm thấy proxy hợp lệ' });
    }

    const dbPromises = validProxies.map(proxy => {
      return new Promise((resolve) => {
        db.run('INSERT OR REPLACE INTO proxies (proxy, ping) VALUES (?, ?)', [proxy, 0], (err) => {
          if (err) console.error('Error importing proxy directly:', err);
          resolve();
        });
      });
    });
    await Promise.all(dbPromises);

    res.json({
      success: true,
      message: `Đã import thành công ${validProxies.length} proxy sống vào database.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/config/check-proxy
router.post('/check-proxy', async (req, res) => {
  try {
    const { proxies } = req.body;
    if (!proxies || !Array.isArray(proxies) || proxies.length === 0) {
      return res.status(400).json({ success: false, error: 'Danh sách proxy trống' });
    }

    const results = await Promise.all(proxies.map(async (p) => {
      const proxyStr = (p || '').trim();
      if (!proxyStr) {
        return { proxy: proxyStr, alive: false, error: 'Trống', ms: 0 };
      }
      const parts = proxyStr.split(':');
      if (parts.length < 2) {
        return { proxy: proxyStr, alive: false, error: 'Sai format', ms: 0 };
      }
      const ip = parts[0];
      const port = parts[1];
      let proxyUrl = 'http://' + ip + ':' + port;
      if (parts.length === 4) {
        proxyUrl = 'http://' + parts[2] + ':' + parts[3] + '@' + ip + ':' + port;
      }
      const startTime = Date.now();
      try {
        const agent = new HttpsProxyAgent(proxyUrl);
        await axios.get('https://httpbin.org/delay/0', {
          httpAgent: agent,
          httpsAgent: agent,
          timeout: 10000
        });
        const duration = Date.now() - startTime;
        return { proxy: proxyStr, alive: true, ms: duration, error: null };
      } catch (err) {
        const duration = Date.now() - startTime;
        let errMsg = 'Không kết nối được';
        if (err.code === 'ECONNRESET') {
          errMsg = 'Bị reset';
        } else if (err.code === 'ECONNREFUSED') {
          errMsg = 'Bị từ chối';
        } else if (err.code === 'ETIMEDOUT') {
          errMsg = 'Timeout';
        } else if (err.response?.status === 407) {
          errMsg = 'Sai auth';
        }
        return { proxy: proxyStr, alive: false, ms: duration, error: errMsg };
      }
    }));

    // Save alive proxies to database and remove dead ones
    const dbPromises = results.map(r => {
      return new Promise((resolve) => {
        if (r.alive) {
          db.run('INSERT OR REPLACE INTO proxies (proxy, ping) VALUES (?, ?)', [r.proxy, r.ms], (err) => {
            if (err) console.error('Error inserting proxy:', err);
            resolve();
          });
        } else {
          db.run('DELETE FROM proxies WHERE proxy = ?', [r.proxy], (err) => {
            if (err) console.error('Error deleting proxy:', err);
            resolve();
          });
        }
      });
    });
    await Promise.all(dbPromises);

    const aliveCount = results.filter(r => r.alive).length;
    const deadCount = results.filter(r => !r.alive).length;

    res.json({
      success: true,
      results,
      summary: {
        total: results.length,
        alive: aliveCount,
        dead: deadCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== AUTO-DELETE VIDEO ON SUCCESS =====

// GET /api/config/delete-video-on-success
router.get('/delete-video-on-success', (req, res) => {
  db.get('SELECT delete_video_on_success FROM config WHERE id = 1', [], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, enabled: row ? !!row.delete_video_on_success : false });
  });
});

// POST /api/config/delete-video-on-success
router.post('/delete-video-on-success', (req, res) => {
  const { enabled } = req.body;
  const val = enabled ? 1 : 0;
  db.run('UPDATE config SET delete_video_on_success = ? WHERE id = 1', [val], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, enabled: !!val });
  });
});

// POST /api/config/cleanup-completed-videos — manually trigger cleanup
router.post('/cleanup-completed-videos', async (req, res) => {
  try {
    const result = await cleanupCompletedVideos();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Core cleanup function
function cleanupCompletedVideos() {
  return new Promise((resolve, reject) => {
    // Find completed tasks that haven't been cleaned up yet
    db.all(
      `SELECT id, video_path, video_filename FROM video_tasks 
       WHERE status = 'completed' AND (video_deleted IS NULL OR video_deleted = 0) AND video_path IS NOT NULL`,
      [],
      (err, rows) => {
        if (err) return reject(err);
        if (!rows || rows.length === 0) return resolve({ deleted: 0, errors: 0, details: [] });

        let deleted = 0;
        let errors = 0;
        const details = [];

        const promises = rows.map(task => {
          return new Promise((res2) => {
            try {
              if (fs.existsSync(task.video_path)) {
                fs.unlinkSync(task.video_path);
                deleted++;
                details.push({ file: task.video_filename, status: 'deleted' });
              } else {
                // File already gone, just mark it
                deleted++;
                details.push({ file: task.video_filename, status: 'not_found' });
              }
              // Mark as cleaned up
              db.run('UPDATE video_tasks SET video_deleted = 1 WHERE id = ?', [task.id], () => res2());
            } catch (e) {
              errors++;
              details.push({ file: task.video_filename, status: 'error', error: e.message });
              res2();
            }
          });
        });

        Promise.all(promises).then(() => {
          resolve({ deleted, errors, details });
        });
      }
    );
  });
}

// Auto-cleanup interval: check every 30 seconds if delete_video_on_success is enabled
setInterval(() => {
  db.get('SELECT delete_video_on_success FROM config WHERE id = 1', [], (err, row) => {
    if (err || !row || !row.delete_video_on_success) return;
    cleanupCompletedVideos()
      .then(result => {
        if (result.deleted > 0) {
          console.log(`🗑️ Auto-cleanup: Đã xóa ${result.deleted} video đã post thành công`);
        }
      })
      .catch(err => console.error('Auto-cleanup error:', err));
  });
}, 30000); // 30 seconds

module.exports = router;