export type Op = '+' | '-' | '×' | '÷';

/** Which operations the child practices: adding and taking away, or all four. */
export type Mode = 'plus' | 'all';

/** The levels Adventure (and so the leaderboard) knows: 1–6 in the "plus" mode, 11–14 in "all four". */
export type AdventureLevelId = 1 | 2 | 3 | 4 | 5 | 6 | 11 | 12 | 13 | 14;

/** 21–22 are the youngest's levels, first in the "plus" mode (before 1). They have no Adventure. */
export type LevelId = AdventureLevelId | 21 | 22;

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
  /** How hard the sum is, 1–6. Adventure pays tier + 1 carrots for a right answer. */
  tier?: number;
  /** A Tricky-path "hard pick", worth half a tier more. */
  hard?: boolean;
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
