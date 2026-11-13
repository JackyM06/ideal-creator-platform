import {type AppState, payoutOutlook, shiftDate} from "../lib/model";

const number = new Intl.NumberFormat("zh-CN");
const scope = {daily: "日常", campaign: "活动"};
const range = (start: string, end: string) => `${start.slice(5)} 至 ${end.slice(5)}`;

export default function PayoutMetrics({state, today}: {state: AppState; today: string}) {
  const summary = payoutOutlook(state, today);
  const received = summary.mode === "received";
  const expectedWeek = summary.forecasts[0]?.expectedWeek;
  const timing = !expectedWeek ? "暂无可预测的待发放记录" : expectedWeek < summary.thisWeek
    ? "已到预计周期，等待发放公告"
    : `预计 ${range(expectedWeek, shiftDate(expectedWeek, 6))} 发放`;

  return <>
    <div className={`metric payout-metric ${received ? "received" : "forecast"}`} aria-label={received ? "本周已到账积分" : "近期预计到账积分"}>
      <span>{received ? "本周已到账积分" : "近期预计到账积分"}</span>
      <strong>{number.format(received ? summary.receivedPoints : summary.forecastPoints)}<em>积分</em></strong>
      {received ? <small>按发放日期统计 · 本周已登记到账 {summary.receivedCount} 篇</small> : <>
        <small>{timing}</small>
        {!!summary.forecasts.length && <details className="forecast-basis">
          <summary>查看 {summary.forecastCount} 篇笔记的预测依据</summary>
          {summary.forecasts.map(item => <p key={item.kind + item.periodStart}>
            {scope[item.kind]} · {range(item.periodStart, item.periodEnd)} · {item.points} 积分<br/>
            {item.sampleCount ? `参考最近 ${item.sampleCount} 次同类发放记录` : "暂无同类记录，参考约两个月"}
          </p>)}
          <p>按历史周期估算，实际以发放公告为准。</p>
        </details>}
      </>}
    </div>
    <div className="metric" aria-label="未发放积分">
      <span>未发放积分</span>
      <strong>{number.format(summary.pendingPoints)}<em>积分</em></strong>
      <small>全部历史 · {summary.pendingCount} 篇尚未发放</small>
    </div>
  </>;
}
