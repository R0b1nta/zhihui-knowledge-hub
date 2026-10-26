const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function inline(text){
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^\s)]+\))/g).map(part=>{
    if(part.startsWith('**')&&part.endsWith('**'))return `<strong>${escape(part.slice(2,-2))}</strong>`;
    if(part.startsWith('`')&&part.endsWith('`'))return `<code>${escape(part.slice(1,-1))}</code>`;
    const link=/^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if(link){try{const url=new URL(link[2]);if(['http:','https:'].includes(url.protocol))return `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${escape(link[1])}</a>`;}catch{}return escape(link[1]);}
    return escape(part);
  }).join('');
}

// A deliberately small, escaped Markdown subset; HTML is always displayed as text.
export function renderDocument(content){
  const lines=String(content??'').replace(/\r\n?/g,'\n').split('\n');
  const headings=[];const blocks=[];let paragraph=[];
  const flush=()=>{if(paragraph.length){blocks.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);paragraph=[];}};
  const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell=>cell.trim());
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(!line){flush();continue;}
    if(line.startsWith('```')){
      flush();const code=[];while(i+1<lines.length&&!lines[i+1].trim().startsWith('```'))code.push(lines[++i]);if(i+1<lines.length)i++;
      blocks.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);continue;
    }
    const markdown=/^(#{1,3})\s+(.+?)(?:\s+#+)?$/.exec(line);
    const plain=/^(?:[一二三四五六七八九十百]+[、．]|\d{1,2}[、．])\s*\S.{0,65}$/.test(line);
    if(markdown||plain){
      flush();const level=markdown?Math.max(2,Math.min(markdown[1].length,3)):2;const text=markdown?markdown[2]:line;const id=`section-${headings.length+1}`;
      headings.push({id,text,level});blocks.push(`<h${level} id="${id}" tabindex="-1">${inline(text)}</h${level}>`);continue;
    }
    if(line.includes('|')&&i+1<lines.length&&/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[i+1].trim())){
      flush();const header=cells(line);i++;const rows=[];while(i+1<lines.length&&lines[i+1].includes('|')&&lines[i+1].trim()){const row=cells(lines[++i]);rows.push(`<tr>${header.map((_,index)=>`<td>${inline(row[index]||'')}</td>`).join('')}</tr>`);}
      blocks.push(`<div class="document-table"><table><thead><tr>${header.map(cell=>`<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);continue;
    }
    if(/^[-*]\s+/.test(line)){
      flush();const items=[line.replace(/^[-*]\s+/,'')];while(i+1<lines.length&&/^\s*[-*]\s+/.test(lines[i+1]))items.push(lines[++i].trim().replace(/^[-*]\s+/,''));
      blocks.push(`<ul>${items.map(item=>`<li>${inline(item)}</li>`).join('')}</ul>`);continue;
    }
    if(/^>\s?/.test(line)){flush();const quote=[line.replace(/^>\s?/,'')];while(i+1<lines.length&&/^\s*>/.test(lines[i+1]))quote.push(lines[++i].trim().replace(/^>\s?/,''));blocks.push(`<blockquote><p>${quote.map(inline).join('<br>')}</p></blockquote>`);continue;}
    paragraph.push(line);
  }
  flush();
  if(!headings.length){headings.push({id:'section-1',text:'正文',level:2});blocks.unshift('<h2 class="document-body-label" id="section-1" tabindex="-1">正文</h2>');}
  return {html:blocks.join('\n'),headings,minutes:Math.max(1,Math.ceil(String(content??'').replace(/\s/g,'').length/450))};
}

export function relatedArticles(articles,article,limit=3){
  const others=articles.filter(item=>item.id!==article.id);
  return [...others.filter(item=>item.category===article.category),...others.filter(item=>item.category!==article.category)].slice(0,limit);
}
