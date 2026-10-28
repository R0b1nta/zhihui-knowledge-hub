import { createCloudScene } from './clouds.js';

const brandSymbol = `<svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M7 7v11c0 7 7 11 11 11S29 25 29 18V7M13 7v11c0 3 3 5 5 5s5-2 5-5V7" stroke="currentColor" stroke-width="1.5"/><path d="M7 7h6m10 0h6M18 3v9" stroke="currentColor" stroke-width="1.5"/></svg>`;
const searchSymbol = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="m15.5 15.5 4.5 4.5" stroke="currentColor" stroke-width="1.4"/></svg>`;
const directions = [
  { id:'magnetization', title:'整体充退磁', subtitle:'从装配，到全生命周期', description:'围绕大型永磁装备，探索无磁装配、原位充退磁，以及制造与运维中的磁场应用。', query:'充退磁', terms:['充退磁'], caption:'永磁装备与磁场的相互作用' },
  { id:'forming', title:'电磁脉冲制造', subtitle:'让瞬态磁场，作用于材料', description:'以脉冲电磁力驱动金属高速运动与变形，了解管件连接、电磁铆接和线缆压接的技术路径。', query:'电磁', terms:['管件','铆接','压接'], caption:'线圈、磁场与金属工件' },
  { id:'coils', title:'特种磁极与线圈', subtitle:'从磁场需求，走向工程设计', description:'围绕特定应用中的磁场需求，认识特种磁极、线圈设计与电磁加工技术服务。', query:'线圈', terms:['磁极','线圈'], caption:'面向应用的磁场发生部件' },
];

function fieldDrawing(id) {
  const rings = Array.from({length:9}, (_,i)=>`<ellipse cx="340" cy="198" rx="${125+i*17}" ry="${43+i*12}"/>`).join('');
  const coil = Array.from({length:13},(_,i)=>`<path d="M${241+i*16} 153c-19 12-19 79 0 91"/>`).join('');
  const workpiece = id==='forming'
    ? `<path d="M230 183h220v38H230z" fill="#9aafb4"/><ellipse cx="450" cy="202" rx="10" ry="19" fill="#617e88"/><path d="M306 170v64m67-64v64" stroke="#e0e9e8" stroke-width="2"/>`
    : id==='coils'
      ? `<path d="M264 143v82c0 40 40 63 76 63s76-23 76-63v-82" fill="none" stroke="#8da5ac" stroke-width="34"/><path d="M264 136v51m152-51v51" stroke="#c1d2d3" stroke-width="38"/>`
      : `<path d="M240 168h200v67H240z" fill="#8ca4ac"/><ellipse cx="240" cy="201" rx="15" ry="33" fill="#b7c9cb"/><ellipse cx="440" cy="201" rx="15" ry="33" fill="#607e89"/><path d="M254 171h172" stroke="#d7e2e2" stroke-width="2"/>`;
  return `<svg class="field-drawing" viewBox="0 0 680 410" role="img" aria-label="${directions.find(d=>d.id===id).caption}，概念示意"><defs><radialGradient id="field-glow"><stop stop-color="#afc9cd" stop-opacity=".25"/><stop offset="1" stop-color="#afc9cd" stop-opacity="0"/></radialGradient></defs><ellipse cx="340" cy="198" rx="310" ry="185" fill="url(#field-glow)"/><g class="field-lines" fill="none" stroke="#aac7ce" stroke-width=".8" opacity=".35">${rings}</g><path d="M70 198h540M340 36v324" stroke="#809ea8" stroke-width=".7" stroke-dasharray="3 8" opacity=".45"/><g>${workpiece}</g><g class="field-coil" fill="none" stroke="#d1e1df" stroke-width="2.4">${id==='coils'?'':coil}</g><ellipse class="field-trace" cx="340" cy="198" rx="210" ry="103" fill="none" stroke="#e3ede9" stroke-width="1.4" stroke-dasharray="35 850"/><circle cx="340" cy="198" r="3" fill="#e8f0ed"/></svg>`;
}

export function renderCinematicHome({main, articles, user, articleHref, escape:h, date, onAccount, onSearch}) {
  const controller = new AbortController();
  const signal = controller.signal;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let manuallyPaused = false;
  let frame = 0;
  let selected = 0;
  const recent = articles.filter(a=>!a.summary.startsWith('示例文章')).slice(0,3);
  const visibleArticles = recent.length ? recent : articles.slice(0,3);
  const articleRows = visibleArticles.map(article=>`<a class="home-article" href="${h(articleHref(article.id))}"><span class="home-article-category">${h(article.category)}</span><div><h3>${h(article.title)}</h3><p>${h(article.summary)}</p></div><time>${date(article.updated)}</time><span class="home-article-open" aria-hidden="true">↗</span></a>`).join('');
  main.innerHTML = `
    <div class="cinematic-home">
      <header class="home-header">
        <a class="home-brand" href="#home" aria-label="磁脉首页">${brandSymbol}<span>磁脉</span></a>
        <nav class="home-nav" aria-label="首页导航"><button type="button" data-home-jump="home-technology">技术方向</button><a href="#knowledge">知识文库</a><a href="#projects">项目空间</a></nav>
        <div class="home-header-actions"><button class="home-search" type="button" data-home-search aria-label="搜索公开知识">${searchSymbol}</button><button class="home-account" type="button" data-home-account>${user?h(user.name):'员工登录'}</button></div>
      </header>
      <section class="home-hero" aria-labelledby="home-title">
        <div class="home-landscape" aria-hidden="true"><img class="home-landscape-image" src="/assets/cimai-mountains.jpg" width="1672" height="941" alt="" fetchpriority="high" decoding="async"></div>
        <div class="home-hero-shade" aria-hidden="true"></div><canvas class="home-cloud-canvas" aria-hidden="true"></canvas>
        <div class="home-mist home-mist-back" aria-hidden="true"></div><div class="home-mist home-mist-front" aria-hidden="true"></div>
        <div class="home-hero-center"><h1 id="home-title" class="home-wordmark" aria-label="磁脉"><img src="/assets/cimai-landscape-v2.svg" width="535" height="164" alt="" aria-hidden="true" draggable="false" fetchpriority="high"></h1><p class="home-hero-tagline"><span>驭磁成器</span><span>聚脉成章</span></p></div>
        <div class="home-hero-bottom"><p>脉冲强磁场技术<br><span>从科学探索，到工程应用</span></p><button class="home-scroll" type="button" data-home-jump="home-technology"><span>向下探索</span><svg viewBox="0 0 20 32" fill="none" aria-hidden="true"><path d="M10 1v28m-6-6 6 6 6-6" stroke="currentColor"/></svg></button><div class="home-scene-actions"><button class="home-settings-toggle" type="button" aria-label="调整云海效果" aria-expanded="false" aria-controls="home-scene-settings"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18M8 3v6m8 0v6m-7 0v6" stroke="currentColor" stroke-width="1.3"/></svg></button><button class="home-motion" type="button" aria-pressed="false"><span class="home-motion-icon" aria-hidden="true"></span><span class="home-motion-label">暂停动态背景</span></button></div></div><div class="home-scene-settings" id="home-scene-settings" hidden><div class="home-settings-heading"><span>云海效果</span><button type="button" data-close-settings aria-label="关闭效果设置">×</button></div><label for="home-cloud-density">云雾浓度 <output id="home-density-value">65%</output></label><input id="home-cloud-density" type="range" min="0" max="100" value="65" data-scene-setting="density"><label for="home-cloud-speed">流动速度 <output id="home-speed-value">35%</output></label><input id="home-cloud-speed" type="range" min="0" max="100" value="35" data-scene-setting="speed"><label for="home-cloud-depth">交互景深 <output id="home-depth-value">50%</output></label><input id="home-cloud-depth" type="range" min="0" max="100" value="50" data-scene-setting="depth"><p>移动鼠标，感受云层的远近变化。</p></div>
      </section>
      <section class="home-technology" id="home-technology" aria-labelledby="home-technology-title">
        <div class="home-section-intro"><h2 id="home-technology-title">看不见的磁场，<br>看得见的改变。</h2><p>磁脉电气（东莞）有限公司，聚焦脉冲强磁场技术的产业化应用。<br>在这里，了解我们的技术方向，走近每一项应用背后的原理。</p></div>
        <div class="home-tech-layout"><div class="home-directions" role="tablist" aria-label="技术方向" aria-orientation="vertical">${directions.map((d,i)=>`<button class="home-direction${i===0?' is-selected':''}" type="button" role="tab" id="home-tab-${d.id}" aria-selected="${i===0}" aria-controls="home-direction-panel" tabindex="${i===0?0:-1}" data-direction="${i}"><span>${d.title}</span><small>${d.subtitle}</small><span class="home-direction-arrow" aria-hidden="true">↗</span></button>`).join('')}</div><div class="home-direction-panel" id="home-direction-panel" role="tabpanel" aria-labelledby="home-tab-magnetization" tabindex="0"></div></div>
      </section>
      <section class="home-library" aria-labelledby="home-library-title"><div class="home-library-heading"><div><span class="home-section-note">公开知识，持续积累</span><h2 id="home-library-title">让技术，有迹可循。</h2></div><a href="#knowledge" class="home-inline-link">浏览知识文库 <span aria-hidden="true">↗</span></a></div><div class="home-articles">${articleRows || '<p class="home-no-articles">技术文章正在整理中，欢迎稍后回来查阅。</p>'}</div></section>
      <section class="home-team" aria-labelledby="home-team-title"><div><h2 id="home-team-title">让经验留下来，<br>让协作向前走。</h2><p>员工登录后，进入团队的项目空间。</p></div><a class="home-team-link" href="#projects">进入项目空间 <span aria-hidden="true">↗</span></a></section>
      <footer class="home-footer"><a class="home-footer-brand" href="#home">磁脉</a><p>磁脉电气（东莞）有限公司</p><span>© ${new Date().getFullYear()} 磁脉知识库</span></footer>
    </div>`;

  const root = main.querySelector('.cinematic-home');
  const hero = root.querySelector('.home-hero');
  const header = root.querySelector('.home-header');
  const motionButton = root.querySelector('.home-motion');
  const panel = root.querySelector('#home-direction-panel');
  const canvas = root.querySelector('.home-cloud-canvas');
  const scene = createCloudScene(canvas);
  if(!scene)canvas.hidden=true;
  root.classList.toggle('has-cloud-scene',!!scene);
  const settingsPanel=root.querySelector('.home-scene-settings');
  const settingsToggle=root.querySelector('.home-settings-toggle');
  let sceneValues={density:.65,speed:.7,depth:.5};
  function setSettingsOpen(open){settingsPanel.hidden=!open;settingsToggle.setAttribute('aria-expanded',String(open));}
  const tabs = [...root.querySelectorAll('[data-direction]')];
  function showDirection(index) {
    selected = index;
    const d = directions[index];
    const article = articles.find(a=>d.terms.some(term=>a.title.includes(term)));
    const href = article ? articleHref(article.id) : `#search?${new URLSearchParams({q:d.query,scope:'article',page:'1'})}`;
    tabs.forEach((tab,i)=>{tab.classList.toggle('is-selected',i===index);tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});
    panel.setAttribute('aria-labelledby',`home-tab-${d.id}`);
    panel.innerHTML = `<div class="home-field-stage">${fieldDrawing(d.id)}<span class="home-drawing-label">技术概念示意</span></div><div class="home-direction-copy"><div><h3>${d.title}</h3><p>${d.description}</p></div><a class="home-inline-link" href="${h(href)}">了解相关技术 <span aria-hidden="true">↗</span></a></div>`;
  }
  function syncMotion() {
    const paused = reduced.matches || manuallyPaused;
    root.classList.toggle('is-motion-paused',paused);
    scene?.setPaused(paused);
    motionButton.setAttribute('aria-pressed',String(paused));
    motionButton.disabled=reduced.matches;
    motionButton.setAttribute('aria-label',reduced.matches?'已按系统设置关闭动态效果':paused?'播放动态背景':'暂停动态背景');
    motionButton.querySelector('.home-motion-label').textContent=reduced.matches?'动态效果已关闭':paused?'播放动态背景':'暂停动态背景';
    if (paused) hero.style.setProperty('--home-scroll','0');
    else updateScroll();
  }
  function updateScroll() {
    if (frame) return;
    frame = requestAnimationFrame(()=>{
      frame=0;
      const progress=Math.min(Math.max(window.scrollY/hero.offsetHeight,0),1);
      header.classList.toggle('is-solid',progress>.7);
      if (!reduced.matches && !manuallyPaused) hero.style.setProperty('--home-scroll',String(progress));
    });
  }
  root.addEventListener('click',event=>{
    const target=event.target.closest('button');
    if(!target) return;
    if(target.dataset.homeJump){root.querySelector(`#${target.dataset.homeJump}`)?.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});return;}
    if(target===settingsToggle || settingsToggle.contains(target)){setSettingsOpen(settingsPanel.hidden);return;}
    if(target.hasAttribute('data-close-settings')){setSettingsOpen(false);return;}
    if(target.hasAttribute('data-home-account')){onAccount();return;}
    if(target.hasAttribute('data-home-search')){onSearch();return;}
    if(target.dataset.direction!==undefined){showDirection(Number(target.dataset.direction));return;}
    if(target===motionButton || motionButton.contains(target)){manuallyPaused=!manuallyPaused;syncMotion();}
  },{signal});
  root.addEventListener('input',event=>{
    const key=event.target.dataset.sceneSetting;if(!key)return;const value=Number(event.target.value);
    sceneValues[key]=key==='speed'?value/50:value/100;scene?.configure(sceneValues);
    root.querySelector(`#home-${key}-value`).textContent=`${value}%`;
    root.style.setProperty('--cloud-density',String(sceneValues.density));root.style.setProperty('--mist-duration',`${45/(.3+sceneValues.speed)}s`);
  },{signal});
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!settingsPanel.hidden){setSettingsOpen(false);settingsToggle.focus();return;}
    if(!event.target.matches('[data-direction]'))return;
    const actions={ArrowDown:(selected+1)%3,ArrowRight:(selected+1)%3,ArrowUp:(selected+2)%3,ArrowLeft:(selected+2)%3,Home:0,End:2};
    if(actions[event.key]===undefined)return;
    event.preventDefault();showDirection(actions[event.key]);tabs[selected].focus();
  },{signal});
  window.addEventListener('scroll',updateScroll,{passive:true,signal});
  window.addEventListener('resize',updateScroll,{passive:true,signal});
  reduced.addEventListener('change',syncMotion);
  const observer = new IntersectionObserver(entries=>{const visible=entries[0].isIntersecting;root.classList.toggle('is-hero-away',!visible);scene?.setActive(visible);});
  observer.observe(hero);
  showDirection(0);syncMotion();updateScroll();
  return ()=>{controller.abort();observer.disconnect();scene?.destroy();reduced.removeEventListener('change',syncMotion);cancelAnimationFrame(frame);};
}
