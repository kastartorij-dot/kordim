shader_type spatial;

uniform sampler2D pine_bark : source_color, filter_linear_mipmap_anisotropic, repeat_enable;

varying float length_m;

void vertex() {
	length_m = length(MODEL_MATRIX[1].xyz);
}

void fragment() {
	float longitudinal = UV.y*max(.48,length_m/1.48);
	vec2 bark_uv = vec2(UV.x*1.45,longitudinal);
	vec3 cortex = texture(pine_bark,bark_uv).rgb;
	float paleness = .89+.15*sin(UV.x*6.283+longitudinal*.26);
	float split = sin(UV.x*90.0+longitudinal*.31)*(.02+.015*sin(longitudinal*5.1));
	ALBEDO = cortex * vec3(.83,.78,.68) * (paleness+split);
	ROUGHNESS = .94;
	SPECULAR = .18;
}
