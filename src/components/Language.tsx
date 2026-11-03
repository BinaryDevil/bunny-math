import { createContext, type ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import { translate, type Language } from '../lib/i18n';

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void }>({ language: 'en', setLanguage: () => {} });
export function LanguageProvider({ language, setLanguage, children }: { language: Language; setLanguage: (language: Language) => void; children: ComponentChildren }) {
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const { language, setLanguage } = useContext(LanguageContext);
  return { language, setLanguage, t: (key: string, values?: Record<string, string | number>) => translate(language, key, values) };
}
export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return <select class="language-switch" aria-label={language === 'en' ? 'Language' : '语言'} value={language} onChange={(event) => setLanguage((event.currentTarget as HTMLSelectElement).value as Language)}>
    <option value="en">English</option><option value="zh-CN">简体中文</option>
  </select>;
}
