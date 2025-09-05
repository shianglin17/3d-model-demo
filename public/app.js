function setStatus(s){ document.getElementById('status').textContent = s; }

function getType(v){
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (v && typeof v === 'object' && typeof v.$date !== 'undefined') return 'date';
  if (v instanceof Date) return 'date';
  return typeof v;
}

function stringifyExample(v){
  try{
    if (v && typeof v === 'object' && typeof v.$date !== 'undefined') return new Date(v.$date).toISOString();
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.length > 100 ? s.slice(0,100) + '…' : s;
  }catch{ return ''; }
}

function showDoc(doc){
  const pre = document.getElementById('doc');
  pre.textContent = JSON.stringify(doc, null, 2);
}

function buildSchemaTree(container, doc){
  container.innerHTML = '';
  const hidden = new Set(['__v']);

  function renderNode(key, value){
    const type = getType(value);
    const isObject = value && typeof value === 'object' && !Array.isArray(value);
    const isArray = Array.isArray(value);
    const wrapper = document.createElement('div');
    wrapper.className = 'border border-slate-700 rounded-md mb-2';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between px-3 py-2 bg-slate-900/60';
    header.innerHTML = `<div class="text-slate-200">${key}<span class="ml-2 text-xs text-cyan-300">${type}</span></div>`;
    wrapper.appendChild(header);

    const body = document.createElement('div');
    body.className = 'px-3 py-2 text-slate-300 text-xs';
    wrapper.appendChild(body);

    if (isObject || isArray){
      const toggle = document.createElement('button');
      toggle.className = 'text-cyan-300 text-xs underline decoration-dotted';
      toggle.textContent = '展開';
      header.appendChild(toggle);

      const childContainer = document.createElement('div');
      childContainer.style.display = 'none';
      body.appendChild(childContainer);

      toggle.onclick = () => {
        const open = childContainer.style.display === 'none';
        childContainer.style.display = open ? '' : 'none';
        toggle.textContent = open ? '收合' : '展開';
      };

      const entries = isArray
        ? value.map((v,i)=>[String(i), v])
        : Object.entries(value).filter(([k]) => !hidden.has(k));
      for (const [k, v] of entries){
        childContainer.appendChild(renderNode(k, v));
      }
    } else {
      body.textContent = stringifyExample(value);
    }
    return wrapper;
  }

  for (const [k, v] of Object.entries(doc)){
    if (hidden.has(k)) continue;
    container.appendChild(renderNode(k, v));
  }
}

async function render(uid){
  const iframe = document.getElementById('viewer');
  iframe.src = 'about:blank';
  const client = new Sketchfab(iframe);
  client.init(uid, { success(api){ api.start(); } });
}

async function list(){
  const d = await (await fetch('/api/models')).json();
  const grid = document.getElementById('grid');
  const count = document.getElementById('count');
  const schemaTree = document.getElementById('schemaTree');
  grid.innerHTML = '';
  count.textContent = Array.isArray(d.models) ? d.models.length : 0;

  for (const m of d.models) {
    const card = document.createElement('article');
    card.className = 'relative rounded-lg border border-slate-700 p-3 bg-slate-900/40 hover:border-cyan-300 transition-colors cursor-pointer';
    const title = m.name || m.uid;
    const author = m.author || '';
    const updatedAt = m.updatedAt ? new Date(m.updatedAt).toLocaleString() : '';
    card.innerHTML = `
      <button title="刪除" class="delete absolute right-2 top-2 text-slate-400 hover:text-rose-400">✕</button>
      <h3 class="text-slate-200 text-sm font-semibold truncate">${title}</h3>
      <p class="text-slate-400 text-xs truncate">UID: ${m.uid}</p>
      <p class="text-slate-500 text-xs truncate">Author: ${author}</p>
      <p class="text-slate-500 text-xs">Updated: ${updatedAt}</p>
    `;
    card.onclick = () => {
      render(m.uid);
      showDoc(m);
      buildSchemaTree(schemaTree, m);
    };
    const delBtn = card.querySelector('.delete');
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`確定刪除？\n${title}\nUID: ${m.uid}`)) return;
      const prevHTML = card.innerHTML;
      card.style.opacity = '0.6';
      try{
        const r = await fetch('/api/models/' + encodeURIComponent(m.uid), { method:'DELETE' });
        if (!r.ok) throw new Error('刪除失敗');
        card.remove();
        // 若刪的是當前顯示的模型，清空 viewer 與欄位
        const doc = document.getElementById('doc');
        if (doc.textContent.includes(m.uid)){
          document.getElementById('viewer').src = 'about:blank';
          doc.textContent='';
          schemaTree.innerHTML='';
        }
        // 更新計數
        const countEl = document.getElementById('count');
        countEl.textContent = String(Math.max(0, Number(countEl.textContent) - 1));
      }catch(err){
        alert(err.message || '刪除失敗');
        card.innerHTML = prevHTML;
      }
    };
    grid.appendChild(card);
  }

  // 預設載入第一筆（若存在）
  if (Array.isArray(d.models) && d.models.length > 0){
    const first = d.models[0];
    render(first.uid);
    showDoc(first);
    buildSchemaTree(schemaTree, first);
  }
}

