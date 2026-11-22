shader_type spatial;

varying vec3 surface_point;

float noise_hash(vec3 p) {
	return fract(sin(dot(p,vec3(127.1,311.7,71.4))) * 43758.5453);
}

void vertex() {
	surface_point = (MODEL_MATRIX * vec4(VERTEX,1.0)).xyz;
}

void fragment() {
	vec3 p = surface_point;
	float debris = noise_hash(floor(p*128.0));
	float shard = noise_hash(floor(p*38.0));
	float crack = abs(sin(p.x*95.0 + p.z*27.0 + 1.25*sin(p.z*44.0)));
	float ember = (1.0-smoothstep(.05,.22,crack)) * smoothstep(.55,.89,shard);
	float pulse = .74 + .21*sin(TIME*3.9 + shard*17.0) + .09*cos(TIME*6.2 + shard*9.0);
	float spread = .30 + .70*max(0.0,NORMAL.y);
	ALBEDO = mix(vec3(.032,.027,.022),vec3(.102,.079,.060),debris*.72);
	EMISSION = vec3(1.65,.32,.025) * ember * pulse * spread;
	ROUGHNESS = .95;
}
