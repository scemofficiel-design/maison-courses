import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { daysBetween, today } from '../domain/dates';
import { useSettings } from './hooks';
import { db } from '../db/db';

type Updater = (reload?: boolean) => Promise<void>;

/**
 * Bandeau de mise à jour (nouvelle version du service worker) et rappel de sauvegarde.
 * La mise à jour n'est jamais appliquée sans action de l'utilisateur.
 */
export function UpdateBanner() {
  const [update, setUpdate] = useState<Updater | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const settings = useSettings();
  const installedAt = useLiveQuery(() => db.meta.get('installedAt'), []);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    let cancelled = false;
    import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return;
      const updateSW = registerSW({
        onNeedRefresh() {
          setUpdate(() => updateSW);
        },
        onOfflineReady() {
          setOfflineReady(true);
          setTimeout(() => setOfflineReady(false), 5000);
        },
        onRegisteredSW(_url, reg) {
          // Vérifie les mises à jour toutes les heures quand l'application reste ouverte.
          if (reg) setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const since = settings.lastExportAt ?? (installedAt?.value as string | undefined);
  const exportDue = since ? daysBetween(since.slice(0, 10), today()) >= settings.exportReminderDays : false;

  return (
    <>
      {update && (
        <div className="banner" role="alert">
          <span className="grow">Une nouvelle version de l’application est disponible.</span>
          <button className="btn small primary" onClick={() => update(true)}>Mettre à jour</button>
        </div>
      )}
      {offlineReady && <div className="banner">L’application est prête à fonctionner hors ligne.</div>}
      {!online && <div className="banner">Hors ligne : toutes les données restent disponibles sur cet appareil.</div>}
      {exportDue && (
        <div className="banner">
          <span className="grow">{settings.lastExportAt ? `Dernière sauvegarde il y a plus de ${settings.exportReminderDays} jours.` : 'Aucune sauvegarde exportée pour l’instant.'}</span>
          <Link className="btn small" to="/parametres">Sauvegarder</Link>
        </div>
      )}
    </>
  );
}
