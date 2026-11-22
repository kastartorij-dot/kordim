shader_type spatial;

uniform vec4 stone_color : source_color = vec4(0.48, 0.46, 0.41, 1.0);
varying vec3 world_point;
varying vec3 world_face;

float hash2(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void vertex() {
	world_point = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_face = MODEL_NORMAL_MATRIX * NORMAL;
}

void fragment() {
	vec3 normal = abs(normalize(world_face));
	vec2 wall = mix(world_point.xy, world_point.zy, smoothstep(0.36, 0.76, normal.x));
	wall = mix(wall, world_point.xz, smoothstep(0.55, 0.83, normal.y));
	float waviness = 0.015 * sin(wall.x*34.0 + wall.y*31.0) + 0.009 * sin(wall.y*87.0);
	float row = wall.y / 0.1715 + 0.25 + waviness;
	float row_id = floor(row);
	float across = wall.x / 0.28 + hash2(vec2(row_id, 1.3)) + waviness;
	vec2 center_distance = min(fract(vec2(across,row)), 1.0-fract(vec2(across,row)));
	vec2 filter_width = max(fwidth(vec2(across,row)), vec2(0.002));
	vec2 joints = 1.0 - smoothstep(vec2(0.040, 0.048), vec2(0.047, 0.061) + filter_width * 1.3, center_distance);
	float mortar = max(joints.x, joints.y) * (1.0-smoothstep(0.18, 0.50, max(filter_width.x,filter_width.y)));
	float grain = hash2(floor(wall * vec2(164.0, 149.0))) - 0.5;
	float block = hash2(vec2(floor(across), row_id));
	ALBEDO = stone_color.rgb * (0.88 + block * 0.24 + grain * 0.085) * (1.0 - mortar * 0.48);
	ROUGHNESS = 0.92;
	SPECULAR = 0.18;
}
