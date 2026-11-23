const layout = globalThis.NORA_LAYOUT;
const sources = {
  canon: ['Запись 24', '../../../Канон/Записи/24-нора-база-героев.md'],
  origin: ['Как появилась Нора', '../../../Проза/nora-arc.md'],
  return: ['Ошерская история', '../../../Проза/Ошерская_история.md'],
  hvat: ['Хват и три ножа', '../../../Проза/Хват_и_три_ножа.md'],
  ref: ['Чертежи Godot', '../Документы/Референсы/README.md'],
};

const phases = {
  spring: 'Ранняя весна 1026 года, первая встреча. В комнате один топчан Арна, люк подпёрт поленом, перед уходом дверь подпирают колом. Лошадей у дома ещё не держат.',
  autumn: 'Ранняя осень 1026 года. В обжитой Норе три топчана, рабочий угол Никто, погреб с запасами и коновязь у ручья.',
  late: 'Поздняя осень после Ошерска. Скоба засова заведена в бревно, крюк над топчаном пуст, у порога появилось ведро для капели. К концу «Хвата» выпадает первый снег.',
};

const viewSpecs = {
  room: {
    kind: 'Вид сверху', title: 'План помещения', overlay: 'Контур погреба',
    caption: 'Масштабная сетка 1 м · фасад внизу',
  },
  site: {
    kind: 'Вид сверху', title: 'Поляна и ручей', overlay: 'Горизонтали склона',
    caption: 'Участок 37 × 37 м · сетка 5 м · высоты от пола дома',
  },
  faces: {
    kind: 'Ортогональные виды', title: 'Четыре фасада',
    caption: 'Единый масштаб · высоты от пола дома',
  },
};

let view = 'room';
let period = 'autumn';
let selected;
const overlays = { room: true, site: true };

const drawing = document.querySelector('#drawing');
const panel = document.querySelector('#drawing-panel');
const list = document.querySelector('#object-list');
const detail = document.querySelector('#object');
const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
const overlay = document.querySelector('#overlay');
const season = document.querySelector('#period');

function entry(id, title, evidence, description, geometry, reference) {
  return { id, title, evidence, description, geometry, reference };
}

function roomEntries() {
  const isSpring = period === 'spring';
  const isLate = period === 'late';
  const objects = [
    entry('door', 'Вход и ставни', isLate ? 'Ошерская история' : 'Канон и проза',
      isSpring ? 'Дверь подпёрта колом снаружи. Изнутри её закрывают засовом. В створе ставен остаётся щель, через которую видно поляну.' :
        isLate ? 'Новая скоба засова уходит в бревно. В дождь у порога Арн ставит ведро под капель.' :
          'Дверь с внутренним засовом. Слева от входа окно со ставнями. В главе VII Грейс предлагает перенести крепление засова с косяка в бревно.',
      'Вход 1,00 × 1,95 м, открывается внутрь. Окна по часовой стрелке от входа: фасадное малое 0,60 × 0,60 м, правое торцевое 0,70 × 0,60 м, заднее 0,80 × 0,65 м и фасадное большое 1,20 × 0,80 м.',
      isLate ? 'return' : 'origin'),
    entry('hearth', 'Каменный очаг', 'Запись 24',
      'Стоит у левой стены. Котелок висит на цепи, над очагом на крюках вялится зайчатина. Труба выходит через передний скат ближе к левому торцу.',
      'Пятно очага около 1,23 × 1,85 м. Труба привязана к тому же узлу.', 'canon'),
    entry('table', 'Общий стол', 'Запись 24',
      isSpring ? 'Тяжёлый стол стоит посреди комнаты. На него кладут арбалет в рогоже, инструмент и огарок.' :
        'Тяжёлый прямоугольный стол с двумя лавками. За ним едят, разбирают привезённое и чинят снаряжение.',
      'Столешница 2,14 × 0,99 м, лавки по 1,90 × 0,31 м.', isSpring ? 'origin' : 'canon'),
    entry('cellar', 'Люк в погреб', isSpring ? 'Как появилась Нора' : 'Запись 24',
      isSpring ? 'Петля сломана, крышка подпёрта поленом. Никто чинит петлю в главе VII.' :
        'Кованое кольцо в крышке люка. Он перед столом и левее, в свободном полу между входом и очагом. В погребе держат соль, железо и запасы на несколько недель.',
      'Крышка 1,02 × 0,92 м. Петля с левой стороны, проход для спуска перед столом. Размеры самого погреба рабочие.',
      isSpring ? 'origin' : 'canon'),
  ];
  if (!isSpring) {
    objects.push(
      entry('workbench', 'Верстак', 'Запись 24',
        'Тяжёлый верстак с пилой, деревянными заготовками и инструментом вдоль левой стены за очагом.',
        'Столешница 0,82 × 1,66 м. Над ней полки и подвесы по концепту.', 'canon'),
      entry('alchemy', 'Алхимический стол', 'Запись 24',
        'Отдельный низкий стол Никто у входной стены слева. На нём склянки, мешочки с порошками и огарок.',
        'Столешница 1,44 × 0,67 м.', 'canon'),
      entry('grace', 'Топчан Грейс', isLate ? 'После Ошерска' : 'Запись 24',
        isLate ? 'Крюк над топчаном пуст. Оборванный ремень Грейс положила в сундук.' :
          'Один из двух топчанов в дальнем правом углу. Арбалет Грейс висит на крюке над изголовьем.',
        'Топчан 0,88 × 2,06 м. Стоит вдоль задней стены, изголовьем к углу.', isLate ? 'return' : 'canon'),
      entry('nikto', 'Топчан Никто', isLate ? 'Хват и три ножа' : 'Запись 24',
        isLate ? 'У изголовья ставят табурет. На нём лежат перевязи, до которых Никто может дотянуться с топчана.' :
          'Второй топчан в дальнем правом углу. Между двумя топчанами стоит сундук.',
        'Топчан 0,88 × 2,04 м. Стоит вдоль торца, под прямым углом к топчану Грейс. Положение табурета условное.', isLate ? 'hvat' : 'canon'),
      entry('chest', 'Сундук', 'Запись 24',
        'Стоит между топчанами. В нём Никто хранит два кожаных рулона для ножей.',
        'Сундук 0,78 × 0,48 м. Стоит у дальней стены, крышка доступна из комнаты.', 'canon'),
      entry('washing', 'Таз и ведро у окна', 'Расстановка в Godot',
        'Арн носит воду из ручья. Под окном отведено место для таза, воды и тряпки.',
        'Подставка глубиной 34 см оставляет свободным подход к люку.', 'working'),
      entry('travelGear', 'Дорожные вещи', 'Расстановка в Godot',
        'У задней стены полка для рогожи и свёртков. На колышке висит сумка.',
        'Вещи лежат у стены вне прохода между столом и верстаком.', 'working'),
    );
  }
  objects.push(entry('arn', isSpring ? 'Единственный топчан' : 'Угол Арна', isSpring ? 'Как появилась Нора' : 'Запись 24',
    isSpring ? 'Один топчан у стены, застеленный шкурами. При первой встрече Арн уступает его раненой Грейс.' :
      'У правой стены шерстяная занавеска отделяет узкий топчан Арна. Над ним полка. В остальной комнате перегородок нет.',
    isSpring ? 'Точное место первого топчана не задано. Положение и габарит показаны по поздней планировке условно.' :
      'Топчан 0,85 × 1,85 м. Две ветви занавески на деревянных стойках, проход между полотнами со стороны комнаты.', isSpring ? 'origin' : 'canon'));
  return objects;
}

