// Renders ExplainSheet for a given sum, so e2e/blocks.mjs can walk every step of any question.
//   window.show({ a: 15, op: '+', b: 27 }, 'zh-CN')
import { render } from 'preact';
import '@fontsource/baloo-2/latin-500.css';
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/mochiy-pop-one/latin-400.css';
import '../../src/styles.css';
import { ExplainPref, ExplainSheet } from '../../src/components/Explain';
import { activate, LangContext, type Lang } from '../../src/i18n';
import type { Fact, Question } from '../../src/lib/types';

const calc = { '+': (a: number, b: number) => a + b, '-': (a: number, b: number) => a - b, '×': (a: number, b: number) => a * b, '÷': (a: number, b: number) => a / b };
let n = 0;

function show({ a, op, b, kind = 'type', hide }: { a: number; op: Fact['op']; b: number; kind?: 'type' | 'missing'; hide?: 'a' | 'b' }, lang: Lang = 'en') {
  activate(lang);
  document.documentElement.lang = lang;
  const fact: Fact = { a, op, b, c: calc[op](a, b) };
  const q = { id: `q${++n}`, fact, skill: 'add', kind, ...(hide ? { hide } : {}) } as Question;
  const app = document.getElementById('app')!;
  render(null, app);
  render(
    <LangContext.Provider value={lang}>
      <ExplainPref.Provider value={{ style: 'blocks', setStyle: () => {} }}>
        <ExplainSheet key={q.id} question={q} onClose={() => {}} />
      </ExplainPref.Provider>
    </LangContext.Provider>,
    app,
  );
}
(window as unknown as { show: typeof show }).show = show;
