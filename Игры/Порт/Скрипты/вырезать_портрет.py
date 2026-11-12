# Запуск: python3 Игры/Порт/Скрипты/вырезать_портрет.py <картинка с пурпурным фоном> <выход.png>
# Даёт PNG с прозрачным фоном, обрезанный по фигуре.
# Вырезка пурпурного фона + снятие пурпурного налёта + лёгкий тёплый сдвиг.
import sys
from PIL import Image, ImageFilter
import numpy as np
def cut(src, warm=(1.07,1.0,0.88)):
    a=np.array(Image.open(src).convert('RGB')).astype(float)
    r,g,b=a[...,0],a[...,1],a[...,2]
    m=np.minimum(r,b)-g
    key=((m>110)&(r>170)&(b>170))|((m>70)&(abs(r-b)<70)&(r>110))
    near=np.array(Image.fromarray((key*255).astype('uint8')).filter(ImageFilter.MaxFilter(3)))>0
    alpha=np.where(key|(near&(m>40)),0,255).astype('uint8')
    ex=np.clip(m-5,0,None)*0.55
    f=a.copy(); f[...,0]-=ex; f[...,2]-=ex
    f[...,0]*=warm[0]; f[...,1]*=warm[1]; f[...,2]*=warm[2]
    # оставить только фигуру: связную область, к которой относится низ кадра по центру
    # (так уходят остатки исходного фона, которые Gemini иногда не закрашивает)
    from collections import deque
    h,w=alpha.shape; k=4
    sm=alpha[::k,::k]>0; sh,sw=sm.shape
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
        keep=np.array(Image.fromarray(seen.astype('uint8')*255).filter(ImageFilter.MaxFilter(3)).resize((w,h),Image.NEAREST))>0
        alpha=np.where(keep,alpha,0).astype('uint8')
    im=Image.fromarray(np.clip(f,0,255).astype('uint8')); im.putalpha(Image.fromarray(alpha))
    bb=im.getbbox(); return im.crop(bb) if bb else im
if __name__=='__main__':
    cut(sys.argv[1]).save(sys.argv[2])
