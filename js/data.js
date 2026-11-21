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
    desc: 'Три влажных бисквита с какао и мягкий крем-чиз на сливках — классика, которая нравится всем.',
    comp: ['Бисквит красный бархат', 'Крем-чиз на сливках', 'Вишнёвое компоте', 'Белый шоколад'],
    decor: 'Крем-подтёки, ягоды, золотая крошка',
    lead: '48 часов', keeps: '48 часов', tiers: 1
  },
  {
    id: 'snickers', name: 'Сникерс', cat: 'birthday', icon: 'cake',
    c1: '#d8b48c', c2: '#a8764a',
    weight: 3, perKg: 2800, minWeight: 2,
    desc: 'Шоколадный бисквит, солёная карамель, жареный арахис и шоколадный ганаш.',
    comp: ['Шоколадный бисквит', 'Солёная карамель', 'Арахис', 'Ганаш 54%'],
    decor: 'Карамельные подтёки, орехи',
    lead: '48 часов', keeps: '48 часов', tiers: 1
  },
  {
    id: 'pistachio', name: 'Фисташка и малина', cat: 'birthday', icon: 'slice',
    c1: '#d7e4a8', c2: '#9fba6a', hit: true,
    weight: 2.5, perKg: 3200, minWeight: 1.5,
    desc: 'Фисташковый бисквит с малиновым кремю — сдержанно-ореховый вкус с кислинкой.',
    comp: ['Фисташковый бисквит', 'Крем на белом шоколаде', 'Малиновое кремю', 'Фисташковая паста'],
    decor: 'Велюр, свежая малина, фисташка',
    lead: '72 часа', keeps: '48 часов', tiers: 1
  },
  {
    id: 'dino', name: 'Динозавры', cat: 'kids', icon: 'cake',
    c1: '#b6e3cd', c2: '#6ab795',
    weight: 2, perKg: 2900, minWeight: 1.5,
    desc: 'Ванильный бисквит и нежный крем, сверху — фигурки из шоколадной мастики.',
    comp: ['Ванильный бисквит', 'Крем-чиз', 'Клубничный конфитюр'],
    decor: 'Фигурки из мастики, зелёный травяной декор',
    lead: '72 часа', keeps: '48 часов', tiers: 1
  },
  {
    id: 'rainbow', name: 'Радуга', cat: 'kids', icon: 'slice',
    c1: '#f8d59a', c2: '#e49fc3',
    weight: 2.5, perKg: 2700, minWeight: 1.5,
    desc: 'Цветные бисквитные слои на натуральных красителях — разрез удивляет при подаче.',
    comp: ['Цветные бисквиты', 'Ванильный крем-чиз', 'Белый шоколад'],
    decor: 'Радужные подтёки, сахарное посыпание',
    lead: '72 часа', keeps: '48 часов', tiers: 1
  },
  {
    id: 'bunny', name: 'Зайчик на облаке', cat: 'kids', icon: 'bento',
    c1: '#e2d6f5', c2: '#b39ee0',
    weight: 1.5, perKg: 3000, minWeight: 1.2,
    desc: 'Небольшой торт для первого дня рождения: мягкий бисквит и минимум сахара.',
    comp: ['Бисквит на йогурте', 'Крем-чиз', 'Банановое пюре'],
    decor: 'Фигурка зайца, облака из крема',
    lead: '72 часа', keeps: '36 часов', tiers: 1
  },
  {
    id: 'ivory', name: 'Ivory, два яруса', cat: 'wedding', icon: 'tiered',
    c1: '#f6ead6', c2: '#dcc39a', hit: true,
    weight: 6, perKg: 3400, minWeight: 4,
    desc: 'Двухъярусный торт в кремовой текстуре — ровные бока, живые цветы, спокойная палитра.',
    comp: ['Ванильный бисквит', 'Крем-чиз на сливках', 'Клубника и базилик', 'Белый шоколад'],
    decor: 'Живые цветы, текстурный крем',
    lead: '7 дней', keeps: '48 часов', tiers: 2
  },
  {
    id: 'marble', name: 'Мраморный с золотом', cat: 'wedding', icon: 'tiered',
    c1: '#e8e5df', c2: '#b9b2a6',
    weight: 8, perKg: 3600, minWeight: 5,
    desc: 'Трёхъярусный торт с мраморной глазурью и золотым поталем — для больших залов.',
    comp: ['Шоколадный и ванильный бисквит', 'Крем-чиз', 'Карамель', 'Ганаш'],
    decor: 'Мраморная глазурь, золотой поталь',
    lead: '10 дней', keeps: '48 часов', tiers: 3
  },
  {
    id: 'naked', name: 'Naked cake с ягодами', cat: 'wedding', icon: 'cake',
    c1: '#f4c9b0', c2: '#d79475',
    weight: 4, perKg: 3100, minWeight: 3,
    desc: 'Открытые бока, видимые слои и много свежих ягод — лёгкий вариант для выездной церемонии.',
    comp: ['Ванильный бисквит', 'Сливочный крем', 'Ягодное компоте'],
    decor: 'Свежие ягоды, зелень, минимум крема',
    lead: '5 дней', keeps: '36 часов', tiers: 2
  },
  {
    id: 'mango', name: 'Манго-маракуйя', cat: 'mousse', icon: 'slice',
    c1: '#fbd79a', c2: '#ef9f55', hit: true,
    weight: 1.8, perKg: 3500, minWeight: 1.2,
    desc: 'Муссовый торт с тропическим желе и миндальным дакуазом. Яркий кисло-сладкий вкус.',
    comp: ['Дакуаз миндальный', 'Мусс на белом шоколаде', 'Желе манго-маракуйя', 'Велюр'],
    decor: 'Жёлтый велюр, шоколадный декор',
    lead: '72 часа', keeps: '24 часа', tiers: 1
  },
  {
    id: 'blackcurrant', name: 'Чёрная смородина', cat: 'mousse', icon: 'slice',
    c1: '#cbb6e8', c2: '#8767b8',
    weight: 1.8, perKg: 3500, minWeight: 1.2,
    desc: 'Мусс на сливках с ярким смородиновым центром и хрустящим слоем из белого шоколада.',
    comp: ['Шоколадный бисквит', 'Мусс на сливках', 'Кремю из смородины', 'Хрустящий слой'],
    decor: 'Фиолетовый велюр, зеркальная капля',
    lead: '72 часа', keeps: '24 часа', tiers: 1
  },
  {
    id: 'ny-classic', name: 'Чизкейк Нью-Йорк', cat: 'cheesecake', icon: 'cheesecake',
    c1: '#f7e6c2', c2: '#d9b67e',
    weight: 1.6, perKg: 2900, minWeight: 1.2,
    desc: 'Плотный сливочный чизкейк на песочной основе. Подаём с ягодным соусом.',
    comp: ['Песочная основа', 'Сливочный сыр', 'Сливки', 'Ванильный экстракт'],
    decor: 'Ягодный соус, свежие ягоды',
    lead: '48 часов', keeps: '72 часа', tiers: 1
  },
  {
    id: 'basque', name: 'Басконский чизкейк', cat: 'cheesecake', icon: 'cheesecake',
    c1: '#e3bd93', c2: '#b87f4e',
    weight: 1.4, perKg: 3000, minWeight: 1,
    desc: 'Карамелизованная корочка и почти текучий центр — чизкейк без основы.',
    comp: ['Сливочный сыр', 'Сливки 33%', 'Яйца', 'Тростниковый сахар'],
    decor: 'Без декора, карамельная корочка',
    lead: '48 часов', keeps: '48 часов', tiers: 1
  },
  {
    id: 'bento-love', name: 'Бенто «записка»', cat: 'bento', icon: 'bento',
    c1: '#f6c2d4', c2: '#e38aa8',
    weight: 0.5, perKg: 3600, minWeight: 0.4,
    desc: 'Маленький торт на 1–2 человека с надписью от руки. Отдаём в коробке-бенто.',
    comp: ['Ванильный или шоколадный бисквит', 'Крем-чиз'],
    decor: 'Надпись кремом, коробка в комплекте',
    lead: '24 часа', keeps: '36 часов', tiers: 1
  },
  {
    id: 'bento-mono', name: 'Бенто моно-цвет', cat: 'bento', icon: 'bento',
    c1: '#cfe0f2', c2: '#8fb2d8',
    weight: 0.5, perKg: 3400, minWeight: 0.4,
    desc: 'Однотонный бенто-торт в выбранном оттенке — для сдержанных подарков.',
    comp: ['Бисквит на выбор', 'Крем-чиз', 'Ягодная прослойка'],
    decor: 'Гладкий крем, один цвет',
    lead: '24 часа', keeps: '36 часов', tiers: 1
  },
  {
    id: 'cupcakes-set', name: 'Набор капкейков, 9 шт', cat: 'cupcakes', icon: 'cupcake',
    c1: '#f9ccd8', c2: '#dd9ab4',
    weight: 0.9, perKg: 3800, minWeight: 0.9,
    desc: 'Девять капкейков трёх вкусов в подарочной коробке — удобная альтернатива торту.',
    comp: ['Ванильный, шоколадный и морковный бисквит', 'Крем-чиз', 'Начинки на выбор'],
    decor: 'Крем-шапки, посыпка, топперы',
    lead: '48 часов', keeps: '48 часов', tiers: 1
  },
  {
    id: 'cupcakes-kids', name: 'Капкейки детские, 12 шт', cat: 'cupcakes', icon: 'cupcake',
    c1: '#d4ecc0', c2: '#9ccb77',
    weight: 1.2, perKg: 3500, minWeight: 1.2,
    desc: 'Яркие капкейки с топперами — хорошо работают на детских праздниках и в садике.',
    comp: ['Ванильный бисквит', 'Крем на белом шоколаде', 'Джем'],
    decor: 'Цветные посыпки, бумажные топперы',
    lead: '48 часов', keeps: '48 часов', tiers: 1
  }
];
