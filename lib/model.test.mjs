import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {weekOf,weeklyStats,ruleFor,extractShareUrl,duplicatePost,resolvedReward,payoutPreview,payoutOutlook} from './model.ts';
const seed=JSON.parse(readFileSync(new URL('../tests/fixtures/creator-state.json',import.meta.url)));
test('自然周按北京时间处理周日深夜和周一',()=>{assert.equal(weekOf('2026-11-15T15:59:00Z'),'2026-11-09');assert.equal(weekOf('2026-11-15T16:00:00Z'),'2026-11-16');});
test('同一周长期赛道共用额度，额外活动独立，未知额度不静默豁免',()=>{const base=seed.posts[0];const posts=[true,true,true,false,null].map((cap,i)=>({...base,id:String(i),countsCap:cap,publishedAt:'2026-11-10T10:00:00+08:00'}));const v=weeklyStats({...seed,posts},'2026-11-09');assert.equal(v.counted,3);assert.equal(v.extra,1);assert.equal(v.unknown,1);assert.equal(v.limit,4);});
test('积分变化只匹配对应生效版本，不改写已发布快照',()=>{const original=JSON.stringify(seed.posts);const newer={...seed.rules[0],id:'new',effectiveFrom:'2026-12-01',points:100};assert.equal(ruleFor([...seed.rules,newer],'2026-11-30').points,150);assert.equal(ruleFor([...seed.rules,newer],'2026-12-01').points,100);assert.equal(JSON.stringify(seed.posts),original);assert.equal(seed.posts.reduce((n,p)=>n+p.expectedPoints,0),1350);});
test('手机分享文本提取链接，不吞入中文标点',()=>{assert.equal(extractShareUrl('测试用户发布了笔记 https://xhslink.cn/o/abc123，复制后打开小红书！'),'https://xhslink.cn/o/abc123');assert.equal(extractShareUrl('普通文本'),'');});
test('同链接不同查询参数、同笔记ID都能发现重复',()=>{const p={...seed.posts[0],shareUrl:'https://xhslink.cn/o/abc?xsec_token=a',noteId:'n1'};assert.equal(duplicatePost([p],{...p,id:'other',noteId:'',shareUrl:'https://xhslink.cn/o/abc?xsec_token=b'}).id,p.id);assert.equal(duplicatePost([p],{...p,id:'other',shareUrl:'https://xhslink.cn/o/def'}).id,p.id);});

test('测试夹具只带虚构定位信息，不携带正文或素材',()=>{assert.equal(seed.posts.length,9);assert.ok(seed.posts.every(p=>!('body' in p)&&!('submission' in p)&&!('imageCount' in p)&&(p.shareUrl||p.editorUrl)));});

const batch=(kind='daily',extra={})=>({id:'batch-'+kind,date:'2026-11-13',periodStart:'2026-09-14',periodEnd:'2026-09-20',kind,notes:'测试发放批次',status:'applied',...extra});
test('日常批次一次覆盖2篇，活动积分不受周额度标记影响',()=>{const b=batch();const preview=payoutPreview(b,seed);assert.equal(preview.fresh.length,2);assert.equal(preview.points,300);const s={...seed,payouts:[...seed.payouts,b]};assert.equal(seed.posts.filter(p=>resolvedReward(p,s).status==='received').length,2);const campaign={...seed.posts[0],countsCap:true};assert.equal(resolvedReward(campaign,s).status,'pending');});
test('全部类型批次更新整周5篇，不逐篇修改原记录',()=>{const snapshot=JSON.stringify(seed.posts);const b=batch('all'),s={...seed,payouts:[...seed.payouts,b]};assert.equal(seed.posts.filter(p=>resolvedReward(p,s).status==='received').length,5);assert.equal(seed.posts.reduce((n,p)=>n+(resolvedReward(p,s).status==='received'?resolvedReward(p,s).points:0),0),750);assert.equal(JSON.stringify(seed.posts),snapshot);});
test('重叠批次跳过已发放记录，撤销后按剩余有效批次恢复状态',()=>{const daily=batch(),all=batch('all',{date:'2026-11-14'});const s={...seed,payouts:[daily,all]};assert.equal(payoutPreview(all,s).fresh.length,3);assert.equal(payoutPreview(all,s).points,450);assert.equal(seed.posts.reduce((n,p)=>n+(resolvedReward(p,s).status==='received'?resolvedReward(p,s).points:0),0),750);const undone={...s,payouts:[daily,{...all,status:'revoked'}]};assert.equal(seed.posts.filter(p=>resolvedReward(p,undone).status==='received').length,2);});
test('发放范围按北京时间包含起止两天，补录记录自动匹配已发批次',()=>{const b=batch('all'),p={...seed.posts[0],id:'backfill',publishedAt:'2026-09-13T16:00:00Z'};assert.equal(resolvedReward(p,{...seed,payouts:[b]}).status,'received');assert.equal(resolvedReward({...p,publishedAt:'2026-09-20T15:59:59Z'},{...seed,payouts:[b]}).status,'received');assert.equal(resolvedReward({...p,publishedAt:'2026-09-20T16:00:00Z'},{...seed,payouts:[b]}).status,'pending');});
test('批次积分使用各篇历史快照，100分和150分混合不重算',()=>{const s={...seed,posts:[{...seed.posts[0],expectedPoints:100},seed.posts[1]]};assert.equal(payoutPreview(batch('all'),s).points,250);});

