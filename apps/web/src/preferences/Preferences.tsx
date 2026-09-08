import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { translate, type Language } from './translations';

type Theme = 'dark' | 'light';
interface Preferences {
  language: Language;
  theme: Theme;
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
  t: (message: string) => string;
}
const PreferencesContext = createContext<Preferences>({
  language: 'en',
  theme: 'dark',
  setLanguage: () => {},
  setTheme: () => {},
  t: (message) => message,
});
function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Preferences still work when storage is disabled. */
  }
}
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() =>
    read('peerbeam.language') === 'es' ? 'es' : 'en',
  );
  const [theme, setTheme] = useState<Theme>(() =>
    read('peerbeam.theme') === 'light' ? 'light' : 'dark',
  );
  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === 'es'
        ? 'PeerBeam — Transferencia directa de archivos'
        : 'PeerBeam — Direct file transfer';
    save('peerbeam.language', language);
  }, [language]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#f5f5fa' : '#09090b');
    save('peerbeam.theme', theme);
  }, [theme]);
  return (
    <PreferencesContext.Provider
      value={{
        language,
        theme,
        setLanguage,
        setTheme,
        t: (message) => translate(language, message),
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
export function usePreferences() {
  return useContext(PreferencesContext);
}
export function PreferenceControls() {
  const { language, theme, setLanguage, setTheme, t } = usePreferences();
  return (
    <div className="preference-controls">
      <select
        aria-label={t('Language')}
        value={language}
        onChange={(event) =>
          setLanguage(event.target.value === 'es' ? 'es' : 'en')
        }
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="es" lang="es">
          Español
        </option>
      </select>
      <button
        className="theme-toggle"
        aria-label={t(
          theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        )}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>{' '}
        {t(theme === 'dark' ? 'Day' : 'Night')}
      </button>
    </div>
  );
}
