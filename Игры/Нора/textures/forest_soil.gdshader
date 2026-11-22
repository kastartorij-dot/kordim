shader_type spatial;

uniform sampler2D leaf_litter : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D leaf_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D trail_soil : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D trail_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;

varying vec2 ground_point;

void vertex() {
	ground_point = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
}

void fragment() {
	vec2 p = ground_point;
	vec2 leaves_uv = p / 1.56;
	vec2 tread_uv = p / 2.30;
	float ragged = sin(p.x*6.78+p.y*9.13)*sin(p.x*3.25-p.y*7.18);
	float tread = smoothstep(.11,.91,clamp(COLOR.r+.105*ragged,0.0,1.0));
	float damp = clamp(COLOR.g,0.0,1.0);
	float moss = smoothstep(.40,.83,COLOR.b) * (1.0-tread);
	vec3 litter = texture(leaf_litter,leaves_uv).rgb;
	vec3 ground = texture(trail_soil,tread_uv).rgb;
	float long_shadow = .84 + .23*cos(p.x*.49+p.y*.37)*cos(p.y*.41-p.x*.23);
	vec3 leaf_tint = mix(vec3(.86,.79,.685),vec3(.51,.70,.42),moss*.61);
	vec3 dirt = mix(litter*leaf_tint,ground*vec3(.76,.71,.62),tread);
	ALBEDO = dirt * long_shadow * mix(1.08,.61,damp*.74);
	NORMAL_MAP = mix(texture(leaf_normal,leaves_uv).rgb,texture(trail_normal,tread_uv).rgb,tread);
	NORMAL_MAP_DEPTH = mix(.68,.31,damp);
	ROUGHNESS = mix(.94,.72,damp);
	SPECULAR = mix(.19,.30,damp);
}
