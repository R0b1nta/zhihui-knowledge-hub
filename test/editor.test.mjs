import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readTextDraft, formatSelection, draftPreview } from '../public/editor.js';
import { renderDocument } from '../public/document.js';

test('导入只拆分明确的 Markdown 主标题，未分段材料不猜标题或改写内容',()=>{
  const draft=readTextDraft('\uFEFF# 管件连接\r\n\r\n## 原理\r\n电压为 5 kV，原文记录。');
  assert.equal(draft.title,'管件连接');assert.equal(draft.content,'## 原理\n电压为 5 kV，原文记录。');
  const prose='磁脉技术资料\n未设置任何标题，参数 20 mm。';
  assert.equal(readTextDraft(prose).title,'');assert.equal(readTextDraft(prose).content,prose);
});

test('空文件、二进制、过长文章与过长主标题不会进入编辑器',()=>{
  assert.throws(()=>readTextDraft(' \n '),/没有文字/);
  assert.throws(()=>readTextDraft('binary\0data'),/文字稿/);
  assert.throws(()=>readTextDraft('甲'.repeat(30001)),/30000/);
  assert.throws(()=>readTextDraft('# '+'甲'.repeat(121)+'\n正文'),/120/);
});

test('章节工具只修改选中行，保留前后段落和数值',()=>{
  const text='原始说明 5 kV。\n适用范围\n铝管 20 mm。';
  const start=text.indexOf('适用范围');const action=formatSelection(text,start,start+4,'section');
  const output=text.slice(0,action.start)+action.replacement+text.slice(action.end);
  assert.equal(output,'原始说明 5 kV。\n## 适用范围\n铝管 20 mm。');
  assert.equal(formatSelection('## 试验条件',0,7,'subsection').replacement,'### 试验条件');
  assert.equal(formatSelection('第一项\n第二项\n',0,8,'list').replacement,'- 第一项\n- 第二项');
});

test('重点标注保留选中文字，任何工具都遵守正文上限',()=>{
  const bold=formatSelection('结论：连接成功。',3,7,'strong');assert.equal(bold.replacement,'**连接成功**');
  assert.equal(formatSelection('',0,0,'quote').replacement,'> 重点说明');
  assert.throws(()=>formatSelection('甲'.repeat(30000),0,1,'strong'),/上限/);
  assert.throws(()=>formatSelection('甲'.repeat(30000),0,1,'section'),/上限/);
});

test('整篇预览清楚区分标题、摘要、章节，并转义标题和正文中的 HTML',()=>{
  const html=draftPreview({title:'<img src=x>技术说明',summary:'<script>alert(1)</script>',content:'## 原理\n说明。\n### 条件\n- 20 mm'});
  assert.match(html,/<h1>&lt;img/);assert.match(html,/内容概要/);assert.match(html,/文章结构/);assert.match(html,/is-subheading/);assert.match(html,/<h2 id="section-1"/);
  assert.doesNotMatch(html,/<img|<script/);
  assert.equal(renderDocument('只有一段文字。').hasSections,false);assert.equal(renderDocument('## 条件\n实际内容。').hasSections,true);
  assert.match(draftPreview({content:'一段原文。'}),/正文尚未分章节/);
});
