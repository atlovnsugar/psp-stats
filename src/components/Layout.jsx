import { Outlet, NavLink } from 'react-router-dom';
import TermSelector from './TermSelector';

export default function Layout() {
  return (
    <div className="app-layout">
      <header className="app-header">
        <div>
          <h1>PSP Stats</h1>
        </div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/poslanci">Poslanci</NavLink>
          <NavLink to="/hlasovani">Hlasování</NavLink>
          <NavLink to="/strany">Strany</NavLink>
        </nav>
        <TermSelector />
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="text-center text-muted" style={{ marginTop: 'auto' }}>
        Data: <a href="https://psp.cz" target="_blank" rel="noopener">psp.cz</a> · Aplikace pro transparentnost
      </footer>
    </div>
  );
}