function siteEntries() {
  const objects = [
    entry('house', 'Сруб на поляне', 'Канон и проза',
      'Одноэтажный охотничий сруб, которому около тридцати лет, стоит выше ручья. Нижний венец у земли. Слева от входа полубревно для сидения и бочка.',
      '9 × 7 м по осям стен. Граница поляны показана условно.', 'canon'),
    entry('trail', 'Узкая тропа', 'Как появилась Нора',
      'Тропа выходит на открытую поляну со стороны двери и спускается к воде. После Ошерска телегу оставляют под елями там, где старая дорога заканчивается, и идут дальше между камнями.',
      'Изгиб тропы показан по рабочему чертежу. Точное место, где оставили телегу, в прозе не задано.', 'origin'),
    entry('stream', 'Ручей и спуск за водой', 'Как появилась Нора',
      'Арн носит воду из ручья. Ниже по течению у мочажины растёт ивняк, куда герои идут за корой. В арке сруб впервые видят снизу, от ручья.',
      'Вода около −2,65 м от пола. Камни у спуска, ширина и направление русла показаны по рабочему плану.', 'origin'),
    entry('rack', 'Сушилка для шкур', 'Как появилась Нора',
      'За домом стоит жердь с двумя перекладинами. При первой встрече на ней сушатся две заячьи шкуры.',
      'Точное место за срубом и длина перекладин условные.', 'origin'),
    entry('wood', 'Поленница', 'Расстановка в Godot',
      'Дрова сложены справа от входа под отдельным дощатым козырьком. Рядом колода с топором.',
      'Пятно навеса около 1,95 × 0,78 м.', 'working'),
  ];
  if (period !== 'spring') {
    objects.push(
      entry('rail', 'Коновязь между соснами', 'Канон и проза',
        'Арн устраивает коновязь у воды после первого возвращения с двумя лошадьми. С тропы её не видно. Лошади стоят на сухом берегу.',
        'Жердь длиной около 2,6 м крепится на высоте около 1,15 м. Площадка около −2,00 м от пола дома.', 'canon'),
      entry('screen', 'Подлесок и бровка', 'Рабочий чертёж',
        'Подлесок и изгиб склона скрывают коновязь. К площадке можно подойти с суши, не переходя ручей.',
        'Способ заслона и короткий подход от тропы взяты из чертежа участка. Их видимость зависит от рельефа и густоты подлеска.', 'ref'),
    );
  }
  return objects;
}

