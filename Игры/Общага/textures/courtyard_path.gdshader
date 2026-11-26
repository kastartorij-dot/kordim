shader_type spatial;
render_mode cull_disabled, depth_draw_never;

uniform bool winter = false;
varying vec2 ground_position;

float grain(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float soft_grain(vec2 p) {
	vec2 cell = floor(p);
	vec2 blend = smoothstep(vec2(0.0), vec2(1.0), fract(p));
	return mix(mix(grain(cell), grain(cell + vec2(1.0, 0.0)), blend.x),
		mix(grain(cell + vec2(0.0, 1.0)), grain(cell + vec2(1.0)), blend.x), blend.y);
}

void vertex() {
	ground_position = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
}

void fragment() {
	float edge_noise = soft_grain(ground_position * 3.2);
	float grit = grain(floor(ground_position * 49.0));
	float distance_to_center = abs(UV.x - 0.5) * 2.0;
	float worn = 1.0 - smoothstep(0.30, 0.97, distance_to_center + (edge_noise - 0.5) * 0.30);
	vec3 packed_snow = mix(vec3(0.67, 0.72, 0.77), vec3(0.83, 0.87, 0.91), edge_noise);
	ALBEDO = (winter ? packed_snow : vec3(0.24, 0.225, 0.20)) * (0.97 + grit * 0.06);
	ALPHA = worn * (winter ? 0.86 : 0.48);
	ROUGHNESS = 0.94;
}
