from PIL import Image, ImageDraw, ImageFont
from pathlib import Path


out = Path(__file__).resolve().parent
windows_fonts = Path('C:/Windows/Fonts')
linux_fonts = Path('/usr/share/fonts/truetype/dejavu')
bg, fg, dim = '#181d1d', '#e9dfc7', '#adb5aa'
wall, wood, amber, blue = '#746052', '#624837', '#e7bb75', '#8bc1c4'
def font(size, bold=False):
    if windows_fonts.is_dir():
        name = 'arialbd.ttf' if bold else 'arial.ttf'
        return ImageFont.truetype(str(windows_fonts / name), size)
    name = 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    return ImageFont.truetype(str(linux_fonts / name), size)
def text(d, xy, value, size=19, fill=fg, anchor=None, bold=False):
    d.text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)
def badge(d, x, y, value):
    d.ellipse((x-13,y-13,x+13,y+13), fill='#282715', outline=amber, width=2)
    text(d,(x,y+1),str(value),16,amber,'mm',True)
def segment(d, a, b, c, w=2):
    d.line((a,b), fill=c, width=w)
def dashed(d, a, b, color, w=2):
    import math
    dx,dy=b[0]-a[0],b[1]-a[1]
    length=math.hypot(dx,dy)
    for s in range(0,int(length),12):
        e=min(s+6,length)
        segment(d,(a[0]+dx*s/length,a[1]+dy*s/length),
                  (a[0]+dx*e/length,a[1]+dy*e/length),color,w)
def measurement(d,a,b,label,off=(0,-12)):
    segment(d,a,b,dim)
    for x,y in (a,b):
        segment(d,(x-4,y-5),(x+4,y+5),dim)
    text(d,((a[0]+b[0])/2+off[0],(a[1]+b[1])/2+off[1]),label,18,dim,'mm')

im=Image.new('RGB',(1580,1080),bg)
d=ImageDraw.Draw(im)
text(d,(56,40),'НОРА · ПЛАН ПОМЕЩЕНИЯ',36,bold=True)
text(d,(58,93),'Вид сверху • сетка 0,5 м • фасад внизу • X вправо, Z вниз',20,dim)
s=89
def p(x,z):
    return (520+x*s,510+z*s)
def rect(x,z,w,h,fill,outline='#ab8e6c',width=2):
    d.rectangle((p(x-w/2,z-h/2),p(x+w/2,z+h/2)),fill=fill,outline=outline,width=width)
def line(a,b,c,w=2):
    segment(d,p(*a),p(*b),c,w)
def dash(a,b,c,w=2):
    dashed(d,p(*a),p(*b),c,w)
def label(x,z,v):
    badge(d,*p(x,z),v)
def bed(x,z,w,l):
    rect(x,z,w,l,'#61594c')
    rect(x,z+.17,w-.10,l-.42,'#786855')
    rect(x,z-l/2+.18,w-.17,.26,'#a8977c')

rect(0,0,9,7,'#332c26',None)
for i in range(-9,10):
    line((i/2,-3.5),(i/2,3.5),'#483c32')
for i in range(-7,8):
    line((-4.5,i/2),(4.5,i/2),'#483c32')
for a,b in [((-4.5,-3.5),(4.5,-3.5)),((-4.5,3.5),(4.5,3.5)),
            ((-4.5,-3.5),(-4.5,3.5)),((4.5,-3.5),(4.5,3.5))]:
    line(a,b,wall,23)
for a,b in [((-2.4,3.5),(-1.2,3.5)),((3,3.5),(3.6,3.5)),
            ((2.2,-3.5),(3,-3.5)),((4.5,-1.6),(4.5,-.9))]:
    line(a,b,'#1e2a2c',22)
    line(a,b,blue,5)
line((.9,3.5),(1.9,3.5),bg,24)
hinge=p(.9,3.5)
line((.9,3.5),(1.242,2.560),amber,5)
d.arc((hinge[0]-s,hinge[1]-s,hinge[0]+s,hinge[1]+s),290,360,fill=amber,width=2)
label(1.65,3.03,1)

rect(-4.0,.9,.95,1.7,'#575955','#ada697')
rect(-3.83,.9,.6,1.09,'#2d2b26')
d.ellipse((p(-4.02,.71),p(-3.64,1.09)),outline=amber,width=3)
rect(-4.15,.9,.7,.8,None,'#a9aaa0')
label(-3.29,.9,2)
rect(-3.5,-3,1.4,.6,wood)
for i in range(3):
    cx,cy=p(-3.97+i*.25,-3.06)
    d.ellipse((cx-5,cy-5,cx+5,cy+5),fill=blue if i<2 else amber)
