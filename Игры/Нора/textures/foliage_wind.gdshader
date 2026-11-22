shader_type spatial;
render_mode cull_disabled;

uniform bool bough = false;
varying vec3 local_point;

void vertex() {
	local_point = VERTEX;
	vec3 world = MODEL_MATRIX[3].xyz;
	float wave = sin(TIME*1.24 + world.x*.34 + world.z*.22)
		+ .37*sin(TIME*2.97 - world.z*.41 + world.x*.19);
	float tip = clamp(bough ? VERTEX.x : VERTEX.y, 0.0, 1.0);
	VERTEX.x += wave*tip*tip*(bough ? .013 : .064);
	VERTEX.z += wave*tip*tip*.026;
}

void fragment() {
	float backlight = .90 + min(1.0,abs(local_point.y)*3.0)*.12;
	ALBEDO = COLOR.rgb * backlight;
	ROUGHNESS = .94;
	SPECULAR = .12;
}
