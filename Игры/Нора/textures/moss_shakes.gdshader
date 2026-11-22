shader_type spatial;

uniform sampler2D shake_wood : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D shake_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
varying vec3 roof_point;
varying vec3 roof_normal;
varying vec2 roof_world;

float random_tile(vec2 id) {
	return fract(sin(dot(id,vec2(127.1,311.7))) * 43758.5453);
}

float soft_tiles(vec2 p) {
	vec2 tile = floor(p);
	vec2 t = smoothstep(vec2(0.0),vec2(1.0),fract(p));
	float a = mix(random_tile(tile),random_tile(tile+vec2(1,0)),t.x);
	float b = mix(random_tile(tile+vec2(0,1)),random_tile(tile+vec2(1,1)),t.x);
	return mix(a,b,t.y);
}

void vertex() {
	roof_point = VERTEX;
	roof_normal = NORMAL;
	roof_world = (MODEL_MATRIX * vec4(VERTEX,1.0)).xz;
}

void fragment() {
	vec2 p = roof_point.xz;
	float top = smoothstep(.12,.91,roof_normal.y);
	float long_warp = (soft_tiles(vec2(p.x*1.6,p.y*.84))-.5)*.087;
	float pitch = (p.y+long_warp)/.219;
	float course = floor(pitch);
	float offset = random_tile(vec2(course,3.5));
	float size = .165 + offset*.037;
	float strip = (p.x+offset*.31+.023*sin(p.x*3.18+course*.91))/size;
	vec2 cell = fract(vec2(strip,pitch));
	float quiet = 1.0-smoothstep(.26,.83,max(fwidth(strip),fwidth(pitch)));
	float corner = soft_tiles(p*27.5);
	float side = min(cell.x,1.0-cell.x);
	float sliver = (1.0-smoothstep(.018,.048+fwidth(strip),side))*quiet;
	float lip = (1.0-smoothstep(.019,.093+fwidth(pitch),cell.y))*quiet;
	float board = random_tile(vec2(floor(strip),course));
	vec2 atlas_uv = p/1.48+vec2(.28,.51);
	vec3 old = texture(shake_wood,atlas_uv).rgb;
	float shade = .72+.45*board+.08*corner;
	vec3 wood = old * vec3(.94,.82,.66) * shade;
	float patch = .56*soft_tiles(roof_world*.76)+.32*soft_tiles(roof_world*2.03)+.12*soft_tiles(roof_world*7.30);
	float moss = smoothstep(.41,.73,patch+(board-.5)*.15)*top;
	vec3 verdigris = mix(vec3(.049,.062,.027),vec3(.131,.155,.072),patch) * (1.0+(.21*corner-.11));
	float joint = clamp(sliver*.38+lip*.49,0.0,.77) * (1.0-moss*.48);
	ALBEDO = mix(wood,verdigris,moss) * (1.0-joint*max(.36,top));
	NORMAL_MAP = texture(shake_normal,atlas_uv).rgb;
	NORMAL_MAP_DEPTH = mix(.63,.31,moss);
	ROUGHNESS = .95;
	SPECULAR = .16;
}
