shader_type spatial;
render_mode blend_mix, depth_prepass_alpha, cull_disabled;

varying vec3 water_point;

float hash2(vec2 p) {
	return fract(sin(dot(p,vec2(121.7,263.3))) * 43758.5453);
}

float noise2(vec2 p) {
	vec2 cell = floor(p);
	vec2 f = smoothstep(vec2(0.0),vec2(1.0),fract(p));
	return mix(mix(hash2(cell),hash2(cell+vec2(1,0)),f.x),mix(hash2(cell+vec2(0,1)),hash2(cell+vec2(1,1)),f.x),f.y);
}

void vertex() {
	water_point = (MODEL_MATRIX * vec4(VERTEX,1.0)).xyz;
}

void fragment() {
	vec2 p = water_point.xz;
	float t = TIME;
	vec2 drift = p-vec2(t*.26,t*.021);
	float broad = noise2(drift*vec2(2.6,8.5));
	float fine = noise2(drift*vec2(8.2,17.0)+vec2(2.9,t*.13));
	float shift = (broad-.5)*.58;
	float phase = drift.x*10.8 + drift.y*29.0 + shift*10.1;
	float wave = sin(phase) * (.32+.62*fine);
	float other = cos(drift.x*12.4-drift.y*18.2+6.2*broad);
	float streak = pow(max(wave*.64+other*.27,0.0),3.0)*smoothstep(.22,.75,broad);
	float rim = pow(1.0-clamp(abs(dot(normalize(NORMAL),normalize(VIEW))),0.0,1.0),3.6);
	float bank = smoothstep(.0,.43,COLOR.a);
	vec3 deep = vec3(.028,.073,.074);
	vec3 shallows = vec3(.071,.100,.092);
	vec3 daylight = vec3(.183,.277,.299);
	vec3 color = mix(shallows,deep,bank);
	ALBEDO = mix(color,daylight,rim*.72)+streak*vec3(.16,.23,.25);
	NORMAL_MAP = vec3(.5+.036*wave+.016*other, .5+.040*other,1.0);
	NORMAL_MAP_DEPTH = .56;
	ROUGHNESS = .24 + .28*(1.0-rim);
	SPECULAR = .51;
	ALPHA = (.64+.23*rim)*bank;
}
