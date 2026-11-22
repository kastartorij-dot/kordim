shader_type spatial;

// Mesh positions keep the grain attached when a table or bench is moved.
uniform vec4 wood_color : source_color = vec4(0.49, 0.38, 0.26, 1.0);
uniform int long_axis = 0;
uniform float seam_spacing = 0.0;
uniform float grain_strength : hint_range(0.0, 1.0) = 0.23;
uniform float roughness : hint_range(0.3, 1.0) = 0.85;
instance uniform float board_shift = 0.0;

varying vec3 object_position;
varying vec3 object_normal;

void vertex() {
	object_position = VERTEX;
	object_normal = NORMAL;
}

float soft_stripe(float coordinate, float width) {
	float distance_to_line = abs(fract(coordinate + 0.5) - 0.5);
	float filter_width = max(fwidth(coordinate), 0.001);
	float strength = 1.0 - smoothstep(0.22, 0.90, filter_width);
	return (1.0 - smoothstep(width, width + filter_width, distance_to_line)) * strength;
}

void fragment() {
	vec3 n = normalize(object_normal);
	vec3 p = object_position;
	vec3 g = p.xzy;
	vec3 gn = n.xzy;
	if (long_axis == 1) {
		g = p.zxy;
		gn = n.zxy;
	} else if (long_axis == 2) {
		g = p.yxz;
		gn = n.yxz;
	}
	float phase = board_shift * 7.5;
	float cross_floor = mix(g.z, g.y, smoothstep(0.31, 0.78, abs(gn.z)));
	float bent = cross_floor + 0.007 * sin(g.x * 3.1 + cross_floor * 19.0 + phase);
	bent += 0.003 * sin(g.x * 8.0 + cross_floor * 27.0 - phase);
	bent += 0.0011 * sin(g.x * 17.0 + phase * 2.0);

	float lines = soft_stripe(bent * 46.0 + phase, 0.09) * 0.48;
	lines += soft_stripe(bent * 122.0 + phase * 1.62, 0.12) * 0.23;
	float fibres = sin(bent * 193.0 + phase * 2.8) * 0.16;
	fibres *= 1.0 - smoothstep(0.46, 1.2, fwidth(bent * 32.0));
	float face = 0.99 + fibres * grain_strength - lines * grain_strength;

	float end_grain = length(vec2(g.y + 0.023, (g.z - 0.010) * 1.12));
	float rings = soft_stripe(end_grain * 92.0 + sin(g.z * 19.0) * 0.12, 0.14);
	face = mix(face, 0.94 - rings * grain_strength * 0.48, smoothstep(0.62, 0.92, abs(gn.x)));

	float seam = 0.0;
	float board_tone = 0.0;
	if (seam_spacing > 0.001) {
		float course = cross_floor / seam_spacing;
		seam = soft_stripe(course, 0.013 + 0.006 * sin(g.x * 3.8));
		board_tone = sin(floor(course) * 83.51 + phase) * 0.035;
	}
	vec3 tint = wood_color.rgb;
	ALBEDO = tint * (face + board_tone + board_shift * 0.055) * (1.0 - seam * 0.42);
	ROUGHNESS = roughness + seam * (1.0 - roughness) * 0.25;
	SPECULAR = 0.22;
}
