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
    card.className = 'rounded-lg border border-slate-700 p-3 bg-slate-900/40 hover:border-cyan-300 transition-colors cursor-pointer';
    const title = m.name || m.uid;
    const author = m.author || '';
    const updatedAt = m.updatedAt ? new Date(m.updatedAt).toLocaleString() : '';
    card.innerHTML = `
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
  const r = await fetch('/api/import/' + uid, { method: 'POST' });
  setStatus('import ' + uid + ' => ' + r.status);
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

// 首次載入
list();