function faceEntries() {
  return [
    entry('front', 'Входной фасад', 'Авторский референс',
      'Дверь чуть правее середины длинной стены. Слева большое окно со ставнями, лавка и бочка, справа малое окно. Труба выходит через левую часть переднего ската.',
      'Стена 9,00 м. Верх стены 2,40 м, конёк 4,30 м, верх трубы 5,15 м.', 'ref'),
    entry('back', 'Задняя стена', 'Рабочий чертёж',
      'На задней стене одно окно над спальной частью комнаты. За домом стоит отдельная сушилка.',
      'Стена 9,00 м. Окно 0,80 × 0,65 м, подоконник на высоте 1,10 м.', 'ref'),
    entry('left', 'Левый торец', 'Рабочий чертёж',
      'Глухой бревенчатый торец у очага. Над ним двускатная крыша из дранки под толстым мхом, с выпуском брёвен на углах.',
      'Торец 7,00 м. Свесы скатов около 0,60 м с каждой стороны.', 'ref'),
    entry('right', 'Правый торец', 'Рабочий чертёж',
      'В торце небольшое окно ближе к задней стене.',
      'Торец 7,00 м. Окно 0,70 × 0,60 м, подоконник на высоте 1,10 м.', 'ref'),
  ];
}

function rect(x, y, w, h, className = '', attributes = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${className}" ${attributes}/>`;
}

function line(x1, y1, x2, y2, className = '', attributes = '') {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${className}" ${attributes}/>`;
}

function label(x, y, value, className = '', anchor = 'middle') {
  return `<text x="${x}" y="${y}" class="${className}" text-anchor="${anchor}">${value}</text>`;
}

function circle(x, y, radius, attributes = '') {
  return `<circle cx="${x}" cy="${y}" r="${radius}" ${attributes}/>`;
}

function path(d, className = '', attributes = '') {
  return `<path d="${d}" class="${className}" ${attributes}/>`;
}

function badge(id, x, y, objects) {
  const index = objects.findIndex(object => object.id === id);
  if (index === -1) return '';
  return `<g class="hotspot" data-object="${id}" role="button" tabindex="0" aria-pressed="false" aria-label="${objects[index].title}">
    ${circle(x, y, 16, 'fill="transparent"')}
    ${circle(x, y, 12, 'class="target"')}
    ${label(x, y, index + 1)}
  </g>`;
}

function outline(id, shape) {
  return `<g class="selection" data-outline="${id}" hidden style="display:none">${shape}</g>`;
}

