import { renderCinematicHome } from '/home.js';
import { mountReader } from '/reader.js';
import { mountArticleEditor, draftPreview } from '/editor.js';
import { homeDateKey, resolveHomeTheme, readHomeTheme, saveHomeTheme } from '/home-theme.js';

const $ = selector => document.querySelector(selector);
const main = $('#main');
const dialog = $('#dialog');
const state = { articles: [], projects: [], users: [], references: [], user: null, configured: false, loginAvailable: false, category: '全部', query: '', status: 'all', libraryView: 'list', librarySort: 'updated' };
const statuses = { planned: '待开始', active: '进行中', done: '已完成' };
const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => value ? new Date(value).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}) : '未设置';
const route = () => {
  const name = location.hash.slice(1).split('?')[0];
  if (name.startsWith('article/')) return 'article';
  return ['home','landscape','knowledge','projects','admin','search'].includes(name) ? name : 'home';
};
const admin = () => state.user?.role === 'admin';
let toastTimer;
let searchSequence = 0;
let cleanupPage = null;
let themeStorage;
try{themeStorage=window.localStorage;}catch{}
let homeThemeMode=readHomeTheme(themeStorage);
const homeVisitDate=new Date();
function toast(text) { $('#toast').textContent=text; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(() => $('#toast').hidden=true,3500); }
async function api(path, method='GET', data) {
  const response = await fetch(`/api/${path}`, { method, credentials:'same-origin', headers: data === undefined ? {} : {'Content-Type':'application/json'}, body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && state.user) { state.user=null; state.projects=[]; state.users=[]; render(); }
    throw new Error(result.error || '操作失败，请稍后重试');
  }
  return result;
}
function title(heading, subtitle, action='') { return `<div class="page-title"><div><h1>${heading}</h1><p>${subtitle}</p></div>${action}</div>`; }
function articleReturnHash() {
  const hash = route()==='article' ? new URLSearchParams(location.hash.split('?')[1] || '').get('from') : (location.hash || '#home');
  return ['#home','#landscape'].includes(hash) || /^#knowledge(?:\?|$)/.test(hash || '') || /^#search(?:\?|$)/.test(hash || '') ? hash : '#knowledge';
}
function articleHref(id) { return `#article/${id}?${new URLSearchParams({from:articleReturnHash()})}`; }
function articleCard(article) { return `<a class="article-card" href="${h(articleHref(article.id))}"><span class="article-card-category">${h(article.category)}</span><div class="article-card-main"><h3>${h(article.title)}</h3><p>${h(article.summary)}</p></div><div class="article-meta"><time>${date(article.updated)}</time><span>阅读全文 ↗</span></div></a>`; }
function updateCategoryNavigation(category=state.category) {
  const counts=new Map();for(const article of state.articles)counts.set(article.category,(counts.get(article.category)||0)+1);
  $('#sidebar-category-list').innerHTML=[['全部',state.articles.length],...counts].map(([name,count])=>`<button class="sidebar-category ${category===name?'active':''}" type="button" data-library-category="${h(name)}"><span>${name==='全部'?'全部知识':h(name)}</span><small>${count}</small></button>`).join('');
}
function knowledgeHash(category=state.category,query=state.query) {
  const params=new URLSearchParams();if(category!=='全部')params.set('category',category);if(query.trim())params.set('q',query.trim());if(state.libraryView!=='list')params.set('view',state.libraryView);if(state.librarySort!=='updated')params.set('sort',state.librarySort);
  return '#knowledge'+(params.size?'?'+params:'');
}
function navigateKnowledge(category=state.category,query=state.query) {
  state.category=category;state.query=query;const hash=knowledgeHash(category,query);if(location.hash===hash)render();else location.hash=hash;
}

function home() {
  const theme=resolveHomeTheme(homeThemeMode,homeVisitDate);
  document.body.dataset.homeTheme=theme;
  if(theme==='landscape')return landscape();
  main.innerHTML='<iframe class="electromagnetic-home-frame" src="/electromagnetic-home.html" title="磁脉首页：技术与知识"></iframe>';
  const frame=main.querySelector('iframe');
  const controller=new AbortController();
  frame.addEventListener('load',()=>{
    frame.contentWindow.postMessage({type:'cimai:public-home-context',articles:state.articles.map(({id,title})=>({id,title}))},location.origin);
  },{signal:controller.signal});
  window.addEventListener('message',event=>{
    if(event.source!==frame.contentWindow||event.origin!==location.origin)return;
    if(event.data?.type==='cimai:home-search'){
      navigateSearch('');requestAnimationFrame(()=>$('#page-search')?.focus());
    }
    if(event.data?.type==='cimai:home-theme')openHomeTheme();
  },{signal:controller.signal});
  cleanupPage=()=>{controller.abort();frame.remove();};
}

