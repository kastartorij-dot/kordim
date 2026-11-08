"""Метод 2: своя палитра у каждой картинки + общий размер пикселя.
1) сетка: равномерная, разрезы липнут к краям исходника (как в Pixel Snapper);
2) цвет клетки: среднее по центральной части клетки (края не мешают);
3) палитра: k-means в CIELAB по уменьшенной картинке, N цветов на картинку;
4) единство: цвет палитры, близкий (dE < SNAP) к общей палитре «Свеча и прилив», заменяется общим.
"""
import numpy as np
from PIL import Image
import pixel_snap as ps
import ad

def lab2rgb(lab):
    L,a,b=lab[...,0],lab[...,1],lab[...,2]
    fy=(L+16)/116; fx=fy+a/500; fz=fy-b/200
    f=np.stack([fx,fy,fz],-1)
    xyz=np.where(f**3>0.008856,f**3,(f-16/116)/7.787)*np.array([0.95047,1.0,1.08883])
    M=np.array([[3.2406,-1.5372,-0.4986],[-0.9689,1.8758,0.0415],[0.0557,-0.2040,1.0570]])
    c=xyz@M.T
    c=np.where(c>0.0031308,1.055*np.clip(c,0,None)**(1/2.4)-0.055,12.92*c)
    return np.clip(np.round(c*255),0,255).astype(np.uint8)

def kmeans_lab(X, k, seed=42, iters=25):
    rng=np.random.default_rng(seed)
    C=[X[rng.integers(len(X))]]; d=np.full(len(X),np.inf)
    for _ in range(1,k):
        d=np.minimum(d,((X-C[-1])**2).sum(1)); C.append(X[rng.choice(len(X),p=d/d.sum())])
    C=np.array(C)
    for _ in range(iters):
        lab=((X[:,None]-C[None])**2).sum(2).argmin(1)
        newC=np.array([X[lab==i].mean(0) if (lab==i).any() else C[i] for i in range(k)])
        if np.abs(newC-C).max()<0.05: C=newC; break
        C=newC
    return C

def snap2(path, n_colors=48, short=180, global_pal=None, snap_de=5.0, clean=True):
    rgb=np.asarray(Image.open(path).convert('RGB'))
    h,w=rgb.shape[:2]
    px,py=ps.profiles(rgb)
    ad.SHORT=short; cw,ch=ad.grid_for(w,h)
    cols=ps.snap_uniform(px,w,w/cw,cw+1); rows=ps.snap_uniform(py,h,h/ch,ch+1)
    labimg=ad.rgb2lab(rgb)
    small=np.zeros((len(rows)-1,len(cols)-1,3))
    for yi in range(len(rows)-1):
        y0,y1=rows[yi],rows[yi+1]; m=(y1-y0)//5; ya,yb=y0+m,max(y0+m+1,y1-m)
        for xi in range(len(cols)-1):
            x0,x1=cols[xi],cols[xi+1]; mx=(x1-x0)//5; xa,xb=x0+mx,max(x0+mx+1,x1-mx)
            small[yi,xi]=np.median(labimg[ya:yb,xa:xb].reshape(-1,3),0)
    X=small.reshape(-1,3)
    C=kmeans_lab(X,n_colors)
    if global_pal is not None:
        G=ad.rgb2lab(ad.hex2rgb(global_pal))
        dd=np.sqrt(((C[:,None]-G[None])**2).sum(2)); j=dd.argmin(1)
        near=dd[np.arange(len(C)),j]<snap_de; C[near]=G[j[near]]
    lab=((X[:,None]-C[None])**2).sum(2).argmin(1).reshape(small.shape[:2])
    if clean: lab=ad.clean_orphans(lab, C[:,0])
    pal=lab2rgb(C)
    return Image.fromarray(pal[lab]), lab, pal