function svg(content, title, height = 600) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${height}" aria-label="${title}">
    <title>${title}</title>${content}
  </svg>`;
}

function dimension(x1, y1, x2, y2, name) {
  const vertical = x1 === x2;
  const ticks = [ [x1, y1], [x2, y2] ].map(([x, y]) =>
    line(x - 4, y + 4, x + 4, y - 4, 'measure')).join('');
  const midpoint = vertical
    ? `<g transform="rotate(-90 ${x1 - 9} ${(y1 + y2) / 2})">${label(x1 - 9, (y1 + y2) / 2, name, 'measure-text')}</g>`
    : label((x1 + x2) / 2, y1 - 7, name, 'measure-text');
  return line(x1, y1, x2, y2, 'measure') + ticks + midpoint;
}

function drawRoom(objects) {
  const room = layout.room;
  const x = m => 400 + m * 66;
  const z = m => 289 + m * 66;
  const box = ([cx, cz, w, d], cls = '', attrs = '') => rect(x(cx - w / 2), z(cz - d / 2), w * 66, d * 66, cls, attrs);
  const edge = (x1, z1, x2, z2, cls, attrs) => line(x(x1), z(z1), x(x2), z(z2), cls, attrs);
  const dot = (id, mx, mz) => badge(id, x(mx), z(mz), objects);
  const select = (id, [mx,mz,w,d]) => outline(id, box([mx,mz,w+.10,d+.10]));
  const obj = (id, position, shape, mark = position) => shape + select(id, position) + dot(id, mark[0], mark[1]);
  const bench = position => box(position, 'furniture', 'rx="2"');
  const bed = ([mx,mz,w,d], horizontal = false) => {
    const pillow = horizontal ? [mx+w/2-.24,mz,.29,d-.18] : [mx,mz-d/2+.24,w-.18,.29];
    const furs = horizontal ? [mx-.11,mz,w-.37,d-.11] : [mx,mz+.10,w-.11,d-.37];
    return box([mx,mz,w,d],'furniture','rx="2"') +
      box(furs,'bedspread','rx="4"') +
      box(furs,'','fill="url(#fur-weave)" rx="4"') +
      box(pillow,'bedspread','rx="4" style="fill:#b9a88c"');
  };
  const walls = [
    [-4.5,-3.5,2.2,-3.5], [3,-3.5,4.5,-3.5], [-4.5,-3.5,-4.5,3.5],
    [4.5,-3.5,4.5,-1.6], [4.5,-.9,4.5,3.5], [-4.5,3.5,-2.4,3.5],
    [-1.2,3.5,.9,3.5], [1.9,3.5,3,3.5], [3.6,3.5,4.5,3.5],
  ].map(points => edge(...points, 'wall')).join('');
  const windows = [
    edge(2.2,-3.5,3,-3.5,'window'), edge(2.2,-3.55,3,-3.55,'window'),
    edge(4.5,-1.6,4.5,-.9,'window'), edge(4.55,-1.6,4.55,-.9,'window'),
    ...[[-2.4,-1.2],[3,3.6]].flatMap(([a,b]) => [
      edge(a,3.5,b,3.5,'window'), edge(a,3.56,b,3.56,'window'),
      edge(a-.38,3.67,a,3.67,'fine known'), edge(b,3.67,b+.38,3.67,'fine known'),
    ]),
  ].join('');
  const [hx,hz,hw,hd] = room.hatch;
  const hatch = obj('cellar', room.hatch, box(room.hatch,'furniture','fill="url(#lid)"') +
    box(room.hatch,'','fill="url(#lid)" stroke="#e1bb83" stroke-width="1"') +
    edge(hx-hw/2+.08,hz-hd/2,hx-hw/2+.08,hz+hd/2,'fine known') +
    circle(x(hx+.31),z(hz),4,'fill="none" stroke="#ecd5aa" stroke-width="1.5"'),
    [hx,hz-.67]);
  const [fx,fz,fw,fd] = room.hearth;
  const fireplace = obj('hearth', room.hearth, box(room.hearth,'stone') +
    box(room.hearth,'','fill="url(#masonry)"') +
    box([fx+.22,fz,fw-.42,fd-.53],'','fill="#382b22"') +
    circle(x(fx+.23),z(fz),18,'fill="#b7713e"') +
    circle(x(fx+.24),z(fz),9,'fill="#f0bf75"') +
    edge(fx+fw/2,fz,fx+fw/2+.31,fz,'callout-line'),[fx+fw/2+.47,fz]);
  const tableSetting = [
    ...[[-.67,-.22],[-.44,.18],[.52,.25],[.78,-.14]].map(([mx,mz],i) =>
      circle(x(mx),z(mz),i % 2 ? 5 : 7,'fill="#9e6b45" stroke="#c89e70"')),
    circle(x(.28),z(.01),4,'fill="#f0c086"'),
  ].join('');
  const table = room.benches.map(bench).join('') +
    obj('table',room.table,box(room.table,'furniture','rx="2"') +
      edge(-.92,-.19,1.11,-.19,'fine known','opacity=".34"') +
      edge(-.92,.20,1.11,.20,'fine known','opacity=".34"') + tableSetting);
  const [wx,wz] = room.workbench;
  const [ax,az] = room.alchemy;
  const workbench = obj('workbench',room.workbench,box(room.workbench,'furniture') +
    box([wx-.22,wz-.04,.18,1.47],'furniture','style="fill:#3e3527"') +
    box([wx+.08,wz-.46,.32,.28],'furniture','style="fill:#886f4c"') +
    edge(wx+.01,wz-.20,wx+.19,wz+.27,'fine known','style="stroke-width:3"') +
    box([wx+.26,wz+.53,.24,.26],'stone'),[wx+.70,wz]);
  const alchemy = obj('alchemy',room.alchemy,box(room.alchemy,'furniture') +
    [[-.42,-.09,5],[-.19,.12,6],[.05,-.11,4],[.27,.11,5],[.51,-.04,3]].map(([dx,dz,r]) => circle(x(ax+dx),z(az+dz),r,'fill="#b8bba1" stroke="#5a5948"')).join(''),[ax,az-.63]);
  const { x:cx, back, front, end, openFrom, openTo } = room.curtain;
  const curtain = (x1,z1,x2,z2) => edge(x1,z1,x2,z2,'fine known','style="stroke-width:6;opacity:.7"') +
    edge(x1,z1,x2,z2,'fine','stroke="#373028" stroke-dasharray="1 5"');
  const alcove = [
    edge(cx,back,cx,front,'working fine'),
    curtain(cx,back,end,back), curtain(cx,back,cx,openFrom), curtain(cx,openTo,cx,front),
    ...[[cx,back],[cx,front],[end,back]].map(([mx,mz]) => box([mx,mz,.13,.13],'furniture')),
    box([4.23,1.33,.23,.74],'working','fill="#6b5336"'),
  ].join('');
  const [gx,gz,gw,gd] = room.grace;
  const hook = path(`M${x(gx+.29)} ${z(gz-gd/2-.05)}v5q0 4 5 3`,'fine known');
  const roomDetails = period === 'spring' ? '' : [
    workbench, alchemy,
    obj('grace',room.grace,bed(room.grace,true) + hook + (period === 'late' ? '' :
      edge(gx-.24,gz-gd/2-.05,gx+.47,gz-gd/2-.05,'fine known','style="stroke-width:3"') +
      edge(gx+.26,gz-gd/2-.18,gx+.26,gz-gd/2+.14,'fine known')),[gx-.30,gz+.67]),
    obj('nikto',room.nikto,bed(room.nikto),[3.91,-1.30]),
    obj('chest',room.chest,box(room.chest,'furniture','rx="3" style="fill:#624b35"') +
      box([2.85,-1.79,.63,.30],'','fill="url(#lid)"') +
      edge(2.80,-1.55,2.90,-1.55,'fine known')),
    alcove,
  ].join('');
  const cellarFootprint = overlays.room
    ? box(room.cellar,'working','fill="none" stroke-opacity=".74"') +
      edge(hx-.34,hz-.32,hx-.34,hz+.32,'fine working') +
      [-.22,0,.22].map(d => edge(hx-.44,hz+d,hx-.30,hz+d,'fine working')).join('') +
      label(x(hx-.43),z(2.47),'Погреб внизу','note')
    : '';
  const arn = obj('arn',room.arn,bed(room.arn),period === 'spring' ? [3.89,1.48] : [3.31,1.46]);

  return svg(`
    <defs>
      <pattern id="room-grid" width="66" height="66" patternUnits="userSpaceOnUse" x="${x(0)}" y="${z(0)}"><path d="M66 0H0V66" fill="none" stroke="#66715d" opacity=".35"/></pattern>
      <pattern id="floorboards" width="103" height="16" patternUnits="userSpaceOnUse"><path d="M0 15.5h103 M26 0v15 M64 15v1" fill="none" stroke="#9a7953" opacity=".33"/></pattern>
      <pattern id="masonry" width="19" height="18" patternUnits="userSpaceOnUse"><path d="M0 1h19 M0 9h19 M5 1v8 M14 9v9" fill="none" stroke="#b4ab97" opacity=".59"/></pattern>
      <pattern id="lid" width="12" height="45" patternUnits="userSpaceOnUse"><rect width="12" height="45" fill="#624e36"/><path d="M1 0v45" stroke="#a58a65"/></pattern>
      <pattern id="fur-weave" width="13" height="11" patternUnits="userSpaceOnUse"><path d="M3 4l3 1m3 3l2 1" stroke="#be9d71" opacity=".5"/></pattern>
    </defs>
    ${rect(22,16,756,568,'','fill="url(#room-grid)" opacity=".45"')}
    ${box([0,0,9,7],'','fill="#403628"')}
    ${box([0,0,9,7],'','fill="url(#floorboards)"')}
    ${box([0,0,9,7],'','fill="url(#room-grid)"')}
    ${dimension(x(-4.5),32,x(4.5),32,'≈ 9,00 м')}
    ${dimension(68,z(-3.5),68,z(3.5),'≈ 7,00 м')}
    ${edge(-4.5,-3.96,-4.5,-3.56,'measure')}${edge(4.5,-3.96,4.5,-3.56,'measure')}
    ${line(66,z(-3.5),x(-4.6),z(-3.5),'measure')}${line(66,z(3.5),x(-4.6),z(3.5),'measure')}
    ${cellarFootprint} ${walls} ${windows}
    ${edge(.9,3.5,.9,2.5,'fine known','stroke-width="3"')}
    ${path(`M${x(.9)} ${z(2.5)}A66 66 0 0 1 ${x(1.9)} ${z(3.5)}`,'fine working')}
    ${box([1.4,3.76,1.1,.27],'stone')}
    ${box([-1.8,3.98,1.6,.32],'furniture','rx="6"')}
    ${circle(x(-3.1),z(4),19,'class="furniture"')}
    ${circle(x(-3.1),z(4),13,'fill="none" stroke="#a6865c"')}
    ${box(layout.site.wood,'furniture')}
    ${circle(x(layout.site.choppingBlock[0]),z(layout.site.choppingBlock[1]),14,'class="furniture"')}
    ${fireplace} ${table} ${roomDetails} ${arn} ${hatch}
    ${period === 'spring' ? '' :
      obj('washing',room.washing,box(room.washing,'furniture') + circle(x(-2.015),z(3.11),8,'class="fine known"'),[-1.5,2.88]) +
      obj('travelGear',room.travelGear,box(room.travelGear,'furniture'),[-1.35,-2.96])}
    ${period === 'late' ? box(room.stool,'furniture') + circle(x(2.33),z(3.07),8,'class="furniture"') : ''}
    ${select('door',[1.4,3.39,1.2,.35])} ${dot('door',1.4,3.91)}
    ${label(x(1.4),z(4.27),'Вход','note')}
    ${label(x(-1.8),z(4.42),'Лавка и бочка','note')}
    ${label(x(3.43),z(4.60),'Дрова','note')}
    ${dimension(614,571,680,571,'1 м')}
  `,'План комнаты Норы с верстаком, отдельным алхимическим столом и свободным люком');
}

function drawSite(objects) {
  const x = m => 391 + m * 15;
  const z = m => 360 + m * 15;
  const track = (points, cls, attrs) => path(points.map(([mx,mz], i) => `${i === 0 ? 'M' : 'L'}${x(mx)} ${z(mz)}`).join(' '), cls, attrs);
  const polygon = (points, attrs) => `<polygon points="${points.map(([mx,mz]) => `${x(mx)},${z(mz)}`).join(' ')}" ${attrs}/>`;
  const groundRect = (mx,mz,w,d,cls,attrs) => rect(x(mx),z(mz),w*15,d*15,cls,attrs);
  const note = (mx,mz,text,anchor) => label(x(mx),z(mz),text,'site-label',anchor);
  const dot = (id,mx,mz) => badge(id,x(mx),z(mz),objects);
  const fir = (mx,mz,r,canopy,edge) => [
    circle(x(mx),z(mz),r*15,`fill="${canopy}" stroke="${edge}" stroke-width="1"`),
    path(`M${x(mx)-r*8} ${z(mz)-1}h${r*16} M${x(mx)} ${z(mz)-r*8}v${r*16}`,'','stroke="#afbb8a" opacity=".45"'),
    circle(x(mx),z(mz),1.3,'fill="#bea278"'),
  ].join('');
  const clearing = [[-6.5,-4],[-5.2,-6.1],[-2.3,-6.6],[3.6,-5.4],[5.4,-4.4],[6.3,-2.8],[6.8,2.9],[5.4,6.6],[2.8,7.8],[-3.5,6.2],[-6.9,3.1]];
  const { upper, lower, trail, screen, access } = layout.site;
  const dryGround = [[5.7,-14.65],[8.2,-14.85],[10.6,-14.45],[11.3,-12.7],[10.8,-10.4],[8.7,-10.2],[6.3,-10.55],[5.55,-12.5]];
  const rows = [[-6.1,'−0,50'],[-8.3,'−1,00'],[-10.5,'−1,50'],[-13.15,'−2,00']];
  const contour = h => [[-18,h+1.3],[-13,h+.35],[-7,h-.3],[-2,h-1.2],[3,h-.7],[7,h+.4],[12,h+1.8],[19,h+1.2]];
  let seed = 1026;
  const random = () => {
    seed = seed * 16807 % 2147483647;
    return seed / 2147483647;
  };
  const woods = Array.from({length:210}, () => {
    const mx = -17.5 + random() * 36;
    const mz = -22.4 + random() * 35.8;
    const r = .32 + random() * .67;
    const opening = mx > -8 && mx < 10 && mz > -7.5 && mz < 9.2;
    const valley = mz < -7.5 && mx > -6 && mx < 13;
    const river = mz < -15.2 && mz > -20.2;
    return opening || valley || river ? '' : fir(mx,mz,r,'#3f5037','#667652');
  }).join('');
  const stony = [[-3,-15.95],[-3.28,-16.54],[-2.91,-17.24],[-2.63,-17.85],[-.7,10.45],[5.65,9],[-4.15,-6.2],[11.6,-6.7]];
  const rail = period === 'spring' ? '' : [
    polygon(dryGround, 'fill="#5a513b" stroke="#b6a680" stroke-width="1.4" stroke-dasharray="5 3"'),
    track(access,'fine working'),
    screen.map(([mx,mz]) => fir(mx,mz,.55,'#60704b','#a2ae80')).join(''),
    track([[3.65,-12.4],[4,-12.75],[4.37,-12.91]],'fine working','stroke-width="3"'),
    fir(7,-14,.64,'#4b5e41','#bac59e'), fir(9.6,-14.2,.64,'#4b5e41','#bac59e'),
    track(layout.site.rail,'fine known','style="stroke-width:3.5"'),
    groundRect(7.35,-13.82,.78,2.40,'working','fill="none"'),
    groundRect(8.72,-13.82,.78,2.40,'working','fill="none"'),
    track([[10.6,-13.9],[12.0,-13.0],[13.3,-13.0]],'callout-line'),
    note(13.5,-12.72,'Коновязь','start'),
    note(13.5,-11.38,'Площадка −2,00 м','start'),
    outline('rail', polygon(dryGround,'')),
    outline('screen', circle(x(3.65),z(-11.9),24)),
    dot('rail',10.7,-14.1), dot('screen',3.65,-12.28),
  ].join('');

  return svg(`
    <defs><pattern id="site-grid" width="75" height="75" patternUnits="userSpaceOnUse" x="${x(0)}" y="${z(0)}">
      <path d="M75 0H0V75" fill="none" stroke="#85916e" opacity=".3"/>
    </pattern></defs>
    ${groundRect(-18,-23,37,37,'','fill="#293629" stroke="#738263"')}
    ${polygon(clearing,'fill="#4a4632" stroke="#8d8565" stroke-dasharray="5 4"')}
    ${groundRect(-18,-23,37,37,'','fill="url(#site-grid)"')}
    ${woods}
    ${overlays.site ? rows.map(([h,value]) => track(contour(h),'terrain') + note(-16.2,h+.72,value)).join('') : ''}
    ${polygon([...upper,...lower.slice().reverse()],'fill="#345458" stroke="#91aeab" stroke-width="1.4"')}
    ${track(upper.map(([mx,mz], i) => [mx,(mz+lower[i][1])/2]),'','fill="none" stroke="#6c989a" stroke-width="1.5"')}
    ${track([[12.0,-17.63],[16.2,-17.86],[15.65,-18.13],[16.2,-17.86],[15.65,-17.56]],'','fill="none" stroke="#b4d3cc" stroke-width="1.4"')}
    ${track(trail,'','fill="none" stroke="#8f7856" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"')}
    ${track(trail,'','fill="none" stroke="#d2b683" stroke-width="1.6" stroke-linejoin="round"')}
    ${stony.map(([mx,mz]) => circle(x(mx),z(mz),3.8,'class="stone"')).join('')}
    ${rail}
    ${groundRect(-4.5,-3.5,9,7,'','fill="#5d6847" stroke="#d2ae7a" stroke-width="2"')}
    ${groundRect(-4.5,0,9,3.5,'','fill="#535e42"')}
    ${track([[-4.5,0],[4.5,0]],'fine working')}
    ${groundRect(-4.5,.5,.7,.8,'stone')}
    ${groundRect(-2.6,3.82,1.6,.32,'furniture')}
    ${circle(x(-3.1),z(4),4,'class="furniture"')}
    ${track([[.9,3.5],[1.9,3.5]],'fine known','style="stroke-width:3"')}
    ${groundRect(4.64,.10,.50,1.50,'furniture')}
    ${track(layout.site.rack,'fine known','style="stroke-width:2.8"')}
    ${track([[-2.7,-4.88],[-.8,-4.88]],'fine known')}
    ${circle(x(-2.7),z(-5.2),2.4,'fill="#d7b480"')}
    ${circle(x(-.8),z(-5.2),2.4,'fill="#d7b480"')}
    ${outline('house',groundRect(-4.65,-3.65,9.3,7.3,'',''))}
    ${outline('trail',track(trail,''))}
    ${outline('stream',polygon([...upper,...lower.slice().reverse()],''))}
    ${outline('rack',groundRect(-2.94,-5.44,2.37,.83,'',''))}
    ${outline('wood',groundRect(2.46,3.60,1.95,.78,'',''))}
    ${note(-10.9,-18.2,'Ручей')} ${note(-3.55,-14.68,'Спуск за водой','end')}
    ${note(14.8,-20.1,'К ивняку ниже по течению')}
    ${note(-.35,2.38,'Нора · 9 × 7 м')} ${note(.30,5.12,'Вход','end')}
    ${note(-7.6,-5.09,'Сушилка')} ${note(12.2,2.8,'Поленница')}
    ${note(5.25,10.18,'Узкая тропа')} ${note(-10.8,4.9,'Лес')}
    ${track([[-6.1,-5.37],[-3.9,-5.37],[-2.8,-5.15]],'callout-line')}
    ${track([[10.5,2.6],[7.7,2.6],[4.39,3.99]],'callout-line')}
    ${dot('house',0,.80)} ${dot('trail',6.38,7.91)} ${dot('stream',-6.35,-17.49)}
    ${dot('rack',-4.48,-5.37)} ${dot('wood',4.25,4.25)}
    ${dimension(x(-16),z(12.1),x(-11),z(12.1),'5 м')}
    ${label(x(16.7),z(12.1),'Фасад внизу','note','end')}
  `, 'Ближайшая территория Норы с тропой, уклоном и ручьём');
}

function drawFaces(objects) {
  const profiles = [
    { id: 'front', name: 'Входной фасад', x: 214, y: 246, width: 9, chimney: -4.15, door: 1.4,
      windows: [[-1.8,1.20,.80,.95,true],[3.3,.60,.60,1.05,true]] },
    { id: 'back', name: 'Задняя стена', x: 598, y: 246, width: 9, chimney: 4.15,
      windows: [[-2.6,.80,.65,1.10,false]] },
    { id: 'left', name: 'Левый торец', x: 214, y: 506, width: 7, gable: true, chimney: .9, windows: [] },
    { id: 'right', name: 'Правый торец', x: 598, y: 506, width: 7, gable: true, chimney: -.9,
      windows: [[1.25,.70,.60,1.10,false]] },
  ];
  const renderFace = face => {
    const scale = 30;
    const width = face.width * scale;
    const base = face.y;
    const cap = base - 2.4 * scale;
    const peak = base - 4.3 * scale;
    const top = base - 5.15 * scale;
    const left = face.x - width / 2;
    const right = face.x + width / 2;
    const eave = face.gable ? .60 * scale : .50 * scale;
    const roof = face.gable
      ? path(`M${left-eave} ${cap+6}L${face.x} ${peak}L${right+eave} ${cap+6}`,'','fill="none" stroke="url(#moss)" stroke-width="10" stroke-linejoin="round"')
      : rect(left-eave, peak, width+eave*2, cap-peak+6, '', 'fill="url(#moss)" stroke="#95a37d" stroke-width="1.3"');
    const chimney = rect(face.x + face.chimney * scale - 10, top, 20, peak - top + 15, 'stone');
    const windows = face.windows.map(([mx,w,h,sill,shutters]) => {
      const wx = face.x+(mx-w/2)*scale;
      const wy = base-(sill+h)*scale;
      return [
        rect(wx,wy,w*scale,h*scale,'','fill="#394746" stroke="#b1c4b4" stroke-width="1.4"'),
        line(wx+w*scale/2,wy,wx+w*scale/2,wy+h*scale,'window'),
        shutters ? rect(wx-10,wy-1,8,h*scale+2,'furniture') + rect(wx+w*scale+2,wy-1,8,h*scale+2,'furniture') : '',
      ].join('');
    }).join('');
    const doorX = face.x + (face.door - .5) * scale;
    const fixtures = [
      face.id === 'front' ? [
        rect(doorX,base-1.95*scale,scale,1.95*scale,'','fill="url(#door-planks)" stroke="#deb681" stroke-width="1.5"'),
        circle(doorX+23,base-28,2,'fill="#d0af79"'),
        rect(face.x-77,base-12,47,4,'furniture'),
        line(face.x-72,base-8,face.x-72,base,'fine known'),
        line(face.x-35,base-8,face.x-35,base,'fine known'),
        rect(face.x-104,base-24,19,24,'furniture','rx="3"'),
        line(face.x-103,base-17,face.x-86,base-17,'fine known'),
        line(face.x-103,base-7,face.x-86,base-7,'fine known'),
      ].join('') : '',
      face.id === 'front' ? [rect(face.x+2.51*scale,base-25,1.84*scale,25,'','fill="url(#woodstack)" stroke="#c39b69"'),line(face.x+2.43*scale,base-28,face.x+4.46*scale,base-28,'fine known')].join('') : '',
    ].join('');

    return [
      label(face.x,base-189,face.name),
      face.id === 'front' ? '' : chimney,
      rect(left,cap,width,base-cap,'','fill="url(#logs)" stroke="#c59767" stroke-width="1.6"'),
      face.gable ? path(`M${left} ${cap}L${face.x} ${peak}L${right} ${cap}Z`,'','fill="url(#logs)" stroke="#c59767"') : '',
      roof,
      face.id === 'front' ? chimney : '',
      windows, fixtures,
      line(left-24,base,right+24,base,'fine working'),
      dimension(left,base+33,right,base+33,face.width === 9 ? '9,00 м' : '7,00 м'),
      face.id === 'front' ? dimension(54,base,54,top,'5,15 м') : '',
      face.id === 'back' ? dimension(776,base,776,peak,'4,30 м') : '',
      face.id === 'left' ? dimension(54,base,54,cap,'2,40 м') : '',
      outline(face.id,rect(left-6,peak-6,width+12,base-peak+12)),
      badge(face.id,left+2,base-186,objects),
    ].join('');
  };

  return svg(`
    <defs>
      <pattern id="logs" width="40" height="9" patternUnits="userSpaceOnUse"><rect width="40" height="9" fill="#735538"/><path d="M0 1H40" stroke="#b48b5e"/><path d="M0 8H40" stroke="#3b3226"/></pattern>
      <pattern id="moss" width="28" height="15" patternUnits="userSpaceOnUse"><rect width="28" height="15" fill="#5a6646"/><path d="M0 5h28 M1 12h21 M14 1v4 M22 5v7" stroke="#a3ac82" opacity=".55" fill="none"/></pattern>
      <pattern id="door-planks" width="7" height="34" patternUnits="userSpaceOnUse"><rect width="7" height="34" fill="#493a2a"/><path d="M1 0v34" stroke="#94734d"/></pattern>
      <pattern id="woodstack" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#493a2a"/><circle cx="4" cy="4" r="2.6" fill="#b0895f"/></pattern>
    </defs>
    ${line(36,303,765,303,'fine working','opacity=".38"')}
    ${line(407,40,407,548,'fine working','opacity=".38"')}
    ${profiles.map(renderFace).join('')}
    ${dimension(648,569,708,569,'2 м')}
  `, 'Четыре фасада Норы в одном масштабе', 590);
}

const entriesByView = { room: roomEntries, site: siteEntries, faces: faceEntries };
const renderByView = { room: drawRoom, site: drawSite, faces: drawFaces };
let objects = [];

function selectObject(id) {
  const object = objects.find(item => item.id === id);
  if (!object) return;

  selected = id;
  const [name, href] = sources[object.reference];
  detail.innerHTML = `
    <p class="eyebrow">${object.evidence}</p>
    <h3>${object.title}</h3>
    <p>${object.description}</p>
    <p class="detail-source">${object.geometry}</p>
    <p class="detail-source"><a href="${href}">${name}</a></p>`;

  panel.querySelectorAll('[data-object]').forEach(node => {
    const active = node.dataset.object === selected;
    node.classList.toggle('is-active', active);
    node.setAttribute('aria-pressed', String(active));
  });
  drawing.querySelectorAll('[data-outline]').forEach(node => {
    node.style.display = node.dataset.outline === selected ? '' : 'none';
    node.removeAttribute('hidden');
  });
}

function render() {
  const spec = viewSpecs[view];
  objects = entriesByView[view]();

  document.querySelector('#view-type').textContent = spec.kind;
  document.querySelector('#view-title').textContent = spec.title;
  document.querySelector('#caption').textContent = spec.caption;
  document.querySelector('#phase-note').textContent = phases[period];
  document.querySelector('#overlay-label').hidden = !spec.overlay;
  document.querySelector('#overlay-name').textContent = spec.overlay ?? '';
  overlay.checked = overlays[view] ?? false;
  panel.setAttribute('aria-labelledby', `tab-${view}`);
  tabs.forEach(tab => {
    const active = tab.dataset.view === view;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });

  drawing.innerHTML = renderByView[view](objects);
  list.innerHTML = objects.map((item, index) =>
    `<button type="button" class="object-button" data-object="${item.id}" aria-pressed="false"><span aria-hidden="true">${index + 1}</span>${item.title}</button>`).join('');
  const initial = view === 'room' ? 'table' : objects[0].id;
  selectObject(objects.some(item => item.id === selected) ? selected : initial);
}

tabs.forEach((tab, index) => {
  const activate = () => {
    view = tab.dataset.view;
    render();
  };
  tab.addEventListener('click', activate);
  tab.addEventListener('keydown', event => {
    const keys = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0, End: tabs.length - 1,
    };
    if (!Object.hasOwn(keys, event.key)) return;
    event.preventDefault();
    tabs[keys[event.key]].click();
    tabs[keys[event.key]].focus();
  });
});

panel.addEventListener('click', event => {
  const target = event.target.closest('[data-object]');
  if (target) selectObject(target.dataset.object);
});
drawing.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target.closest('[data-object]');
  if (!target) return;
  event.preventDefault();
  selectObject(target.dataset.object);
});
season.addEventListener('change', () => {
  period = season.value;
  render();
});
overlay.addEventListener('change', () => {
  overlays[view] = overlay.checked;
  render();
});
const zoom = document.querySelector('.zoom');
zoom.addEventListener('click', () => {
  const enlarged = drawing.classList.toggle('is-enlarged');
  zoom.setAttribute('aria-pressed', String(enlarged));
  zoom.textContent = enlarged ? 'Уместить' : 'Крупнее';
  if (!enlarged) drawing.scrollLeft = 0;
});

render();
