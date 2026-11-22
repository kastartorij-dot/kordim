shader_type spatial;

uniform sampler2D shake_wood : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D shake_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
varying vec2 roof_world;

float random_tile(vec2 cell) {
	return fract(sin(dot(cell,vec2(127.1,311.7))) * 43758.5453);
}

float soft_tiles(vec2 p) {
	vec2 cell = floor(p);
	vec2 t = smoothstep(vec2(0.0),vec2(1.0),fract(p));
	return mix(mix(random_tile(cell),random_tile(cell+vec2(1,0)),t.x),
		mix(random_tile(cell+vec2(0,1)),random_tile(cell+vec2(1,1)),t.x),t.y);
}

void vertex() {
	roof_world = (MODEL_MATRIX * vec4(VERTEX,1.0)).xz;
}

void fragment() {
	float figure = soft_tiles(roof_world*vec2(3.4,2.6));
	float small = soft_tiles(roof_world*29.0);
	float sprigs = soft_tiles(roof_world*87.0);
	float patch = .53*soft_tiles(roof_world*.84)+.33*figure+.14*small;
	float moisture = .04*(1.0-smoothstep(1.45,3.84,abs(roof_world.y)));
	float moss = smoothstep(.39,.64,patch+moisture) * COLOR.g;
	vec3 ancient = texture(shake_wood,UV).rgb * vec3(.82,.74,.62);
	vec3 wood = ancient * (.64+.56*COLOR.r) * mix(.77,1.0,COLOR.b);
	vec3 moss_color = mix(vec3(.060,.073,.027),vec3(.183,.199,.082),clamp(.57*small+.39*sprigs+.22*patch,0.0,1.0));
	ALBEDO = mix(wood,moss_color,moss);
	NORMAL_MAP = texture(shake_normal,UV).rgb;
	NORMAL_MAP_DEPTH = mix(.67,.30,moss);
	ROUGHNESS = .96;
	SPECULAR = .13;
}
