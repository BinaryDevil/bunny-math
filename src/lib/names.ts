/**
 * Leaderboard names are picked from these lists, never typed, so every name is kid-safe
 * and no child types their real name onto a public list.
 * Shared with the leaderboard server (worker/), which only accepts words from here.
 * A name is unique by its two words: there is only ever one "Bouncy Otter".
 * Only add words to the end of a list; never remove or reorder, since saved names point at them by word.
 */
export const NAME_EMOJI = [
  '🐰', '🦦', '🦄', '🐸', '🐢', '🐝', '🦊', '🐼', '🐧', '🍓', '🌙', '🌈',
  '🐨', '🦁', '🐯', '🐙', '🦋', '🐳', '🐞', '🌻', '🍉', '🍩', '🚀', '⭐',
] as const;

export const NAME_ADJECTIVES = [
  'Bouncy', 'Zippy', 'Sleepy', 'Giggly', 'Sparkly', 'Brave', 'Wobbly', 'Fluffy',
  'Speedy', 'Sunny', 'Cosmic', 'Jolly', 'Happy', 'Lucky', 'Mighty', 'Snuggly',
  'Dizzy', 'Fizzy', 'Breezy', 'Cheery', 'Clever', 'Curly', 'Dancing', 'Dreamy',
  'Fancy', 'Frosty', 'Glowing', 'Golden', 'Hoppy', 'Jumpy', 'Merry', 'Misty',
  'Peppy', 'Perky', 'Plucky', 'Puffy', 'Quirky', 'Rosy', 'Silly', 'Snappy',
  'Spotty', 'Starry', 'Swirly', 'Tiny', 'Twinkly', 'Wiggly', 'Witty', 'Zesty',
  'Bubbly', 'Busy', 'Calm', 'Chirpy', 'Cozy', 'Crunchy', 'Cuddly', 'Daring',
  'Dapper', 'Dotty', 'Eager', 'Fearless', 'Flappy', 'Friendly', 'Bright', 'Gentle',
  'Gleaming', 'Glittery', 'Grinning', 'Humming', 'Jazzy', 'Kind', 'Lively', 'Magical',
  'Mellow', 'Minty', 'Nifty', 'Noble', 'Peachy', 'Purple', 'Royal', 'Sandy',
  'Shiny', 'Skippy', 'Smiley', 'Snowy', 'Spiffy', 'Stripy', 'Super', 'Swift',
  'Tidy', 'Toasty', 'Twirly', 'Velvet', 'Wavy', 'Whizzy', 'Wise', 'Zany',
  'Zooming', 'Chilly', 'Fuzzy', 'Rainbow',
] as const;

export const NAME_NOUNS = [
  'Otter', 'Pancake', 'Turnip', 'Waffle', 'Noodle', 'Muffin', 'Pickle', 'Rocket',
  'Dumpling', 'Comet', 'Pebble', 'Carrot', 'Acorn', 'Bagel', 'Biscuit', 'Blueberry',
  'Bubble', 'Button', 'Cactus', 'Cloud', 'Cookie', 'Cupcake', 'Daisy', 'Donut',
  'Dragon', 'Feather', 'Gecko', 'Jellybean', 'Kiwi', 'Koala', 'Lemon', 'Llama',
  'Mango', 'Marshmallow', 'Meadow', 'Moonbeam', 'Nugget', 'Panda', 'Peanut', 'Penguin',
  'Pretzel', 'Puffin', 'Pumpkin', 'Raindrop', 'Sprout', 'Star', 'Tulip', 'Walrus',
  'Badger', 'Beetle', 'Bluebird', 'Butterfly', 'Cherry', 'Chipmunk', 'Clover', 'Coconut',
  'Crayon', 'Cricket', 'Crumpet', 'Dolphin', 'Duckling', 'Firefly', 'Flamingo', 'Gumdrop',
  'Hamster', 'Hedgehog', 'Honeybee', 'Kitten', 'Ladybug', 'Lantern', 'Lollipop', 'Marble',
  'Meerkat', 'Mitten', 'Moose', 'Narwhal', 'Octopus', 'Owl', 'Parrot', 'Peach',
  'Pinecone', 'Popcorn', 'Puddle', 'Puppy', 'Raccoon', 'Robin', 'Seashell', 'Snowflake',
  'Sparrow', 'Squirrel', 'Starfish', 'Sunflower', 'Teapot', 'Toffee', 'Turtle', 'Unicorn',
  'Wombat', 'Zebra', 'Hippo', 'Pudding',
] as const;

export type PlayerName = { emoji: string; adj: string; noun: string };

export const nameText = (n: PlayerName) => `${n.emoji} ${n.adj} ${n.noun}`;

export function isValidName(n: Partial<PlayerName> | null | undefined): n is PlayerName {
  return (
    !!n &&
    (NAME_EMOJI as readonly string[]).includes(n.emoji ?? '') &&
    (NAME_ADJECTIVES as readonly string[]).includes(n.adj ?? '') &&
    (NAME_NOUNS as readonly string[]).includes(n.noun ?? '')
  );
}

/** A random name. `random` returns a number in [0, 1), like Math.random. */
export function randomName(random: () => number = Math.random): PlayerName {
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  return { emoji: pick(NAME_EMOJI), adj: pick(NAME_ADJECTIVES), noun: pick(NAME_NOUNS) };
}
