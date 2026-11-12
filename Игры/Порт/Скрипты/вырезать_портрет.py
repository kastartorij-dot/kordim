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
    key=(m>110)&(r>170)&(b>170)
    near=np.array(Image.fromarray((key*255).astype('uint8')).filter(ImageFilter.MaxFilter(3)))>0
    alpha=np.where(key|(near&(m>40)),0,255).astype('uint8')
    ex=np.clip(m-5,0,None)*0.55
    f=a.copy(); f[...,0]-=ex; f[...,2]-=ex
    f[...,0]*=warm[0]; f[...,1]*=warm[1]; f[...,2]*=warm[2]
    im=Image.fromarray(np.clip(f,0,255).astype('uint8')); im.putalpha(Image.fromarray(alpha))
    bb=im.getbbox(); return im.crop(bb) if bb else im
if __name__=='__main__':
    cut(sys.argv[1]).save(sys.argv[2])
