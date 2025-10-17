import React from 'react';
import PlexChart from './components/PlexChart';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>EVE Online PLEX Market</h1>
      </header>
      <main>
        <PlexChart />
      </main>
    </div>
  );
}

export default App;