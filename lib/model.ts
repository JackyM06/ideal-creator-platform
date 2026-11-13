export type Post={id:string;title:string;trackId:string;publishedAt:string;shareUrl:string;noteId:string;editorUrl:string;countsCap:boolean|null;expectedPoints:number;ruleId:string;rewardKind?:"daily"|"campaign";reward:"pending"|"received"|"ineligible";actualPoints:number|null;receivedAt:string;notes:string;historical:boolean;recordedAt:string};
export type Track={id:string;name:string;kind:"ongoing"|"campaign";hashtag:string;countsCap:boolean|null;active:boolean;startsAt:string;endsAt:string;maxPosts:number|null;notes:string};
export type Rule={id:string;label:string;effectiveFrom:string;points:number;weeklyCap:number;source:string};
export type FormConfig={id:string;name:string;month:string;kind:"notes"|"views";url:string;active:boolean;notes:string};
export type Payout={id:string;date:string;periodStart:string;periodEnd:string;kind:"daily"|"campaign"|"all";notes:string;status?:"applied"|"revoked"};
export type AppState={version:1;profile:{nickname:string;modelTag:string};posts:Post[];tracks:Track[];rules:Rule[];forms:FormConfig[];payouts:Payout[]};
export function shanghaiDate(now:Date=new Date()):string{return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}
export function weekOf(value:string):string{const dateOnly=value.includes("T")?shanghaiDate(new Date(value)):value;const d=new Date(dateOnly+"T00:00:00Z");if(Number.isNaN(d.getTime()))return "";d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
export function shiftDate(value:string,days:number):string{const d=new Date(value+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function ruleFor(rules:Rule[],date:string):Rule{return [...rules].filter(r=>r.effectiveFrom<=date).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0]??[...rules].sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom))[0];}
export function weeklyStats(s:AppState,week:string){const p=s.posts.filter(p=>weekOf(p.publishedAt)===week);return{published:p.length,counted:p.filter(p=>p.countsCap===true).length,extra:p.filter(p=>p.countsCap===false).length,unknown:p.filter(p=>p.countsCap===null).length,limit:ruleFor(s.rules,shiftDate(week,6)).weeklyCap};}
export function extractShareUrl(text:string):string{return(text.match(/https?:\/\/(?:www\.)?(?:xhslink\.(?:com|cn)|xiaohongshu\.com)\/[^\s<>"'，。；！）)]+/u)?.[0]??"").replace(/[.,;!?]+$/,"");}
export function canonicalUrl(value:string):string{try{const u=new URL(value);return u.hostname.replace(/^www\./,"")+u.pathname.replace(/\/$/,"");}catch{return "";}}
export function duplicatePost(posts:Post[],post:Post):Post|undefined{return posts.find(p=>p.id!==post.id&&((post.noteId&&post.noteId===p.noteId)||(post.shareUrl&&canonicalUrl(post.shareUrl)===canonicalUrl(p.shareUrl))));}
export function newPost(s:AppState,trackId?:string):Post{const t=s.tracks.find(t=>t.id===trackId)??s.tracks.find(t=>t.active&&t.countsCap===true);const r=ruleFor(s.rules,shanghaiDate());return{id:crypto.randomUUID(),title:"",trackId:t?.id??"",publishedAt:new Date(Date.now()+8*3600000).toISOString().slice(0,16)+"+08:00",shareUrl:"",noteId:"",editorUrl:"",countsCap:t?.countsCap??null,expectedPoints:r.points,ruleId:r.id,rewardKind:t?.kind==="campaign"?"campaign":"daily",reward:"pending",actualPoints:null,receivedAt:"",notes:"",historical:false,recordedAt:new Date().toISOString()};}

export function rewardKind(post:Post,tracks:Track[]):"daily"|"campaign"|undefined {
  if(post.rewardKind)return post.rewardKind;
  const track=tracks.find(t=>t.id===post.trackId);
  return track?.kind==="campaign"?"campaign":track?.kind==="ongoing"?"daily":undefined;
}
export function inPayout(post:Post,batch:Payout,tracks:Track[]):boolean {
  if(!batch.periodStart||!batch.periodEnd||batch.periodEnd<batch.periodStart)return false;
  const day=shanghaiDate(new Date(post.publishedAt));
  return day>=batch.periodStart&&day<=batch.periodEnd&&(batch.kind==="all"||rewardKind(post,tracks)===batch.kind);
}
export function resolvedReward(post:Post,state:Pick<AppState,"tracks"|"payouts">):{status:Post["reward"];points:number;date:string;batchId?:string} {
  if(post.reward==="ineligible")return{status:"ineligible",points:0,date:""};
  if(post.reward==="received")return{status:"received",points:post.actualPoints??post.expectedPoints,date:post.receivedAt};
  const batch=[...state.payouts].filter(b=>b.status!=="revoked"&&inPayout(post,b,state.tracks)).sort((a,b)=>a.date.localeCompare(b.date))[0];
  return batch?{status:"received",points:post.expectedPoints,date:batch.date,batchId:batch.id}:{status:"pending",points:post.expectedPoints,date:""};
}
export function payoutPreview(batch:Payout,state:AppState){
  const otherState={...state,payouts:state.payouts.filter(b=>b.id!==batch.id)};
  const matched=state.posts.filter(p=>p.reward!=="ineligible"&&inPayout(p,batch,state.tracks));
  const fresh=matched.filter(p=>resolvedReward(p,otherState).status==="pending");
  return{matched,fresh,skipped:matched.length-fresh.length,points:fresh.reduce((sum,p)=>sum+p.expectedPoints,0)};
}

type PayoutForecast = {
  kind: "daily" | "campaign";
  periodStart: string;
  periodEnd: string;
  expectedWeek: string;
  points: number;
  postCount: number;
  sampleCount: number;
};

function twoMonthsAfter(value: string): string {
  const date = new Date(value + "T00:00:00Z");
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 2);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

export function payoutOutlook(state: AppState, today = shanghaiDate()) {
  const thisWeek = weekOf(today);
  const records = state.posts.map(post => {
    const reward = resolvedReward(post, state);
    if (reward.date.includes("T")) reward.date = shanghaiDate(new Date(reward.date));
    return {post, reward};
  });
  const pending = records.filter(({reward}) => reward.status === "pending" ||
    (reward.status === "received" && reward.date > today));
  const received = records.filter(({reward}) => reward.status === "received" &&
    reward.date >= thisWeek && reward.date <= today);
  const plans: PayoutForecast[] = [];

  for (const kind of ["daily", "campaign"] as const) {
    // Keep daily and campaign delays separate; duplicate or revoked notices are not extra samples.
    const notices = [...state.payouts].filter(batch => batch.status !== "revoked" &&
      batch.date <= today && batch.periodStart <= batch.periodEnd && batch.periodEnd <= batch.date &&
      (batch.kind === kind || batch.kind === "all"))
      .sort((a, b) => b.date.localeCompare(a.date));
    const unique = [...new Map(notices.map(batch => [batch.date + ":" + batch.periodEnd, batch])).values()].slice(0, 5);
    const delays = unique.map(batch => Math.round((Date.parse(batch.date) - Date.parse(batch.periodEnd)) / 86400000)).sort((a, b) => a - b);
    const middle = Math.floor(delays.length / 2);
    const delay = delays.length ? Math.round((delays[middle] + delays[Math.floor((delays.length - 1) / 2)]) / 2) : null;
    const weeks = new Map<string, Post[]>();
    for (const {post} of pending) {
      if (rewardKind(post, state.tracks) !== kind) continue;
      const week = weekOf(post.publishedAt);
      const posts = weeks.get(week) ?? [];
      posts.push(post);
      weeks.set(week, posts);
    }
    for (const [periodStart, posts] of weeks) {
      const periodEnd = shiftDate(periodStart, 6);
      const expectedDate = delay === null ? twoMonthsAfter(periodEnd) : shiftDate(periodEnd, delay);
      plans.push({kind, periodStart, periodEnd, expectedWeek: weekOf(expectedDate),
        points: posts.reduce((sum, post) => sum + post.expectedPoints, 0),
        postCount: posts.length, sampleCount: unique.length});
    }
  }

  const earliestWeek = plans.map(plan => plan.expectedWeek).sort()[0];
  const forecasts = plans.filter(plan => plan.expectedWeek <= thisWeek || plan.expectedWeek === earliestWeek)
    .sort((a, b) => a.expectedWeek.localeCompare(b.expectedWeek) || a.periodStart.localeCompare(b.periodStart));
  return {
    mode: received.length ? "received" as const : "forecast" as const,
    thisWeek,
    receivedPoints: received.reduce((sum, {reward}) => sum + reward.points, 0),
    receivedCount: received.length,
    pendingPoints: pending.reduce((sum, {post}) => sum + post.expectedPoints, 0),
    pendingCount: pending.length,
    forecastPoints: forecasts.reduce((sum, plan) => sum + plan.points, 0),
    forecastCount: forecasts.reduce((sum, plan) => sum + plan.postCount, 0),
    forecasts,
  };
}
