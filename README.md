# 🐛 个人Bug记录系统

轻量级个人 Bug 追踪系统，支持两种运行模式。

```
bug-record/
├── server.js              # Express 后端
├── bug.html               # 入口页（选择模式）
├── package.json
├── public/
│   ├── index.html         # 服务器模式前端（推荐）
│   └── standalone.html    # 单机模式前端（无服务器）
├── data/
│   └── database.sqlite    # SQLite 数据库
├── uploads/               # 上传文件目录
└── .gitignore
```

## 🚀 快速开始

### 入口页
直接双击打开 `bug.html`，选择模式进入。

### 方式一：服务器模式（推荐）

需要 Node.js 18+。

```bash
# 安装依赖
npm install

# 启动服务
npm start
# 或双击 启动系统.bat
```

打开 http://localhost:3002

### 方式二：单机模式

- 从 `bug.html` 入口页点击「单机模式」
- 或直接打开 `public/standalone.html`

无需服务器，数据保存在浏览器 localStorage。

> ⚠️ 清除浏览器缓存会导致数据丢失，请定期导出备份。

## ✨ 功能

- **项目管理** — 创建/编辑/删除项目，自动统计未解决 Bug 数
- **Bug 管理** — 记录标题、内容、严重程度、状态、解决方法和附件
- **筛选与搜索** — 按级别/状态筛选，按关键词搜索
- **附件上传** — 服务器模式存磁盘，单机模式存浏览器
- **数据备份** — 导出/导入 JSON 备份，支持 CSV 报表
- **统计概览** — 总项目、总Bug、未解决/已解决数量

## 🛠️ 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Node.js + Express |
| 数据库 | SQLite (via sql.js) |
| 前端 | 原生 JS + Bootstrap 5.3 |
| 文件上传 | Multer |

## 📦 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 创建项目 |
| PUT | `/api/projects/:id` | 更新项目 |
| DELETE | `/api/projects/:id` | 删除项目（级联删除 Bug） |
| GET | `/api/bugs` | Bug 列表（支持 `?projectId=` 筛选） |
| POST | `/api/bugs` | 创建 Bug |
| PUT | `/api/bugs/:id` | 更新 Bug |
| DELETE | `/api/bugs/:id` | 删除 Bug |
| POST | `/api/upload` | 上传文件 |
| DELETE | `/api/upload/:name` | 删除文件 |
| GET | `/api/stats` | 统计数据 |
