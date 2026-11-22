shader_type spatial;
render_mode cull_disabled;

uniform bool bough = false;
uniform bool textured = false;
uniform sampler2D leaf_surface : source_color, filter_linear_mipmap_anisotropic;
uniform float bend : hint_range(0.0, 1.0) = .60;

varying vec3 local_point;

void vertex() {
	local_point = VERTEX;
	vec3 world = MODEL_MATRIX[3].xyz;
	float wave = sin(TIME*1.24 + world.x*.34 + world.z*.22)
		+ .37*sin(TIME*2.97 - world.z*.41 + world.x*.19);
	float tip = clamp(bough ? VERTEX.x : VERTEX.y*1.9,0.0,1.0);
	VERTEX.x += wave*tip*tip*(bough ? .022 : .066)*bend;
	VERTEX.z += wave*tip*tip*.035*bend;
	VERTEX.y += wave*tip*tip*.013*bend;
}

void fragment() {
	vec4 leaf = vec4(1.0);
	if (textured) {
		leaf = texture(leaf_surface,UV);
	}
	float backlight = .92 + min(1.0,abs(local_point.y)*2.2)*.10;
	ALBEDO = leaf.rgb * COLOR.rgb * backlight;
	ROUGHNESS = .92;
	SPECULAR = .13;
	ALPHA = leaf.a;
	ALPHA_SCISSOR_THRESHOLD = .39;
}
