shader_type spatial;

uniform sampler2D mineral : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D mineral_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool earthen = false;

varying vec3 point;
varying vec3 outward;

float hash_cell(vec2 p) {
	return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453);
}

void vertex() {
	point = (MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;
	outward = MODEL_NORMAL_MATRIX * NORMAL;
}

void fragment() {
	vec3 n = abs(normalize(outward));
	vec2 p = mix(point.xy,point.zy,smoothstep(.35,.85,n.x));
	if (earthen) {
		p = point.xz;
	}
	vec2 a = p*vec2(1.04,1.19);
	vec3 raw = texture(mineral,a).rgb;
	float row = p.y/.242 + .058*sin(p.x*19.4+p.y*10.7);
	float across = p.x/.395 + hash_cell(vec2(floor(row),1.64)) + .047*sin(p.y*37.3+p.x*21.0);
	vec2 seam = min(fract(vec2(across,row)),1.0-fract(vec2(across,row)));
	float joint = 1.0 - smoothstep(.033,.104,min(seam.x,seam.y));
	float stone = .82 + .26*hash_cell(vec2(floor(across),floor(row)));
	float wet = 1.0-smoothstep(-1.98,-.81,point.y);
	float earthy = texture(mineral,a*.61+vec2(.19,-.43)).r;
	vec3 neutral_stone = mix(vec3(dot(raw,vec3(.24,.57,.19))),raw,.28);
	vec3 tone = earthen ? vec3(.59,.48,.35) : vec3(.87,.85,.80);
	float shade = earthen ? (.91+.28*earthy) : (stone*(1.0-joint*.44)*(1.0-wet*.22));
	ALBEDO = (earthen ? raw : neutral_stone)*tone*shade;
	NORMAL_MAP = texture(mineral_normal,a).rgb;
	NORMAL_MAP_DEPTH = earthen ? .53 : .65;
	ROUGHNESS = .97;
	SPECULAR = .12;
}
