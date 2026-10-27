import { renderDocument } from './document.js';

const escape=text=>String(text??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const LIMIT=30000;

// Import explicit document structure only; unstructured prose is never guessed.
export function readTextDraft(value){
  const original=String(value??'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
  if(!original)throw new Error('文件里没有文字，请选择其他文件。');
  if(original.includes('\0'))throw new Error('这不是可读取的文字稿，请复制文字后粘贴到正文。');
  const first=/^#\s+([^\n]+)\n?/.exec(original);
  const title=first?first[1].trim():'';
  if(title.length>120)throw new Error('文章主标题超过 120 字，请先缩短标题。');
  const content=first?original.slice(first[0].length).trim():original;
  if(original.length>LIMIT)throw new Error('一篇文章最多 30000 字，请先按主题拆成几篇。');
  return {original,title,content};
}

export function formatSelection(value,start,end,kind){
  const text=String(value??'');
  start=Math.max(0,Math.min(text.length,start));end=Math.max(start,Math.min(text.length,end));
  if(kind==='strong'){
    const selected=text.slice(start,end)||'重点内容';
    if(text.length-(end-start)+selected.length+4>LIMIT)throw new Error('正文已达到字数上限，请先删减内容。');
    return {start,end,replacement:`**${selected}**`,selectionStart:start+2,selectionEnd:start+2+selected.length};
  }
  const prefixes={section:'## ',subsection:'### ',list:'- ',quote:'> '};
  if(!prefixes[kind])throw new Error('不支持的排版方式');
  const lineStart=start===0?0:text.lastIndexOf('\n',start-1)+1;
  const tail=end>start&&text[end-1]==='\n'?end-1:end;
  const next=text.indexOf('\n',tail),lineEnd=next<0?text.length:next;
  const body=text.slice(lineStart,lineEnd)||({section:'章节标题',subsection:'小节标题',list:'要点',quote:'重点说明'}[kind]);
  const replacement=body.split('\n').map(line=>{
    if(!line.trim())return '';
    const plain=line.replace(/^\s*(?:#{1,6}\s+|[-*]\s+|>\s?)/,'');
    return prefixes[kind]+plain;
  }).join('\n');
  if(text.length-(lineEnd-lineStart)+replacement.length>LIMIT)throw new Error('正文已达到字数上限，请先删减内容。');
  return {start:lineStart,end:lineEnd,replacement,selectionStart:lineStart,selectionEnd:lineStart+replacement.length};
}

export function draftPreview({title='',summary='',content=''}){
  const view=renderDocument(content);
  const headings=view.hasSections?view.headings:[];
  return `<article class="draft-article"><header class="draft-article-header"><span class="draft-preview-label">文章预览</span><h1>${escape(title||'尚未填写文章标题')}</h1>${summary?`<div class="article-summary"><strong>内容概要</strong><p>${escape(summary)}</p></div>`:'<p class="draft-empty-note">还没有摘要。用两三句话说明这篇文章解决什么问题。</p>'}</header>${headings.length?`<nav class="draft-outline" aria-label="预览章节"><strong>文章结构</strong><ol>${headings.map(item=>`<li class="${item.level===3?'is-subheading':''}">${escape(item.text)}</li>`).join('')}</ol></nav>`:'<p class="draft-empty-note">正文尚未分章节。返回编辑，选中一行并点“章节标题”。</p>'}<div class="document-content">${view.html}</div></article>`;
}

export function mountArticleEditor(form){
  const content=form.elements.content,title=form.elements.title,summary=form.elements.summary;
  const file=form.querySelector('[data-draft-file]');
  const status=form.querySelector('[data-draft-status]');
  const structure=form.querySelector('[data-draft-structure]');
  const undo=form.querySelector('[data-draft-undo]');
  let previous=null;
  function update(){
    const view=renderDocument(content.value),count=view.hasSections?view.headings.length:0;
    structure.textContent=count?`已识别 ${count} 个章节或小节，预览中可查看文章结构。`:'正文还没有章节：选中一行，点“章节标题”或“小节标题”。';
    structure.classList.toggle('needs-structure',!count&&!!content.value.trim());
    const preview=form.querySelector('#draft-preview');
    if(!preview.hidden)preview.innerHTML=draftPreview({title:title.value,summary:summary.value,content:content.value});
  }
  form.addEventListener('input',update);
  form.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-draft-import'))file.click();
    if(button.hasAttribute('data-draft-undo')&&previous){
      content.value=previous.content;title.value=previous.title;previous=null;undo.hidden=true;status.textContent='已恢复导入前的内容。';update();
    }
    if(button.dataset.draftFormat){
      try{
        const result=formatSelection(content.value,content.selectionStart,content.selectionEnd,button.dataset.draftFormat);
        content.setRangeText(result.replacement,result.start,result.end,'select');
        content.focus();content.setSelectionRange(result.selectionStart,result.selectionEnd);update();
      }catch(error){status.textContent=error.message;}
    }
  });
  file.addEventListener('change',async()=>{
    const selected=file.files[0];if(!selected)return;
    try{
      if(!/\.(txt|md|markdown)$/i.test(selected.name))throw new Error('请选择 TXT 或 Markdown 文件；Word/PDF 可先复制文字再粘贴。');
      if(selected.size>150000)throw new Error('文件过大，请按主题拆成较小的文字稿。');
      let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(await selected.arrayBuffer());}catch{throw new Error('文件文字无法识别，请另存为 UTF-8 文字稿，或直接复制正文粘贴。');}
      const draft=readTextDraft(text);
      previous={content:content.value,title:title.value};
      const sameTitle=title.value.trim()===draft.title;
      if(!title.value.trim()&&draft.title)title.value=draft.title.slice(0,120);
      content.value=draft.title&&(!previous.title.trim()||sameTitle)?draft.content:draft.original;
      undo.hidden=false;status.textContent=`已导入“${selected.name}”，只填入当前编辑器，尚未发布。可预览后修改，或撤销导入。`;update();
    }catch(error){status.textContent=error.message;}
    finally{file.value='';}
  });
  update();
}
