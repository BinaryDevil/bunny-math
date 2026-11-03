import type { Question, Story } from './types';

export type Language = 'en' | 'zh-CN';
export const normalizeLanguage = (value: unknown): Language => value === 'zh-CN' ? 'zh-CN' : 'en';

const zh: Record<string, string> = {
  'What shall we practice?': '今天练习什么？', 'What to practice': '选择练习内容',
  'Add & take away': '加法和减法', 'Adding and taking away, up to 3 digits': '练习三位数以内的加减法',
  'All four': '四则运算', 'Times tables and dividing too': '还有乘法和除法',
  'Warm-up': '热身练习', 'Big + small': '两位数与一位数', 'Tricky ones': '进退位练习', 'Double digits': '两位数', 'Hundreds': '三位数', 'Super sums': '挑战练习',
  'First tables': '乘法入门', 'More tables': '更多乘法', 'All tables': '乘法口诀', 'Big times': '乘除挑战',
  'Within 20': '20 以内', 'No carrying': '不进退位', 'Carry and borrow': '进位和退位', 'Two-digit numbers': '两位数运算', 'Three-digit numbers': '三位数运算', 'Lots of carrying': '多次进退位',
  'Tables of 2, 5 and 10': '2、5 和 10 的乘法', 'Tables up to 5': '5 以内的乘法', 'Tables up to 10': '10 以内的乘法', 'Two-digit times and divide': '两位数乘除法',
  'Turn sound off': '关闭声音', 'Turn sound on': '打开声音', 'Practicing: {mode}. Change': '当前练习：{mode}。点击更改', 'Print a worksheet': '打印练习纸', 'Sticker book': '贴纸册',
  "Pick a level and let's hop to it!": '选个关卡，一起开始吧！', 'Level': '关卡', 'Best: {n} stars': '最佳成绩：{n} 颗星', 'Questions': '题数', 'Start!': '开始！',
  'You can do it!': '你一定可以！', 'Take your time!': '慢慢来！', "Let's hop to it!": '一起加油！', 'Think hard!': '仔细想想！', 'I believe in you!': '我相信你！',
  'Yes!': '答对啦！', 'Great job!': '做得好！', 'You got it!': '你答对啦！', 'Super!': '太棒了！', 'Hoppy-tastic!': '蹦蹦跳跳真棒！', 'Hmm…': '嗯……',
  'Find the missing number!': '找出缺少的数字！', 'Pick the answer!': '选出答案！', 'Bigger, smaller, or the same?': '大于、小于还是等于？',
  'Add them up!': '把它们加起来！', 'Take away!': '做减法！', 'Times!': '做乘法！', 'Share it out!': '平均分一分！',
  'Stop quiz': '结束练习', 'Question {n} of {total}': '第 {n} 题，共 {total} 题', 'Again!': '再试一次！', 'One more try!': '再做一次！',
  '💡 Show me how': '💡 看看怎么做', 'Delete': '删除', 'Clear': '清空', 'Check': '检查', 'smaller than': '小于', 'the same as': '等于', 'bigger than': '大于', 'smaller': '小于', 'same': '等于', 'bigger': '大于',
  'See my stars!': '看看我的星星！', 'Next': '下一题', 'So close!': '差一点点！', 'Have one more go.': '再试一次吧。', 'Try again': '再试一次', 'The answer is {answer}': '答案是 {answer}',
  "Let's look at how it works.": '一起看看怎么做吧。', "We'll try it again at the end.": '最后我们会再练习一次。', 'Stop the quiz?': '结束练习吗？', "Your answers so far won't be saved.": '目前的答题记录不会保存。', 'Stop': '结束', 'Keep going': '继续练习',
  '🧱 Blocks': '🧱 积木', '✏️ Columns': '✏️ 竖式', 'How to solve {question}': '如何计算 {question}', 'Show it with': '选择讲解方式', 'Close': '关闭', 'Step {n} of {total}': '第 {n} 步，共 {total} 步', '◀ Back': '◀ 返回', 'Got it!': '明白了！', 'Next ▶': '下一步 ▶',
  'Amazing!': '太厉害了！', 'Good try!': '继续加油！', 'Home': '返回首页', '{n} of 3 stars': '3 颗星中获得 {n} 颗', '{right} out of {total}': '答对 {right} / {total} 题', 'Your answers': '答题情况', 'Tap one to see how': '点击查看讲解', 'right': '正确', 'needs practice': '需要练习', 'Question {n}: {status}': '第 {n} 题：{status}',
  'Adding to 20': '20 以内的加法', 'Taking away to 20': '20 以内的减法', 'Adding': '加法', 'Taking away': '减法', 'Carrying a ten': '进位', 'Breaking a ten': '退位', 'Times': '乘法', 'Dividing': '除法',
  '⭐ Super!': '⭐ 真棒！', '🌱 Practice more': '🌱 再练一练', 'New sticker!': '获得新贴纸！', "It's in your sticker book now.": '它已经放进贴纸册了。', 'Try the next level ▶': '挑战下一关 ▶', 'Play again': '再玩一次',
  'Back': '返回', 'My sticker book': '我的贴纸册', '{owned} of {total} stickers · finish a quiz to get one': '已收集 {owned} / {total} 张贴纸 · 完成练习即可获得', 'sticker': '贴纸', 'not found yet': '尚未获得',
  'Pages': '页数', '🔄 New questions': '🔄 换一批题目', '🖨️ Print': '🖨️ 打印', 'Page {n} of {total}': '第 {n} 页，共 {total} 页', 'Name: ____________________': '姓名：____________________', 'Date: ____________': '日期：____________', 'Answers': '参考答案', 'Page {n}': '第 {n} 页',
};

