shader_type spatial;

uniform sampler2D plank : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D plank_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
varying vec3 board_point;
varying vec3 board_normal;
varying float wear_seed;

void vertex() {
	board_point = VERTEX;
	board_normal = NORMAL;
	wear_seed = fract(sin(dot(MODEL_MATRIX[3].xyz,vec3(125.4,264.1,19.3)))*43758.5453);
}

void fragment() {
	vec3 up = abs(normalize(board_normal));
	float across = mix(board_point.x,board_point.z,smoothstep(.40,.80,up.x));
	vec2 planks = vec2(across*.86+wear_seed*.37,board_point.y*.60+wear_seed*.61);
	vec3 raw = texture(plank,planks).rgb;
	float rim = .82+.18*sin(wear_seed*9.7+board_point.y*.97);
	ALBEDO = raw * vec3(.82,.76,.66) * rim;
	NORMAL_MAP = texture(plank_normal,planks).rgb;
	NORMAL_MAP_DEPTH = .42;
	ROUGHNESS = .93;
	SPECULAR = .16;
}