test('近期预测定位两个月前的未发文章，空匹配公告不冒充个人到账',()=>{
  const result=payoutOutlook(seed,'2026-11-13');
  assert.equal(result.mode,'forecast');
  assert.equal(result.receivedPoints,0);
  assert.equal(result.pendingPoints,1350);
  assert.equal(result.forecastPoints,750);
  assert.equal(result.forecastCount,5);
  assert.ok(result.forecasts.every(item=>item.periodStart==='2026-09-14'&&item.expectedWeek==='2026-11-16'));
  assert.equal(result.forecasts.find(item=>item.kind==='daily').sampleCount,1);
  assert.equal(result.forecasts.find(item=>item.kind==='campaign').sampleCount,0);
});
test('登记本周到账切换卡片，重叠批次不重算，撤销全部后恢复预测',()=>{
  const daily=batch(),all=batch('all');
  const single=payoutOutlook({...seed,payouts:[daily]},'2026-11-13');
  assert.equal(single.mode,'received');assert.equal(single.receivedPoints,300);assert.equal(single.pendingPoints,1050);
  const both=payoutOutlook({...seed,payouts:[daily,all]},'2026-11-13');
  assert.equal(both.receivedPoints,750);assert.equal(both.receivedCount,5);assert.equal(both.pendingPoints,600);
  const undone=payoutOutlook({...seed,payouts:[{...daily,status:'revoked'},{...all,status:'revoked'}]},'2026-11-13');
  assert.equal(undone.mode,'forecast');assert.equal(undone.receivedPoints,0);assert.equal(undone.pendingPoints,1350);
});
test('本周到账按北京时间的发放日期统计，下周不沿用上周金额',()=>{
  const post={...seed.posts[0],reward:'received',actualPoints:100,receivedAt:'2026-11-15T16:00:00Z'};
  const state={...seed,posts:[post],payouts:[]};
  assert.equal(payoutOutlook(state,'2026-11-15').mode,'forecast');
  const monday=payoutOutlook(state,'2026-11-16');
  assert.equal(monday.mode,'received');assert.equal(monday.receivedPoints,100);assert.equal(monday.pendingPoints,0);
  assert.equal(payoutOutlook(state,'2026-11-23').mode,'forecast');
});
test('日常和活动分别估算，撤销及未来公告不参与历史周期',()=>{
  const campaign=batch('campaign',{id:'older-campaign',date:'2026-10-15',periodStart:'2026-08-24',periodEnd:'2026-08-30'});
  const ignored=batch('daily',{id:'future',date:'2027-01-01',periodStart:'2026-08-24',periodEnd:'2026-08-30'});
  const revoked={...campaign,id:'revoked',kind:'daily',status:'revoked'};
  const result=payoutOutlook({...seed,payouts:[...seed.payouts,campaign,ignored,revoked]},'2026-11-13');
  assert.equal(result.forecastPoints,450);
  assert.ok(result.forecasts.every(item=>item.kind==='campaign'&&item.sampleCount===1&&item.expectedWeek==='2026-11-02'));
});
test('空台账和未计奖记录不产生预计或到账金额',()=>{
  const empty=payoutOutlook({...seed,posts:[]},'2026-11-13');
  assert.equal(empty.mode,'forecast');assert.equal(empty.pendingPoints,0);assert.equal(empty.forecastPoints,0);
  const ineligible=payoutOutlook({...seed,posts:seed.posts.map(post=>({...post,reward:'ineligible'})),payouts:[batch('all')]},'2026-11-13');
  assert.equal(ineligible.receivedCount,0);assert.equal(ineligible.pendingPoints,0);assert.equal(ineligible.forecastPoints,0);
});

test('新用户默认台账为空，通用初始化不含个人记录和表单',()=>{const initial=JSON.parse(readFileSync(new URL('./seed.json',import.meta.url)));assert.equal(initial.posts.length,0);assert.equal(initial.payouts.length,0);assert.equal(initial.forms.length,0);assert.deepEqual(initial.profile,{nickname:'',modelTag:''});assert.ok(initial.tracks.every(t=>t.kind==='ongoing'));});
