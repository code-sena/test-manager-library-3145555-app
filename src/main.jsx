import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const views = [
  ['books', 'Catálogo', '▤'],
  ['members', 'Socios', '◉'],
  ['loans', 'Préstamos', '↗'],
  ['overdue', 'Vencidos', '!'],
  ['reports', 'Informes', '⌁'],
];

async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && token) window.dispatchEvent(new Event('library:logout'));
    throw new Error(data.message || 'No fue posible completar la solicitud.');
  }
  return data;
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      onLogin(result);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-screen">
      <div className="login-art">
        <div className="login-logo">M</div>
        <p className="eyebrow">UN LUGAR PARA CADA HISTORIA</p>
        <h1>Cuida los libros.<br /><em>Comparte historias.</em></h1>
        <p>La biblioteca, en armonía.</p>
        <div className="book-illustration"><i /><i /><i /><i /><i /></div>
      </div>
      <form className="login-card" onSubmit={submit}>
        <span className="overline">BIENVENIDA, BIENVENIDO</span>
        <h2>Inicia sesión</h2>
        <p>Ingresa tus credenciales para continuar.</p>
        <label>Usuario<input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy ? 'Ingresando…' : 'Entrar a mi biblioteca'} <span>→</span></button>
        <small>Acceso exclusivo para el equipo de la biblioteca.</small>
      </form>
    </main>
  );
}

