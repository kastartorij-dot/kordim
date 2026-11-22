shader_type spatial;
render_mode cull_disabled;

uniform vec4 dye : source_color = vec4(.44,.30,.22,1.0);
uniform vec4 selvage : source_color = vec4(.23,.11,.066,1.0);
uniform float mend = 0.0;

void fragment() {
	vec2 d = UV;
	float sx = d.x * 126.0;
	float sy = d.y * 216.0;
	float resolution = 1.0-smoothstep(.36,1.1,max(fwidth(sx),fwidth(sy)));
	float wool = .94+.07*cos(sx*6.283)*cos(sy*6.283)*resolution;
	float hem = 1.0-smoothstep(.013,.032,min(d.y,1.0-d.y));
	float sides = 1.0-smoothstep(.015,.035,min(d.x,1.0-d.x));
	float stitching = smoothstep(.60,.86,sin(d.x*189.0)) * (1.0-smoothstep(.003,.009,abs(d.y-.969)));
	vec2 patch_shape = abs((d-vec2(.64,.72)+vec2(.19,-.13)*(d.y-.7))/vec2(.16,.12));
	float patch_edge = max(patch_shape.x,patch_shape.y);
	float repair = (1.0-smoothstep(.98,1.02,patch_edge))*mend;
	float repair_thread = (1.0-smoothstep(.045,.095,abs(patch_edge-.94)))*repair*max(sin((d.x+d.y)*180.0),0.0);
	vec3 base = mix(dye.rgb,dye.rgb*vec3(.82,.86,.92),repair);
	base = mix(base,selvage.rgb,max(hem*.75,sides*.68));
	float dull = .92+.08*sin(d.x*54.9+sin(d.y*11.0))+.07*COLOR.r;
	ALBEDO = (base * wool * dull + (repair_thread*.031+stitching*.033)*vec3(1.0,.82,.63));
	ROUGHNESS = .99;
	SPECULAR = .14;
}