label(-3.48,-2.46,3)

rect(0,0,1.9,.90,wood)
for z in (-.8,.8):
    rect(0,z,1.7,.28,wood)
label(-1.13,0,4)
for a,b in [((-.30,-.35),(.50,-.35)),((.50,-.35),(.50,.45)),
            ((.50,.45),(-.30,.45)),((-.30,.45),(-.30,-.35))]:
    dash(a,b,blue,3)
cx,cy=p(.10,.30)
d.ellipse((cx-5,cy-5,cx+5,cy+5), outline=blue, width=2)
label(.13,-.06,5)

for x,id_ in ((1.4,6),(3.7,7)):
    bed(x,-2.45,.85,1.9)
    label(x,-2.22,id_)
line((1.1,-3.35),(1.7,-3.35),blue,4)
rect(2.55,-3,.75,.45,wood)
label(2.55,-2.57,8)
bed(4,1.30,.75,1.8)
dash((4.14,.8),(4.14,1.8),blue,4)
dash((3.4,.05),(3.4,1.95),amber,5)
label(3.91,1.40,9)

rect(-1.8,3.98,1.6,.32,wood)
cx,cy=p(-3.1,4.0)
d.ellipse((cx-.32*s,cy-.32*s,cx+.32*s,cy+.32*s),fill=wood,outline=amber,width=2)
label(-2.51,4.25,10)
rect(4.9,.85,.5,1.5,wood)
for i in range(7):
    z=.23+i*.20
    line((4.67,z),(5.13,z),amber,2)
label(5.11,.85,11)
measurement(d,p(-4.5,-3.96),p(4.5,-3.96),'9,00 м')
measurement(d,p(-4.97,-3.5),p(-4.97,3.5),'7,00 м',(-29,0))
text(d,p(1.4,4.21),'ФАСАД / +Z',21,fg,'mm',True)
measurement(d,p(-1,4.88),p(0,4.88),'1 м')
text(d,(1055,154),'Планировка',26,bold=True)
entries=[
    ('Вход','1,00 × 1,95 м. Створка внутрь.'),
    ('Каменный очаг','Котелок на цепи, вяленая зайчатина.\nТруба над очагом в переднем скате.'),
    ('Стол Никто','Несколько склянок, мешочки, огарок.'),
    ('Общий стол','1,90 × 0,90 м. Две лавки вдоль.'),
    ('Люк в погреб','0,80 × 0,80 м под столом. Кольцо.'),
    ('Топчан Грейс','Арбалет на крюке над топчаном.'),
    ('Топчан Никто','Грубое одеяло, как и у Грейс.'),
    ('Сундук между топчанами','Внутри два кожаных рулона ножей.'),
    ('Угол Арна','Узкий топчан, полка сверху,\nшерстяная занавеска.'),
    ('Лавка и старая бочка','Слева от входа, лавка из полубревна.'),
    ('Поленница','Снаружи у правого торца.'),
]
y=205
for i,(title,body) in enumerate(entries,1):
    badge(d,1070,y+11,i)
    text(d,(1097,y),title,20,bold=True)
    text(d,(1097,y+27),body,18,dim)
    y+=65+(22 if '\n' in body else 0)
text(d,(58,1020),'Оси стен X = ±4,50 и Z = ±3,50 м. Голубой пунктир показывает предметы под другими объектами или над ними.',19,dim)
im.save(out/'04-plan.png',optimize=True)