function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('library-session')); } catch { return null; }
  });
  const [view, setView] = useState('books');
  const [refresh, setRefresh] = useState(0);
  const [toast, setToast] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const token = session?.access_token;
  const logout = useCallback(() => {
    localStorage.removeItem('library-session');
    setSession(null);
  }, []);
  useEffect(() => {
    window.addEventListener('library:logout', logout);
    return () => window.removeEventListener('library:logout', logout);
  }, [logout]);
  useEffect(() => {
    if (session) localStorage.setItem('library-session', JSON.stringify(session));
  }, [session]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  if (!session) return <Login onLogin={setSession} />;

  function done(message) {
    setToast(message);
    setRefresh((current) => current + 1);
  }
  const activeView = views.find(([key]) => key === view);
  return (
    <div className="workspace">
      <aside className={`sidebar ${navOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark">M</span><span>manager<span className="brand-muted">library</span></span>
        </a>
        <p className="nav-label">BIBLIOTECA</p>
        <nav aria-label="Secciones de la biblioteca">
          {views.filter(([key]) => key !== 'reports' || session.role === 'admin').map(([key, label, icon]) => (
            <button key={key} className={`nav-item ${view === key ? 'nav-active' : ''}`} onClick={() => { setView(key); setNavOpen(false); }}>
              <span className="nav-icon">{icon}</span>{label}
              {key === 'overdue' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-badge"><span>{session.role === 'admin' ? 'A' : 'B'}</span><div><strong>{session.role === 'admin' ? 'Administración' : 'Bibliotecario'}</strong><small>{session.role}</small></div></div>
          <button className="logout-button" onClick={logout}>Cerrar sesión <span>↗</span></button>
        </div>
      </aside>
      <main className="main-panel">
        <header className="top-header">
          <button className="menu-button" aria-label="Abrir menú" onClick={() => setNavOpen((open) => !open)}>☰</button>
          <div><span className="breadcrumb">Manager Library</span><span className="crumb-separator">/</span><strong>{activeView?.[1]}</strong></div>
          <span className="header-date">{new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(new Date())}</span>
        </header>
        <section className="content">
          {view === 'books' && <Books token={token} refresh={refresh} notify={done} admin={session.role === 'admin'} />}
          {view === 'members' && <Members token={token} refresh={refresh} notify={done} />}
          {view === 'loans' && <Loans token={token} refresh={refresh} notify={done} />}
          {view === 'overdue' && <Overdue token={token} refresh={refresh} />}
          {view === 'reports' && (session.role === 'admin' ? <Reports token={token} /> : <Empty title="Informe reservado" text="Solo el administrador puede consultar este informe." />)}
        </section>
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>;
}

function Empty({ title, text }) {
  return <div className="empty-state"><span>✳</span><h3>{title}</h3><p>{text}</p></div>;
}

function useLoad(path, token, refresh = 0) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    api(path, { token }).then((result) => { if (alive) { setData(result); setError(''); } })
      .catch((failure) => { if (alive) setError(failure.message); });
    return () => { alive = false; };
  }, [path, token, refresh]);
  return { data, error };
}

function Alert({ children }) {
  return children ? <p className="form-error" role="alert">{children}</p> : null;
}

function Books({ token, refresh, notify, admin }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: '', author: '', isbn: '', category_id: '', total_copies: 1 });
  const params = new URLSearchParams({ page: String(page), size: '12' });
  if (query.trim()) params.set('q', query.trim());
  const { data, error: loadError } = useLoad(`/books?${params}`, token, refresh);
  useEffect(() => { api('/categories', { token }).then(setCategories).catch((failure) => setError(failure.message)); }, [token]);
  async function create(event) {
    event.preventDefault(); setError('');
    try {
      await api('/books', { token, method: 'POST', body: JSON.stringify({ ...form, total_copies: Number(form.total_copies) }) });
      setCreating(false); setForm({ title: '', author: '', isbn: '', category_id: '', total_copies: 1 }); notify('Libro agregado al catálogo.');
    } catch (failure) { setError(failure.message); }
  }
  async function remove(book) {
    if (!window.confirm(`¿Dar de baja «${book.title}»?`)) return;
    try { await api(`/books/${book.id}`, { token, method: 'DELETE' }); notify('Libro dado de baja.'); }
    catch (failure) { setError(failure.message); }
  }
  return <>
    <PageHeading eyebrow="COLECCIÓN" title="Catálogo de libros" subtitle="Todo lo que hace de tu biblioteca un lugar especial."
      action={admin && <button className="primary-button compact" onClick={() => setCreating(!creating)}>＋ Agregar libro</button>} />
    {admin && creating && <form className="form-card book-form" onSubmit={create}>
      <h3>Nuevo libro</h3><div className="form-grid">
        <label>Título<input required maxLength="250" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label>Autor<input required maxLength="200" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></label>
        <label>ISBN (13 dígitos)<input required pattern="[0-9]{13}" maxLength="13" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} /></label>
        <label>Categoría<select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}><option value="">Selecciona</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Ejemplares<input required type="number" min="1" value={form.total_copies} onChange={(e) => setForm({ ...form, total_copies: e.target.value })} /></label>
      </div><Alert>{error}</Alert><div className="form-actions"><button type="button" className="quiet-button" onClick={() => setCreating(false)}>Cancelar</button><button className="primary-button compact">Guardar libro</button></div>
    </form>}
    <div className="toolbar"><label className="search-box"><span>⌕</span><input aria-label="Buscar por título o autor" placeholder="Busca un título o autor…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} /></label><span className="result-count">{data?.total ?? '—'} libros en colección</span></div>
    <Alert>{error || loadError}</Alert>
    {data?.items?.length ? <div className="book-grid">{data.items.map((book, index) => <article className="book-card" key={book.id}>
      <div className={`book-cover cover-${index % 5}`}><span>{book.category.name}</span><strong>{book.title.split(' ').slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</strong><small>MANAGER LIBRARY</small></div>
      <div className="book-info"><span className="category-tag">{book.category.name}</span><h3>{book.title}</h3><p>{book.author}</p><div className="book-meta"><span>ISBN {book.isbn}</span><strong className={book.available_copies ? '' : 'unavailable'}>{book.available_copies} / {book.total_copies} disponibles</strong></div>{admin && <button className="text-danger" onClick={() => remove(book)}>Dar de baja</button>}</div>
    </article>)}</div> : data && <Empty title="Aún no hay libros" text={query ? 'Prueba con otro título o autor.' : 'Cuando agregues libros, aparecerán aquí.'} />}
    {data?.total > data?.size && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Anterior</button><span>Página {page}</span><button disabled={page * data.size >= data.total} onClick={() => setPage(page + 1)}>Siguiente →</button></div>}
  </>;
}

function Members({ token, refresh, notify }) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: '', document_number: '' });
  const [error, setError] = useState('');
  const params = new URLSearchParams({ page: '1', size: '50' });
  if (query.trim()) params.set('q', query.trim());
  const { data, error: loadError } = useLoad(`/members?${params}`, token, refresh);
  async function create(event) {
    event.preventDefault(); setError('');
    try { await api('/members', { token, method: 'POST', body: JSON.stringify(form) }); setForm({ full_name: '', document_number: '' }); setCreating(false); notify('Socio registrado.'); }
    catch (failure) { setError(failure.message); }
  }
  return <>
    <PageHeading eyebrow="COMUNIDAD" title="Socios" subtitle="Las personas que dan vida a cada historia." action={<button className="primary-button compact" onClick={() => setCreating(!creating)}>＋ Registrar socio</button>} />
    {creating && <form className="form-card" onSubmit={create}><h3>Nuevo socio</h3><div className="form-grid two-columns"><label>Nombre completo<input required maxLength="200" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label><label>Número de documento<input required maxLength="30" value={form.document_number} onChange={(e) => setForm({ ...form, document_number: e.target.value })} /></label></div><Alert>{error}</Alert><div className="form-actions"><button type="button" className="quiet-button" onClick={() => setCreating(false)}>Cancelar</button><button className="primary-button compact">Guardar socio</button></div></form>}
    <div className="toolbar"><label className="search-box"><span>⌕</span><input placeholder="Buscar por nombre o documento…" value={query} onChange={(e) => setQuery(e.target.value)} /></label><span className="result-count">{data?.total ?? '—'} socios</span></div><Alert>{loadError}</Alert>
    {data?.items?.length ? <div className="table-wrap"><table><thead><tr><th>SOCIO</th><th>DOCUMENTO</th><th>REGISTRO</th></tr></thead><tbody>{data.items.map((member) => <tr key={member.id}><td><span className="member-avatar">{member.full_name.trim().split(/\s+/).slice(0, 2).map((name) => name[0]).join('').toUpperCase()}</span><strong>{member.full_name}</strong></td><td>{member.document_number}</td><td><span className="status-pill status-active">Activo</span></td></tr>)}</tbody></table></div> : data && <Empty title="Aún no hay socios" text="Registra el primer socio de la biblioteca." />}
  </>;
}

function Loans({ token, refresh, notify }) {
  const [members, setMembers] = useState([]);
  const [books, setBooks] = useState([]);
  const [memberId, setMemberId] = useState('');
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [error, setError] = useState('');
  const params = new URLSearchParams({ page: '1', size: '50' });
  const { data, error: loadError } = useLoad(`/loans?${params}`, token, refresh);
  useEffect(() => { Promise.all([api('/members?page=1&size=50', { token }), api('/books?page=1&size=50', { token })]).then(([m, b]) => { setMembers(m.items); setBooks(b.items); }).catch((failure) => setError(failure.message)); }, [token, refresh]);
  async function lend(event) {
    event.preventDefault(); setError('');
    try {
      await api('/loans', { token, method: 'POST', body: JSON.stringify({ member_id: memberId, items: selectedBooks.map((book_id) => ({ book_id })) }) });
      setMemberId(''); setSelectedBooks([]); notify('Préstamo registrado correctamente.');
    } catch (failure) { setError(failure.message); }
  }
  async function returnItem(loan, item) {
    try { await api(`/loans/${loan.id}/items/${item.id}/return`, { token, method: 'POST' }); notify(`Devolución de «${item.book_title}» registrada.`); }
    catch (failure) { setError(failure.message); }
  }
  const openItems = useMemo(() => (data?.items || []).flatMap((loan) => loan.items.filter((item) => !item.returned_at).map((item) => ({ loan, item }))), [data]);
  return <>
    <PageHeading eyebrow="CIRCULACIÓN" title="Préstamos" subtitle="Cada préstamo, acompañado de principio a fin." />
    <form className="form-card loan-form" onSubmit={lend}><h3>Registrar préstamo</h3><div className="form-grid two-columns">
      <label>Socio<select required value={memberId} onChange={(e) => setMemberId(e.target.value)}><option value="">Selecciona un socio</option>{members.map((member) => <option key={member.id} value={member.id}>{member.full_name} · {member.document_number}</option>)}</select></label>
      <label>Libros <small>(máximo 3)</small><select multiple required value={selectedBooks} onChange={(e) => setSelectedBooks(Array.from(e.target.selectedOptions, (option) => option.value).slice(0, 3))}>{books.filter((book) => book.available_copies > 0).map((book) => <option key={book.id} value={book.id}>{book.title} · {book.available_copies} disponibles</option>)}</select></label>
    </div><Alert>{error}</Alert><button className="primary-button compact" disabled={!memberId || selectedBooks.length === 0}>Confirmar préstamo <span>→</span></button></form>
    <div className="section-title"><div><span className="eyebrow">SEGUIMIENTO</span><h2>Devoluciones pendientes</h2></div><span className="result-count">{openItems.length} libros</span></div><Alert>{loadError}</Alert>
    {openItems.length ? <div className="table-wrap"><table><thead><tr><th>LIBRO</th><th>VENCE</th><th>ESTADO</th><th></th></tr></thead><tbody>{openItems.map(({ loan, item }) => <tr key={item.id}><td><strong>{item.book_title}</strong><small className="table-secondary">{item.category_name}</small></td><td>{new Date(item.due_at).toLocaleDateString('es-CO')}</td><td><span className={`status-pill ${loan.status === 'overdue' ? 'status-late' : 'status-active'}`}>{loan.status === 'overdue' ? 'Vencido' : 'Abierto'}</span></td><td><button className="quiet-button" onClick={() => returnItem(loan, item)}>Registrar devolución</button></td></tr>)}</tbody></table></div> : data && <Empty title="Todo al día" text="No hay libros pendientes de devolución." />}
  </>;
}

function Overdue({ token, refresh }) {
  const { data, error } = useLoad('/loans/overdue', token, refresh);
  return <><PageHeading eyebrow="SEGUIMIENTO" title="Libros vencidos" subtitle="Préstamos que necesitan un recordatorio amable." /><Alert>{error}</Alert>
    {data?.items?.length ? <div className="table-wrap"><table><thead><tr><th>LIBRO</th><th>SOCIO</th><th>FECHA DE VENCIMIENTO</th><th>RETRASO</th></tr></thead><tbody>{data.items.map((item) => <tr key={item.item_id}><td><strong>{item.book_title}</strong></td><td>{item.member_name}</td><td>{new Date(item.due_at).toLocaleDateString('es-CO')}</td><td><span className="status-pill status-late">{item.days_late} días</span></td></tr>)}</tbody></table></div> : data && <Empty title="Sin vencidos" text="No hay libros vencidos en este momento." />}
  </>;
}

function Reports({ token }) {
  const initial = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${initial.slice(0, 7)}-01`);
  const [to, setTo] = useState(initial);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  async function run(event) {
    event.preventDefault(); setError('');
    try { setReport(await api(`/reports/most-borrowed?${new URLSearchParams({ from, to })}`, { token })); }
    catch (failure) { setReport(null); setError(failure.message); }
  }
  return <><PageHeading eyebrow="ANÁLISIS" title="Libros más prestados" subtitle="Descubre las historias que más circulan en tu biblioteca." />
    <form className="form-card report-form" onSubmit={run}><label>Desde<input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>Hasta<input type="date" required value={to} onChange={(e) => setTo(e.target.value)} /></label><button className="primary-button compact">Generar informe <span>→</span></button></form><Alert>{error}</Alert>
    {report && (report.rows.length ? <div className="table-wrap"><table><thead><tr><th>LIBRO</th><th>CATEGORÍA</th><th>PRÉSTAMOS</th></tr></thead><tbody>{report.rows.map((row) => <tr key={`${row.book_id}-${row.category_name}`}><td><strong>{row.book_title}</strong></td><td>{row.category_name}</td><td><span className="status-pill status-active">{row.times_borrowed}</span></td></tr>)}</tbody></table></div> : <Empty title="Sin préstamos en este rango" text="Prueba con un período distinto." />)}
  </>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
