shader_type spatial;

varying vec3 world_point;

float grain(vec3 p) {
	return fract(sin(dot(p,vec3(127.1,311.7,81.4))) * 43758.5453);
}

void vertex() {
	world_point = (MODEL_MATRIX * vec4(VERTEX,1.0)).xyz;
}

void fragment() {
	vec3 slab = vec3(.243,.217,.182) * (.49 + COLOR.rgb*.66);
	float detail = grain(floor(world_point*88.0))-.5;
	float grit = grain(floor(world_point*39.0+vec3(.24,.51,.9)))-.5;
	float wear = sin(world_point.x*9.1+world_point.y*12.3)*sin(world_point.z*19.6-world_point.y*7.1);
	ALBEDO = slab * (.92 + detail*.11 + grit*.084 + wear*.046);
	ROUGHNESS = .93;
	SPECULAR = .17;
}
