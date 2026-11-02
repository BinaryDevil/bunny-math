export type Op = '+' | '-';

export type LevelId = 1 | 2 | 3 | 4;

/** What a question practices. Used for the "how you did" summary. */
export type Skill = 'add20' | 'sub20' | 'add' | 'sub' | 'carry' | 'borrow';

/** The underlying sum, e.g. 38 + 7 = 45. */
export type Fact = { a: number; op: Op; b: number; c: number };

export type Story = { emoji: string; text: string };

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
