/* ============================================================
   Данные демо-каталога.
   Фото намеренно нет: у каждого товара пара цветов (c1/c2)
   и ключ иконки — из них собирается цветной плейсхолдер.
   ============================================================ */

const CATEGORIES = [
  { id: 'all',        name: 'Все' },
  { id: 'birthday',   name: 'День рождения' },
  { id: 'kids',       name: 'Детские' },
  { id: 'wedding',    name: 'Свадебные' },
  { id: 'mousse',     name: 'Муссовые' },
  { id: 'cheesecake', name: 'Чизкейки' },
  { id: 'bento',      name: 'Бенто-торты' },
  { id: 'cupcakes',   name: 'Капкейки' }
];

/* иконки плейсхолдеров */
const ICONS = {
  cake: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 54h44V38c0-4.4-3.6-8-8-8H18c-4.4 0-8 3.6-8 8v16Z"/><path d="M10 43c3.8 3.4 7.6 3.4 11.4 0 3.8 3.4 7.6 3.4 11.3 0 3.8 3.4 7.6 3.4 11.4 0 3.2 2.8 6.4 3.3 9.9 1.6"/><path d="M20 30v-6M32 30v-8M44 30v-6"/><circle cx="20" cy="20" r="2.4" fill="currentColor" stroke="none"/><circle cx="32" cy="18" r="2.4" fill="currentColor" stroke="none"/><circle cx="44" cy="20" r="2.4" fill="currentColor" stroke="none"/></svg>',
  tiered: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 56h40V44H12v12ZM17 44V34h30v10M22 34V24h20v10"/><path d="M12 50c3.3 2.6 6.7 2.6 10 0 3.3 2.6 6.7 2.6 10 0 3.3 2.6 6.7 2.6 10 0 2.6 2 5.2 2.5 7.8.8"/><path d="M32 24v-6"/><circle cx="32" cy="14" r="3" fill="currentColor" stroke="none"/><path d="M22 40h20M19 50h26"/></svg>',
  cupcake: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 34h28l-4 22H22l-4-22Z"/><path d="M16 34c0-5.5 4.2-10 9.4-10 .6-4.6 4.4-8 8.9-8 5 0 9.1 4 9.1 9 3.6.5 6.6 3.6 6.6 7.4 0 .5 0 1-.1 1.6"/><path d="M26 40l1.6 10M38 40l-1.6 10M32 40v10"/></svg>',
  cheesecake: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 24h44l-4 28H14l-4-28Z"/><path d="M10 24c0-4 9.8-7 22-7s22 3 22 7"/><path d="M12 38h40"/><circle cx="24" cy="30" r="2" fill="currentColor" stroke="none"/><circle cx="38" cy="31" r="2" fill="currentColor" stroke="none"/><path d="M20 46h24"/></svg>',
  bento: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="26" width="36" height="26" rx="5"/><path d="M14 34h36"/><path d="M22 20c0 3.3 4.5 6 10 6s10-2.7 10-6"/><path d="M26 42h12"/><circle cx="32" cy="16" r="2.6" fill="currentColor" stroke="none"/></svg>',
  slice: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 50l20-34 20 34H12Z"/><path d="M19 38h26M24 30h16"/><circle cx="32" cy="20" r="2.4" fill="currentColor" stroke="none"/></svg>'
};

