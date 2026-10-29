import { ChevronLeft, Search, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseNumber } from '../domain/units';

// ---------------------------------------------------------------------------
// Feuille modale
// ---------------------------------------------------------------------------

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // `onClose` change à chaque rendu (fonction en ligne) : on le lit via une référence pour que
  // l'effet ne s'exécute qu'à l'ouverture. Sinon chaque frappe redonnait le focus au volet.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    // Ne pas voler le focus d'un champ marqué autoFocus à l'intérieur du volet.
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true });
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn round ghost" onClick={onClose} aria-label="Fermer"><X /></button>
        </div>
        <div className="stack">{children}</div>
        {footer && <div className="btn-row" style={{ marginTop: 16 }}>{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications et confirmations
// ---------------------------------------------------------------------------

interface ToastItem { id: number; text: string; error?: boolean; action?: { label: string; run: () => void } }
interface ConfirmReq { title: string; body?: ReactNode; confirm?: string; danger?: boolean; resolve: (v: boolean) => void }

interface UiApi {
  toast: (text: string, opts?: { error?: boolean; action?: ToastItem['action'] }) => void;
  confirm: (title: string, opts?: { body?: ReactNode; confirm?: string; danger?: boolean }) => Promise<boolean>;
  /** Exécute une action et affiche l'erreur éventuelle de façon lisible. */
  run: <T>(fn: () => Promise<T>, success?: string) => Promise<T | undefined>;
}

const UiContext = createContext<UiApi | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [req, setReq] = useState<ConfirmReq | null>(null);
  const toast = useCallback<UiApi['toast']>((text, opts) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.action ? 6000 : 3200);
  }, []);
  const confirm = useCallback<UiApi['confirm']>((title, opts) => new Promise((resolve) => setReq({ title, ...opts, resolve })), []);
  const run = useCallback<UiApi['run']>(async (fn, success) => {
    try {
      const r = await fn();
      if (success) toast(success);
      return r;
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : 'Une erreur est survenue.', { error: true });
      return undefined;
    }
  }, [toast]);
  const close = (v: boolean) => {
    req?.resolve(v);
    setReq(null);
  };
  return (
    <UiContext.Provider value={{ toast, confirm, run }}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.error ? ' error' : ''}`}>
            <span>{t.text}</span>
            {t.action && <button onClick={() => { t.action!.run(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
      <Sheet open={!!req} onClose={() => close(false)} title={req?.title ?? ''}
        footer={<>
          <button className="btn grow" onClick={() => close(false)}>Annuler</button>
          <button className={`btn grow ${req?.danger ? 'danger' : 'primary'}`} onClick={() => close(true)} autoFocus>{req?.confirm ?? 'Confirmer'}</button>
        </>}>
        {req?.body && <div className="stack">{req.body}</div>}
      </Sheet>
    </UiContext.Provider>
  );
}

export function useUi(): UiApi {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('UiProvider manquant');
  return ctx;
}

// ---------------------------------------------------------------------------
// Éléments simples
// ---------------------------------------------------------------------------

export function PageHead({ title, sub, back, actions }: { title: string; sub?: ReactNode; back?: string | true; actions?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="page-head">
      <div className="grow">
        {back && (
          <button className="back" onClick={() => (back === true ? nav(-1) : nav(back))}>
            <ChevronLeft size={18} /> Retour
          </button>
        )}
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function Empty({ icon = '🫙', title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big" aria-hidden>{icon}</div>
      <p className="strong">{title}</p>
      {children && <div className="small" style={{ marginTop: 6 }}>{children}</div>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Rechercher…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="search">
      <Search aria-hidden />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

/** Champ numérique tolérant la virgule française. `null` = vide. */
export function NumberInput({ value, onChange, placeholder, ariaLabel, autoFocus }: { value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string; ariaLabel?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value).replace('.', ','));
  useEffect(() => {
    const parsed = parseNumber(text);
    if (parsed !== (value ?? null)) setText(value === null || value === undefined ? '' : String(value).replace('.', ','));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      // Toucher le champ sélectionne la valeur : la saisie la remplace au lieu de s'y ajouter (« 0 » → « 012 »).
      onFocus={(e) => {
        const el = e.currentTarget;
        requestAnimationFrame(() => el.select());
      }}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNumber(e.target.value));
      }}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      {label}
      {children}
      {hint && <span className="tiny muted" style={{ fontWeight: 500 }}>{hint}</span>}
    </label>
  );
}

export function Chips<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} className="chip" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`progress${value > max && max > 0 ? ' over' : ''}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}
