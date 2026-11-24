shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_back;

uniform vec3 snow_color : source_color = vec3(0.89, 0.92, 0.96);
uniform float snow_roughness : hint_range(0.0, 1.0) = 0.86;
uniform float normal_threshold : hint_range(0.0, 1.0) = 0.62;
uniform float coverage : hint_range(0.0, 1.0) = 0.92;
uniform float noise_scale = 0.35;
uniform float min_world_x = 6.66;
uniform float normal_offset = 0.006;

varying vec3 v_world_pos;
varying vec3 v_world_normal;

float hash21(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float value_noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
		mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
		f.y
	);
}

void vertex() {
	vec4 wp = MODEL_MATRIX * vec4(VERTEX, 1.0);
	v_world_pos = wp.xyz;
	v_world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
	VERTEX += NORMAL * normal_offset;
}

void fragment() {
	// Исключаем комнату и застеклённую лоджию (x <= 6.66).
	if (v_world_pos.x < min_world_x) {
		discard;
	}
	float up = clamp(v_world_normal.y, 0.0, 1.0);
	float n1 = value_noise(v_world_pos.xz * noise_scale);
	float n2 = value_noise(v_world_pos.xz * noise_scale * 2.7 + vec2(11.3, -7.1));
	float n = n1 * 0.65 + n2 * 0.35;

	float mask = smoothstep(normal_threshold - 0.08, normal_threshold + 0.16, up);
	float patchy = smoothstep(1.0 - coverage - 0.18, 1.0 - coverage + 0.22, n);
	float alpha = clamp(mask * mix(patchy, 1.0, clamp(coverage * 1.15 - 0.15, 0.0, 1.0)) * coverage, 0.0, 1.0);
	if (alpha < 0.03) {
		discard;
	}

	vec3 tint = snow_color * mix(0.94, 1.03, n2);
	ALBEDO = tint;
	ROUGHNESS = clamp(snow_roughness - n2 * 0.08, 0.45, 0.98);
	SPECULAR = 0.28;
	ALPHA = alpha;
}
