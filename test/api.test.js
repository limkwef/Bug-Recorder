/**
 * Bug Record API 测试
 * 使用: API_TOKEN=test-token-12345 node test/api.test.js
 * 需要先启动服务端: API_TOKEN=test-token-12345 node server.js
 */

const TEST_TOKEN = process.env.API_TOKEN || 'test-token-12345';
const BASE = `http://localhost:${process.env.TEST_PORT || 3002}`;

async function api(path, options = {}) {
    const url = BASE + path;
    const config = {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + TEST_TOKEN,
            ...(options.headers || {}),
        },
    };
    if (options.body) config.body = options.body;
    const res = await fetch(url, config);
    let data;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
}

let passed = 0;
let failed = 0;

function assert(condition, name) {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.log(`  ❌ ${name}`);
        failed++;
    }
}

async function runTests() {
    console.log('\n🧪 Bug Record API Tests\n');

    // 1. Auth
    console.log('── Auth ──');
    let r = await api('/api/projects', { headers: { 'Authorization': 'Bearer WRONG_TOKEN' } });
    assert(r.status === 401, 'Rejects wrong token');

    r = await api('/api/projects');
    assert(r.status === 200, 'Accepts correct token');

    if (r.status !== 200) {
        console.log('\n⚠️  Cannot connect. Is the server running on port 3002 with API_TOKEN=test-token-12345?');
        process.exit(1);
    }

    // 2. Project CRUD
    console.log('\n── Projects ──');
    r = await api('/api/projects', { method: 'POST', body: JSON.stringify({ name: '测试项目' }) });
    assert(r.status === 200 && r.data && r.data.id, 'Creates project');
    const projectId = r.data.id;

    r = await api('/api/projects');
    assert(r.status === 200 && Array.isArray(r.data), 'Lists projects');
    assert(r.data.some(p => p.id === projectId), 'New project appears in list');

    r = await api('/api/projects/' + projectId, { method: 'PUT', body: JSON.stringify({ name: '改名项目' }) });
    assert(r.status === 200 && r.data.ok, 'Updates project name');

    // 3. Bug CRUD
    console.log('\n── Bugs ──');
    r = await api('/api/bugs', { method: 'POST', body: JSON.stringify({
        projectId, title: '测试Bug', content: 'Bug内容描述', level: '严重', status: '未解决'
    })});
    assert(r.status === 200 && r.data && r.data.id, 'Creates bug');
    const bugId = r.data.id;

    r = await api('/api/bugs?projectId=' + projectId);
    assert(r.status === 200 && r.data && r.data.data, 'Lists bugs by project');
    assert(r.data.data.length > 0, 'Returns bug entries');
    assert(r.data.total > 0, 'Has pagination total');

    r = await api('/api/bugs/' + bugId, { method: 'PUT', body: JSON.stringify({
        title: '更新标题', content: '更新内容', level: '一般', status: '已解决', solve: '找到了原因'
    })});
    assert(r.status === 200 && r.data.ok, 'Updates bug');

    // 4. Search & Sort
    console.log('\n── Search & Sort ──');
    // Create a bug with searchable content
    r = await api('/api/bugs', { method: 'POST', body: JSON.stringify({
        projectId, title: '性能问题', content: '页面加载缓慢需要优化', level: '一般', status: '未解决'
    })});
    const searchBugId = r.data.id;
    r = await api('/api/bugs?search=性能');
    assert(r.status === 200 && r.data.total > 0, 'Searches bugs by keyword');
    r = await api('/api/bugs?search=缓慢');
    assert(r.status === 200 && r.data.total > 0, 'Searches bugs by content');
    await api('/api/bugs/' + searchBugId, { method: 'DELETE' });

    r = await api('/api/bugs?sort=createTime:asc&pageSize=5');
    assert(r.status === 200, 'Sorts by createTime asc');

    r = await api('/api/bugs?sort=level:desc&pageSize=5');
    assert(r.status === 200, 'Sorts by level desc');

    r = await api('/api/bugs?sort=status:asc&pageSize=5');
    assert(r.status === 200, 'Sorts by status asc');

    // 5. Pagination
    console.log('\n── Pagination ──');
    r = await api('/api/bugs?page=1&pageSize=10');
    assert(r.status === 200 && r.data.page === 1 && r.data.pageSize === 10, 'Respects page and pageSize params');

    r = await api('/api/bugs?page=999&pageSize=10');
    assert(r.status === 200 && r.data.data.length === 0, 'Returns empty for out-of-range page');

    // 6. Batch operations
    console.log('\n── Batch ──');
    // Create a couple more bugs
    let extraIds = [];
    for (let i = 0; i < 2; i++) {
        r = await api('/api/bugs', { method: 'POST', body: JSON.stringify({
            projectId, title: '批量Bug' + i, content: '批量测试', level: '一般', status: '未解决'
        })});
        extraIds.push(r.data.id);
    }

    r = await api('/api/bugs/batch-update-status', { method: 'POST', body: JSON.stringify({ ids: extraIds, status: '已解决' }) });
    assert(r.status === 200 && r.data.updated === 2, 'Batch updates status');

    r = await api('/api/bugs/batch-delete', { method: 'POST', body: JSON.stringify({ ids: extraIds }) });
    assert(r.status === 200 && r.data.deleted === 2, 'Batch deletes bugs');

    // 7. Stats
    console.log('\n── Stats ──');
    r = await api('/api/stats');
    assert(r.status === 200, 'Returns stats');
    assert(typeof r.data.totalProjects === 'number', 'Has totalProjects');
    assert(typeof r.data.totalBugs === 'number', 'Has totalBugs');
    assert(typeof r.data.unsolvedBugs === 'number', 'Has unsolvedBugs');
    assert(typeof r.data.solvedBugs === 'number', 'Has solvedBugs');

    // 8. Validation
    console.log('\n── Validation ──');
    r = await api('/api/projects', { method: 'POST', body: JSON.stringify({}) });
    assert(r.status === 400, 'Rejects empty project name');

    r = await api('/api/bugs', { method: 'POST', body: JSON.stringify({}) });
    assert(r.status === 400, 'Rejects empty bug fields');

    r = await api('/api/bugs/batch-delete', { method: 'POST', body: JSON.stringify({}) });
    assert(r.status === 400, 'Rejects empty batch delete');

    r = await api('/api/bugs/batch-update-status', { method: 'POST', body: JSON.stringify({ ids: ['x'], status: 'invalid' }) });
    assert(r.status === 400, 'Rejects invalid batch status');

    // 9. Upload (fileless test - just check endpoint exists)
    console.log('\n── Upload ──');
    const uploadRes = await fetch(BASE + '/api/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + TEST_TOKEN }
    });
    assert(uploadRes.status === 400, 'Upload returns 400 with no file');

    // Cleanup
    console.log('\n── Cleanup ──');
    await api('/api/bugs/' + bugId, { method: 'DELETE' });
    await api('/api/projects/' + projectId, { method: 'DELETE' });

    // Summary
    console.log(`\n${'─'.repeat(40)}`);
    console.log(`Result: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Test crashed:', err);
    process.exit(1);
});
