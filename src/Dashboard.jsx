import React, { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import * as Papa from "papaparse";

const COLORS = ['#2563eb','#dc2626','#16a34a','#9333ea','#ea580c','#f59e0b','#10b981','#06b6d4','#8b5cf6','#ec4899',
  '#0891b2','#be123c','#4f46e5','#ca8a04','#059669','#e11d48','#7c3aed','#0284c7','#d97706','#65a30d'];

const NOISE_LIST = ['unknown','expired attributions','anonymous ips','malformed advertising id','untrusted devices'];
const isNoise = (n) => !n || NOISE_LIST.includes(n.toLowerCase().trim());

const METRICS = [
  { key:'d2', label:'D+2', days:2, bg:'bg-sky-100', border:'border-sky-500', text:'text-sky-800' },
  { key:'d7', label:'D+7', days:7, bg:'bg-cyan-100', border:'border-cyan-500', text:'text-cyan-800' },
  { key:'d14', label:'D+14', days:14, bg:'bg-teal-100', border:'border-teal-500', text:'text-teal-800' },
  { key:'d30', label:'D+30', days:30, bg:'bg-blue-100', border:'border-blue-500', text:'text-blue-800' },
  { key:'d60', label:'D+60', days:60, bg:'bg-green-100', border:'border-green-500', text:'text-green-800' },
  { key:'d90', label:'D+90', days:90, bg:'bg-amber-100', border:'border-amber-500', text:'text-amber-800' },
  { key:'d120', label:'D+120', days:120, bg:'bg-purple-100', border:'border-purple-500', text:'text-purple-800' },
];

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');
  const [topN, setTopN] = useState(5);
  const [selCh, setSelCh] = useState([]);
  const [selApp, setSelApp] = useState([]);
  const [selOS, setSelOS] = useState([]);
  const [selMetrics, setSelMetrics] = useState(['d7','d14','d30','d60','d90','d120']);
  const [showNoise, setShowNoise] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const cleaned = res.data.map(r => ({
          app: r.app?.trim() || '',
          os: r.os_name?.trim() || '',
          ch: r.channel?.trim() || '',
          cn: r.campaign_network?.trim() || '',
          day: r.day?.trim() || '',
          cost: parseFloat(r.network_cost) || 0,
          r2: parseFloat(r.all_revenue_total_d2) || 0,
          r7: parseFloat(r.all_revenue_total_d7) || 0,
          r14: parseFloat(r.all_revenue_total_d14) || 0,
          r30: parseFloat(r.all_revenue_total_d30) || 0,
          r60: parseFloat(r.all_revenue_total_d60) || 0,
          r90: parseFloat(r.all_revenue_total_d90) || 0,
          r120: parseFloat(r.all_revenue_total_d120) || 0,
        }));
        setRows(cleaned);
        setSelCh([...new Set(cleaned.map(r=>r.ch).filter(Boolean))].sort());
        setSelApp([...new Set(cleaned.map(r=>r.app).filter(Boolean))].sort());
        setSelOS([...new Set(cleaned.map(r=>r.os).filter(Boolean))].sort());
      }
    });
  };

  const channels = useMemo(() => [...new Set(rows.map(r=>r.ch).filter(Boolean))].sort(), [rows]);
  const apps = useMemo(() => [...new Set(rows.map(r=>r.app).filter(Boolean))].sort(), [rows]);
  const osList = useMemo(() => [...new Set(rows.map(r=>r.os).filter(Boolean))].sort(), [rows]);

  const toggle = (setter) => (v) => setter(p => p.includes(v) ? p.filter(x=>x!==v) : [...p,v]);
  const toggleAll = (setter, all, sel) => () => setter(sel.length === all.length ? [] : [...all]);

  const maxMonths = useMemo(() => {
    if (!rows.length) return {};
    const NOW = new Date();
    const months = [...new Set(rows.map(r=>r.day?.substring(0,7)).filter(Boolean))].sort().reverse();
    const res = {};
    METRICS.forEach(m => {
      for (const mo of months) {
        const [y,mn] = mo.split('-').map(Number);
        const last = new Date(y, mn, 0);
        const req = new Date(last); req.setDate(req.getDate() + m.days);
        if (NOW >= req) { res[m.key] = mo; break; }
      }
      if (!res[m.key]) res[m.key] = null;
    });
    return res;
  }, [rows]);

  const { topCampaigns, chartData } = useMemo(() => {
    if (!rows.length || !selCh.length) return { topCampaigns:[], chartData:[] };
    const NOW = new Date();
    const cohortOk = (mo, days) => {
      const [y,mn] = mo.split('-').map(Number);
      const last = new Date(y, mn, 0);
      const req = new Date(last); req.setDate(req.getDate() + days);
      return NOW >= req;
    };

    const filtered = rows.filter(r => {
      if (r.day < startDate || r.day > endDate) return false;
      if (!selCh.includes(r.ch)) return false;
      if (!selApp.includes(r.app)) return false;
      if (!selOS.includes(r.os)) return false;
      if (!showNoise && isNoise(r.cn)) return false;
      return true;
    });

    const costMap = {};
    filtered.forEach(r => { const k = r.cn||'Unknown'; costMap[k] = (costMap[k]||0) + r.cost; });
    const top = Object.entries(costMap).sort((a,b)=>b[1]-a[1]).slice(0,topN).map(([name,cost])=>({name,cost}));
    const topNames = new Set(top.map(c=>c.name));

    const monthly = {};
    filtered.filter(r => topNames.has(r.cn)).forEach(r => {
      const mo = r.day.substring(0,7);
      const cn = r.cn;
      if (!monthly[mo]) monthly[mo] = {};
      if (!monthly[mo][cn]) { monthly[mo][cn] = { cost:0 }; METRICS.forEach(m => { monthly[mo][cn][m.key] = 0; }); }
      const d = monthly[mo][cn];
      d.cost += r.cost;
      METRICS.forEach(m => { d[m.key] += r[`r${m.key.slice(1)}`]; });
    });

    const chart = Object.entries(monthly).sort((a,b)=>a[0].localeCompare(b[0])).map(([mo, camps]) => {
      const pt = { month: mo };
      Object.entries(camps).forEach(([cn, d]) => {
        METRICS.forEach(m => {
          const roas = d.cost > 0 ? d[m.key] / d.cost : 0;
          const ok = cohortOk(mo, m.days);
          const valid = roas >= 0.01 && d.cost >= 1000000;
          pt[`${cn}__${m.key}__c`] = (ok && valid) ? roas : null;
          pt[`${cn}__${m.key}__i`] = (!ok && valid) ? roas : null;
          pt[`${cn}__${m.key}__v`] = valid ? roas : null;
          pt[`${cn}__${m.key}__ok`] = ok;
        });
      });
      return pt;
    });

    // 실선→점선 연결: 마지막 완료 포인트 값을 점선에도 복사
    top.forEach(c => {
      METRICS.forEach(m => {
        let lastOkIdx = -1;
        for (let i = 0; i < chart.length; i++) {
          if (chart[i][`${c.name}__${m.key}__ok`]) lastOkIdx = i;
        }
        if (lastOkIdx >= 0 && lastOkIdx < chart.length - 1) {
          chart[lastOkIdx][`${c.name}__${m.key}__i`] = chart[lastOkIdx][`${c.name}__${m.key}__c`];
        }
      });
    });

    return { topCampaigns: top, chartData: chart };
  }, [rows, startDate, endDate, topN, selCh, selApp, selOS, showNoise]);

  const renderChart = (mk) => {
    const m = METRICS.find(x=>x.key===mk);
    if (!m || !selMetrics.includes(mk)) return null;
    return (
      <div key={mk} className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-sm font-bold text-gray-800">월별 {m.label} ROAS</h3>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">완료: ~{maxMonths[mk]||'N/A'}</span>
        </div>
        <p className="text-xs text-gray-400 mb-2">점선 = 코호트 미완료</p>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chartData} margin={{top:5,right:20,left:10,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#9ca3af" style={{fontSize:'11px'}} />
            <YAxis stroke="#9ca3af" style={{fontSize:'11px'}} tickFormatter={v=>(v*100).toFixed(0)+'%'} />
            <Tooltip
              contentStyle={{backgroundColor:'#fff',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'11px'}}
              content={({active, payload, label}) => {
                if (!active || !payload) return null;
                const seen = new Set();
                const items = payload
                  .filter(p => p.value != null && p.value >= 0.01)
                  .filter(p => {
                    const cn = p.dataKey?.split('__')[0];
                    if (seen.has(cn)) return false;
                    seen.add(cn);
                    return true;
                  })
                  .sort((a,b) => (b.value||0) - (a.value||0));
                if (!items.length) return null;
                return (
                  <div style={{backgroundColor:'#fff',border:'1px solid #e5e7eb',borderRadius:8,fontSize:11,padding:'8px 12px'}}>
                    <p style={{margin:'0 0 4px',fontWeight:600,color:'#374151'}}>{label}</p>
                    {items.map(p => (
                      <p key={p.dataKey} style={{margin:'2px 0',color:p.stroke}}>
                        {p.dataKey?.split('__')[0]}: {(p.value*100).toFixed(1)}%
                      </p>
                    ))}
                  </div>
                );
              }} />
            <Legend wrapperStyle={{fontSize:'10px',paddingTop:'8px'}} iconType="line"
              payload={topCampaigns.map((c,i) => ({ value: c.name, type:'line', color:COLORS[i%COLORS.length] }))} />
            <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="8 4" strokeWidth={1.5}
              label={{value:'BEP 100%',position:'right',fill:'#ef4444',fontSize:10}} />
            {topCampaigns.map((c,i) => (
              <React.Fragment key={c.name}>
                <Line type="monotone" dataKey={`${c.name}__${mk}__c`} stroke={COLORS[i%COLORS.length]}
                  strokeWidth={2} dot={false} activeDot={{r:4}}
                  connectNulls name={`${c.name}__${mk}__complete`} />
                <Line type="monotone" dataKey={`${c.name}__${mk}__i`} stroke={COLORS[i%COLORS.length]}
                  strokeWidth={1.5} strokeDasharray="5 5" strokeOpacity={0.3}
                  dot={false} activeDot={{r:3,strokeOpacity:0.3}}
                  connectNulls legendType="none" name={`${c.name}__${mk}__inc`} />
              </React.Fragment>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const TableView = () => {
    if (!showTable || !chartData.length || !topCampaigns.length) return null;
    const active = METRICS.filter(m=>selMetrics.includes(m.key));
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 overflow-x-auto">
        <h3 className="text-sm font-bold text-gray-800 mb-3">월별 ROAS 테이블</h3>
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="py-2 px-3 text-left font-semibold text-gray-600 sticky left-0 bg-white z-10">월</th>
              {topCampaigns.map((c,i)=>(
                <th key={c.name} colSpan={active.length} className="py-2 px-1 text-center font-semibold border-l border-gray-200"
                  style={{color:COLORS[i%COLORS.length]}}>
                  {c.name.length>22 ? c.name.substring(0,22)+'...' : c.name}
                </th>
              ))}
            </tr>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="py-1 px-3 sticky left-0 bg-gray-50 z-10"></th>
              {topCampaigns.map(c => active.map(m=>(
                <th key={`${c.name}_${m.key}`} className="py-1 px-1.5 text-center text-gray-500 font-medium border-l border-gray-100 text-xs">
                  {m.label}
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {chartData.map(row=>(
              <tr key={row.month} className="border-b border-gray-50 hover:bg-blue-50/50">
                <td className="py-1.5 px-3 font-medium text-gray-700 sticky left-0 bg-white z-10">{row.month}</td>
                {topCampaigns.map(c => active.map(m => {
                  const v = row[`${c.name}__${m.key}__v`];
                  const ok = row[`${c.name}__${m.key}__ok`];
                  const txt = v!=null && v>0 ? (v*100).toFixed(1)+'%' : '-';
                  const clr = v>=1?'text-green-700 font-semibold':v>0.5?'text-amber-700':v>0?'text-red-600':'text-gray-300';
                  return (
                    <td key={`${c.name}_${m.key}_${row.month}`}
                      className={`py-1.5 px-1.5 text-center border-l border-gray-50 ${clr} ${!ok?'opacity-40 italic':''}`}>
                      {txt}
                    </td>
                  );
                }))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-400 mt-2">* 흐린 이탤릭 = 미완료 코호트 / 초록 &ge;100% / 빨강 &lt;50%</p>
      </div>
    );
  };

  const Chips = ({label, items, sel, onToggle, onAll}) => (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-600">{label} ({sel.length}/{items.length})</span>
        <button onClick={onAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
          {sel.length===items.length?'해제':'전체'}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(v=>(
          <button key={v} onClick={()=>onToggle(v)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${sel.includes(v)?'bg-blue-50 border-blue-300 text-blue-800':'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full min-h-screen bg-gray-50 p-4" style={{fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'}}>
      <div className="max-w-7xl mx-auto space-y-4">

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold text-gray-900">캠페인 ROAS 대시보드</h1>
              <p className="text-xs text-gray-400">Adjust CSV &rarr; 캠페인별 코호트 ROAS 추이</p>
            </div>
            {fileName && <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">{fileName} / {rows.length.toLocaleString()}행</span>}
          </div>

          <input type="file" accept=".csv" onChange={handleFile}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4" />

          {rows.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">시작일</label>
                  <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">종료일</label>
                  <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Top N</label>
                  <select value={topN} onChange={e=>setTopN(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
                    {[3,5,10,15,20].map(n=><option key={n} value={n}>Top {n}</option>)}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-lg">
                    <input type="checkbox" checked={showNoise} onChange={()=>setShowNoise(!showNoise)} className="rounded" />
                    <span className="text-yellow-800 font-medium">노이즈 포함</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
                    <input type="checkbox" checked={showTable} onChange={()=>setShowTable(!showTable)} className="rounded" />
                    <span className="text-gray-700 font-medium">테이블</span>
                  </label>
                </div>
              </div>

              {apps.length > 1 && <Chips label="앱" items={apps} sel={selApp} onToggle={toggle(setSelApp)} onAll={toggleAll(setSelApp,apps,selApp)} />}
              {osList.length > 1 && <Chips label="OS" items={osList} sel={selOS} onToggle={toggle(setSelOS)} onAll={toggleAll(setSelOS,osList,selOS)} />}
              <Chips label="채널" items={channels} sel={selCh} onToggle={toggle(setSelCh)} onAll={toggleAll(setSelCh,channels,selCh)} />

              <div className="mb-4">
                <span className="text-xs font-semibold text-gray-600 mb-1.5 block">ROAS 지표</span>
                <div className="flex flex-wrap gap-1.5">
                  {METRICS.map(m => {
                    const on = selMetrics.includes(m.key);
                    return (
                      <button key={m.key} onClick={()=>setSelMetrics(p=>p.includes(m.key)?p.filter(x=>x!==m.key):[...p,m.key])}
                        className={`px-3 py-1 rounded-md text-xs font-semibold border-2 transition-all ${on ? `${m.bg} ${m.border} ${m.text}` : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {topCampaigns.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Top {topN} (광고비 순)</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {topCampaigns.map((c,i) => (
                      <div key={c.name} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:shadow transition-shadow">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-3 h-3 rounded-full" style={{backgroundColor:COLORS[i%COLORS.length]}} />
                          <span className="text-xs font-bold text-gray-400">#{i+1}</span>
                        </div>
                        <p className="text-xs font-medium text-gray-800 break-all mb-0.5">
                          {c.name}
                        </p>
                        <p className="text-sm font-bold text-gray-700">{(c.cost/1e6).toFixed(1)}M</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {chartData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            {METRICS.map(m => renderChart(m.key))}
          </div>
        )}

        <TableView />

        {!rows.length && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-3">📊</div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">Adjust CSV를 업로드해주세요</h3>
            <p className="text-sm text-gray-400">필수 컬럼: app, os_name, channel, campaign_network, day, network_cost, all_revenue_total_d2~d120</p>
          </div>
        )}
      </div>
    </div>
  );
}