im=Image.new('RGB',(1540,1020),bg)
d=ImageDraw.Draw(im)
text(d,(55,40),'НОРА · ЧЕТЫРЕ ФАСАДА',36,bold=True)
text(d,(56,92),'Ортогональные виды снаружи • карниз по стене +2,40 м • конёк +4,30 м',20,dim)
s=60
def face(cx, by, name, width, gable, window_map, door=None, chimney=None,
         bench=False, firewood=False):
    def q(a,b):
        return (cx+a*s,by-b*s)
    def box(x1,y1,x2,y2,fill,stroke):
        d.rectangle((q(x1,y2),q(x2,y1)),fill=fill,outline=stroke,width=2)
    def poly(coords,fill,stroke):
        d.polygon([q(*pt) for pt in coords],fill=fill,outline=stroke,width=2)
    text(d,(cx,by-335),name,22,bold=True,anchor='mm')
    hw=width/2
    box(-hw,0,hw,2.4,'#51463b',wall)
    for h in range(1,11):
        segment(d,q(-hw,h*.22),q(hw,h*.22),'#867361')
    for left,right,bottom,top in window_map:
        box(left,bottom,right,top,'#293c3d',blue)
    if door:
        box(door[0],0,door[1],1.95,'#4b382a',amber)
    if gable:
        poly([(-hw,2.4),(0,4.30),(hw,2.4)],'#51463b',wall)
        for k in range(1,8):
            h=2.4+k*.22
            span=hw*(4.3-h)/1.9
            segment(d,q(-span,h),q(span,h),'#867361')
        segment(d,q(-hw-.60,2.075),q(0,4.30),'#81916a',8)
        segment(d,q(0,4.30),q(hw+.60,2.075),'#81916a',8)
    else:
        poly([(-hw-.5,2.075),(-hw-.5,4.3),(hw+.5,4.3),(hw+.5,2.075)],'#515a3f','#86916c')
        for h in (2.44,2.83,3.25,3.64,4.04):
            segment(d,q(-hw-.5,h),q(hw+.5,h),'#6f7b56')
    if chimney:
        x,lo,hi=chimney
        half = .40 if gable else .35
        left, right = x-half, x+half
        if gable:
            # The near roof edge occludes the flue below its local slope.
            y_left = 4.30 - abs(left)*1.90/3.50
            y_right = 4.30 - abs(right)*1.90/3.50
        else:
            y_left = y_right = lo
        poly([(left,y_left),(left,hi),(right,hi),(right,y_right)],'#686960','#bbbab0')
        base = max(y_left,y_right)
        for h in range(1,4):
            y=base+(hi-base)*h/4
            segment(d,q(left,y),q(right,y),'#a3a498')
    if bench:
        box(-2.65,.35,-.95,.45,'#826445',amber)
        box(-2.50,0,-2.36,.35,wood,wall)
        box(-1.27,0,-1.13,.35,wood,wall)
        box(-3.4,0,-2.8,.85,wood,amber)
    if firewood:
        box(-1.60,0,-.10,.90,wood,amber)
        for h in (.22,.44,.66):
            segment(d,q(-1.60,h),q(-.10,h),amber)
    segment(d,q(-hw-.8,0),q(hw+.8,0),dim)
    measurement(d,q(-hw,-.48),q(hw,-.48),f'{width},00 м')
face(400,495,'ФАСАД • со стороны +Z',9,False,
     [(-2.4,-1.2,.95,1.75),(3,3.6,1.05,1.65)],(.9,1.9),(-4.15,3.66,5.15),True)
face(1135,495,'ЗАДНЯЯ СТЕНА • со стороны −Z',9,False,
     [(-3,-2.2,1.1,1.75)],chimney=(4.15,4.30,5.15))
face(400,925,'ЛЕВЫЙ ТОРЕЦ • со стороны −X',7,True,[],
     chimney=(.9,3.78,5.15))
face(1135,925,'ПРАВЫЙ ТОРЕЦ • со стороны +X',7,True,
     [(.9,1.6,1.1,1.7)],chimney=(-.9,4.30,5.15),firewood=True)
text(d,(55,982),'Размеры указаны по осям брёвен. Труба проходит через передний скат, в левой части дома.',18,dim)
im.save(out/'05-elevations.png',optimize=True)

# Local site. X/Z use the same datum as the room plan.
import math
import random

im = Image.new('RGB', (1660, 1180), bg)
d = ImageDraw.Draw(im)
text(d, (55,37), 'НОРА · ПЛАН УЧАСТКА', 36, bold=True)
text(d, (56,88), 'Вид сверху • X вправо, Z вниз • пол дома Y = 0,00 м', 21, dim)
scale = 24
def site(x, z):
    return (505+x*scale, 715+z*scale)
def shape(points, fill, outline=None, width=2):
    d.polygon([site(*point) for point in points], fill=fill, outline=outline, width=width)
def site_line(points, fill, width):
    d.line([site(*point) for point in points], fill=fill, width=width, joint='curve')
def site_box(x1, z1, x2, z2, fill, outline=None):
    d.rectangle((site(x1,z1), site(x2,z2)), fill=fill, outline=outline, width=2)