async function importModel(){
  const uid = document.getElementById('uid').value.trim();
  if (!uid) return;

  try {
    setStatus(`獲取模型數據 ${uid}...`);

    // 先從 Sketchfab API 獲取模型數據
    const sketchfabResponse = await fetch(`https://api.sketchfab.com/v3/models/${uid}`);
    if (!sketchfabResponse.ok) {
      throw new Error(`獲取模型失敗: ${sketchfabResponse.status}`);
    }

    const modelData = await sketchfabResponse.json();
    setStatus(`保存模型 ${uid}...`);

    // 發送到後端保存
    const importResponse = await fetch('/api/import/' + uid, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(modelData)
    });

    if (importResponse.ok) {
      setStatus('成功匯入 ' + uid);
      await list();

      try {
        const j = await (await fetch('/api/models/' + encodeURIComponent(uid))).json();
        if (j.ok) {
          const schemaTree = document.getElementById('schemaTree');
          render(uid);
          showDoc(j.model);
          buildSchemaTree(schemaTree, j.model);
        }
      } catch {}
    } else {
      const errorData = await importResponse.json();
      throw new Error(errorData.error || `匯入失敗: ${importResponse.status}`);
    }
  } catch (error) {
    setStatus('匯入錯誤: ' + error.message);
  }
}

document.getElementById('import').onclick = importModel;
document.getElementById('latest').onclick = async () => {
  const d = await (await fetch('/api/model')).json();
  if (d.ok) {
    try {
      const j = await (await fetch('/api/models/' + encodeURIComponent(d.uid))).json();
      if (j.ok) {
        const schemaTree = document.getElementById('schemaTree');
        render(d.uid);
        showDoc(j.model);
        buildSchemaTree(schemaTree, j.model);
      }
    } catch {}
  }
};

// 前端直接搜索 Sketchfab API
async function searchModels(query) {
  try {
    const params = new URLSearchParams({
      q: query.trim(),
      type: 'models',
      downloadable: 'true',
      sort_by: '-viewCount', // 觀看最多的模型
      count: '5', // 只返回5個結果
      offset: '0'
    });

    const response = await fetch(`https://api.sketchfab.com/v3/search?${params.toString()}`);
    const data = await response.json();

    if (response.ok) {
      displaySearchResults(data.results || []);
      document.getElementById('searchCount').textContent = data.total || 0;
      return data;
    } else {
      throw new Error(`搜索失敗: ${response.status}`);
    }
  } catch (error) {
    console.error('搜索失敗:', error);
    setStatus('搜索失敗: ' + error.message);
    return null;
  }
}

