import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDocument, relatedArticles } from '../public/document.js';

test('旧文章段落与中文章节保留，并生成稳定目录',()=>{
  const result=renderDocument('原有介绍。\n\n一、建立脉冲磁场\n实际说明。\n\n二、形成连接\n另一段说明。');
  assert.equal(result.headings.length,2);assert.equal(result.headings[0].text,'一、建立脉冲磁场');
  assert.match(result.html,/<p>原有介绍。<\/p>/);assert.match(result.html,/id="section-2"/);assert.match(result.html,/另一段说明/);
});
test('Markdown 标题、列表、引用与表格可以组合，中文单位不丢失',()=>{
  const result=renderDocument('## 试验条件\n- 铝管\n- 同轴装配\n\n> 以下只是试验记录。\n\n| 项目 | 数值 |\n| --- | --- |\n| 长度 | 20 mm |\n| 电压 | 5 kV |');
  assert.equal(result.headings[0].text,'试验条件');assert.equal(result.headings[0].level,2);assert.match(result.html,/<ul><li>铝管<\/li><li>同轴装配<\/li><\/ul>/);
  assert.match(result.html,/<blockquote>/);assert.match(result.html,/<th scope="col">项目<\/th>/);assert.match(result.html,/<td>5 kV<\/td>/);
});
test('正文、标题与表格中的 HTML 始终作为文字显示',()=>{
  const result=renderDocument('## <img src=x onerror=alert(1)>\n<script>alert(1)</script>\n\n| 内容 |\n| --- | --- |\n| <svg onload=alert(1)> |');
  assert.doesNotMatch(result.html,/<script|<img|<svg/);assert.match(result.html,/&lt;script&gt;/);assert.match(result.html,/&lt;img/);
});
test('外链仅允许 http 与 https，属性字符无法越界',()=>{
  const result=renderDocument('[正常](https://example.com/docs?a=1&b=2) [危险](javascript:alert%281%29) [数据](data:text/html,test)');
  assert.match(result.html,/href="https:\/\/example.com\/docs\?a=1&amp;b=2"/);assert.match(result.html,/rel="noopener noreferrer"/);
  assert.doesNotMatch(result.html,/href="(?:javascript|data):/);assert.match(result.html,/危险/);
});
test('代码块不执行 HTML，内部井号不生成章节',()=>{
  const result=renderDocument('```html\n<img src="x">\n## 不是章节\n```\n\n实际正文');
  assert.equal(result.headings.length,1);assert.equal(result.headings[0].text,'正文');assert.match(result.html,/&lt;img src=&quot;x&quot;&gt;/);assert.match(result.html,/## 不是章节/);
});
test('重复章节名拥有不同锚点，无标题文章仍可导航',()=>{
  const result=renderDocument('## 方法\n第一种。\n\n## 方法\n第二种。');assert.deepEqual(result.headings.map(h=>h.id),['section-1','section-2']);
  const plain=renderDocument('只有一段正文。');assert.equal(plain.minutes,1);assert.equal(plain.headings[0].id,'section-1');assert.match(plain.html,/只有一段正文/);
});
test('相关文章排除当前文章，优先相同分类并限制返回数量',()=>{
  const articles=[{id:1,category:'技术'},{id:2,category:'其他'},{id:3,category:'技术'},{id:4,category:'其他'}];
  assert.deepEqual(relatedArticles(articles,articles[0],2).map(a=>a.id),[3,2]);assert.equal(articles.length,4);
});