def disc(x, z, radius, fill, outline=None):
    d.ellipse((site(x-radius,z-radius),site(x+radius,z+radius)),fill=fill,outline=outline,width=2)
def marker(x, z, number):
    badge(d,*site(x,z),number)
def distance_to_route(x, z, route):
    nearest = float('inf')
    for (x0,z0),(x1,z1) in zip(route,route[1:]):
        dx,dz=x1-x0,z1-z0
        t=min(1,max(0,((x-x0)*dx+(z-z0)*dz)/(dx*dx+dz*dz)))
        nearest=min(nearest,math.hypot(x-x0-dx*t,z-z0-dz*t))
    return nearest

bounds=(-18,-23,19,14)
site_box(*bounds,'#30392b','#57604a')
for x in range(-15,20,5):
    site_line([(x,-23),(x,14)],'#3d4735',1)
for z in range(-20,15,5):
    site_line([(-18,z),(19,z)],'#3d4735',1)
clearing=[(-6.5,-4),(-5.2,-6.1),(-2.3,-6.6),(3.6,-5.4),(5.4,-4.4),
          (6.3,-2.8),(6.8,2.9),(5.4,6.6),(2.8,7.8),(-3.5,6.2),(-6.9,3.1)]
shape(clearing,'#494735','#605944')
bank_north=[(-18,-19.9),(-13,-19.5),(-7,-18.8),(-3,-18.15),(2,-18.3),
            (7,-18.05),(11,-18.85),(15,-19.30),(19,-18.85)]
bank_south=[(-18,-17.25),(-13,-16.9),(-7,-16.3),(-3,-15.6),(2,-15.9),
            (7,-15.55),(11,-16.1),(15,-16.75),(19,-16.25)]
shape(bank_north+bank_south[::-1],'#375455','#73999a')
water_line=[((x1+x2)/2,(z1+z2)/2) for (x1,z1),(x2,z2) in zip(bank_north,bank_south)]
site_line(water_line,'#5d8a8b',2)
site_line([(14,-17.9),(16.5,-17.9),(16.1,-18.15)],blue,2)
site_line([(16.5,-17.9),(16.1,-17.65)],blue,2)
for x,z in [(-3.0,-15.95),(-3.28,-16.54),(-2.91,-17.24),(-2.63,-17.85)]:
    disc(x,z,.21,'#858a80','#b8b3a1')

levels=[
    (-6.1,'−0,50'),(-8.3,'−1,00'),(-10.5,'−1,50'),(-13.15,'−2,00')
]
for (z,label_text) in levels:
    ridge=[(-17.7,z+1.3),(-13,z+.35),(-7,z-.3),(-2,z-1.2),
           (3,z-.7),(7,z+.4),(12,z+1.8),(18.8,z+1.2)]
    for a,b in zip(ridge,ridge[1:]):
        dashed(d,site(*a),site(*b),'#7e8066',2)

trail=[(1.42,3.7),(1.48,5.35),(1.35,7.15),(3.60,8.2),(6.75,7.75),
       (8.05,5.5),(8.50,1.5),(8.50,-2.6),(8.15,-5.7),(7.25,-7.15),
       (4.95,-9.0),(2.10,-10.05),(-.20,-11.25),(-2.05,-13.25),(-3.0,-15.45)]
site_line(trail,'#8c7653',19)
site_line(trail,'#b39b72',5)
pad=[(5.7,-14.65),(8.2,-14.85),(10.6,-14.45),(11.3,-12.7),
     (10.8,-10.4),(8.7,-10.2),(6.3,-10.55),(5.55,-12.5)]
shape(pad,'#59513b','#908264')
access=[(4.95,-9),(5.85,-9.8),(6.25,-10.55)]
for a,b in zip(access,access[1:]):
    dashed(d,site(*a),site(*b),'#d1b581',3)

scatter=random.Random(1026)
for _ in range(310):
    x,z=scatter.uniform(-17.5,18.5),scatter.uniform(-22.5,13.5)
    if (-8<x<7.1 and -6.8<z<7.9) or (4.8<x<11.9 and -15.6<z<-9.4):
        continue
    if -20.1<z<-15.1 or distance_to_route(x,z,trail)<.78:
        continue
    rad=scatter.uniform(.25,.67)
    disc(x,z,rad,scatter.choice(['#3b4933','#3a4b34','#354631','#45543b']))
    disc(x,z,.085,'#8e8060')