export function translate(language: Language, key: string, values: Record<string, string | number> = {}): string {
  return (language === 'zh-CN' ? zh[key] ?? key : key).replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}

export function localizeStory(q: Extract<Question, { kind: 'story' }>, language: Language): Story {
  if (language === 'en') return q.story;
  const { a, b, op } = q.fact;
  const stories: Record<string, [string, string]> = {
    '+🐠': [`鱼缸里有 ${a} 条鱼，又游来了 ${b} 条。`, '现在有多少条鱼？'],
    '+🌸': [`花园里有 ${a} 朵花，又长出了 ${b} 朵。`, '现在有多少朵花？'],
    '+🍪': [`罐子里有 ${a} 块饼干，你又烤了 ${b} 块。`, '现在有多少块饼干？'],
    '+⭐': [`你有 ${a} 张贴纸，又得到了 ${b} 张。`, '现在有多少张贴纸？'],
    '+🐞': [`叶子上有 ${a} 只瓢虫，又飞来了 ${b} 只。`, '现在有多少只瓢虫？'],
    '-🍓': [`碗里有 ${a} 颗草莓，你吃了 ${b} 颗。`, '还剩多少颗？'],
    '-🎈': [`派对上有 ${a} 个气球，${b} 个破了。`, '还剩多少个？'],
    '-🐦': [`树上有 ${a} 只鸟，飞走了 ${b} 只。`, '还剩多少只？'],
    '-🧁': [`盘子里有 ${a} 个纸杯蛋糕，朋友们吃了 ${b} 个。`, '还剩多少个？'],
    '-🦋': [`花园里有 ${a} 只蝴蝶，飞走了 ${b} 只。`, '还剩多少只？'],
    '×🍪': [`有 ${a} 个盘子，每个盘子里有 ${b} 块饼干。`, '一共有多少块饼干？'],
    '×🌷': [`有 ${a} 个花盆，每个花盆里有 ${b} 朵花。`, '一共有多少朵花？'],
    '×🐰': [`有 ${a} 只小兔，每只吃了 ${b} 根胡萝卜。`, '一共吃了多少根胡萝卜？'],
    '×🎁': [`有 ${a} 个袋子，每袋有 ${b} 颗糖。`, '一共有多少颗糖？'],
    '÷🍓': [`${a} 颗草莓平均分给 ${b} 个朋友。`, '每人分到多少颗？'],
    '÷🧁': [`${a} 个纸杯蛋糕，每 ${b} 个装一盒。`, '需要多少个盒子？'],
    '÷🐟': [`${a} 条鱼，每个鱼缸放 ${b} 条。`, '需要多少个鱼缸？'],
    '÷🌸': [`${a} 朵花平均分成 ${b} 束。`, '每束有多少朵？'],
  };
  const [text, ask] = stories[op + q.story.emoji] ?? [q.story.text, q.story.ask];
  return { emoji: q.story.emoji, text, ask };
}