const PRODUCTS = [
  {
    id: 'velvet', name: 'Красный бархат', cat: 'birthday', icon: 'cake',
    c1: '#f3b8c6', c2: '#d98098',
    weight: 2.5, perKg: 2600, minWeight: 1.5, hit: true,
    desc: 'Классика с ярким срезом и контрастным светлым кремом — подходит почти под любой праздник.',
    flavors: ['шоколад', 'ягоды', 'сливки'],
    decor: 'Подтёки, акцент сверху',
    tiers: 1
  },
  {
    id: 'choco-caramel', name: 'Шоколад и карамель', cat: 'birthday', icon: 'cake',
    c1: '#d8b48c', c2: '#a8764a',
    weight: 3, perKg: 2800, minWeight: 2,
    desc: 'Насыщенный, плотный десерт для тех, кто любит торты погуще.',
    flavors: ['шоколад'],
    decor: 'Подтёки',
    tiers: 1
  },
  {
    id: 'pistachio', name: 'Фисташка и малина', cat: 'birthday', icon: 'slice',
    c1: '#d7e4a8', c2: '#9fba6a', hit: true,
    weight: 2.5, perKg: 3200, minWeight: 1.5,
    desc: 'Сдержанный, не приторный вкус с лёгкой кислинкой.',
    flavors: ['ягоды', 'не сладко'],
    decor: 'Велюровое покрытие',
    tiers: 1
  },
  {
    id: 'dino', name: 'Динозавры', cat: 'kids', icon: 'cake',
    c1: '#b6e3cd', c2: '#6ab795',
    weight: 2, perKg: 2900, minWeight: 1.5,
    desc: 'Торт с фигурками динозавров для детского праздника.',
    flavors: ['сливки', 'ягоды'],
    decor: 'Фигурки, «травяной» декор',
    tiers: 1
  },
  {
    id: 'rainbow', name: 'Радуга', cat: 'kids', icon: 'slice',
    c1: '#f8d59a', c2: '#e49fc3',
    weight: 2.5, perKg: 2700, minWeight: 1.5,
    desc: 'Разноцветные слои на срезе — эффектно в момент подачи.',
    flavors: ['сливки', 'ягоды'],
    decor: 'Радужные подтёки',
    tiers: 1
  },
  {
    id: 'bunny', name: 'Зайчик на облаке', cat: 'kids', icon: 'bento',
    c1: '#e2d6f5', c2: '#b39ee0',
    weight: 1.5, perKg: 3000, minWeight: 1.2,
    desc: 'Небольшой торт для самых маленьких именинников.',
    flavors: ['сливки', 'фрукты', 'не сладко'],
    decor: 'Фигурка зайца, облака',
    tiers: 1
  },
  {
    id: 'ivory', name: 'Ivory, два яруса', cat: 'wedding', icon: 'tiered',
    c1: '#f6ead6', c2: '#dcc39a', hit: true,
    weight: 6, perKg: 3400, minWeight: 4,
    desc: 'Двухъярусный торт в спокойной светлой палитре, с ровными боками.',
    flavors: ['сливки', 'ягоды'],
    decor: 'Текстурное покрытие, цветочный декор',
    tiers: 2
  },
  {
    id: 'marble', name: 'Мраморный с золотом', cat: 'wedding', icon: 'tiered',
    c1: '#e8e5df', c2: '#b9b2a6',
    weight: 8, perKg: 3600, minWeight: 5,
    desc: 'Трёхъярусный торт с мраморным узором — для больших залов.',
    flavors: ['шоколад', 'сливки'],
    decor: 'Мраморный узор, золотые акценты',
    tiers: 3
  },
  {
    id: 'naked', name: 'Naked cake с ягодами', cat: 'wedding', icon: 'cake',
    c1: '#f4c9b0', c2: '#d79475',
    weight: 4, perKg: 3100, minWeight: 3,
    desc: 'Открытые бока и видимые слои — лёгкий стиль для выездной церемонии.',
    flavors: ['ягоды', 'сливки', 'не сладко'],
    decor: 'Минимум покрытия',
    tiers: 2
  },
  {
    id: 'mango', name: 'Манго-маракуйя', cat: 'mousse', icon: 'slice',
    c1: '#fbd79a', c2: '#ef9f55', hit: true,
    weight: 1.8, perKg: 3500, minWeight: 1.2,
    desc: 'Муссовый торт с ярким кисло-сладким вкусом.',
    flavors: ['фрукты', 'не сладко'],
    decor: 'Глянцевое покрытие',
    tiers: 1
  },
  {
    id: 'blackcurrant', name: 'Чёрная смородина', cat: 'mousse', icon: 'slice',
    c1: '#cbb6e8', c2: '#8767b8',
    weight: 1.8, perKg: 3500, minWeight: 1.2,
    desc: 'Муссовый торт с насыщенным ягодным вкусом.',
    flavors: ['ягоды', 'шоколад'],
    decor: 'Велюр, зеркальная капля',
    tiers: 1
  },
  {
    id: 'ny-classic', name: 'Чизкейк Нью-Йорк', cat: 'cheesecake', icon: 'cheesecake',
    c1: '#f7e6c2', c2: '#d9b67e',
    weight: 1.6, perKg: 2900, minWeight: 1.2,
    desc: 'Плотный сливочный чизкейк в классическом стиле.',
    flavors: ['сливки', 'ягоды'],
    decor: 'Классическая подача',
    tiers: 1
  },
  {
    id: 'basque', name: 'Басконский чизкейк', cat: 'cheesecake', icon: 'cheesecake',
    c1: '#e3bd93', c2: '#b87f4e',
    weight: 1.4, perKg: 3000, minWeight: 1,
    desc: 'Чизкейк с тёмной карамелизованной корочкой и мягким центром.',
    flavors: ['сливки', 'не сладко'],
    decor: 'Без декора',
    tiers: 1
  },
  {
    id: 'bento-love', name: 'Бенто «записка»', cat: 'bento', icon: 'bento',
    c1: '#f6c2d4', c2: '#e38aa8',
    weight: 0.5, perKg: 3600, minWeight: 0.4,
    desc: 'Маленький торт на 1–2 человека с надписью от руки.',
    flavors: ['сливки', 'шоколад'],
    decor: 'Надпись, коробка-бенто',
    tiers: 1
  },
  {
    id: 'bento-mono', name: 'Бенто моно-цвет', cat: 'bento', icon: 'bento',
    c1: '#cfe0f2', c2: '#8fb2d8',
    weight: 0.5, perKg: 3400, minWeight: 0.4,
    desc: 'Однотонный бенто-торт в выбранном оттенке.',
    flavors: ['ягоды', 'сливки'],
    decor: 'Гладкое покрытие, один цвет',
    tiers: 1
  },
  {
    id: 'cupcakes-set', name: 'Набор капкейков, 9 шт', cat: 'cupcakes', icon: 'cupcake',
    c1: '#f9ccd8', c2: '#dd9ab4',
    weight: 0.9, perKg: 3800, minWeight: 0.9,
    desc: 'Девять капкейков трёх вкусов в коробке — альтернатива торту.',
    flavors: ['шоколад', 'сливки', 'фрукты'],
    decor: 'Шапочки, топперы',
    tiers: 1
  },
  {
    id: 'cupcakes-kids', name: 'Капкейки детские, 12 шт', cat: 'cupcakes', icon: 'cupcake',
    c1: '#d4ecc0', c2: '#9ccb77',
    weight: 1.2, perKg: 3500, minWeight: 1.2,
    desc: 'Яркие капкейки с топперами для детского праздника.',
    flavors: ['сливки', 'фрукты'],
    decor: 'Цветная посыпка, топперы',
    tiers: 1
  }
];
