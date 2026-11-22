shader_type spatial;

uniform vec4 soil_tint : source_color = vec4(0.61, 0.53, 0.40, 1.0);
varying vec2 ground_point;

float scramble(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void vertex() {
	ground_point = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
}

void fragment() {
	vec2 steps = ground_point * 39.0;
	vec2 tile = floor(steps);
	vec2 center = vec2(scramble(tile), scramble(tile.yx+31.0)) * 0.46 + 0.27;
	vec2 around_pebble = (fract(steps)-center)*vec2(1.0,1.65);
	float distance_to_pebble = length(around_pebble);
	float detail_fade = 1.0-smoothstep(0.48,1.2,max(fwidth(steps.x),fwidth(steps.y)));
	float stone = (1.0-smoothstep(.14,.18+fwidth(distance_to_pebble),distance_to_pebble));
	stone *= smoothstep(.55,.93,scramble(tile+39.0)) * detail_fade;
	float grain = (scramble(floor(ground_point*97.0))-.5)*detail_fade;
	float clusters = .92 + .088*sin(ground_point.x*4.7 + ground_point.y*2.7)*sin(ground_point.y*5.9-ground_point.x*1.7);
	vec3 dirt = soil_tint.rgb * COLOR.rgb * (clusters + grain*.15);
	ALBEDO = mix(dirt,dirt*1.75+vec3(.019,.018,.015),stone*.76);
	ROUGHNESS = .93;
	SPECULAR = .18;
}
