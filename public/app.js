const $ = selector => document.querySelector(selector);
const main = $('#main');
const dialog = $('#dialog');
const state = { articles: [], projects: [], users: [], user: null, configured: false, loginAvailable: false, category: '全部', query: '', status: 'all' };
const statuses = { planned: '待开始', active: '进行中', done: '已完成' };
const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => value ? new Date(value).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}) : '未设置';
const route = () => ['home','knowledge','projects','admin'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
const admin = () => state.user?.role === 'admin';
let toastTimer;
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
function articleCard(article) { return `<button class="article-card" data-article="${article.id}"><span class="badge">${h(article.category)}</span><h3>${h(article.title)}</h3><p>${h(article.summary)}</p><div class="article-meta"><span>更新于 ${date(article.updated)}</span><span aria-hidden="true">↗</span></div></button>`; }
function home() {
  const categories = new Set(state.articles.map(a => a.category)).size;
  main.innerHTML=`<section class="hero"><div class="hero-copy"><span class="eyebrow">KNOWLEDGE CONNECTS US</span><h1>让每一份经验，<br>成为下一步的力量。</h1><p>在这里发现知识、分享方法，<br>也让团队的每一个项目，向前一步。</p><div class="hero-actions"><a class="button" href="#knowledge">探索知识文库 <span>↗</span></a><a class="button secondary" href="#projects">进入项目空间 <span>→</span></a></div></div><div class="hero-art" aria-hidden="true"><i></i></div></section><div class="intro-row"><span>欢迎来到磁脉，知识与协作从这里连接。</span><div class="intro-stats"><span><strong>${state.articles.length}</strong>篇公开文章</span><span><strong>${categories}</strong>个知识分类</span></div></div><div class="section-heading"><h2>找到你的空间</h2><span class="eyebrow">OUR SPACES</span></div><div class="spaces"><a class="space-card" href="#knowledge"><div class="space-icon" aria-hidden="true">▤</div><div><h3>知识文库 <span class="badge">公开</span></h3><p>让知识有迹可循，让经验触手可及。</p></div><span class="arrow">↗</span></a><a class="space-card project" href="#projects"><div class="space-icon" aria-hidden="true">▦</div><div><h3>项目空间 <span class="badge warm">员工专属</span></h3><p>看见目标与进展，让协作更有方向。</p></div><span class="arrow">↗</span></a></div><div class="section-heading"><div><h2>最近更新</h2><p class="section-subtitle">沉淀一点经验，积累一份共同的知识。</p></div><a class="text-button" href="#knowledge">全部文章 <span>→</span></a></div>${state.articles.length ? `<div class="card-grid">${state.articles.slice(0,3).map(articleCard).join('')}</div>` : '<div class="empty"><h3>知识正在积累中</h3><p>正式文章发布后，会在这里展示。</p></div>'}<div class="bottom-note"><span>◈</span>当前文章为使用示例，正式资料将由管理员陆续发布。项目内容仅向已登录的员工开放。</div>`;
}
function filteredArticles() {
  const query = state.query.trim().toLowerCase();
  return state.articles.filter(a => (state.category==='全部' || a.category===state.category) && `${a.title} ${a.summary} ${a.content}`.toLowerCase().includes(query));
}
function renderArticleResults() {
  const items = filteredArticles();
  $('#results-count').textContent=`共 ${items.length} 篇文章`;
  $('#article-results').innerHTML = items.length ? `<div class="card-grid">${items.map(articleCard).join('')}</div>` : '<div class="empty"><h3>没有找到相关内容</h3><p>换个关键词或分类再试试。</p></div>';
}
function knowledge() {
  main.innerHTML=title('知识文库','公开的知识与方法，随时查阅，持续积累。',admin()?'<button class="button" data-action="new-article">＋ 发布文章</button>':'<span class="badge">无需登录</span>')+`<div class="search-bar"><span aria-hidden="true">⌕</span><input id="search" type="search" aria-label="搜索文章" placeholder="搜索文章标题、摘要或正文…" value="${h(state.query)}"></div><div class="filters">${['全部',...new Set(state.articles.map(a=>a.category))].map(c=>`<button class="filter ${c===state.category?'active':''}" data-category="${h(c)}">${h(c)}</button>`).join('')}</div><p class="section-subtitle" id="results-count"></p><div class="section-heading"></div><div id="article-results"></div>`;
  renderArticleResults();
  $('#search').addEventListener('input',event=>{state.query=event.target.value;renderArticleResults();});
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
  main.innerHTML=title('项目空间',`你好，${h(state.user.name)}。团队项目在这里保持同步。`,'<button class="button" data-action="new-project">＋ 新建项目</button>')+`<div class="preview-notice">当前为团队共享空间：所有已开通账号的员工均可查看和更新项目；管理员可以删除项目。</div><div class="filters">${Object.entries({all:'全部项目',...statuses}).map(([key,label])=>`<button class="filter ${state.status===key?'active':''}" data-status="${key}">${label} · ${key==='all'?state.projects.length:state.projects.filter(p=>p.status===key).length}</button>`).join('')}</div>${items.length?`<div class="project-grid">${items.map(projectCard).join('')}</div>`:`<div class="empty"><h3>${state.status==='all'?'从第一个项目开始':'此状态下还没有项目'}</h3><p>写下目标、负责人和截止日期，让大家知道下一步做什么。</p><button class="button secondary" data-action="new-project">新建项目 →</button></div>`}`;
}
function adminPage() {
  if(!admin()){main.innerHTML=title('内容与账号','这里需要管理员账号。')+'<div class="empty"><h3>请使用管理员账号登录</h3><p>管理员负责发布公开文章和开通员工账号。</p><button class="button" data-action="login">员工登录 ↗</button></div>';return;}
  main.innerHTML=title('内容与账号','管理对外分享的知识，以及团队成员的访问权限。')+`<section class="admin-section"><div class="section-heading"><h2>公开文章 · ${state.articles.length}</h2><button class="button small" data-action="new-article">＋ 发布文章</button></div><div class="table-wrap"><table><thead><tr><th>文章标题</th><th>分类</th><th>更新日期</th><th>操作</th></tr></thead><tbody>${state.articles.map(a=>`<tr><td>${h(a.title)}</td><td>${h(a.category)}</td><td>${date(a.updated)}</td><td><div class="inline-actions"><button class="text-button" data-edit-article="${a.id}">编辑</button><button class="text-button" data-delete-article="${a.id}">删除</button></div></td></tr>`).join('')||'<tr><td colspan="4">暂无文章</td></tr>'}</tbody></table></div></section><section class="admin-section"><div class="section-heading"><h2>团队账号 · ${state.users.length}</h2><button class="button small" data-action="new-user">＋ 开通账号</button></div><div class="table-wrap"><table><thead><tr><th>姓名</th><th>账号</th><th>角色 / 状态</th><th>操作</th></tr></thead><tbody>${state.users.map(u=>`<tr><td>${h(u.name)}</td><td>${h(u.username)}</td><td>${u.role==='admin'?'管理员':'员工'} / ${u.active?'已启用':'已停用'}</td><td><div class="inline-actions"><button class="text-button" data-reset-user="${u.id}">重设密码</button>${u.role!=='admin'?`<button class="text-button" data-toggle-user="${u.id}">${u.active?'停用':'启用'}</button>`:''}</div></td></tr>`).join('')}</tbody></table></div></section>`;
}
function render() {
  const current=route();
  document.querySelectorAll('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===current);if(a.dataset.nav===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#page-label').textContent=({home:'空间首页',knowledge:'知识文库',projects:'项目空间',admin:'内容与账号'})[current];
  $('#admin-nav').hidden=!admin();
  $('#account-button').textContent=state.user?`${state.user.name} · 退出`:'员工登录 ↗';
  document.title=`${$('#page-label').textContent} · 磁脉知识库`;
  ({home,knowledge,projects,admin:adminPage})[current]();
}
async function refresh() {
  const [info,articles]=await Promise.all([api('me'),api('articles')]);
  Object.assign(state,info,{articles});
  state.projects=state.user?await api('projects'):[];
  state.users=admin()?await api('users'):[];
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
  openDialog(id?'编辑公开文章':'发布公开文章',`<form><p class="form-note">保存后所有访客均可看到全文，请确认内容适合公开。</p><label>标题<input name="title" value="${h(item.title)}" required maxlength="120"></label><label>分类<input name="category" value="${h(item.category)}" required maxlength="30" placeholder="例如：使用指南、技术知识"></label><label>摘要<textarea name="summary" rows="2" required maxlength="240">${h(item.summary)}</textarea></label><label>正文<textarea name="content" rows="10" required maxlength="30000">${h(item.content)}</textarea></label>${actions(id?'保存修改':'公开发布')}</form>`);
  formSubmit(values=>api(`articles${id?`/${id}`:''}`,id?'PUT':'POST',values));
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
function readArticle(id) {
  const item=state.articles.find(a=>a.id===id);if(!item)return;
  openDialog('知识文库',`<span class="badge">${h(item.category)}</span><h1 class="article-detail-title">${h(item.title)}</h1><p class="form-note">更新于 ${date(item.updated)}</p><div class="article-body">${h(item.content)}</div>${admin()?`<div class="form-actions"><button class="button secondary" data-edit-article="${id}">编辑文章</button></div>`:''}`);
}
document.addEventListener('click',async event=>{
  const target=event.target.closest('button,[data-category],[data-status]');if(!target)return;
  try{
    if(target.hasAttribute('data-close'))return dialog.close();
    if(target.dataset.article)return readArticle(Number(target.dataset.article));
    if(target.dataset.editArticle)return editArticle(Number(target.dataset.editArticle));
    if(target.dataset.editProject)return editProject(Number(target.dataset.editProject));
    if(target.dataset.category){state.category=target.dataset.category;knowledge();return;}
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
  }catch(error){toast(error.message);}
});
$('#account-button').addEventListener('click',()=>{
  if(state.user)confirmAction('退出登录','退出后仍可浏览公开知识库。',async()=>{await api('logout','POST',{});state.user=null;state.projects=[];state.users=[];});
  else login();
});
window.addEventListener('hashchange',()=>{dialog.close();render();window.scrollTo(0,0);});
dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
$('#year').textContent=new Date().getFullYear();
refresh().catch(error=>{main.innerHTML=`<div class="empty"><h2>暂时无法加载知识库</h2><p>${h(error.message)}</p><button class="button" id="retry">重新加载</button></div>`;$('#retry').addEventListener('click',()=>location.reload());});