// 顯示搜索結果
function displaySearchResults(results) {
  const grid = document.getElementById('searchGrid');
  const resultsDiv = document.getElementById('searchResults');

  grid.innerHTML = '';

  if (results && results.length > 0) {
    results.forEach(model => {
      const card = createSearchModelCard(model);
      grid.appendChild(card);
    });
    resultsDiv.classList.remove('hidden');
  } else {
    grid.innerHTML = '<p class="text-slate-400 text-center py-4">沒有找到符合的模型</p>';
    resultsDiv.classList.remove('hidden');
  }
}

// 創建搜索結果模型卡片
function createSearchModelCard(model) {
  const card = document.createElement('article');
  card.className = 'rounded-lg border border-slate-700 p-3 bg-slate-900/40 hover:border-cyan-300 transition-colors cursor-pointer';

  const title = model.name || '未命名模型';
  const author = model.user?.displayName || model.user?.username || '未知作者';
  const thumbnail = model.thumbnails?.images?.[0]?.url || '';
  const viewCount = model.viewCount || 0;

  card.innerHTML = `
    ${thumbnail ? `<img src="${thumbnail}" alt="${title}" class="w-full h-24 object-cover rounded-md mb-2">` : ''}
    <h3 class="text-slate-200 text-sm font-semibold truncate">${title}</h3>
    <p class="text-slate-400 text-xs truncate">作者: ${author}</p>
    <p class="text-slate-500 text-xs">👁 ${viewCount} 次瀏覽</p>
  `;

  card.onclick = () => {
    importAndShowModel(model.uid);
  };

  return card;
}

// 匯入並顯示模型
async function importAndShowModel(uid) {
  try {
    setStatus(`獲取模型數據 ${uid}...`);

    // 先從 Sketchfab API 獲取模型數據
    const sketchfabResponse = await fetch(`https://api.sketchfab.com/v3/models/${uid}`);
    if (!sketchfabResponse.ok) {
      throw new Error(`獲取模型失敗: ${sketchfabResponse.status}`);
    }

    const modelData = await sketchfabResponse.json();
    setStatus(`保存模型 ${uid}...`);

    // 發送到後端保存
    const importResponse = await fetch(`/api/import/${uid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(modelData)
    });

    if (importResponse.ok) {
      setStatus(`成功匯入模型 ${uid}`);
      await list(); // 重新載入本地模型列表

      // 顯示在 viewer 中
      const localModelResponse = await fetch(`/api/models/${encodeURIComponent(uid)}`);
      const localModelData = await localModelResponse.json();

      if (localModelData.ok) {
        const schemaTree = document.getElementById('schemaTree');
        render(uid);
        showDoc(localModelData.model);
        buildSchemaTree(schemaTree, localModelData.model);
      }
    } else {
      const errorData = await importResponse.json();
      throw new Error(errorData.error || `匯入失敗: ${importResponse.status}`);
    }
  } catch (error) {
    setStatus(`匯入錯誤: ${error.message}`);
  }
}

// 事件監聽器
document.getElementById('searchBtn').onclick = async () => {
  const query = document.getElementById('searchQuery').value.trim();

  if (!query) {
    setStatus('請輸入搜索關鍵字');
    return;
  }

  setStatus('搜索中...');
  await searchModels(query);
  setStatus('搜索完成');
};

// 允許按 Enter 鍵搜索
document.getElementById('searchQuery').onkeypress = (e) => {
  if (e.key === 'Enter') {
    document.getElementById('searchBtn').click();
  }
};

// 搜索區域折疊功能
let isSearchCollapsed = false;
document.getElementById('toggleSearch').onclick = () => {
  const searchContent = document.getElementById('searchContent');
  const toggleIcon = document.getElementById('toggleIcon');
  const toggleBtn = document.getElementById('toggleSearch');

  isSearchCollapsed = !isSearchCollapsed;

  if (isSearchCollapsed) {
    searchContent.style.display = 'none';
    toggleIcon.textContent = '▶';
    toggleBtn.innerHTML = '<span id="toggleIcon">▶</span> 展開';
  } else {
    searchContent.style.display = 'block';
    toggleIcon.textContent = '▼';
    toggleBtn.innerHTML = '<span id="toggleIcon">▼</span> 收起';
  }
};

// 首次載入
list();

