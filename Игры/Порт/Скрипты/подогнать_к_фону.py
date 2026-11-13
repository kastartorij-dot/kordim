# Подгоняет вырезанный портрет (PNG с прозрачностью) по цвету и свету к фону места,
# чтобы человек и фон выглядели как одна картинка, а люди одного места — одинаково.
# Запуск: python3 Игры/Порт/Скрипты/подогнать_к_фону.py <портрет.png> <фон> <выход.png> [сила=0.6] [свет=left|right|none]
#  1) перенос цвета в Lab: среднее и разброс тона фигуры тянутся к фону (сила 0..1);
#  2) свет сбоку: сторона источника чуть теплее и светлее, другая — темнее и холоднее;
#  3) низ фигуры слегка уходит в тень (фигура «стоит» в комнате, а не светится целиком).
import sys
import numpy as np
from PIL import Image

def srgb2lab(rgb):
    c=rgb/255.0; c=np.where(c>0.04045,((c+0.055)/1.055)**2.4,c/12.92)
    M=np.array([[0.4124,0.3576,0.1805],[0.2126,0.7152,0.0722],[0.0193,0.1192,0.9505]])
    xyz=c@M.T/np.array([0.95047,1.0,1.08883])
    f=np.where(xyz>0.008856,np.cbrt(xyz),7.787*xyz+16/116)
    return np.stack([116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])],-1)

def lab2srgb(lab):
    fy=(lab[...,0]+16)/116; fx=fy+lab[...,1]/500; fz=fy-lab[...,2]/200
    f=np.stack([fx,fy,fz],-1); xyz=np.where(f**3>0.008856,f**3,(f-16/116)/7.787)*np.array([0.95047,1.0,1.08883])
    M=np.array([[3.2406,-1.5372,-0.4986],[-0.9689,1.8758,0.0415],[0.0557,-0.2040,1.0570]])
    c=np.clip(xyz@M.T,0,1); c=np.where(c>0.0031308,1.055*c**(1/2.4)-0.055,12.92*c)
    return np.clip(c*255,0,255)

def fit(fig, bg, strength=0.6, light='left'):
    a=np.array(fig.convert('RGBA')).astype(float); rgb,al=a[...,:3],a[...,3]
    m=al>0
    L=srgb2lab(rgb); B=srgb2lab(np.array(bg.convert('RGB').resize((320,int(320*bg.height/bg.width)))).astype(float)).reshape(-1,3)
    fm,fs=L[m].mean(0),L[m].std(0)+1e-6; bm,bs=B.mean(0),B.std(0)
    # цель: середина между своим и фоновым; яркость тянем слабее, чтобы лицо не тонуло
    w=np.array([0.5,1.0,1.0])*strength
    tm=fm+(bm-fm)*w; ts=fs+(bs-fs)*w*0.5
    out=(L-fm)/fs*ts+tm
    h,wd=al.shape
    if light in('left','right'):
        x=np.linspace(-1,1,wd)[None,:]; x=-x if light=='left' else x   # +1 — сторона света
        out[...,0]+=6*x*strength; out[...,1]+=2*x*strength; out[...,2]+=5*x*strength   # свет теплее, тень холоднее
    y=np.linspace(0,1,h)[:,None]; out[...,0]-=10*np.clip(y-0.55,0,1)*strength
    res=lab2srgb(out); res=np.where(m[...,None],res,rgb)
    im=Image.fromarray(res.astype('uint8')); im.putalpha(Image.fromarray(al.astype('uint8'))); return im

if __name__=='__main__':
    a=sys.argv[1:]
    fit(Image.open(a[0]),Image.open(a[1]),float(a[3]) if len(a)>3 else 0.6,a[4] if len(a)>4 else 'left').save(a[2])