function landscape() {
  cleanupPage = renderCinematicHome({
    main, articles:state.articles, user:state.user, articleHref, escape:h, date,
    onAccount:()=>$('#account-button').click(),
    onSearch:()=>{navigateSearch('');requestAnimationFrame(()=>$('#page-search')?.focus());},
    onTheme:openHomeTheme,
  });
}

function openHomeTheme(){
  const today=resolveHomeTheme('daily',homeVisitDate)==='magnetic'?'磁脉':'山水';
  openDialog('首页外观',`<p class="theme-intro">两种外观共用同一套知识文库。文章、搜索和项目空间保持一致。</p><form id="home-theme-form" class="theme-options">${[['magnetic','磁脉','定制字标与“来拒去留”交互。'],['landscape','山水','云海与山峦，保留安静的阅读入口。'],['daily','随日期切换',`按北京时间每天交替；${homeDateKey(homeVisitDate)} 为${today}，本次浏览期间保持一致。`]].map(([value,label,description])=>`<label><input type="radio" name="theme" value="${value}" ${homeThemeMode===value?'checked':''}><span><strong>${label}</strong><small>${description}</small></span></label>`).join('')}<div class="form-actions"><button class="button secondary" type="button" data-close>取消</button><button class="button" type="submit">应用外观</button></div></form>`);
  $('#home-theme-form').addEventListener('submit',event=>{
    event.preventDefault();homeThemeMode=new FormData(event.currentTarget).get('theme');
    const saved=saveHomeTheme(themeStorage,homeThemeMode);dialog.close();
    if(route()==='home')render();else location.hash='#home';
    if(!saved)toast('本次浏览已应用；浏览器未允许保存外观偏好。');
  });
}

function filteredArticles() {
  const query=state.query.trim().toLowerCase();
  const items=state.articles.filter(a=>(state.category==='全部'||a.category===state.category)&&`${a.title} ${a.summary} ${a.content}`.toLowerCase().includes(query));
  return items.sort(state.librarySort==='title'?(a,b)=>a.title.localeCompare(b.title,'zh-CN'):(a,b)=>b.updated.localeCompare(a.updated)||b.id-a.id);
}
function renderArticleResults() {
  const items=filteredArticles();$('#results-count').textContent=`共 ${items.length} 篇文章`;
  $('#article-results').innerHTML=items.length?`<div class="card-grid ${state.libraryView==='grid'?'is-grid':''}">${items.map(articleCard).join('')}</div>`:'<div class="empty"><h3>没有找到相关内容</h3><p>换个关键词或分类再试试。</p></div>';
}
function knowledge() {
  const params=new URLSearchParams(location.hash.split('?')[1]||'');const category=params.get('category')||'全部';state.category=category==='全部'||state.articles.some(a=>a.category===category)?category:'全部';state.query=(params.get('q')||'').slice(0,100);state.libraryView=params.get('view')==='grid'?'grid':'list';state.librarySort=params.get('sort')==='title'?'title':'updated';
  const categories=[...new Set(state.articles.map(article=>article.category))];
  main.innerHTML=`<section class="knowledge-intro"><div><span class="eyebrow">磁脉技术与知识</span><h1>知识文库</h1><p>从技术原理到工程应用，让每一份经验有据可查。</p></div><div class="knowledge-intro-meta"><strong>${state.articles.length}</strong> 篇公开知识 / ${categories.length} 个分类</div>${admin()?'<button class="button" data-action="new-article">发布文章</button>':''}</section><div class="knowledge-toolbar"><div class="search-bar"><span aria-hidden="true">⌕</span><input id="search" type="search" aria-label="搜索文章" placeholder="搜索标题、摘要或正文…" maxlength="100" value="${h(state.query)}"></div><select class="library-order" aria-label="文章排序"><option value="updated" ${state.librarySort==='updated'?'selected':''}>最近更新</option><option value="title" ${state.librarySort==='title'?'selected':''}>按标题排序</option></select><div class="library-view" role="group" aria-label="文章显示方式"><button type="button" data-library-view="list" class="${state.libraryView==='list'?'active':''}" aria-pressed="${state.libraryView==='list'}">列表</button><button type="button" data-library-view="grid" class="${state.libraryView==='grid'?'active':''}" aria-pressed="${state.libraryView==='grid'}">卡片</button></div></div><div class="filters">${['全部',...categories].map(name=>`<button type="button" class="filter ${state.category===name?'active':''}" data-category="${h(name)}">${h(name)}<small>${name==='全部'?state.articles.length:state.articles.filter(article=>article.category===name).length}</small></button>`).join('')}</div><div class="library-results-heading"><p id="results-count"></p><span>${state.category==='全部'?'全部知识':h(state.category)}</span></div><div id="article-results"></div>`;
  updateCategoryNavigation();renderArticleResults();
  $('#search').addEventListener('input',event=>{state.query=event.target.value;history.replaceState(null,'',knowledgeHash());renderArticleResults();});
  $('.library-order').addEventListener('change',event=>{state.librarySort=event.target.value;history.replaceState(null,'',knowledgeHash());renderArticleResults();});
}

