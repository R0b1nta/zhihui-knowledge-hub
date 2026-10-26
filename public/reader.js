import { renderDocument, relatedArticles } from './document.js';

export function mountReader({main,article,articles,backLink,articleHref,escape:h,date,isAdmin,toast}){
  const documentView=renderDocument(article.content);
  const related=relatedArticles(articles,article);
  const siblings=articles.filter(item=>item.category===article.category);
  const sequence=siblings.length>1?siblings:articles;
  const position=sequence.findIndex(item=>item.id===article.id);
  const previous=sequence[position-1],next=sequence[position+1];
  const categoryLink=`#knowledge?${new URLSearchParams({category:article.category})}`;
  const toc=documentView.headings.map(heading=>`<button type="button" data-reading-section="${heading.id}" class="${heading.level===3?'toc-subheading':''}">${h(heading.text)}</button>`).join('')+(related.length?'<button type="button" data-reading-section="reading-related">相关知识</button>':'');
  main.innerHTML=`<div class="reading-progress" aria-hidden="true"><i></i></div><div class="article-page">${backLink}<div class="article-layout"><article class="article-reading"><header class="article-reading-header"><div class="article-crumbs"><a href="#knowledge">知识文库</a><span>/</span><a href="${h(categoryLink)}">${h(article.category)}</a><span>/</span>文章</div><div class="article-reading-meta"><span class="badge">公开知识</span><time>更新于 ${date(article.updated)}</time><span>约 ${documentView.minutes} 分钟阅读</span></div><h1>${h(article.title)}</h1>${article.summary?`<p class="article-reading-summary">${h(article.summary)}</p>`:''}<div class="article-tools"><button type="button" data-reader-copy>复制文章链接</button><button type="button" data-reader-print>打印 / 保存为 PDF</button>${isAdmin?`<button type="button" data-edit-article="${article.id}">编辑文章</button>`:''}</div></header><details class="mobile-toc"><summary>本页目录</summary><nav class="toc-links" aria-label="文章章节">${toc}</nav></details><div class="document-content" id="article-content">${documentView.html}</div>${previous||next?`<nav class="article-neighbors" aria-label="继续阅读">${previous?`<a href="${h(articleHref(previous.id))}"><span>上一篇</span><strong>${h(previous.title)}</strong></a>`:'<div></div>'}${next?`<a href="${h(articleHref(next.id))}"><span>下一篇</span><strong>${h(next.title)}</strong></a>`:'<div></div>'}</nav>`:''}${related.length?`<section class="related-articles" aria-labelledby="reading-related"><h2 id="reading-related" tabindex="-1">相关知识</h2>${related.map(item=>`<a href="${h(articleHref(item.id))}">${h(item.title)}<span>${h(item.category)}</span></a>`).join('')}</section>`:''}<div class="article-reading-footer"><a class="text-button" href="${h(categoryLink)}">浏览此分类</a><button class="text-button" type="button" data-reading-section="article-content">回到正文顶部 ↑</button></div></article><aside class="article-toc" aria-label="本页目录"><h2>本页目录</h2><nav class="toc-links">${toc}</nav><button type="button" class="toc-top" data-reading-section="article-content">回到正文顶部 ↑</button></aside></div></div>`;
  const controller=new AbortController();
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const buttons=[...main.querySelectorAll('.toc-links button')];
  const sections=[...documentView.headings.map(heading=>main.querySelector(`#${heading.id}`)),main.querySelector('#reading-related')].filter(Boolean);
  const content=main.querySelector('#article-content');
  const progress=main.querySelector('.reading-progress>i');
  let frame=0;
  let selectedSection=null;
  function update(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;const threshold=innerWidth<560?145:125;
      let current=selectedSection||sections[0]?.id;
      if(!selectedSection)for(const section of sections){if(section.getBoundingClientRect().top<=threshold)current=section.id;else break;}
      for(const button of buttons){if(button.dataset.readingSection===current)button.setAttribute('aria-current','location');else button.removeAttribute('aria-current');}
      const rect=content.getBoundingClientRect();const value=Math.max(0,Math.min(1,-rect.top/Math.max(1,rect.height-innerHeight*.6)));progress.style.transform=`scaleX(${value})`;
    });
  }
  main.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.readingSection){const section=main.querySelector(`#${button.dataset.readingSection}`);if(section){selectedSection=section.id;section.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});section.setAttribute('tabindex','-1');section.focus({preventScroll:true});update();}return;}
    if(button.hasAttribute('data-reader-print')){window.print();return;}
    if(button.hasAttribute('data-reader-copy')){try{if(!navigator.clipboard?.writeText)throw new Error();await navigator.clipboard.writeText(location.href);toast('文章链接已复制');}catch{toast('无法自动复制，请复制浏览器地址栏中的文章链接。');}}
  },{signal:controller.signal});
  window.addEventListener('scroll',update,{passive:true,signal:controller.signal});
  window.addEventListener('resize',update,{passive:true,signal:controller.signal});
  const resumeScrollTracking=()=>{selectedSection=null;update();};
  window.addEventListener('wheel',resumeScrollTracking,{passive:true,signal:controller.signal});
  window.addEventListener('touchstart',resumeScrollTracking,{passive:true,signal:controller.signal});
  window.addEventListener('pointerdown',resumeScrollTracking,{passive:true,signal:controller.signal});
  window.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))resumeScrollTracking();},{signal:controller.signal});
  update();main.focus({preventScroll:true});
  return ()=>{controller.abort();cancelAnimationFrame(frame);};
}
