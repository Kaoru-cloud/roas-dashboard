import React, { useState } from 'react'
import Dashboard from './Dashboard'
import CreativeDashboard from './CreativeDashboard'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:40,fontFamily:'monospace'}}>
          <h2 style={{color:'red'}}>렌더링 에러 발생</h2>
          <pre style={{whiteSpace:'pre-wrap',background:'#f5f5f5',padding:16,borderRadius:8}}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button onClick={()=>this.setState({error:null})} style={{marginTop:16,padding:'8px 16px',cursor:'pointer'}}>
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const TABS = [
  { key: 'campaigns', label: 'Campaign ROAS' },
  { key: 'creatives', label: 'Creative Performance' },
];

export default function App() {
  const [page, setPage] = useState('campaigns');
  return (
    <ErrorBoundary>
      <nav className="bg-white border-b border-gray-200 px-4 py-2 flex gap-2" style={{fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'}}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setPage(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              page === t.key
                ? 'bg-blue-50 text-blue-700 border border-blue-300'
                : 'text-gray-500 hover:bg-gray-100 border border-transparent'
            }`}>
            {t.label}
          </button>
        ))}
      </nav>
      {page === 'campaigns' ? <Dashboard /> : <CreativeDashboard />}
    </ErrorBoundary>
  )
}