function searchParams() {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  return { query: params.get('q') || '', scope: ['article','project'].includes(params.get('scope')) ? params.get('scope') : 'all', page: /^[1-9]\d{0,3}$/.test(params.get('page') || '') ? Number(params.get('page')) : 1 };
}
function navigateSearch(query, scope='all', page=1) {
  const params = new URLSearchParams({q:query.trim(),scope,page:String(page)});
  const hash = `#search?${params}`;
  if (location.hash === hash) render(); else location.hash = hash;
}
function highlighted(text, query) {
  const terms = [...new Set(query.trim().split(/\s+/u).filter(Boolean))].slice(0,8).sort((a,b)=>b.length-a.length);
  if (!terms.length) return h(text);
  const escaped = terms.map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`,'giu');
  return String(text).split(pattern).map((part,index)=>index%2 ? `<mark>${h(part)}</mark>` : h(part)).join('');
}
function searchPage() {
  const params = searchParams();
  if (!state.user && params.scope === 'project') params.scope = 'all';
  $('#global-search').value = params.query;
  main.innerHTML = title('全局搜索',state.user?'统一搜索知识文章、项目说明、负责人和截止日期。':'搜索公开文章的标题、分类、摘要与全文。') + `<form id="page-search-form" class="search-bar search-page-form" role="search"><span aria-hidden="true">⌕</span><input name="q" id="page-search" type="search" aria-label="搜索全部内容" placeholder="输入关键词，多个词用空格分隔…" maxlength="100" value="${h(params.query)}"><button class="button small" type="submit">搜索</button></form><div class="filters">${[['all','全部'],['article','知识文章'],...(state.user?[['project','项目空间']]:[])].map(([scope,label])=>`<button class="filter ${params.scope===scope?'active':''}" data-search-scope="${scope}">${label}</button>`).join('')}</div><p class="form-note search-visibility">${state.user?'项目搜索仅限当前账号有权访问的团队空间。':'员工登录后可同时搜索项目；访客搜索不会包含项目内容。'}</p><div id="global-results" aria-live="polite">${params.query?'<div class="loading">正在搜索…</div>':'<div class="empty"><h3>从一个关键词开始</h3><p>例如：充退磁、电磁铆接、技术服务。多个关键词会同时匹配。</p></div>'}</div>`;
  $('#page-search-form').addEventListener('submit',event=>{event.preventDefault();navigateSearch(new FormData(event.currentTarget).get('q'),params.scope);});
  if (!params.query.trim()) return;
  const sequence = searchSequence;
  const userId = state.user?.id;
  api(`search?${new URLSearchParams({q:params.query,scope:params.scope,page:String(params.page)})}`).then(result=>{
    if (sequence!==searchSequence || route()!=='search' || userId!==state.user?.id) return;
    const pages = Math.max(1,Math.ceil(result.total/result.pageSize));
    $('#global-results').innerHTML = `<div class="search-summary"><span>“${h(result.query)}” · 共 <strong>${result.total}</strong> 条结果</span><span>按相关程度排序</span></div>${result.results.length?`<div class="search-results">${result.results.map(item=>`${item.type==='article'?`<a class="search-result" href="${h(articleHref(item.id))}">`:`<button class="search-result" data-search-result="${item.id}" data-result-type="${item.type}">`}<div class="search-result-heading"><span class="badge ${item.type==='project'?'warm':''}">${item.type==='project'?'员工项目':'知识文章'}</span><span>${h(item.category)}</span></div><h3>${highlighted(item.title,result.query)}</h3><p>${highlighted(item.excerpt,result.query)}</p><div class="search-result-meta"><span>${item.type==='project'?`负责人：${h(item.owner)} · `:''}更新于 ${date(item.updated)}</span><span>查看详情 ↗</span></div>${item.type==='article'?'</a>':'</button>'}`).join('')}</div>`:`<div class="empty"><h3>${result.total?'这一页暂时没有结果':'没有找到相关内容'}</h3><p>试试更简短的关键词，或切换搜索范围。</p>${result.total?'<button class="button secondary" data-search-page="1">返回第一页</button>':''}</div>`}${result.total?`<div class="search-pagination"><button class="button secondary small" data-search-page="${params.page-1}" ${params.page<=1?'disabled':''}>上一页</button><span>第 ${params.page} / ${pages} 页</span><button class="button secondary small" data-search-page="${params.page+1}" ${params.page>=pages?'disabled':''}>下一页</button></div>`:''}`;
  }).catch(error=>{
    if (sequence===searchSequence && route()==='search') $('#global-results').innerHTML=`<div class="empty"><h3>搜索暂时无法完成</h3><p>${h(error.message)}</p><button class="button secondary" data-action="retry-search">重新搜索</button></div>`;
  });
}
async function openSearchResult(id,type) {
  if (type==='article') { location.hash=articleHref(id); return; }
  const userId=state.user?.id;
  const project = await api(`projects/${id}`);
  if (!state.user || state.user.id!==userId) return toast('请重新登录后查看项目');
  if (!state.projects.some(item=>item.id===id)) state.projects.push(project);
  else state.projects = state.projects.map(item=>item.id===id?project:item);
  openDialog('项目详情',`<span class="badge status-${h(project.status)}">${statuses[project.status]}</span><h1 class="article-detail-title">${h(project.title)}</h1><p class="form-note">负责人：${h(project.owner)} · 截止日期：${date(project.deadline)}</p><div class="article-body">${h(project.description || '暂无项目说明')}</div><div class="form-actions"><button class="button secondary" data-edit-project="${id}">编辑项目 ↗</button></div>`);
}
function projectCard(project) {
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const overdue=project.deadline && project.deadline<localToday && project.status!=='done';
  return `<article class="project-card"><div class="project-top"><span class="badge status-${h(project.status)}">${statuses[project.status]}</span><button class="text-button" data-edit-project="${project.id}">编辑项目 ↗</button></div><h3>${h(project.title)}</h3><p>${h(project.description || '暂无项目说明')}</p><div class="project-info"><span>负责人<strong>${h(project.owner)}</strong></span><span>截止日期<strong class="${overdue?'overdue':''}">${date(project.deadline)}${overdue?' · 已逾期':''}</strong></span></div><div class="updated">${h(project.updated_by)} 更新于 ${date(project.updated)}</div></article>`;
}
function projects() {
  if (!state.user) {
    main.innerHTML=title('项目空间','员工专属的团队协作空间。')+`<section class="login-panel"><div class="login-emblem" aria-hidden="true">▦</div><h2>每一个进展，都值得被看见。</h2><p>登录后查看团队项目，记录负责人、截止日期与当前进度。项目内容仅向员工开放。</p><button class="button" data-action="login">员工登录 <span>↗</span></button><small>${!state.configured?'员工账号尚未开通，请联系管理员。':!state.loginAvailable?'当前为公开浏览入口，HTTPS 启用后开放员工登录。':'账号由管理员开通，暂不开放访客注册。'}</small></section>`;
    return;
  }
  const items=state.projects.filter(p=>state.status==='all'||p.status===state.status);
  main.innerHTML=title('项目空间',`你好，${h(state.user.name)}。团队项目在这里保持同步。`,'<button class="button" data-action="new-project">＋ 新建项目</button>')+`<div class="project-summary">${[['全部项目',state.projects.length],['进行中',state.projects.filter(p=>p.status==='active').length],['已完成',state.projects.filter(p=>p.status==='done').length]].map(([name,count])=>`<div><span>${name}</span><strong>${count}</strong></div>`).join('')}</div><div class="preview-notice">当前为团队共享空间：所有已开通账号的员工均可查看和更新项目；管理员可以删除项目。</div><div class="filters">${Object.entries({all:'全部项目',...statuses}).map(([key,label])=>`<button class="filter ${state.status===key?'active':''}" data-status="${key}">${label} · ${key==='all'?state.projects.length:state.projects.filter(p=>p.status===key).length}</button>`).join('')}</div>${items.length?`<div class="project-grid">${items.map(projectCard).join('')}</div>`:`<div class="empty"><h3>${state.status==='all'?'从第一个项目开始':'此状态下还没有项目'}</h3><p>写下目标、负责人和截止日期，让大家知道下一步做什么。</p><button class="button secondary" data-action="new-project">新建项目 →</button></div>`}`;
}
function adminPage() {
  if(!admin()){main.innerHTML=title('内容与账号','这里需要管理员账号。')+'<div class="empty"><h3>请使用管理员账号登录</h3><p>管理员负责发布公开文章和开通员工账号。</p><button class="button" data-action="login">员工登录 ↗</button></div>';return;}
  main.innerHTML=title('内容与账号','管理对外分享的知识，以及团队成员的访问权限。')+`<section class="admin-section"><div class="section-heading"><h2>公开文章 · ${state.articles.length}</h2><button class="button small" data-action="new-article">＋ 发布文章</button></div><div class="table-wrap"><table><thead><tr><th>文章标题</th><th>分类</th><th>更新日期</th><th>操作</th></tr></thead><tbody>${state.articles.map(a=>`<tr><td>${h(a.title)}</td><td>${h(a.category)}</td><td>${date(a.updated)}</td><td><div class="inline-actions"><button class="text-button" data-edit-article="${a.id}">编辑</button><button class="text-button" data-delete-article="${a.id}">删除</button></div></td></tr>`).join('')||'<tr><td colspan="4">暂无文章</td></tr>'}</tbody></table></div></section><section class="admin-section"><div class="section-heading"><h2>团队账号 · ${state.users.length}</h2><button class="button small" data-action="new-user">＋ 开通账号</button></div><div class="table-wrap"><table><thead><tr><th>姓名</th><th>账号</th><th>角色 / 状态</th><th>操作</th></tr></thead><tbody>${state.users.map(u=>`<tr><td>${h(u.name)}</td><td>${h(u.username)}</td><td>${u.role==='admin'?'管理员':'员工'} / ${u.active?'已启用':'已停用'}</td><td><div class="inline-actions"><button class="text-button" data-reset-user="${u.id}">重设密码</button>${u.role!=='admin'?`<button class="text-button" data-toggle-user="${u.id}">${u.active?'停用':'启用'}</button>`:''}</div></td></tr>`).join('')}</tbody></table></div></section>`;
  main.insertAdjacentHTML('beforeend',`<section class="admin-section"><div class="section-heading"><div><h2>旧站参考内容 · ${state.references.length} 篇</h2><p class="section-subtitle">预览整理后的内容，确认后再导入公开知识库；不覆盖现有文章。</p></div><button class="button small" data-action="import-references" ${state.references.every(item=>item.imported)?'disabled':''}>导入全部待发布内容</button></div><div class="table-wrap"><table><thead><tr><th>参考文章</th><th>分类</th><th>状态</th><th>操作</th></tr></thead><tbody>${state.references.map(item=>`<tr><td>${h(item.title)}</td><td>${h(item.category)}</td><td>${item.imported?'已导入':'待确认'}</td><td><button class="text-button" data-reference="${h(item.id)}">预览${item.imported?'':'与导入'} ↗</button></td></tr>`).join('')}</tbody></table></div></section>`);
}
function render() {
  cleanupPage?.();cleanupPage=null;
  searchSequence++;
  if(route()==='landscape'){
    homeThemeMode='landscape';saveHomeTheme(themeStorage,homeThemeMode);
    history.replaceState(null,'',location.pathname+location.search+'#home');
  }
  const current=route();
  document.body.classList.toggle('landing',current==='home'||current==='landscape');
  document.body.classList.remove('nav-open');$('#nav-toggle').setAttribute('aria-expanded','false');$('#nav-backdrop').hidden=true;
  updateCategoryNavigation();
  const activeNav=current==='article'?'knowledge':current==='landscape'?'home':current;
  document.querySelectorAll('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===activeNav);if(a.dataset.nav===activeNav)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#page-label').textContent=({home:'磁脉首页',landscape:'山水首页',knowledge:'知识文库',projects:'项目空间',admin:'内容与账号',search:'全局搜索',article:'文章详情'})[current];
  $('#admin-nav').hidden=!admin();
  $('#account-button').textContent=state.user?`${state.user.name} · 退出`:'员工登录 ↗';
  $('#global-search').placeholder=state.user?'搜索知识、项目、负责人…':'搜索公开知识…';
  document.title=`${$('#page-label').textContent} · 磁脉知识库`;
  ({home,landscape,knowledge,projects,admin:adminPage,search:searchPage,article:articlePage})[current]();
}
async function refresh() {
  const [info,articles]=await Promise.all([api('me'),api('articles')]);
  Object.assign(state,info,{articles});
  state.projects=state.user?await api('projects'):[];
  state.users=admin()?await api('users'):[];
  state.references=admin()?await api('reference-articles'):[];
  if(state.category!=='全部'&&!state.articles.some(a=>a.category===state.category))state.category='全部';
  render();
}
function openDialog(heading,content) {
  $('#dialog-content').innerHTML=`<div class="dialog-head"><h2>${heading}</h2><button class="close" data-close aria-label="关闭窗口">×</button></div><div class="dialog-body">${content}</div>`;
  if(!dialog.open)dialog.showModal();
}
const actions=(text='保存')=>`<p class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="button secondary" data-close>取消</button><button class="button" type="submit">${text}</button></div>`;
function formSubmit(handler) {
  $('#dialog form').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');button.disabled=true;
    const values=Object.fromEntries(new FormData(form));
    try{await handler(values);dialog.close();await refresh();toast('操作已完成');}
    catch(error){const output=form.querySelector('.form-error');if(output)output.textContent=error.message;}
    finally{button.disabled=false;}
  });
}
function login() {
  if(!state.loginAvailable){openDialog('员工登录',`<p class="form-note">${state.configured?'员工登录需要加密连接。当前入口可浏览公开知识库，域名与 HTTPS 配置完成后即可登录。':'员工账号正在准备中，请联系管理员开通。公开知识库可以直接浏览。'}</p><div class="form-actions"><button class="button" data-close>知道了</button></div>`);return;}
  if(!state.configured){openDialog('员工登录','<p class="form-note">管理员尚未开通账号。公开知识库可以直接浏览，项目空间将在账号开通后启用。</p><div class="form-actions"><button class="button" data-close>知道了</button></div>');return;}
  openDialog('登录员工空间',`<form><p class="form-note">使用管理员为你开通的账号登录。</p><label>账号<input name="username" required maxlength="64" autocomplete="username" autocapitalize="none"></label><label>密码<input name="password" type="password" required maxlength="128" autocomplete="current-password"></label>${actions('登录 →')}</form>`);
  formSubmit(async values=>{await api('login','POST',values);});
}
function editArticle(id) {
  const item=state.articles.find(a=>a.id===id)||{};
  openDialog(id?'编辑公开文章':'发布公开文章',`<form class="article-editor"><p class="form-note">完成编辑并点击${id?'“保存修改”':'“公开发布”'}后，访客才能看到本次内容。请先确认资料适合公开。</p><div class="draft-import"><button type="button" class="button secondary small" data-draft-import>导入文字稿</button><input type="file" data-draft-file accept=".txt,.md,.markdown,text/plain,text/markdown" aria-label="选择文字稿" hidden><button type="button" class="text-button" data-draft-undo hidden>撤销导入</button><span>支持 TXT、Markdown；Word/PDF 可复制文字后粘贴。</span></div><p class="draft-import-status" data-draft-status role="status"></p><label>文章主标题<input name="title" value="${h(item.title)}" required maxlength="120" placeholder="这篇文章主要解决什么问题？"><small>只写一个主标题，正文里的章节请使用下方排版工具。</small></label><label>分类<input name="category" value="${h(item.category)}" required maxlength="30" placeholder="例如：整体充退磁、电磁脉冲制造"></label><label>内容摘要<textarea name="summary" rows="3" required maxlength="240" placeholder="用两三句话说明：主要结论、适用对象和阅读价值。">${h(item.summary)}</textarea><small>摘要放在主标题下方，帮助读者先抓住重点。</small></label><div class="editor-tabs" role="group" aria-label="正文编辑方式"><button type="button" class="active" data-editor-tab="write" aria-pressed="true">整理正文</button><button type="button" data-editor-tab="preview" aria-pressed="false">预览整篇文章</button></div><div class="draft-tools" id="article-editor-tools" role="group" aria-label="正文排版工具"><button type="button" data-draft-format="section">章节标题</button><button type="button" data-draft-format="subsection">小节标题</button><button type="button" data-draft-format="strong">加粗重点</button><button type="button" data-draft-format="list">要点列表</button><button type="button" data-draft-format="quote">重点提示</button></div><p class="draft-structure" data-draft-structure></p><label>正文内容<textarea class="editor-input" name="content" rows="13" required maxlength="30000" placeholder="先粘贴原文，再选中一行文字，点“章节标题”或“小节标题”；选中关键结论可点“加粗重点”。">${h(item.content)}</textarea></label><div id="draft-preview" class="editor-preview" hidden></div><details class="editor-help"><summary>建议怎样组织一篇技术文章？</summary><p>先写核心结论，再分为适用场景、原理与方法、应用与限制、资料来源等章节。不是每篇都必须有全部章节，先保留材料里确实有的内容。没有结论或参数依据时，不必补写。</p><p>也可直接使用 ## 章节标题、### 小节标题、- 要点、**重点** 和 &gt; 提示。旧文章的“一、二、三、”也会生成目录。</p></details>${actions(id?'保存修改':'公开发布')}</form>`);
  formSubmit(values=>api(`articles${id?`/${id}`:''}`,id?'PUT':'POST',values));
  mountArticleEditor($('#dialog form'));
}
function editProject(id) {
  const item=state.projects.find(p=>p.id===id)||{owner:state.user.name,status:'planned'};
  openDialog(id?'编辑项目':'新建项目',`<form><label>项目名称<input name="title" value="${h(item.title)}" required maxlength="120"></label><label>项目说明与下一步<textarea name="description" rows="5" maxlength="5000">${h(item.description)}</textarea></label><div class="form-row"><label>负责人<input name="owner" value="${h(item.owner)}" required maxlength="60"></label><label>截止日期<input name="deadline" type="date" value="${h(item.deadline)}"></label></div><label>当前状态<select name="status">${Object.entries(statuses).map(([key,label])=>`<option value="${key}" ${key===item.status?'selected':''}>${label}</option>`).join('')}</select></label>${id&&admin()?`<button type="button" class="text-button" data-delete-project="${id}">删除这个项目</button>`:''}${actions()}</form>`);
  formSubmit(values=>api(`projects${id?`/${id}`:''}`,id?'PUT':'POST',values));
}
function newUser() {
  openDialog('开通员工账号',`<form><label>员工姓名<input name="name" required maxlength="60" autocomplete="off"></label><label>登录账号<input name="username" required pattern="[a-zA-Z0-9._-]{3,64}" maxlength="64" placeholder="至少 3 位字母或数字，可用 . _ -" autocomplete="off" autocapitalize="none"></label><label>初始密码<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label><p class="form-note">密码至少 12 个字符。请将账号和密码私下告知本人，所有员工共享项目空间。</p>${actions('开通账号')}</form>`);
  formSubmit(values=>api('users','POST',values));
}
function resetUser(id) {
  const user=state.users.find(u=>u.id===id);
  openDialog('重设账号密码',`<form><p class="form-note">为 ${h(user.name)} 设置新密码，原有登录会立即失效。</p><label>新密码<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label>${actions('重设密码')}</form>`);
  formSubmit(values=>api(`users/${id}`,'PUT',values));
}
function confirmAction(heading,message,handler) {
  openDialog(heading,`<form><p class="form-note">${h(message)}</p>${actions('确认')}</form>`);formSubmit(handler);
}
function articlePage() {
  const returnHash=articleReturnHash();
  const returnLabel=returnHash.startsWith('#search')?'返回搜索结果':returnHash==='#home'?'返回首页':returnHash==='#landscape'?'返回山水首页':'返回知识文库';
  const backLink=`<a class="text-button article-back" href="${h(returnHash)}">← ${returnLabel}</a>`;
  const id=location.hash.slice(1).split('?')[0].split('/')[1];
  const sequence=searchSequence;
  const showError=message=>{main.innerHTML=`<div class="article-page">${backLink}<section class="empty"><h1>暂时无法查看文章</h1><p>${h(message)}</p><a class="button secondary" href="#knowledge">浏览知识文库</a></section></div>`;};
  if (!/^[1-9]\d{0,9}$/.test(id || '')) { showError('文章地址不正确，请从知识文库重新打开。'); return; }
  main.innerHTML=`<div class="article-page">${backLink}<div class="loading" role="status">正在加载文章…</div></div>`;
  api(`articles/${id}`).then(item=>{
    if (sequence!==searchSequence || route()!=='article') return;
    if (state.articles.some(existing=>existing.id===item.id)) state.articles=state.articles.map(existing=>existing.id===item.id?item:existing);
    else state.articles.push(item);
    document.title=`${item.title} · 磁脉知识库`;
    updateCategoryNavigation(item.category);
    cleanupPage=mountReader({main,article:item,articles:state.articles,backLink,articleHref,escape:h,date,isAdmin:admin(),toast});
  }).catch(error=>{if(sequence===searchSequence && route()==='article')showError(error.message);});
}

