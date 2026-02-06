import React from 'react'
import Dashboard from './Dashboard'

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

export default function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  )
}
