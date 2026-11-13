"use client";

import { useState } from "react";
import { Check, ChevronRight, Plus } from "lucide-react";
import {
  type AppState, type Payout, payoutPreview, resolvedReward, rewardKind,
  shanghaiDate, shiftDate, weekOf,
} from "../lib/model";

const scopeLabels = {daily: "日常积分", campaign: "活动积分", all: "全部积分"} as const;
const formatter = new Intl.NumberFormat("zh-CN");

type Props = {
  state: AppState;
  busy: boolean;
  persist: (next: AppState) => Promise<boolean>;
  editBatch: (batch?: Payout) => void;
};

export default function SettlementDesk({state, busy, persist, editBatch}: Props) {
  const [selected, setSelected] = useState("");
  const [scope, setScope] = useState<Payout["kind"]>("daily");
  const [awardDate, setAwardDate] = useState(shanghaiDate());
  const pending = state.posts.filter(post => resolvedReward(post, state).status === "pending");
  const paid = state.posts.filter(post => resolvedReward(post, state).status === "received");
  const weeks = [...new Set(pending.map(post => weekOf(post.publishedAt)))].sort();
  const batches = [...state.payouts].sort((a, b) => b.date.localeCompare(a.date));
  const activeWeek = weeks.includes(selected) ? selected : weeks[0];
  const saved = batches.find(batch => batch.id === selected) ?? (!activeWeek ? batches[0] : undefined);
  const start = saved?.periodStart ?? activeWeek ?? "";
  const end = saved?.periodEnd ?? (start ? shiftDate(start, 6) : "");
  const currentScope = saved?.kind ?? scope;
  const candidate: Payout = saved ?? {
    id: "", date: awardDate, periodStart: start, periodEnd: end,
    kind: currentScope, notes: "", status: "applied",
  };
  const preview = payoutPreview(candidate, state);
  const freshIds = new Set(preview.fresh.map(post => post.id));
  const inRange = state.posts.filter(post => {
    const day = shanghaiDate(new Date(post.publishedAt));
    return day >= start && day <= end;
  }).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const attributed = saved ? inRange.filter(post => resolvedReward(post, state).batchId === saved.id) : [];
  const included = saved ? attributed : preview.fresh;
  const points = included.reduce((sum, post) => sum + post.expectedPoints, 0);
  const rates = [...new Set(included.map(post => post.expectedPoints))];
  const totals = [
    [state.posts.length, "累计文章"], [pending.length, "待发放"],
    [pending.reduce((sum, p) => sum + p.expectedPoints, 0), "预计积分"],
    [paid.reduce((sum, p) => sum + resolvedReward(p, state).points, 0), "已发放积分"],
  ] as const;

  async function record() {
    if (saved || !start || !awardDate || !included.length) return;
    const batch = {...candidate, id: crypto.randomUUID()};
    if (await persist({...state, payouts: [...state.payouts, batch]})) setSelected(batch.id);
  }

  async function toggleSaved() {
    if (!saved) return;
    const status = saved.status === "revoked" ? "applied" : "revoked";
    await persist({...state, payouts: state.payouts.map(batch =>
      batch.id === saved.id ? {...batch, status} : batch
    )});
  }

  return <div className="settlement">
    <aside className="period-list" aria-label="发放周期">
      <div className="period-title"><h2>发放周期</h2>
        <button onClick={() => editBatch()} title="自定义发放日期范围" aria-label="自定义发放日期范围"><Plus size={17}/></button>
      </div>
      <p className="period-help">按公告覆盖的发布日期登记积分</p>
      <div className="period-options">
        {weeks.map(week => {
          const active = !saved && activeWeek === week;
          const kind = active ? scope : "all";
          const posts = pending.filter(p => weekOf(p.publishedAt) === week &&
            (kind === "all" || rewardKind(p, state.tracks) === kind));
          return <button key={week} className="period-option" aria-pressed={active}
            onClick={() => setSelected(week)}>
            <strong>{week} 至 {shiftDate(week, 6)}</strong>
            <span>待发放 · {scopeLabels[kind]}</span>
            <b>{posts.length} 篇 / {formatter.format(posts.reduce((sum, p) => sum + p.expectedPoints, 0))} 积分</b>
            <ChevronRight size={15}/>
          </button>;
        })}
        {batches.map(batch => <button key={batch.id} className="period-option"
          aria-pressed={saved?.id === batch.id} onClick={() => setSelected(batch.id)}>
          <strong>{batch.periodStart} 至 {batch.periodEnd}</strong>
          <span>{batch.status === "revoked" ? "已撤销" : "已登记发放"} · {scopeLabels[batch.kind]}</span>
          <small>发放日 {batch.date}</small><ChevronRight size={15}/>
        </button>)}
      </div>
    </aside>
    <section className="period-detail" aria-label="发放批次详情">
      <div className="settlement-overview">
        <div><p className="caption">{saved ? "发放批次记录" : "发放批次（预览）"}</p>
          <h1>{start ? <>{start} <em>至</em> {end}</> : "暂无发放周期"}</h1></div>
        <div className="all-time"><p className="caption">全部历史总览</p><dl>
          {totals.map(([value, label]) => <div key={label}><dt>{label}</dt><dd>{formatter.format(value)}</dd></div>)}
        </dl></div>
      </div>
      {start ? <>
        <div className="scope-settings"><div><h2>选择发放范围</h2>
          <div className="scope-buttons" role="group" aria-label="积分类型">
            {(Object.keys(scopeLabels) as Payout["kind"][]).map(kind =>
              <button key={kind} aria-pressed={currentScope === kind} disabled={!!saved} onClick={() => setScope(kind)}>
                {scopeLabels[kind]}
              </button>)}
          </div></div>
          <label className="award-date">积分发放日期
            <input type="date" required aria-label="积分发放日期" value={saved?.date ?? awardDate}
              disabled={!!saved} onChange={event => setAwardDate(event.target.value)}/>
          </label>
        </div>
        <div className="matched-totals">
          <div><p>{saved ? "已计入文章" : "本次匹配文章"}（{scopeLabels[currentScope]}）</p>
            <strong>{included.length} <small>篇</small></strong></div>
          <div><p>发放积分合计</p><strong>{formatter.format(points)} <small>积分</small></strong>
            {rates.length === 1 && <span>（{included.length} 篇 × {rates[0]} 积分）</span>}
          </div>
        </div>
        <h2 className="details-heading">匹配文章明细</h2>
        <div className="table-wrap settlement-table"><table><thead><tr>
          <th>文章标题</th><th>类型</th><th>积分</th><th>纳入本次发放</th>
        </tr></thead><tbody>{inRange.map(post => {
          const kind = rewardKind(post, state.tracks);
          const status = resolvedReward(post, state);
          const includedNow = saved ? status.batchId === saved.id : freshIds.has(post.id);
          const label = includedNow ? (saved ? "已计入本批" : "纳入本次发放") :
            status.status === "ineligible" ? "未计奖" : status.status === "received" ? "已由其他记录发放" :
            saved?.status === "revoked" ? "批次已撤销" : "另批发放";
          return <tr key={post.id}><td><a href={post.shareUrl || post.editorUrl} target="_blank" rel="noreferrer">{post.title}</a></td>
            <td><span className={includedNow ? "scope-chip included" : "scope-chip"}>{kind ? scopeLabels[kind] : "类型待确认"}</span></td>
            <td>{includedNow ? post.expectedPoints : "—"}</td>
            <td className={includedNow ? "inclusion yes" : "inclusion"}>{includedNow && <Check size={15}/>} {label}</td></tr>;
        })}</tbody></table>{!inRange.length && <p className="empty-note">该周期没有已登记的文章。</p>}</div>
        <div className="settlement-action">
          <div><strong>{saved ? "本批已登记" : "本次将登记发放"} {included.length} 篇，共 {points} 积分</strong>
            <p>{saved ? (saved.notes || `登记发放日期 ${saved.date}`) :
              `本周期共 ${inRange.length} 篇，另有 ${inRange.length - included.length} 篇未计入本批。`}</p></div>
          {saved ? <div className="saved-actions"><button className="button" onClick={() => editBatch(saved)}>编辑批次</button>
            <button className="button" disabled={busy} onClick={toggleSaved}>{saved.status === "revoked" ? "恢复登记" : "撤销登记"}</button></div> :
            <button className="primary" disabled={busy || !awardDate || !included.length} onClick={record}>
              {busy ? "正在保存…" : `登记发放并更新 ${included.length} 篇`}
            </button>}
        </div>
      </> : <button className="button" onClick={() => editBatch()}>录入发放日期范围</button>}
    </section>
  </div>;
}
