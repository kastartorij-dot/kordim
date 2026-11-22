shader_type spatial;

uniform vec4 split_wood : source_color = vec4(0.32, 0.26, 0.20, 1.0);
uniform vec4 muted_moss : source_color = vec4(0.31, 0.35, 0.23, 1.0);
varying vec3 roof_point;
varying vec3 roof_normal;
varying vec2 roof_world;

float random_tile(vec2 id) {
	return fract(sin(dot(id, vec2(127.1,311.7))) * 43758.5453);
}

float soft_tiles(vec2 p) {
	vec2 tile = floor(p);
	vec2 t = smoothstep(vec2(0.0), vec2(1.0), fract(p));
	float a = mix(random_tile(tile), random_tile(tile+vec2(1.0,0.0)), t.x);
	float b = mix(random_tile(tile+vec2(0.0,1.0)), random_tile(tile+vec2(1.0,1.0)), t.x);
	return mix(a,b,t.y);
}

void vertex() {
	roof_point = VERTEX;
	roof_normal = NORMAL;
	roof_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
}

void fragment() {
	float pitch = roof_point.z / 0.19;
	float course = floor(pitch);
	float strip = roof_point.x / 0.16 + 0.5 * mod(course, 2.0);
	vec2 cell = fract(vec2(strip,pitch));
	float edge = 1.0-smoothstep(0.045, 0.06+max(fwidth(strip),fwidth(pitch)), min(min(cell.x,1.0-cell.x),cell.y));
	float board = random_tile(vec2(floor(strip),course));
	float patch = 0.68*soft_tiles(roof_world*0.83) + 0.32*soft_tiles(roof_world*2.65);
	float moss = smoothstep(0.34, 0.67, patch + (board-0.5)*0.09) * smoothstep(0.16, 0.90, roof_normal.y);
	float flecks = random_tile(floor(roof_point.xz*72.0));
	vec3 grain = split_wood.rgb * (0.86 + 0.26*board);
	ALBEDO = mix(grain, muted_moss.rgb * (0.92 + 0.14*flecks),moss) * (1.0 - edge * mix(0.47,0.21,moss));
	ROUGHNESS = 0.95;
	SPECULAR = 0.15;
}
