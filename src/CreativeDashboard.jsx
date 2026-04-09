import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import * as Papa from "papaparse";

const COLORS = ['#2563eb','#dc2626','#16a34a','#9333ea','#ea580c','#f59e0b','#10b981','#06b6d4','#8b5cf6','#ec4899',
  '#0891b2','#be123c','#4f46e5','#ca8a04','#059669','#e11d48','#7c3aed','#0284c7','#d97706','#65a30d'];

const NOISE_LIST = ['unknown','expired attributions','anonymous ips','malformed advertising id','untrusted devices'];
const isNoise = (n) => !n || NOISE_LIST.includes(n.toLowerCase().trim());

const METRIC_OPTIONS = [
  { key: 'spend', trendKey: 'cost', label: 'Spend' },
  { key: 'installs', trendKey: 'installs', label: 'Installs' },
  { key: 'revenue', trendKey: 'rev2', label: 'D+2 Revenue' },
];

const fmtCount = (v) => {
  if (v == null || !isFinite(v)) return '-';
  const man = v / 10000;
  if (man >= 10000) return (man / 10000).toFixed(1) + '억건';
  if (man >= 1) return man.toFixed(0) + '만건';
  return v.toFixed(0) + '건';
};

const fmtWon = (v) => {
  if (v == null || !isFinite(v)) return '-';
  const man = v / 10000;
  if (man >= 10000) return (man / 10000).toFixed(1) + '억원';
  if (man >= 1) return man.toFixed(0) + '만원';
  return v.toFixed(0) + '원';
};

const fmtMetric = (v, metric) => metric === 'installs' ? fmtCount(v) : fmtWon(v);

