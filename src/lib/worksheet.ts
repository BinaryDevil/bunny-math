import { compareSign, correctAnswer, generateQuiz } from './generator';
import type { Answer, Kind, LevelId, Question } from './types';

/** Printed sheets mix plain sums (twice as often), missing numbers, compare and picture stories. */
const KINDS: Kind[] = ['type', 'type', 'missing', 'compare', 'story'];

/** Story questions take two lines, so keep at most 2 per sheet so 20 questions still fit on one page. */
const MAX_STORIES = 2;
function fitOnePage(questions: Question[]): Question[] {
  let stories = 0;
  return questions.map((q) => (q.kind === 'story' && ++stories > MAX_STORIES ? { id: q.id, fact: q.fact, skill: q.skill, kind: 'type' } : q));
}

/** The questions for each printed page. One big batch, so no sum repeats across pages. */
export function makeSheets(level: LevelId, perPage: number, pageCount: number, seed: number): Question[][] {
  const all = generateQuiz({ level, count: perPage * pageCount, seed, kinds: KINDS });
  return Array.from({ length: pageCount }, (_, p) => fitOnePage(all.slice(p * perPage, (p + 1) * perPage)));
}

/** What goes in the answer key: the number, or the sign for a compare question. */
export const keyAnswer = (q: Question): Answer => (q.kind === 'compare' ? compareSign(q.fact.c, q.than) : correctAnswer(q));
