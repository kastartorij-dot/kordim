shader_type spatial;
render_mode blend_mix, depth_prepass_alpha, cull_disabled;

varying vec3 water_point;

void vertex() {
	water_point = (MODEL_MATRIX * vec4(VERTEX,1.0)).xyz;
}

void fragment() {
	vec2 q = water_point.xz;
	float t = TIME;
	float surge = sin(q.x*9.2 + q.y*17.6 - t*2.8);
	float ripple = sin(q.x*13.8 - q.y*28.4 - t*4.4 + .44*sin(q.y*11.0));
	float fleck = (1.0-smoothstep(.026,.113,abs(.61*surge+.39*ripple)));
	fleck *= smoothstep(.49,.94,sin(q.x*5.0+q.y*10.0-t*.9));
	float rim = pow(1.0-clamp(abs(dot(normalize(NORMAL),normalize(VIEW))),0.0,1.0),3.2);
	vec3 pool = mix(vec3(.049,.105,.107),vec3(.248,.375,.397),rim*.76);
	ALBEDO = pool + vec3(.115,.164,.173)*fleck*(.25+.52*rim);
	ROUGHNESS = .20 + .22*(1.0-rim);
	SPECULAR = .43;
	ALPHA = (.66+.20*rim) * smoothstep(0.0,.40,COLOR.a);
}
