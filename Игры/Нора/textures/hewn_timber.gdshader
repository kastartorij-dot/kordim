shader_type spatial;

uniform sampler2D grain : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D grain_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;

varying vec3 wood_point;
varying vec3 world_point;
varying vec3 face_local;
varying vec3 face_world;
varying float log_seed;

float hash2(vec2 p) {
	return fract(sin(dot(p,vec2(127.1,263.7)))*43758.5453);
}

void vertex() {
	log_seed = hash2(vec2(MODEL_MATRIX[3].x*.86+MODEL_MATRIX[3].z,MODEL_MATRIX[3].y*4.61));
	float t = VERTEX.y+log_seed*2.7;
	float cut = .0073*sin(t*4.9) + .0046*sin(t*10.7+1.2);
	VERTEX.x += cut + NORMAL.x*.0036*sin(t*7.1);
	VERTEX.z += cut*.72 + NORMAL.z*.0036*sin(t*7.1);
	wood_point = VERTEX;
	world_point = (MODEL_MATRIX * vec4(VERTEX,1.0)).xyz;
	face_local = NORMAL;
	face_world = MODEL_NORMAL_MATRIX * NORMAL;
}

void fragment() {
	vec3 face = normalize(face_local);
	vec3 world_face = normalize(face_world);
	vec2 timber_uv = vec2(UV.x*.92 + log_seed*.41,wood_point.y*.81 + log_seed*.95);
	vec3 old_grain = texture(grain,timber_uv).rgb;
	vec2 radial = wood_point.xz+vec2(.018,-.023)*(log_seed-.25);
	float arc = length(radial*vec2(.91,1.14))+.0035*sin(atan(radial.y,radial.x)*3.0);
	float ring = sin(arc*(242.0+67.0*log_seed) + sin(arc*35.0+log_seed*5.0)*.74+2.8*arc*sin(radial.y*74.0));
	float edge_wood = smoothstep(.64,.96,abs(face.y));
	float cuts = sin(wood_point.y*2.7 + log_seed*18.0)*.084;
	float outside = smoothstep(.12,.83,dot(world_face.xz,world_point.xz/vec2(4.5,3.5)));
	float damp = (1.0-smoothstep(.11,1.04,world_point.y))*outside;
	float shelter = clamp(.88+.18*log_seed+cuts,.73,1.19);
	vec3 log_tone = mix(vec3(.99,.81,.59),vec3(.80,.76,.69),outside);
	vec3 end_tone = vec3(.151,.123,.095)*(1.0+ring*.073+log_seed*.20);
	end_tone = mix(end_tone,old_grain*vec3(.73,.66,.54),.37);
	vec3 tone = mix(old_grain*log_tone,end_tone,edge_wood);
	vec3 weather = mix(vec3(1.0),vec3(.60,.67,.55),damp*.68);
	ALBEDO = tone * weather * shelter;
	NORMAL_MAP = mix(texture(grain_normal,timber_uv).rgb,vec3(.5,.5,1),edge_wood);
	NORMAL_MAP_DEPTH = mix(.29,.63,outside);
	ROUGHNESS = .94;
	SPECULAR = .18;
}
