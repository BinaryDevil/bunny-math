export type Op = '+' | '-' | '×' | '÷';

/** Which operations the child practices: adding and taking away, or all four. */
export type Mode = 'plus' | 'all';

/** Levels 1–6 are in the "plus" mode, 11–14 in the "all four" mode. */
export type LevelId = 1 | 2 | 3 | 4 | 5 | 6 | 11 | 12 | 13 | 14;

/** What a question practices. Used for the "how you did" summary. */
export type Skill = 'add20' | 'sub20' | 'add' | 'sub' | 'carry' | 'borrow' | 'times' | 'divide';

/** The underlying sum, e.g. 38 + 7 = 45. */
export type Fact = { a: number; op: Op; b: number; c: number };

/** Which picture story a question tells. The words live in the translations: `story.<id>.text` and `story.<id>.ask`. */
export type StoryId =
  | 'fish' | 'flowers' | 'cookies' | 'stickers' | 'ladybugs'
  | 'strawberries' | 'balloons' | 'birds' | 'cupcakes' | 'butterflies'
  | 'plates' | 'pots' | 'bunnies' | 'bags'
  | 'share' | 'boxes' | 'tanks' | 'bunches';

export type Story = { emoji: string; id: StoryId };

export type Question = {
  id: string;
  fact: Fact;
  skill: Skill;
} & (
  | { kind: 'type' }
  | { kind: 'story'; story: Story }
  | { kind: 'choice'; choices: number[] }
  /** One number in the sum is hidden. 'a' and 'b' are the two inputs, the answer is that number. */
  | { kind: 'missing'; hide: 'a' | 'b' }
  /** Compare the sum to `than`. */
  | { kind: 'compare'; than: number }
);

export type Kind = Question['kind'];
export type CompareSign = '<' | '=' | '>';

/** The answer the child gives: a number, or a sign for compare questions. */
export type Answer = number | CompareSign;
