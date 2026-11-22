shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, depth_draw_never, blend_mix;

float hash21(vec2 p) {
	return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}

float haze(vec2 p) {
	vec2 id = floor(p);
	vec2 f = smoothstep(vec2(0.0),vec2(1.0),fract(p));
	return mix(mix(hash21(id),hash21(id+vec2(1,0)),f.x),
		mix(hash21(id+vec2(0,1)),hash21(id+vec2(1,1)),f.x),f.y);
}

void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0],INV_VIEW_MATRIX[1],INV_VIEW_MATRIX[2],MODEL_MATRIX[3]);
}

void fragment() {
	float rim = length((UV-vec2(.50,.51))*vec2(1.99,2.09));
	float wisp = .69*haze(UV*3.9+vec2(TIME*.19,TIME*.32)) + .31*haze(UV*7.5-vec2(TIME*.28,TIME*.11));
	float softened = 1.0-smoothstep(.22,1.0,rim+(wisp-.55)*.53);
	ALBEDO = mix(vec3(.52,.53,.52),vec3(.64,.66,.67),wisp);
	ALPHA = softened * (.095+wisp*.09) * COLOR.a;
}
