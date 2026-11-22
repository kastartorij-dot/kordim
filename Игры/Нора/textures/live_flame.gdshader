shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, depth_draw_never, blend_mix, fog_disabled;

uniform float strength : hint_range(0.0, 2.0) = 1.0;
uniform float phase = 0.0;

float hash21(vec2 p) {
	return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
}

float value_noise(vec2 p) {
	vec2 cell = floor(p);
	vec2 f = fract(p);
	f = f*f*(3.0-2.0*f);
	float a = mix(hash21(cell),hash21(cell+vec2(1,0)),f.x);
	float b = mix(hash21(cell+vec2(0,1)),hash21(cell+vec2(1,1)),f.x);
	return mix(a,b,f.y);
}

void fragment() {
	float h = 1.0-UV.y;
	float t = TIME + phase;
	float bend = h * (sin(h*9.0-t*5.0)*.13 + sin(h*15.0+t*2.8)*.08);
	float x = abs((UV.x-.5)*2.0 + bend);
	float wind = value_noise(vec2(UV.x*6.6 + h*.8,h*6.5-t*4.0));
	float eddies = value_noise(vec2(UV.x*19.0,h*11.0-t*6.8));
	float profile = pow(max(1.0-h,0.001),.81) * (.65 + .31*wind);
	float edge = profile-x + (wind-.43)*.29*h + (eddies-.5)*.12;
	float shape = smoothstep(-.04,.11,edge) * smoothstep(0.0,.090,h);
	shape *= 1.0-smoothstep(.69,.98,h + (1.0-wind)*.105);
	float core = smoothstep(.05,.37,edge) * (1.0-smoothstep(.21,.65,h));
	float hot = core * mix(.66,1.0,eddies);
	vec3 rim = vec3(.97,.12,.016);
	vec3 middle = vec3(1.0,.38,.034);
	vec3 center = vec3(1.0,.77,.29);
	ALBEDO = mix(mix(rim,middle,smoothstep(.01,.26,edge)),center,hot) * (1.0+.24*hot) * strength;
	ALPHA = clamp(shape * (.71 + hot*.23),0.0,1.0);
}
