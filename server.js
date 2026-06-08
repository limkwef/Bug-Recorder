const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

// ============ 初始化 ============
const app = express();
const PORT = 3002;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// 确保目录存在
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ============ SQLite ============
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');
let db;

async function initDb() {
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            createTime TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS bugs (
            id TEXT PRIMARY KEY,
            projectId TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            level TEXT NOT NULL DEFAULT '一般',
            status TEXT NOT NULL DEFAULT '未解决',
            solveTime TEXT DEFAULT '',
            solve TEXT DEFAULT '',
            desc TEXT DEFAULT '',
            files TEXT DEFAULT '[]',
            createTime TEXT NOT NULL
        )
    `);
    saveDb();
}

function saveDb() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ============ 中间件 ============
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

// ============ 鉴权 ============
const API_TOKEN = process.env.API_TOKEN || crypto.randomBytes(16).toString('hex');
app.use('/api', (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || auth !== 'Bearer ' + API_TOKEN) {
        return res.status(401).json({ error: '未授权，请在请求头中添加 Authorization: Bearer <token>' });
    }
    next();
});

// 文件上传 - multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

// ============ API: 项目管理 ============

// 列出所有项目
app.get('/api/projects', (req, res) => {
    const results = db.exec('SELECT * FROM projects ORDER BY createTime DESC');
    if (!results.length) return res.json([]);
    const { columns, values } = results[0];
    res.json(values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]]))));
});

// 创建项目
app.post('/api/projects', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '项目名称不能为空' });
    const id = crypto.randomUUID();
    const createTime = new Date().toLocaleString('zh-CN');
    db.run('INSERT INTO projects (id, name, createTime) VALUES (?, ?, ?)', [id, name, createTime]);
    saveDb();
    res.json({ id, name, createTime });
});

// 更新项目
app.put('/api/projects/:id', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '项目名称不能为空' });
    db.run('UPDATE projects SET name = ? WHERE id = ?', [name, req.params.id]);
    saveDb();
    res.json({ ok: true });
});

// 删除项目（级联删除项目下的所有Bug）
app.delete('/api/projects/:id', (req, res) => {
    const id = req.params.id;
    // 删除关联的附件文件
    const bugs = db.exec('SELECT files FROM bugs WHERE projectId = ?', [id]);
    if (bugs.length) {
        for (const row of bugs[0].values) {
            const files = JSON.parse(row[0] || '[]');
            for (const f of files) {
                if (f.url.startsWith('/uploads/')) {
                    const filePath = path.join(UPLOAD_DIR, path.basename(f.url));
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
            }
        }
    }
    db.run('DELETE FROM bugs WHERE projectId = ?', [id]);
    db.run('DELETE FROM projects WHERE id = ?', [id]);
    saveDb();
    res.json({ ok: true });
});

// ============ API: Bug管理 ============

// 列出Bug（按项目筛选）
app.get('/api/bugs', (req, res) => {
    const { projectId } = req.query;
    let sql = 'SELECT * FROM bugs';
    const params = [];
    if (projectId) {
        sql += ' WHERE projectId = ?';
        params.push(projectId);
    }
    sql += ' ORDER BY createTime DESC';
    const results = db.exec(sql, params);
    if (!results.length) return res.json([]);
    const { columns, values } = results[0];
    res.json(values.map(row => {
        const obj = Object.fromEntries(columns.map((c, i) => [c, row[i]]));
        obj.files = JSON.parse(obj.files || '[]');
        return obj;
    }));
});

// 创建Bug
app.post('/api/bugs', (req, res) => {
    const { projectId, title, content, level, status, solveTime, solve, desc, files } = req.body;
    if (!projectId || !title || !content) {
        return res.status(400).json({ error: '缺少必填字段' });
    }
    const id = crypto.randomUUID();
    const createTime = new Date().toLocaleString('zh-CN');
    const filesJson = JSON.stringify(files || []);
    db.run(
        'INSERT INTO bugs (id, projectId, title, content, level, status, solveTime, solve, desc, files, createTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, projectId, title, content, level || '一般', status || '未解决', solveTime || '', solve || '', desc || '', filesJson, createTime]
    );
    saveDb();
    res.json({ id, createTime });
});

// 更新Bug
app.put('/api/bugs/:id', (req, res) => {
    const { title, content, level, status, solveTime, solve, desc, files } = req.body;
    const filesJson = JSON.stringify(files || []);
    db.run(
        'UPDATE bugs SET title=?, content=?, level=?, status=?, solveTime=?, solve=?, desc=?, files=? WHERE id=?',
        [title, content, level, status, solveTime || '', solve || '', desc || '', filesJson, req.params.id]
    );
    saveDb();
    res.json({ ok: true });
});

// 删除Bug
app.delete('/api/bugs/:id', (req, res) => {
    const bugs = db.exec('SELECT files FROM bugs WHERE id = ?', [req.params.id]);
    if (bugs.length && bugs[0].values.length) {
        const files = JSON.parse(bugs[0].values[0][0] || '[]');
        for (const f of files) {
            if (f.url.startsWith('/uploads/')) {
                const filePath = path.join(UPLOAD_DIR, path.basename(f.url));
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
        }
    }
    db.run('DELETE FROM bugs WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ ok: true });
});

// 上传文件
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: '请选择文件' });
    res.json({
        name: req.file.originalname,
        url: '/uploads/' + req.file.filename,
        size: req.file.size
    });
});

// 删除上传的文件
app.delete('/api/upload/:name', (req, res) => {
    const safeName = path.basename(req.params.name);
    const filePath = path.join(UPLOAD_DIR, safeName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true });
});

// ============ 统计接口 ============
app.get('/api/stats', (req, res) => {
    const totalProjects = db.exec('SELECT COUNT(*) as c FROM projects');
    const totalBugs = db.exec('SELECT COUNT(*) as c FROM bugs');
    const unsolved = db.exec("SELECT COUNT(*) as c FROM bugs WHERE status = '未解决'");
    const solved = db.exec("SELECT COUNT(*) as c FROM bugs WHERE status = '已解决'");
    res.json({
        totalProjects: totalProjects[0]?.values[0][0] || 0,
        totalBugs: totalBugs[0]?.values[0][0] || 0,
        unsolvedBugs: unsolved[0]?.values[0][0] || 0,
        solvedBugs: solved[0]?.values[0][0] || 0
    });
});

// ============ 静态文件 ============
app.use(express.static(path.join(__dirname, 'public')));

// ============ 启动 ============
async function start() {
    await initDb();
    app.listen(PORT, () => {
        console.log(`✅ Bug记录系统已启动`);
        console.log(`   http://localhost:${PORT}`);
        console.log(`   数据文件: ${DB_PATH}`);
        console.log(`   上传目录: ${UPLOAD_DIR}`);
        console.log(`   API Token: ${API_TOKEN}`);
        console.log(`   (前端页面可输入此 Token 进行认证)`);
    });
}

start();
