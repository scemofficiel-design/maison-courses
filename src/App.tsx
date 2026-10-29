import { CalendarDays, ChefHat, Home, LayoutGrid, Package, Settings as SettingsIcon, ShoppingCart, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ensureSeed } from './db/seedOps';
import { t } from './i18n/fr';
import { UiProvider } from './ui/kit';
import { UpdateBanner } from './ui/UpdateBanner';
import { ErrorBoundary } from './ui/ErrorBoundary';
import HomePage from './pages/Home';
import StocksPage from './pages/Stocks';
import ProductPage from './pages/Product';
import ShoppingPage from './pages/Shopping';
import ListPage from './pages/ShoppingList';
import MenusPage from './pages/Menus';
import MealPage from './pages/Meal';
import RecipesPage from './pages/Recipes';
import RecipePage from './pages/Recipe';
import ProfilesPage from './pages/Profiles';
import PersonPage from './pages/Person';
import ProfilePage from './pages/DietProfile';
import PlanPage from './pages/Plan';
import SettingsPage from './pages/Settings';
import MorePage from './pages/More';
import SuggestionsPage from './pages/Suggestions';
import BudgetPage from './pages/Budget';
import ImportPage from './pages/Import';
import FamilyPage from './pages/Family';

const NAV = [
  { to: '/', label: t.nav.home, icon: Home, end: true },
  { to: '/stocks', label: t.nav.stocks, icon: Package },
  { to: '/courses', label: t.nav.shopping, icon: ShoppingCart },
  { to: '/menus', label: t.nav.menus, icon: CalendarDays },
];
const SIDE_EXTRA = [
  { to: '/recettes', label: t.nav.recipes, icon: ChefHat },
  { to: '/profils', label: t.nav.profiles, icon: Users },
  { to: '/parametres', label: t.nav.settings, icon: SettingsIcon },
];

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Shell() {
  const { pathname } = useLocation();
  const moreActive = ['/recettes', '/profils', '/parametres', '/plus', '/suggestions', '/budget'].some((p) => pathname.startsWith(p));
  return (
    <div className="app">
      <nav className="sidebar" aria-label="Navigation principale">
        <div className="brand"><img src="favicon.svg" alt="" width={28} height={28} /> {t.appName}</div>
        {[...NAV, ...SIDE_EXTRA.map((x) => ({ ...x, end: false }))].map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}><n.icon aria-hidden /> {n.label}</NavLink>
        ))}
      </nav>
      <main className="main">
        <UpdateBanner />
        <ErrorBoundary key={pathname}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/stocks" element={<StocksPage />} />
          <Route path="/stocks/famille/:id" element={<FamilyPage />} />
          <Route path="/stocks/:id" element={<ProductPage />} />
          <Route path="/courses" element={<ShoppingPage />} />
          <Route path="/courses/import" element={<ImportPage />} />
          <Route path="/courses/:id" element={<ListPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/menus" element={<MenusPage />} />
          <Route path="/menus/repas/:id" element={<MealPage />} />
          <Route path="/recettes" element={<RecipesPage />} />
          <Route path="/recettes/:id" element={<RecipePage />} />
          <Route path="/suggestions" element={<SuggestionsPage />} />
          <Route path="/profils" element={<ProfilesPage />} />
          <Route path="/profils/personne/:id" element={<PersonPage />} />
          <Route path="/profils/profil/:id" element={<ProfilePage />} />
          <Route path="/profils/plan/:id" element={<PlanPage />} />
          <Route path="/parametres" element={<SettingsPage />} />
          <Route path="/plus" element={<MorePage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <nav className="tabbar" aria-label="Navigation principale">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}><n.icon aria-hidden />{n.label}</NavLink>
        ))}
        <NavLink to="/plus" className={moreActive ? 'active' : undefined}><LayoutGrid aria-hidden />{t.nav.more}</NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    ensureSeed()
      .then(() => setState('ready'))
      .catch((e) => {
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      });
    // Demande au navigateur de ne pas effacer les données (accordé ou non selon le navigateur).
    navigator.storage?.persist?.().catch(() => undefined);
  }, []);
  if (state === 'loading') return <div className="empty" style={{ paddingTop: '30vh' }}>Chargement…</div>;
  if (state === 'error') {
    return (
      <div className="main">
        <div className="card danger stack">
          <h2>Impossible d’ouvrir la base de données</h2>
          <p className="small">{error}</p>
          <p className="small">En navigation privée, Safari peut bloquer le stockage local. Ouvrez l’application dans une fenêtre normale.</p>
        </div>
      </div>
    );
  }
  return (
    <UiProvider>
      <HashRouter>
        <ScrollTop />
        <Shell />
      </HashRouter>
    </UiProvider>
  );
}