screen=[(5.0,-10.15),(3.55,-10.7),(3.25,-11.8),(3.8,-12.9),
        (4.6,-13.65),(4.7,-14.6),(5.3,-15.0),(11.15,-15.1),
        (12.0,-13.45),(11.75,-11.3)]
for x,z in screen:
    disc(x,z,.56,'#526140','#6c7955')
    disc(x,z,.11,'#978768')
site_line([(3.65,-12.4),(4.0,-12.75),(4.37,-12.91)],'#a29978',6)
for x,z in [(7,-14),(9.6,-14.2)]:
    disc(x,z,.65,'#425536','#869471')
    disc(x,z,.18,'#8f7556')
site_line([(7,-14),(9.6,-14.2)],amber,6)
for x1,x2 in [(7.35,8.13),(8.72,9.5)]:
    site_box(x1,-13.82,x2,-11.42,None,'#baa47d')
for x,z in [(-.7,10.45),(5.65,9.0),(-4.15,-6.2),(11.6,-6.7)]:
    disc(x,z,.39,'#585c51','#858679')

# Ground footprint and roof. The drying rack is separate from the tethering rail.
site_box(-4.5,-3.5,4.5,3.5,'#596246','#c0aa81')
site_line([(-4.5,0),(4.5,0)],'#a7ad84',2)
site_box(-4.5,.5,-3.8,1.3,'#6d6c61','#b1ad98')
site_line([(.9,3.5),(1.9,3.5)],amber,5)
site_box(4.64,.10,5.14,1.60,wood,amber)
site_line([(-2.7,-5.2),(-.8,-5.2)],amber,4)
for x in (-2.7,-.8):
    disc(x,-5.2,.12,amber)
site_line([(-2.7,-4.9),(-.8,-4.9)],amber,2)
for z, level in levels:
    pos = site(-17.1,z+.93)
    d.rounded_rectangle((pos[0]-6,pos[1]-2,pos[0]+51,pos[1]+18),radius=3,fill='#30392b')
    text(d,pos,level,15,dim)
marker(-.03,.9,1)
marker(6.35,6.9,2)
marker(-6.7,-17.65,3)
marker(10.30,-13.75,4)
marker(4.05,-12.45,5)
marker(-2.05,-5.95,6)
marker(5.56,.89,7)
text(d,site(1.37,4.35),'Вход',17,amber,'mm')

measurement(d,site(-17,12.6),site(-12,12.6),'5 м')
text(d,site(15.5,12.4),'+X  →',19,dim,'mm')
text(d,site(15.5,13.25),'+Z  ↓',19,dim,'mm')
text(d,(1005,148),'Участок и подходы',26,bold=True)
site_entries=[
  ('Дом 9 × 7 м','Небольшая полянка выше ручья.\nНижний венец у уровня земли.'),
  ('Одна узкая тропа','Выходит на поляну со стороны входа,\nогибает склон к одному спуску за водой.'),
  ('Ручей в низине','Неглубокое русло с камнями. Ива ниже\nпо течению, за границей схемы.'),
  ('Коновязь Арна','Обе сосны на одном сухом берегу. Жердь\nна высоте ~1,15 м от площадки. Лошади\nстоят со стороны суши. Контуры в масштабе.'),
  ('Скрытый карман','Подлесок и плечо склона между тропой\nи жердью. Вход с суши, без переправы.'),
  ('Жердь для шкур','Отдельная сушилка за домом.'),
  ('Поленница у правого торца','Подход от ручья проходит сбоку дома.\nЗа поленницей есть укрытие, как в арке.'),
]
y=199
for i,(title,body) in enumerate(site_entries,1):
    badge(d,1021,y+11,i)
    text(d,(1048,y),title,21,bold=True)
    text(d,(1048,y+29),body,19,dim)
    y+=53+body.count('\n')*24
text(d,(1005,865),'Высоты относительно пола',22,bold=True)
text(d,(1005,908),'Тропа спускается по диагонали. Карман у жерди\nпочти ровный, около −2,00 м. За сухой бровкой\nберег опускается к воде до −2,65 м.',19,dim)
text(d,(55,1112),'Пунктиром показаны проектные горизонтали и короткий проход от тропы. Вода течёт слева направо.',20,dim)
im.save(out/'06-site.png',optimize=True)
