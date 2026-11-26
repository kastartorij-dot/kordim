shader_type spatial;
render_mode cull_disabled, depth_draw_never;

uniform bool winter = false;
varying vec2 ground_position;

float grain(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void vertex() {
	ground_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
}

void fragment() {
	float edge_noise = grain(floor(ground_position * 9.0));
	float grit = grain(floor(ground_position * 49.0));
	float distance_to_center = abs(UV.x - 0.5) * 2.0;
	float worn = 1.0 - smoothstep(0.30, 0.97, distance_to_center + (edge_noise - 0.5) * 0.30);
	vec3 packed_snow = mix(vec3(0.30, 0.31, 0.29), vec3(0.65, 0.69, 0.73), 0.22 + edge_noise * 0.48);
	ALBEDO = (winter ? packed_snow : vec3(0.24, 0.225, 0.20)) * (0.91 + grit * 0.17);
	ALPHA = worn * (winter ? 0.64 : 0.48);
	ROUGHNESS = 0.94;
}
