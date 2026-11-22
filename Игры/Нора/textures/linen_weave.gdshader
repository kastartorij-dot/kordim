shader_type spatial;
render_mode cull_disabled;

uniform vec4 dye : source_color = vec4(.53,.45,.34,1.0);
uniform vec4 trim : source_color = vec4(.28,.168,.115,1.0);
uniform float lining = 0.0;
varying vec3 cloth_point;

void vertex() {
	cloth_point = VERTEX;
}

void fragment() {
	vec2 span = vec2(cloth_point.x,cloth_point.z);
	float threads = mix(sin(span.x*149.0),sin(span.y*155.0),.51);
	float fade = 1.0-smoothstep(.22,.62,max(fwidth(span.x*24.0),fwidth(span.y*25.0)));
	float weave = .95+threads*.08*fade;
	float seam = max(1.0-smoothstep(.021,.043,UV.x),smoothstep(.955,.981,UV.x));
	ALBEDO = mix(dye.rgb,trim.rgb,seam*lining*.86) * weave * mix(.86,1.13,COLOR.r);
	ROUGHNESS = .98;
	SPECULAR = .15;
}