export default function CreativeDashboard() {
  const [rows, setRows] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [topN, setTopN] = useState(5);
  const [selApp, setSelApp] = useState('');
  const [selStore, setSelStore] = useState('');
  const [selCh, setSelCh] = useState('');
  const [selCn, setSelCn] = useState('');
  const [selAg, setSelAg] = useState('');
  const [showNoise, setShowNoise] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [fileName, setFileName] = useState('');
  const [sortMetric, setSortMetric] = useState('spend');
  const trendMetric = METRIC_OPTIONS.find(m => m.key === sortMetric)?.trendKey || 'cost';

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const cleaned = res.data.map(r => ({
          app: r.app?.trim() || '',
          store: r.store_type?.trim() || '',
          ch: r.channel?.trim() || '',
          cn: r.campaign_network?.trim() || '',
          ag: r.adgroup_network?.trim() || '',
          creative: r.creative_network?.trim() || '',
          day: r.day?.trim() || '',
          cost: parseFloat(r.network_cost) || 0,
          installs: parseInt(r.installs) || 0,
          rev2: parseFloat(r.all_revenue_total_d2) || 0,
        }));
        setRows(cleaned);
        const days = cleaned.map(r => r.day).filter(Boolean).sort();
        if (days.length) {
          const maxD = days[days.length - 1];
          const [y, m, d] = maxD.split('-').map(Number);
          const start = new Date(y, m - 1, d - 6);
          const fmt = (dt) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
          setStartDate(fmt(start));
          setEndDate(maxD);
        }
        // Reset all filters to (전체)
        setSelApp('');
        setSelStore('');
        setSelCh('');
        setSelCn('');
        setSelAg('');
      }
    });
  };

  const dateFiltered = useMemo(() => {
    if (!startDate || !endDate) return rows;
    return rows.filter(r => r.day >= startDate && r.day <= endDate);
  }, [rows, startDate, endDate]);

  const appsRanked = useMemo(() => {
    const map = {};
    dateFiltered.forEach(r => { if (r.app) map[r.app] = (map[r.app] || 0) + r.cost; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name);
  }, [dateFiltered]);

  const stores = useMemo(() => [...new Set(rows.map(r => r.store).filter(Boolean))].sort(), [rows]);

  const channelsRanked = useMemo(() => {
    const map = {};
    dateFiltered.filter(r => !selApp || r.app === selApp).forEach(r => { if (r.ch) map[r.ch] = (map[r.ch] || 0) + r.cost; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name);
  }, [dateFiltered, selApp]);

  const campaignsRanked = useMemo(() => {
    const map = {};
    dateFiltered
      .filter(r => (!selCh || r.ch === selCh) && (!selApp || r.app === selApp))
      .forEach(r => { if (r.cn && !isNoise(r.cn)) map[r.cn] = (map[r.cn] || 0) + r.cost; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name);
  }, [dateFiltered, selCh, selApp]);

  const adgroupsRanked = useMemo(() => {
    const map = {};
    dateFiltered
      .filter(r => (!selCh || r.ch === selCh) && (!selCn || r.cn === selCn) && (!selApp || r.app === selApp))
      .forEach(r => { if (r.ag && !isNoise(r.ag)) map[r.ag] = (map[r.ag] || 0) + r.cost; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name);
  }, [dateFiltered, selCh, selCn, selApp]);

  const maxDay = useMemo(() => {
    const days = rows.map(r => r.day).filter(Boolean).sort();
    return days.length ? days[days.length - 1] : '';
  }, [rows]);

  const setDateRange = (daysBack) => {
    if (!maxDay) return;
    const [y, m, d] = maxDay.split('-').map(Number);
    const start = new Date(y, m - 1, d - daysBack + 1);
    const fmt = (dt) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    setStartDate(fmt(start));
    setEndDate(maxDay);
  };

  const { topCreatives, trendData } = useMemo(() => {
    if (!rows.length) return { topCreatives: [], trendData: [] };

    const filtered = rows.filter(r => {
      if (r.day < startDate || r.day > endDate) return false;
      if (selApp && r.app !== selApp) return false;
      if (selStore && r.store !== selStore) return false;
      if (selCh && r.ch !== selCh) return false;
      if (selCn && r.cn !== selCn) return false;
      if (selAg && r.ag !== selAg) return false;
      if (!showNoise && isNoise(r.creative)) return false;
      return true;
    });

    const creativeMap = {};
    filtered.forEach(r => {
      const key = r.creative || 'Unknown';
      if (!creativeMap[key]) creativeMap[key] = { name: key, spend: 0, installs: 0, revenue: 0 };
      const d = creativeMap[key];
      d.spend += r.cost;
      d.installs += r.installs;
      d.revenue += r.rev2;
    });

    const allCreatives = Object.values(creativeMap).map(c => ({
      ...c,
      cpi: c.installs > 0 ? c.spend / c.installs : Infinity,
      roas: c.spend > 0 ? c.revenue / c.spend : 0,
    }));

    const sortFn = (a, b) => (b[sortMetric] || 0) - (a[sortMetric] || 0);
    const top = allCreatives.sort(sortFn).slice(0, topN);
    const topNames = new Set(top.map(c => c.name));

    const dailyMap = {};
    filtered.filter(r => topNames.has(r.creative)).forEach(r => {
      const day = r.day;
      if (!dailyMap[day]) dailyMap[day] = { day };
      const key = r.creative;
      dailyMap[day][`${key}__cost`] = (dailyMap[day][`${key}__cost`] || 0) + r.cost;
      dailyMap[day][`${key}__installs`] = (dailyMap[day][`${key}__installs`] || 0) + r.installs;
      dailyMap[day][`${key}__rev2`] = (dailyMap[day][`${key}__rev2`] || 0) + r.rev2;
    });

    const trend = Object.values(dailyMap).sort((a, b) => a.day.localeCompare(b.day));
    return { topCreatives: top, trendData: trend };
  }, [rows, startDate, endDate, topN, selApp, selStore, selCh, selCn, selAg, showNoise, sortMetric]);

  const barData = useMemo(() => {
    return [...topCreatives].map((c, i) => ({
      name: c.name,
      displayName: c.name,
      value: c[sortMetric],
      fill: COLORS[i % COLORS.length],
    }));
  }, [topCreatives, sortMetric]);

  const renderBarChart = () => {
    if (!barData.length) return null;
    const metricLabel = METRIC_OPTIONS.find(s => s.key === sortMetric)?.label || sortMetric;
    const barH = Math.max(barData.length * 40 + 40, 200);
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">Top {topN} 소재 ({metricLabel} 기준)</h3>
        <p className="text-xs text-gray-400 mb-3">소재별 {metricLabel} 합계 랭킹</p>
        <ResponsiveContainer width="100%" height={barH}>
          <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" stroke="#9ca3af" style={{ fontSize: '11px' }}
              tickFormatter={v => fmtMetric(v, sortMetric)} />
            <YAxis type="category" dataKey="displayName" width={200} stroke="#9ca3af" style={{ fontSize: '10px' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11 }}
              formatter={(v) => [fmtMetric(v, sortMetric), metricLabel]}
              labelFormatter={(label) => {
                const item = barData.find(d => d.displayName === label);
                return item ? item.name : label;
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderTrendChart = () => {
    if (!trendData.length || !topCreatives.length) return null;
    const metricLabel = METRIC_OPTIONS.find(m => m.key === sortMetric)?.label || sortMetric;
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-bold text-gray-800">일별 소재 추이 ({metricLabel})</h3>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" stroke="#9ca3af" style={{ fontSize: '11px' }} />
            <YAxis stroke="#9ca3af" style={{ fontSize: '11px' }} tickFormatter={v => fmtMetric(v, sortMetric)} />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11 }}
              content={({ active, payload, label }) => {
                if (!active || !payload) return null;
                const items = payload.filter(p => p.value != null && p.value > 0).sort((a, b) => (b.value || 0) - (a.value || 0));
                if (!items.length) return null;
                return (
                  <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11, padding: '8px 12px', maxWidth: 350 }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#374151' }}>{label}</p>
                    {items.map(p => (
                      <p key={p.dataKey} style={{ margin: '2px 0', color: p.stroke }}>
                        {p.dataKey?.split('__')[0]}: {fmtMetric(p.value, sortMetric)}
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} iconType="line"
              payload={topCreatives.map((c, i) => ({ value: c.name, type: 'line', color: COLORS[i % COLORS.length] }))} />
            {topCreatives.map((c, i) => (
              <Line key={c.name} type="monotone" dataKey={`${c.name}__${trendMetric}`}
                stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }}
                connectNulls name={c.name} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderTable = () => {
    if (!showTable || !topCreatives.length) return null;
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 overflow-x-auto">
        <h3 className="text-sm font-bold text-gray-800 mb-3">소재 성과 테이블</h3>
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="py-2 px-2 text-left font-semibold text-gray-600 w-8">#</th>
              <th className="py-2 px-3 text-left font-semibold text-gray-600 min-w-[200px]">소재</th>
              {METRIC_OPTIONS.map(s => (
                <th key={s.key} onClick={() => setSortMetric(s.key)}
                  className="py-2 px-3 text-right font-semibold text-gray-600 cursor-pointer hover:text-blue-600 whitespace-nowrap">
                  {s.label} {sortMetric === s.key ? '▼' : ''}
                </th>
              ))}
              <th className="py-2 px-3 text-right font-semibold text-gray-600 whitespace-nowrap">CPI</th>
              <th className="py-2 px-3 text-right font-semibold text-gray-600 whitespace-nowrap">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {topCreatives.map((c, i) => {
              const roasAlpha = c.spend > 0 ? Math.min(c.roas / 2, 1) * 0.4 : 0;
              const roasBg = c.roas >= 1
                ? `rgba(22,163,74,${roasAlpha.toFixed(2)})`
                : c.spend > 0 ? `rgba(220,38,38,${roasAlpha.toFixed(2)})` : 'transparent';
              return (
                <tr key={c.name} className="border-b border-gray-50 hover:bg-blue-50/30">
                  <td className="py-2 px-2 text-gray-400 font-bold" style={{ borderLeftColor: COLORS[i % COLORS.length], borderLeftWidth: 3 }}>
                    {i + 1}
                  </td>
                  <td className="py-2 px-3 font-medium text-gray-800 break-all text-xs leading-tight max-w-[300px]">
                    {c.name}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-700 font-medium">{fmtWon(c.spend)}</td>
                  <td className="py-2 px-3 text-right text-gray-700 font-medium">{fmtCount(c.installs)}</td>
                  <td className="py-2 px-3 text-right text-gray-700 font-medium">{fmtWon(c.revenue)}</td>
                  <td className="py-2 px-3 text-right text-gray-700 font-medium">
                    {isFinite(c.cpi) && c.cpi > 0 ? Math.round(c.cpi).toLocaleString() + '원' : '-'}
                  </td>
                  <td className="py-2 px-3 text-right font-bold" style={{ backgroundColor: roasBg }}>
                    {c.spend > 0 ? (c.roas * 100).toFixed(1) + '%' : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const selectClass = "w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm";

  return (
    <div className="w-full min-h-screen bg-gray-50 p-4" style={{ fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <div className="max-w-7xl mx-auto space-y-4">

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold text-gray-900">소재 성과 대시보드</h1>
              <p className="text-xs text-gray-400">CSV 업로드 &rarr; 소재별 Spend / Install / D+2 Revenue 분석</p>
            </div>
            {fileName && <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">{fileName} / {rows.length.toLocaleString()}행</span>}
          </div>

          <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4" />

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[{ label: '최근 1주', days: 7 }, { label: '최근 2주', days: 14 }, { label: '최근 1달', days: 30 }, { label: '전체', days: 0 }].map(p => (
                  <button key={p.label} onClick={() => p.days ? setDateRange(p.days) : (() => { const days = rows.map(r => r.day).filter(Boolean).sort(); if (days.length) { setStartDate(days[0]); setEndDate(days[days.length - 1]); } })()}
                    className="px-3 py-1 rounded-md text-xs font-semibold border-2 transition-all bg-gray-100 border-gray-200 text-gray-500 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800">
                    {p.label}
                  </button>
                ))}
                <span className="text-xs text-gray-400 self-center ml-1">기준: 데이터 최신일 {maxDay || '-'}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">시작일</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className={selectClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">종료일</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className={selectClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Top N</label>
                  <select value={topN} onChange={e => setTopN(Number(e.target.value))} className={selectClass}>
                    {[3, 5, 7, 10].map(n => <option key={n} value={n}>Top {n}</option>)}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-lg">
                    <input type="checkbox" checked={showNoise} onChange={() => setShowNoise(!showNoise)} className="rounded" />
                    <span className="text-yellow-800 font-medium">노이즈 포함</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
                    <input type="checkbox" checked={showTable} onChange={() => setShowTable(!showTable)} className="rounded" />
                    <span className="text-gray-700 font-medium">테이블</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1.5fr_1.25fr] gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">앱</label>
                  <select value={selApp} onChange={e => { setSelApp(e.target.value); setSelCh(''); setSelCn(''); setSelAg(''); }} className={selectClass}>
                    <option value="">(전체)</option>
                    {appsRanked.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">스토어</label>
                  <select value={selStore} onChange={e => setSelStore(e.target.value)} className={selectClass}>
                    <option value="">(전체)</option>
                    {stores.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">채널</label>
                  <select value={selCh} onChange={e => { setSelCh(e.target.value); setSelCn(''); setSelAg(''); }} className={selectClass}>
                    <option value="">(전체)</option>
                    {channelsRanked.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">캠페인</label>
                  <select value={selCn} onChange={e => { setSelCn(e.target.value); setSelAg(''); }} className={selectClass}>
                    <option value="">(전체)</option>
                    {campaignsRanked.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">광고 세트</label>
                  <select value={selAg} onChange={e => setSelAg(e.target.value)} className={selectClass}>
                    <option value="">(전체)</option>
                    {adgroupsRanked.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-xs font-semibold text-gray-600 mb-1.5 block">정렬 기준</span>
                <div className="flex flex-wrap gap-1.5">
                  {METRIC_OPTIONS.map(s => (
                    <button key={s.key} onClick={() => setSortMetric(s.key)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold border-2 transition-all ${
                        sortMetric === s.key ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-gray-100 border-gray-200 text-gray-400'
                      }`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {topCreatives.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                    Top {topN} ({METRIC_OPTIONS.find(s => s.key === sortMetric)?.label} 순)
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    {topCreatives.slice(0, 5).map((c, i) => (
                      <div key={c.name} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:shadow transition-shadow">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                        </div>
                        <p className="text-xs font-medium text-gray-800 break-all mb-1 leading-tight">{c.name}</p>
                        <div className="flex gap-3 text-xs text-gray-500">
                          <span>Spend: <b className="text-gray-700">{fmtWon(c.spend)}</b></span>
                          <span>Install: <b className="text-gray-700">{fmtCount(c.installs)}</b></span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          D+2 Rev: <b className="text-gray-700">{fmtWon(c.revenue)}</b>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {topCreatives.length > 0 && (
          <>
            {renderBarChart()}
            {renderTrendChart()}
          </>
        )}

        {renderTable()}

        {!rows.length && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-3">&#x1F3AF;</div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">CSV를 업로드해주세요</h3>
            <p className="text-sm text-gray-400">필수 컬럼: app, store_type, channel, creative_network, day, network_cost, installs, all_revenue_total_d2</p>
          </div>
        )}
      </div>
    </div>
  );
}
