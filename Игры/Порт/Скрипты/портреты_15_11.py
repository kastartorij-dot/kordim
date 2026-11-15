# Повторная подготовка исходников из Источники_Арта/Портреты_15_11.
# python3 Скрипты/портреты_15_11.py [liv kim cleaner servant servant_stand hozyain leya odvin odvin_full]
from pathlib import Path
from PIL import Image, ImageDraw
import importlib.util, sys, tempfile
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('cut',ROOT/'Скрипты/вырезать_портрет.py'); mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
archive=ROOT/'Источники_Арта/Портреты_15_11'; archive.mkdir(exist_ok=True)
items=[
('1794715794572.jpg','liv','Синий_Час/siniy_chas_liv_art.webp',(1.06,1,.96)),
('1794723715532.jpg','kim','Синий_Час/siniy_chas_kim_art.webp',(1.02,1,.98)),
('1794723962433.jpg','cleaner','Синий_Час/siniy_chas_uborshchitsa_art.webp',(1.02,1,.98)),
('1794724114295.jpg','servant','Синий_Час/siniy_chas_sluga_art.webp',(1.03,1,.98)),
('1794724126396.jpg','servant_stand',None,(1.03,1,.98)),
('1794724234326.jpg','hozyain','Лица/port_hozyain_art.webp',(1.08,1,.90)),
('1794724524705.jpg','leya','Лица/port_leya_arden_art.webp',(1.02,1,.98)),
('1794724762470.jpg','odvin','Герой/одвин_art.webp',(1.,1.,1.)),
('1794724924009.jpg','odvin_full',None,(1.,1.,1.)),
]
masks={
 'cleaner': [[(.79,.58),(1,.58),(1,.89),(.81,.89),(.81,.82),(.78,.80),(.766,.74),(.755,.68)]],
 'hozyain': [[(.646,.08),(1,.08),(1,.335),(.646,.335)],[(0,.76),(.13,.76),(.18,.79),(.225,.83),(.275,.88),(.268,.91),(.25,1),(0,1)],[(1,.77),(.87,.77),(.83,.80),(.81,.84),(.787,.865),(.756,.883),(.756,.900),(.766,.930),(.776,.965),(.784,1),(1,1)]]
}
for original,key,dest,warm in items:
 if len(sys.argv)>1 and key not in sys.argv[1:]: continue
 source=archive/(key+'_magenta.jpg')
 im=Image.open(source).convert('RGB');d=ImageDraw.Draw(im)
 for polygon in masks.get(key,[]):d.polygon([(round(x*im.width),round(y*im.height)) for x,y in polygon],fill=(255,0,255))
 with tempfile.TemporaryDirectory(prefix='port-portrait-') as work:
  prepared=Path(work)/(key+'_masked.png'); im.save(prepared)
  out=mod.cut(prepared,warm=warm)
 if out.height>1100:out=out.resize((round(out.width*1100/out.height),1100),Image.Resampling.NEAREST)
 target=ROOT/'Ресурсы'/dest if dest else archive/(key+'_art.webp');target.parent.mkdir(parents=True,exist_ok=True)
 out.save(target,'WEBP',quality=94,method=6)
 print(key,out.size,target.stat().st_size)
