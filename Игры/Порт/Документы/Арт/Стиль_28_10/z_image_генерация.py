# Пробная генерация Z-Image Turbo через API ComfyUI: python зимаж.py <имя> <ширина> <высота> <зерно> "<текст>"
import json, sys, time, urllib.request, shutil, os

имя, w, h, зерно, текст = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
API = 'http://127.0.0.1:8188'
граф = {
    '28': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'z_image_turbo_int8_convrot.safetensors', 'weight_dtype': 'default'}},
    '30': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_4b.safetensors', 'type': 'lumina2', 'device': 'default'}},
    '29': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'ae.safetensors'}},
    '27': {'class_type': 'CLIPTextEncode', 'inputs': {'text': текст, 'clip': ['30', 0]}},
    '33': {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': ['27', 0]}},
    '13': {'class_type': 'EmptySD3LatentImage', 'inputs': {'width': w, 'height': h, 'batch_size': 1}},
    '11': {'class_type': 'ModelSamplingAuraFlow', 'inputs': {'shift': 3, 'model': ['28', 0]}},
    '3': {'class_type': 'KSampler', 'inputs': {'seed': зерно, 'steps': 8, 'cfg': 1, 'sampler_name': 'res_multistep', 'scheduler': 'simple', 'denoise': 1,
                                            'model': ['11', 0], 'positive': ['27', 0], 'negative': ['33', 0], 'latent_image': ['13', 0]}},
    '8': {'class_type': 'VAEDecode', 'inputs': {'samples': ['3', 0], 'vae': ['29', 0]}},
    '9': {'class_type': 'SaveImage', 'inputs': {'filename_prefix': 'порт_' + имя, 'images': ['8', 0]}},
}
req = urllib.request.Request(API + '/prompt', data=json.dumps({'prompt': граф}).encode(), headers={'Content-Type': 'application/json'})
pid = json.load(urllib.request.urlopen(req))['prompt_id']
t0 = time.time()
while True:
    h_ = json.load(urllib.request.urlopen(f'{API}/history/{pid}'))
    if pid in h_:
        st = h_[pid].get('status', {})
        if st.get('status_str') == 'error':
            print('ОШИБКА', json.dumps(st, ensure_ascii=False)[:1500]); sys.exit(1)
        outs = [im for o in h_[pid]['outputs'].values() for im in o.get('images', [])]
        if outs:
            src = os.path.join('D:/AI/ComfyUI/ComfyUI/output', outs[0].get('subfolder', ''), outs[0]['filename'])
            print(f'готово за {time.time()-t0:.0f} с:', src); break
    time.sleep(2)
