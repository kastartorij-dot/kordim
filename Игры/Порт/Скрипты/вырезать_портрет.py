# Запуск: python3 Игры/Порт/Скрипты/вырезать_портрет.py <картинка с пурпурным фоном> <выход.png> [--top 0.19]
#   --clear x1,y1,x2,y2 — в этом прямоугольнике (доли кадра) убрать остатки фото с пурпурным налётом; можно несколько.
#   --top — срезать всё выше этой доли высоты (если над головой остался приклеенный обрывок).
# Даёт PNG с прозрачным фоном, обрезанный по фигуре.
# Вырезка пурпурного фона + снятие пурпурного налёта + лёгкий тёплый сдвиг.
import sys
from PIL import Image, ImageFilter
import numpy as np
def cut(src, warm=(1.07,1.0,0.88), top=0.0, clear=()):
    a=np.array(Image.open(src).convert('RGB')).astype(float)
    r,g,b=a[...,0],a[...,1],a[...,2]
    m=np.minimum(r,b)-g
    key=((m>110)&(r>170)&(b>170))|((m>70)&(abs(r-b)<70)&(r>110))
    near=np.array(Image.fromarray((key*255).astype('uint8')).filter(ImageFilter.MaxFilter(3)))>0
    alpha=np.where(key|(near&(m>40)),0,255).astype('uint8')
    if top: alpha[:int(alpha.shape[0]*top)]=0
    for x1,y1,x2,y2 in clear:   # прямоугольник (доли кадра), где остался кусок исходного фото с пурпурным налётом
        H_,W_=alpha.shape; sl=(slice(int(y1*H_),int(y2*H_)),slice(int(x1*W_),int(x2*W_)))
        alpha[sl]=np.where(m[sl]>12,0,alpha[sl])   # срезать всё выше доли высоты (обрывки, которые Gemini приклеил над головой)
    ex=np.clip(m-5,0,None)*0.55
    f=a.copy(); f[...,0]-=ex; f[...,2]-=ex
    f[...,0]*=warm[0]; f[...,1]*=warm[1]; f[...,2]*=warm[2]
    # оставить только фигуру: связную область, к которой относится низ кадра по центру
    # (так уходят остатки исходного фона, которые Gemini иногда не закрашивает)
    from collections import deque
    h,w=alpha.shape; k=4
    # клетка считается фигурой, только если непрозрачна целиком: тонкая щель в 1–2 точки
    # (как между головой и оставшимся над ней куском волос) тогда разрывает связь
    hh,ww=(h//k)*k,(w//k)*k
    sm=(alpha[:hh,:ww].reshape(hh//k,k,ww//k,k)>0).all(axis=(1,3)); sh,sw=sm.shape
    seen=np.zeros_like(sm); best=None
    for y in range(sh-1,sh//2,-1):
        xs=np.nonzero(sm[y])[0]
        if len(xs): best=(y,int(xs[np.argmin(abs(xs-sw//2))])); break
    if best:
        q=deque([best]); seen[best]=True
        while q:
            y,x=q.popleft()
            for dy,dx in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
                ny,nx=y+dy,x+dx
                if 0<=ny<sh and 0<=nx<sw and sm[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx]=True; q.append((ny,nx))
        keep=np.array(Image.fromarray(seen.astype('uint8')*255).filter(ImageFilter.MaxFilter(5)).resize((sw*k,sh*k),Image.NEAREST))>0
        keep=np.pad(keep,((0,h-sh*k),(0,w-sw*k)),mode='edge')
        alpha=np.where(keep,alpha,0).astype('uint8')
    im=Image.fromarray(np.clip(f,0,255).astype('uint8')); im.putalpha(Image.fromarray(alpha))
    bb=im.getbbox(); return im.crop(bb) if bb else im
if __name__=='__main__':
    a=sys.argv[1:]; top=0.0; clear=[]
    while '--clear' in a: i=a.index('--clear'); clear.append(tuple(map(float,a[i+1].split(',')))); del a[i:i+2]
    if '--top' in a: i=a.index('--top'); top=float(a[i+1]); del a[i:i+2]
    cut(a[0],top=top,clear=clear).save(a[1])