function previewReference(id) {
  const item=state.references.find(article=>article.id===id);if(!item)return;
  openDialog('旧站参考内容',`<span class="badge">${h(item.category)}</span><h1 class="article-detail-title">${h(item.title)}</h1><p class="form-note">${h(item.source)}</p><div class="article-body">${h(item.content)}</div>${item.imported?'<p class="form-note">已导入知识库，可在公开文章列表中编辑。</p>':`<div class="form-actions"><button class="button" data-import-reference="${h(id)}">确认并公开导入</button></div>`}`);
}
function confirmReferenceImport(ids) {
  confirmAction('导入公开知识库',`将这 ${ids.length} 篇参考文章加入公开知识库，所有访客均可阅读。现有文章保留，已导入的内容不会重复添加。`,()=>api('reference-articles/import','POST',{ids}));
}
document.addEventListener('click',async event=>{
  const target=event.target.closest('button,[data-category],[data-status]');if(!target)return;
  try{
    if(target.hasAttribute('data-close'))return dialog.close();
    if(target.dataset.searchScope){const params=searchParams();return navigateSearch(params.query,target.dataset.searchScope);}
    if(target.dataset.searchPage){const params=searchParams();return navigateSearch(params.query,params.scope,Number(target.dataset.searchPage));}
    if(target.dataset.searchResult)return await openSearchResult(Number(target.dataset.searchResult),target.dataset.resultType);
    if(target.dataset.reference)return previewReference(target.dataset.reference);
    if(target.dataset.importReference)return confirmReferenceImport([target.dataset.importReference]);
    if(target.dataset.editArticle)return editArticle(Number(target.dataset.editArticle));
    if(target.dataset.editProject)return editProject(Number(target.dataset.editProject));
    if(target.dataset.category){navigateKnowledge(target.dataset.category);return;}
    if(target.dataset.libraryCategory){navigateKnowledge(target.dataset.libraryCategory,'');return;}
    if(target.dataset.libraryView){state.libraryView=target.dataset.libraryView;navigateKnowledge();return;}
    if(target.dataset.editorTab){const preview=target.dataset.editorTab==='preview';const textarea=$('#dialog textarea[name=content]'),form=textarea.form;$('#draft-preview').hidden=!preview;textarea.closest('label').hidden=preview;textarea.required=!preview;$('#article-editor-tools').hidden=preview;if(preview)$('#draft-preview').innerHTML=draftPreview({title:form.elements.title.value,summary:form.elements.summary.value,content:textarea.value}).replaceAll('id="section-','id="draft-section-');document.querySelectorAll('[data-editor-tab]').forEach(button=>{button.classList.toggle('active',(button.dataset.editorTab==='preview')===preview);button.setAttribute('aria-pressed',String((button.dataset.editorTab==='preview')===preview));});return;}
    if(target.dataset.status){state.status=target.dataset.status;projects();return;}
    if(target.dataset.resetUser)return resetUser(Number(target.dataset.resetUser));
    if(target.dataset.deleteArticle){const id=Number(target.dataset.deleteArticle);return confirmAction('删除文章','删除后访客将无法再浏览这篇文章。确定删除？',()=>api(`articles/${id}`,'DELETE',{}));}
    if(target.dataset.deleteProject){const id=Number(target.dataset.deleteProject);return confirmAction('删除项目','这个项目会从团队空间中删除。确定删除？',()=>api(`projects/${id}`,'DELETE',{}));}
    if(target.dataset.toggleUser){const id=Number(target.dataset.toggleUser);const user=state.users.find(u=>u.id===id);return confirmAction(user.active?'停用账号':'启用账号',`${user.active?'停用后该员工将立即退出，并无法访问项目空间。':'启用后该员工可以重新登录。'}`,()=>api(`users/${id}`,'PUT',{active:!user.active}));}
    const action=target.dataset.action;
    if(action==='login')login();
    if(action==='new-article')editArticle();
    if(action==='new-project')editProject();
    if(action==='new-user')newUser();
    if(action==='retry-search')render();
    if(action==='import-references')confirmReferenceImport(state.references.filter(item=>!item.imported).map(item=>item.id));
  }catch(error){toast(error.message);}
});
function toggleNavigation(open) {document.body.classList.toggle('nav-open',open);$('#nav-toggle').setAttribute('aria-expanded',String(open));$('#nav-backdrop').hidden=!open;}
$('#nav-toggle').addEventListener('click',()=>toggleNavigation(!document.body.classList.contains('nav-open')));
$('#nav-backdrop').addEventListener('click',()=>toggleNavigation(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape')toggleNavigation(false);});
$('#account-button').addEventListener('click',()=>{
  if(state.user)confirmAction('退出登录','退出后仍可浏览公开知识库。',async()=>{await api('logout','POST',{});state.user=null;state.projects=[];state.users=[];});
  else login();
});
$('#global-search-form').addEventListener('submit',event=>{event.preventDefault();navigateSearch($('#global-search').value);});
document.addEventListener('keydown',event=>{
  if ((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='k') {event.preventDefault();if(['home','landscape'].includes(route())){navigateSearch('');requestAnimationFrame(()=>$('#page-search')?.focus());}else $('#global-search').focus();}
});
window.addEventListener('hashchange',()=>{dialog.close();render();window.scrollTo(0,0);});
dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
$('#year').textContent=new Date().getFullYear();
refresh().catch(error=>{main.innerHTML=`<div class="empty"><h2>暂时无法加载知识库</h2><p>${h(error.message)}</p><button class="button" id="retry">重新加载</button></div>`;$('#retry').addEventListener('click',()=>location.reload());});
