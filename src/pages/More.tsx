import { BarChart3, ChefHat, Settings, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHead } from '../ui/kit';

const ITEMS = [
  { to: '/recettes', icon: ChefHat, title: 'Recettes', sub: 'Bibliothèque, portions, compatibilité' },
  { to: '/suggestions', icon: Sparkles, title: 'Que cuisiner ?', sub: 'Repas réalisables avec les stocks' },
  { to: '/profils', icon: Users, title: 'Profils', sub: 'Personnes, régimes, plans alimentaires' },
  { to: '/budget', icon: BarChart3, title: 'Budget', sub: 'Dépenses et comparaison des périodes' },
  { to: '/parametres', icon: Settings, title: 'Paramètres', sub: 'Sauvegarde, préférences, installation' },
];

export default function MorePage() {
  return (
    <div className="stack">
      <PageHead title="Plus" />
      <div className="list">
        {ITEMS.map((i) => (
          <Link key={i.to} to={i.to} className="item">
            <i.icon size={22} aria-hidden style={{ color: 'var(--primary)' }} />
            <span className="grow"><span className="title">{i.title}</span><div className="meta">{i.sub}</div></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
